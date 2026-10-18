# ==============================================================================
# Ledgio Landing Page v2 — Real Empirical Performance Measurement Harness
# Measures: LCP (ms), CLS (score), Total Transfer Size (KB) & Resource Breakdown
# Usage: powershell -ExecutionPolicy Bypass -File scripts\measure_performance.ps1
# ==============================================================================

param(
    [string]$Phase = "phase-2"
)

$ErrorActionPreference = "Stop"
$port = 8114
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$outJson = Join-Path $baseDir "docs\ui\landing-v2\$Phase-perf.json"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()
Write-Host "Performance server listening on http://127.0.0.1:$port/" -ForegroundColor Green

$serverJob = [powershell]::Create().AddScript({
    param($listener, $serverDir, $outJson)
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
            $req = $context.Request
            $res = $context.Response

            if ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/save-perf") {
                $sr = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
                $body = $sr.ReadToEnd()
                $sr.Close()
                [System.IO.File]::WriteAllText($outJson, $body, [System.Text.Encoding]::UTF8)
                $res.StatusCode = 200
                $msg = [System.Text.Encoding]::UTF8.GetBytes("Performance data saved")
                $res.OutputStream.Write($msg, 0, $msg.Length)
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
            }
            $res.OutputStream.Close()
        } catch {
            break
        }
    }
}).AddArgument($listener).AddArgument($baseDir).AddArgument($outJson)

$asyncHandle = $serverJob.BeginInvoke()

# Locate msedge
$edgePaths = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
$edgeExe = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $edgeExe) {
    throw "Microsoft Edge binary not found!"
}

$userDataDir = "C:\Users\stand\AppData\Local\Temp\edge_perf_measurement_userData"
if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue }
if (Test-Path $outJson) { Remove-Item $outJson -Force }

Write-Host "Running Headless Chromium with Mobile Emulation (375x812)..." -ForegroundColor Cyan

$procArgs = @(
    "--headless=new",
    "--disable-gpu",
    "--window-size=375,812",
    "--user-data-dir=$userDataDir",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-agent=`"Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1`"",
    "http://127.0.0.1:$port/index.html?measure_perf=1"
)

try {
    $proc = Start-Process -FilePath $edgeExe -ArgumentList $procArgs -PassThru -NoNewWindow
    
    # Wait for the save-perf endpoint to write file (up to 15 seconds)
    $timeout = 15
    $elapsed = 0
    while (-not (Test-Path $outJson) -and $elapsed -lt $timeout) {
        Start-Sleep -Milliseconds 500
        $elapsed += 0.5
    }

    if ($proc -and -not $proc.HasExited) {
        $proc.Kill()
    }

    if (Test-Path $outJson) {
        $jsonContent = Get-Content $outJson -Raw
        Write-Host "`n================ REAL MEASURED PERFORMANCE ================" -ForegroundColor Green
        Write-Host $jsonContent -ForegroundColor White
        Write-Host "==========================================================`n" -ForegroundColor Green
    } else {
        Write-Error "Failed to receive performance metrics within timeout!"
    }
} finally {
    $listener.Stop()
    $listener.Close()
    $serverJob.Dispose()
    if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue }
}
