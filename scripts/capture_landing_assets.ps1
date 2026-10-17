$ErrorActionPreference = "Stop"
$port = 8108
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$outWebpDir = Join-Path $baseDir "assets\img\landing"
if (-not (Test-Path $outWebpDir)) {
    New-Item -ItemType Directory -Path $outWebpDir -Force | Out-Null
}

$rawPngDir = Join-Path $baseDir "docs\ui\landing-v2\raw_png"
if (-not (Test-Path $rawPngDir)) {
    New-Item -ItemType Directory -Path $rawPngDir -Force | Out-Null
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()
Write-Host "Server started on http://127.0.0.1:$port/ for landing assets capture" -ForegroundColor Green

$serverJob = [powershell]::Create().AddScript({
    param($listener, $serverDir, $outWebpDir)
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
            $req = $context.Request
            $res = $context.Response

            if ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/save-webp") {
                $fileName = $req.QueryString["file"]
                if (-not [string]::IsNullOrWhiteSpace($fileName)) {
                    $targetPath = Join-Path $outWebpDir $fileName
                    $fs = [System.IO.File]::Create($targetPath)
                    $req.InputStream.CopyTo($fs)
                    $fs.Close()
                    $res.StatusCode = 200
                    $msg = [System.Text.Encoding]::UTF8.GetBytes("Saved $fileName")
                    $res.OutputStream.Write($msg, 0, $msg.Length)
                } else {
                    $res.StatusCode = 400
                }
                $res.OutputStream.Close()
                continue
            }

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
                $msg = [System.Text.Encoding]::UTF8.GetBytes("Not found: $rawPath")
                $res.ContentLength64 = $msg.Length
                $res.OutputStream.Write($msg, 0, $msg.Length)
            }
            $res.OutputStream.Close()
        } catch {
            if (-not $listener.IsListening) { break }
        }
    }
}).AddArgument($listener).AddArgument($baseDir).AddArgument($outWebpDir)
$asyncHandle = $serverJob.BeginInvoke()

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$userDataDir = "C:\Users\stand\AppData\Local\Temp\edge_screenshot_userData_landing_assets"

$tasks = @(
    @{ Name = "screen_dashboard_dark"; Screen = "dashboard"; Theme = "dark"; Width = 390; Height = 844 },
    @{ Name = "screen_dashboard_light"; Screen = "dashboard"; Theme = "light"; Width = 390; Height = 844 },
    @{ Name = "screen_stat_cards_percent"; Screen = "stat-cards"; Theme = "dark"; Width = 390; Height = 480 },
    @{ Name = "screen_budgets"; Screen = "budgets"; Theme = "dark"; Width = 390; Height = 844 },
    @{ Name = "screen_goals"; Screen = "goals"; Theme = "dark"; Width = 390; Height = 844 },
    @{ Name = "screen_loans_list"; Screen = "loans"; Theme = "dark"; Width = 390; Height = 844 },
    @{ Name = "screen_reports"; Screen = "reports"; Theme = "dark"; Width = 390; Height = 844 },
    @{ Name = "screen_loan_modal"; Screen = "loan-modal"; Theme = "dark"; Width = 390; Height = 844 },
    @{ Name = "screen_categories"; Screen = "categories"; Theme = "dark"; Width = 390; Height = 844 }
)

try {
    foreach ($t in $tasks) {
        if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue }
        $pngPath = Join-Path $rawPngDir "$($t.Name).png"
        $webpPath = Join-Path $outWebpDir "$($t.Name).webp"
        if (Test-Path $pngPath) { Remove-Item $pngPath -Force }
        if (Test-Path $webpPath) { Remove-Item $webpPath -Force }

        $w = $t.Width
        $h = $t.Height
        $s = $t.Screen
        $th = $t.Theme
        Write-Host "Capturing $($t.Name) (${s}, ${th}) at ${w}x${h} @2x..." -ForegroundColor Yellow

        # 1. Capture 2x Retina PNG via Edge Headless
        $edgeArgs = @(
            "--headless=new",
            "--disable-gpu",
            "--force-device-scale-factor=2",
            "--window-size=$w,$h",
            "--virtual-time-budget=6000",
            "--screenshot=$pngPath",
            "--user-data-dir=$userDataDir",
            "--no-first-run",
            "--no-default-browser-check",
            "http://127.0.0.1:$port/tests/screenshot_landing_assets.html?screen=$s&theme=$th&width=$w&height=$h"
        )

        $proc = Start-Process -FilePath $edgePath -ArgumentList $edgeArgs -PassThru -NoNewWindow
        $proc.WaitForExit(15000)

        if (-not (Test-Path $pngPath)) {
            Write-Host "  -> PNG capture failed: $pngPath" -ForegroundColor Red
            continue
        }

        $pngBytes = (Get-Item $pngPath).Length
        Write-Host "  -> PNG captured: $pngBytes bytes. Converting to WebP..." -ForegroundColor Cyan

        # 2. Convert to WebP via HTML5 Canvas in headless Edge
        $relPng = "/docs/ui/landing-v2/raw_png/$($t.Name).png"
        $convUrl = "http://127.0.0.1:$port/tests/convert_to_webp.html?src=$relPng&name=$($t.Name).webp"
        $convArgs = @(
            "--headless=new",
            "--disable-gpu",
            "--virtual-time-budget=4000",
            "--user-data-dir=$userDataDir",
            "--no-first-run",
            "--no-default-browser-check",
            $convUrl
        )

        $convProc = Start-Process -FilePath $edgePath -ArgumentList $convArgs -PassThru -NoNewWindow
        $convProc.WaitForExit(10000)

        # Wait briefly for POST /save-webp to finish writing
        $waited = 0
        while (-not (Test-Path $webpPath) -and $waited -lt 10) {
            Start-Sleep -Milliseconds 250
            $waited++
        }

        if (Test-Path $webpPath) {
            $webpBytes = (Get-Item $webpPath).Length
            $kb = [Math]::Round($webpBytes / 1024, 1)
            Write-Host "  -> SUCCESS: $($t.Name).webp (${kb} KB)" -ForegroundColor Green
        } else {
            Write-Host "  -> WebP conversion failed: $($t.Name).webp" -ForegroundColor Red
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
    $serverJob.Dispose()
    if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue }
}

Write-Host "`nAll landing assets captured and converted in $outWebpDir" -ForegroundColor Cyan
Get-ChildItem $outWebpDir -Filter *.webp | Select-Object Name, Length, @{Name="KB"; Expression={[Math]::Round($_.Length / 1024, 1)}} | Format-Table -AutoSize
