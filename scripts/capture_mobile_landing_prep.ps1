# ==============================================================================
# Ledgio — Mobile Landing Preparation: Step 0 Reference & Desktop Baseline Capture
# ==============================================================================

$ErrorActionPreference = "Stop"
$port = 8119
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$refDir = Join-Path $baseDir "docs\ui\mobile-landing\reference"
$beforeDir = Join-Path $baseDir "docs\ui\mobile-landing\before"
$afterDir = Join-Path $baseDir "docs\ui\mobile-landing\after"

New-Item -ItemType Directory -Path $refDir -Force | Out-Null
New-Item -ItemType Directory -Path $beforeDir -Force | Out-Null
New-Item -ItemType Directory -Path $afterDir -Force | Out-Null

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

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$userDataDir = "C:\Users\stand\AppData\Local\Temp\edge_mobile_landing_prep_userData"

$targets = @(
    # Step 0: Real Mobile App References (390px)
    @{
        OutFile = Join-Path $refDir "real_app_dashboard_390.png"
        Width = 390
        Height = 844
        Url = "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=dashboard&section=top&width=390&height=844"
    },
    @{
        OutFile = Join-Path $refDir "real_app_loans_390.png"
        Width = 390
        Height = 844
        Url = "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=dashboard&section=loans&width=390&height=844"
    },
    @{
        OutFile = Join-Path $refDir "real_app_goals_390.png"
        Width = 390
        Height = 844
        Url = "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=dashboard&section=goals&width=390&height=844"
    },

    # Desktop Parity Before Baselines (1024px & 1440px)
    @{
        OutFile = Join-Path $beforeDir "landing_desktop_1024.png"
        Width = 1024
        Height = 768
        Url = "http://127.0.0.1:$port/index.html"
    },
    @{
        OutFile = Join-Path $beforeDir "landing_desktop_1440.png"
        Width = 1440
        Height = 900
        Url = "http://127.0.0.1:$port/index.html"
    }
)

try {
    foreach ($t in $targets) {
        Write-Host "Capturing $($t.OutFile)..." -ForegroundColor Cyan
        $args = @(
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--window-size=$($t.Width),$($t.Height)",
            "--virtual-time-budget=3500",
            "--user-data-dir=$userDataDir",
            "--no-first-run",
            "--no-default-browser-check",
            "--screenshot=`"$($t.OutFile)`"",
            "`"$($t.Url)`""
        )
        $p = Start-Process -FilePath $edgePath -ArgumentList $args -PassThru -NoNewWindow
        $p.WaitForExit(15000) | Out-Null
        if (Test-Path $t.OutFile) {
            $len = (Get-Item $t.OutFile).Length
            Write-Host "  -> Saved: $($t.OutFile) ($len bytes)" -ForegroundColor Green
        } else {
            Write-Warning "Failed to capture $($t.OutFile)"
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
    $serverJob.Dispose()
    if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue }
}

Write-Host "Preparation captures complete!" -ForegroundColor Green
