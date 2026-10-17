# ==============================================================================
# Ledgio Landing Page v2 — Phase 1 Automated Screenshot Verification Harness
# Usage: powershell -ExecutionPolicy Bypass -File scripts\capture_phase1_screenshots.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"
$port = 8110
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$outDir = Join-Path $baseDir "docs\ui\landing-v2\phase-1"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()
Write-Host "Server listening on http://127.0.0.1:$port/" -ForegroundColor Green

$serverJob = [powershell]::Create().AddScript({
    param($listener, $serverDir)
    while ($listener.IsListening) {
        try {
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
                    ".webp" { "image/webp" }
                    Default { "application/octet-stream" }
                }
                $res.ContentType = $contentType
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $res.StatusCode = 404
            }
            $res.OutputStream.Close()
        } catch {
            break
        }
    }
}).AddArgument($listener).AddArgument($baseDir)

$asyncHandle = $serverJob.BeginInvoke()

# Locate msedge
$edgePaths = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
$edgeExe = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $edgeExe) {
    throw "Microsoft Edge binary not found for automated screenshot capture!"
}

$targets = @(
    @{ Name = "hero_dark_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/index.html?theme=dark" },
    @{ Name = "hero_light_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/index.html?theme=light" },
    @{ Name = "mobile_menu_open_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/index.html?theme=dark&menu=1" },
    @{ Name = "hero_dark_768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:$port/index.html?theme=dark" },
    @{ Name = "hero_light_768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:$port/index.html?theme=light" },
    @{ Name = "hero_dark_1024.png"; Width = 1024; Height = 768; Url = "http://127.0.0.1:$port/index.html?theme=dark" },
    @{ Name = "hero_light_1024.png"; Width = 1024; Height = 768; Url = "http://127.0.0.1:$port/index.html?theme=light" },
    @{ Name = "hero_dark_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/index.html?theme=dark" },
    @{ Name = "hero_light_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/index.html?theme=light" }
)

try {
    foreach ($t in $targets) {
        $outFile = Join-Path $outDir $t.Name
        Write-Host "Capturing $($t.Name) ($($t.Width)x$($t.Height))..." -ForegroundColor Cyan
        
        $procArgs = @(
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--window-size=$($t.Width),$($t.Height)",
            "--virtual-time-budget=2500",
            "--screenshot=`"$outFile`"",
            "`"$($t.Url)`""
        )
        
        $p = Start-Process -FilePath $edgeExe -ArgumentList $procArgs -PassThru -NoNewWindow
        $p.WaitForExit(15000) | Out-Null
        if (-not (Test-Path $outFile)) {
            Write-Warning "Failed to capture $($t.Name)"
        } else {
            $sz = (Get-Item $outFile).Length
            Write-Host "  -> Saved: $outFile ($sz bytes)" -ForegroundColor Green
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
    $serverJob.Dispose()
    Write-Host "Phase 1 screenshots capture completed!" -ForegroundColor Green
}
