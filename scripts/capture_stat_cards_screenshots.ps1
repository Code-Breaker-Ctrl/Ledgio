# ==============================================================================
# Ledgio — Stat Cards Tap-to-Toggle Screenshot Capture
# ==============================================================================

$ErrorActionPreference = "Stop"

$port = 8095
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$artifactDir = "C:\Users\stand\.gemini\antigravity\brain\12bece44-a523-42b8-8e86-61c4988f01d6"

# 1. Start HTTP server in background job
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()
Write-Host "Local HTTP Server running on http://127.0.0.1:$port/" -ForegroundColor Green

$serverJob = [powershell]::Create().AddScript({
    param($listener, $serverDir)
    try {
        while ($listener.IsListening) {
            $context = $listener.GetContext()
            $req = $context.Request
            $res = $context.Response
            
            $rawPath = $req.Url.LocalPath.TrimStart('/')
            if ([string]::IsNullOrWhiteSpace($rawPath)) { $rawPath = "index.html" }
            $filePath = [System.IO.Path]::GetFullPath((Join-Path $serverDir $rawPath))
            
            if ($filePath.StartsWith($serverDir, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $filePath -PathType Leaf)) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = switch ($ext) {
                    ".html" { "text/html; charset=utf-8" }
                    ".js"   { "application/javascript; charset=utf-8" }
                    ".css"  { "text/css; charset=utf-8" }
                    ".json" { "application/json; charset=utf-8" }
                    ".png"  { "image/png" }
                    ".jpg"  { "image/jpeg" }
                    ".svg"  { "image/svg+xml" }
                    Default { "application/octet-stream" }
                }
                $res.ContentType = $contentType
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $res.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes("Not found: $rawPath")
                $res.ContentLength64 = $msg.Length
                $res.OutputStream.Write($msg, 0, $msg.Length)
            }
            $res.OutputStream.Close()
        }
    } catch {}
}).AddArgument($listener).AddArgument($baseDir)

$asyncHandle = $serverJob.BeginInvoke()

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$userDataDir = "C:\Users\stand\AppData\Local\Temp\edge_screenshot_userData_stat_cards"

$targets = @(
    @{ Name = "stat_cards_desktop_dark.png"; Width = 800; Height = 480; Query = "?mode=desktop-dark&view=percent&tap5x=true" },
    @{ Name = "stat_cards_desktop_dark_toggled.png"; Width = 800; Height = 480; Query = "?mode=desktop-dark&view=rupee" },
    @{ Name = "stat_cards_desktop_light.png"; Width = 800; Height = 480; Query = "?mode=desktop-light&view=percent" },
    @{ Name = "stat_cards_mobile_dark.png"; Width = 414; Height = 640; Query = "?mode=mobile-dark&view=percent&tap5x=true" },
    @{ Name = "stat_cards_mobile_dark_toggled.png"; Width = 414; Height = 640; Query = "?mode=mobile-dark&view=rupee" },
    @{ Name = "stat_cards_mobile_light.png"; Width = 414; Height = 640; Query = "?mode=mobile-light&view=percent" }
)

try {
    foreach ($t in $targets) {
        if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue }
        $outPath = Join-Path $artifactDir $t.Name
        if (Test-Path $outPath) { Remove-Item $outPath -Force }

        $w = $t.Width
        $h = $t.Height
        $q = $t.Query
        Write-Host "Capturing $($t.Name) at ${w}x${h}..." -ForegroundColor Yellow

        $edgeArgs = @(
            "--headless=new",
            "--disable-gpu",
            "--window-size=$w,$h",
            "--virtual-time-budget=5000",
            "--screenshot=$outPath",
            "--user-data-dir=$userDataDir",
            "--no-first-run",
            "--no-default-browser-check",
            "http://127.0.0.1:$port/tests/screenshot_stat_cards.html$q"
        )

        $proc = Start-Process -FilePath $edgePath -ArgumentList $edgeArgs -PassThru -NoNewWindow
        $proc.WaitForExit(15000)

        if (Test-Path $outPath) {
            Write-Host "  -> Successfully captured $outPath ($((Get-Item $outPath).Length) bytes)" -ForegroundColor Green
        } else {
            Write-Host "  -> Failed to capture $($t.Name)" -ForegroundColor Red
        }
    }
} finally {
    $listener.Stop()
    $serverJob.Dispose()
    Write-Host "`nCapture run completed." -ForegroundColor Cyan
}
