# ==============================================================================
# Ledgio Landing Page v2 — Real Horizontal Overflow Check Harness
# Tests: 360, 375, 390, 412, 768, 1024, 1440
# Usage: powershell -ExecutionPolicy Bypass -File scripts\check_overflow.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"
$port = 8118
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()

$sharedReport = [hashtable]::Synchronized(@{ LastResult = $null; Ready = $false })

$serverJob = [powershell]::Create().AddScript({
    param($listener, $serverDir, $reportState)
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
            $req = $context.Request
            $res = $context.Response

            if ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/report-overflow") {
                $sr = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
                $body = $sr.ReadToEnd()
                $sr.Close()
                $reportState.LastResult = $body
                $reportState.Ready = $true
                $res.StatusCode = 200
                $msg = [System.Text.Encoding]::UTF8.GetBytes("Report received")
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
}).AddArgument($listener).AddArgument($baseDir).AddArgument($sharedReport)

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

$userDataDir = "C:\Users\stand\AppData\Local\Temp\edge_overflow_check_userData"
$allPassed = $true

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  REAL HORIZONTAL OVERFLOW VERIFICATION (360px - 1440px)    " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

try {
    if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue }

    $procArgs = @(
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=1600,1000",
        "--user-data-dir=$userDataDir",
        "--no-first-run",
        "--no-default-browser-check",
        "http://127.0.0.1:$port/tests/check_overflow.html"
    )

    $proc = Start-Process -FilePath $edgeExe -ArgumentList $procArgs -PassThru -NoNewWindow
    
    $timeout = 25
    $elapsed = 0
    while (-not $sharedReport.Ready -and $elapsed -lt $timeout) {
        Start-Sleep -Milliseconds 500
        $elapsed += 0.5
    }

    if ($proc -and -not $proc.HasExited) {
        $proc.Kill()
    }

    if ($sharedReport.Ready -and $sharedReport.LastResult) {
        $results = $sharedReport.LastResult | ConvertFrom-Json
        foreach ($data in $results) {
            $w = $data.targetWidth
            $scrollW = $data.scrollWidth
            $innerW = $data.viewportWidth
            $overflowElements = $data.overflowingElements

            if ($data.hasOverflow) {
                $allPassed = $false
                Write-Host "  [FAIL] Width: ${w}px -> innerWidth: ${innerW}px, scrollWidth: ${scrollW}px (OVERFLOW DETECTED)" -ForegroundColor Red
                if ($overflowElements) {
                    foreach ($el in $overflowElements) {
                        Write-Host "         Element: <$($el.tag)> id='$($el.id)' class='$($el.className)' right=$($el.right)px (+$(($el.overflowPx))px)" -ForegroundColor Yellow
                    }
                }
            } else {
                Write-Host "  [PASS] Width: ${w}px -> innerWidth: ${innerW}px, scrollWidth: ${scrollW}px (zero overflow, 0 elements exceeding)" -ForegroundColor Green
            }
        }
    } else {
        $allPassed = $false
        Write-Host "  [FAIL] Did not receive measurement report from browser within $timeout seconds!" -ForegroundColor Red
    }
} finally {
    $listener.Stop()
    $listener.Close()
    $serverJob.Dispose()
    if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue }
}

Write-Host "============================================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "  >>> OVERFLOW AUDIT VERIFIED: ALL 7 VIEWPORTS PASS (0 OVERFLOW) <<<`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "  >>> OVERFLOW AUDIT FAILED: OVERFLOW DETECTED ON ONE OR MORE VIEWPORTS <<<`n" -ForegroundColor Red
    exit 1
}
