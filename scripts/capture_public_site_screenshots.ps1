$ErrorActionPreference = "Stop"
$port = 8105
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$outDir = Join-Path $baseDir "docs\ui\public-site"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$artifactDir = "C:\Users\stand\.gemini\antigravity\brain\3da55abb-6c31-42f5-964b-0f216dcbc73f"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()
Write-Host "Server started on http://127.0.0.1:$port/ for public site capture" -ForegroundColor Green

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
        } catch {
            if (-not $listener.IsListening) { break }
        }
    }
}).AddArgument($listener).AddArgument($baseDir)
$asyncHandle = $serverJob.BeginInvoke()

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$userDataDir = "C:\Users\stand\AppData\Local\Temp\edge_screenshot_userData_public_site"

$pages = @("index.html", "login.html", "signup.html", "terms.html", "privacy.html", "reset-password.html")
$tasks = @()

foreach ($pg in $pages) {
    $slug = [System.IO.Path]::GetFileNameWithoutExtension($pg).Replace('-', '_')
    # Desktop 1440x900 (Dark & Light)
    $tasks += @{ Name = "${slug}_dark_1440"; Page = $pg; Width = 1440; Height = 900; Theme = "dark"; Extra = "" }
    $tasks += @{ Name = "${slug}_light_1440"; Page = $pg; Width = 1440; Height = 900; Theme = "light"; Extra = "" }
    # Mobile 375x812 (Dark & Light)
    $tasks += @{ Name = "${slug}_dark_375"; Page = $pg; Width = 375; Height = 812; Theme = "dark"; Extra = "" }
    $tasks += @{ Name = "${slug}_light_375"; Page = $pg; Width = 375; Height = 812; Theme = "light"; Extra = "" }
}

# Bonus contextual screenshots
$tasks += @{ Name = "login_forgot_dark_375"; Page = "login.html"; Width = 375; Height = 812; Theme = "dark"; Extra = "&forgot=1" }
$tasks += @{ Name = "login_forgot_dark_1440"; Page = "login.html"; Width = 1440; Height = 900; Theme = "dark"; Extra = "&forgot=1" }
$tasks += @{ Name = "index_menu_dark_375"; Page = "index.html"; Width = 375; Height = 812; Theme = "dark"; Extra = "&menu=1" }

try {
    foreach ($t in $tasks) {
        if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue }
        $outPath = Join-Path $outDir "$($t.Name).png"
        if (Test-Path $outPath) { Remove-Item $outPath -Force }

        $w = $t.Width
        $h = $t.Height
        $th = $t.Theme
        $pg = $t.Page
        $extra = $t.Extra
        Write-Host "Capturing $($t.Name) (${pg}, ${th}) at ${w}x${h}..." -ForegroundColor Yellow

        $edgeArgs = @(
            "--headless=new",
            "--disable-gpu",
            "--window-size=$w,$h",
            "--virtual-time-budget=6000",
            "--screenshot=$outPath",
            "--user-data-dir=$userDataDir",
            "--no-first-run",
            "--no-default-browser-check",
            "http://127.0.0.1:$port/tests/screenshot_public_site.html?page=$pg&theme=$th&width=$w&height=$h$extra"
        )

        $proc = Start-Process -FilePath $edgePath -ArgumentList $edgeArgs -PassThru -NoNewWindow
        $proc.WaitForExit(15000)

        if (Test-Path $outPath) {
            $bytes = (Get-Item $outPath).Length
            Write-Host "  -> OK: $($t.Name).png ($bytes bytes)" -ForegroundColor Green
            if (Test-Path $artifactDir) {
                Copy-Item -Path $outPath -Destination (Join-Path $artifactDir "$($t.Name).png") -Force
            }
        } else {
            Write-Host "  -> FAILED: $($t.Name).png" -ForegroundColor Red
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
    $serverJob.Dispose()
    if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue }
}

Write-Host "`nAll public site captures completed in $outDir" -ForegroundColor Cyan
