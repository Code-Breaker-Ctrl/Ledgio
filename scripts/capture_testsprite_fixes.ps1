param(
    [string]$Fix = "3"
)

$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }
$outDir = Join-Path $baseDir "docs\ui\testsprite"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$port = 8125
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
try {
    $listener.Start()
} catch {
    $port = 8126
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Start()
}

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
                $res.ContentType = switch ($ext) {
                    ".html" { "text/html; charset=utf-8" }
                    ".js"   { "application/javascript; charset=utf-8" }
                    ".css"  { "text/css; charset=utf-8" }
                    ".json" { "application/json; charset=utf-8" }
                    ".png"  { "image/png" }
                    Default { "application/octet-stream" }
                }
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $res.StatusCode = 404
            }
            $res.OutputStream.Close()
        } catch { break }
    }
}).AddArgument($listener).AddArgument($baseDir)
$asyncHandle = $serverJob.BeginInvoke()

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$userData = "C:\Users\stand\AppData\Local\Temp\edge_testsprite_" + [System.Guid]::NewGuid().ToString("N")

try {
    function CaptureUrl($url, $w, $h, $outFile, $delayMs=3500) {
        Write-Host "Capturing $outFile ($w x $h)..." -ForegroundColor Cyan
        $args = @(
            "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--window-size=$w,$h",
            "--virtual-time-budget=$delayMs",
            "--user-data-dir=$userData",
            "--no-first-run", "--no-default-browser-check",
            "--screenshot=$outFile",
            "$url"
        )
        $p = Start-Process -FilePath $edgePath -ArgumentList $args -PassThru -NoNewWindow
        $p.WaitForExit(15000) | Out-Null
        if (Test-Path $outFile) {
            $len = (Get-Item $outFile).Length
            Write-Host "  -> Saved: $outFile ($len bytes)" -ForegroundColor Green
        } else {
            Write-Warning "Failed: $outFile"
        }
    }

    if ($Fix -eq "1") {
        CaptureUrl "http://127.0.0.1:$port/index.html" 1440 900 (Join-Path $outDir "fix1_landing_desktop_1440.png") 3500
        CaptureUrl "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=landing&section=scene1_start&width=390&height=844" 390 844 (Join-Path $outDir "fix1_landing_mobile_390.png") 3500
    }
    if ($Fix -eq "2") {
        CaptureUrl "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=dashboard&section=dashboard&width=1440&height=900" 1440 900 (Join-Path $outDir "fix2_dashboard_desktop_1440.png") 3500
        CaptureUrl "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=dashboard&section=dashboard&width=390&height=844" 390 844 (Join-Path $outDir "fix2_dashboard_mobile_390.png") 3500
    }
    if ($Fix -eq "3") {
        CaptureUrl "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=dashboard&section=income&width=1440&height=900" 1440 900 (Join-Path $outDir "fix3_income_desktop_1440.png") 3500
        CaptureUrl "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=dashboard&section=income&width=390&height=844" 390 844 (Join-Path $outDir "fix3_income_mobile_390.png") 3500
    }
} finally {
    $listener.Stop()
    $listener.Close()
    if (Test-Path $userData) { Remove-Item -Recurse -Force $userData -ErrorAction SilentlyContinue }
}
