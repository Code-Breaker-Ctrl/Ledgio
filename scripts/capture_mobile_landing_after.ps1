# ==============================================================================
# Ledgio — Mobile Landing: "After" Captures & Desktop Parity Audit
# ==============================================================================

$ErrorActionPreference = "Stop"
$port = 8119
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$afterDir = Join-Path $baseDir "docs\ui\mobile-landing\after"
$beforeDir = Join-Path $baseDir "docs\ui\mobile-landing\before"
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
$userDataDir = "C:\Users\stand\AppData\Local\Temp\edge_mobile_landing_after_userData"

$targets = @(
    # 1. Mobile Phone App Captures (390px)
    @{
        OutFile = Join-Path $afterDir "mobile_hero_390.png"
        Width = 390
        Height = 844
        Url = "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=landing&section=hero&width=390&height=844"
    },
    @{
        OutFile = Join-Path $afterDir "mobile_demo_scene1_sheet_open_390.png"
        Width = 390
        Height = 844
        Url = "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=landing&section=scene1_sheet&width=390&height=844"
    },
    @{
        OutFile = Join-Path $afterDir "mobile_demo_scene1_payoff_390.png"
        Width = 390
        Height = 844
        Url = "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=landing&section=scene1_payoff&width=390&height=844"
    },
    @{
        OutFile = Join-Path $afterDir "mobile_demo_scene2_banner_390.png"
        Width = 390
        Height = 844
        Url = "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=landing&section=scene2_banner&width=390&height=844"
    },
    @{
        OutFile = Join-Path $afterDir "mobile_demo_scene3_milestone_390.png"
        Width = 390
        Height = 844
        Url = "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=landing&section=scene3_milestone&width=390&height=844"
    },
    @{
        OutFile = Join-Path $afterDir "mobile_demo_scene4_swiped_390.png"
        Width = 390
        Height = 844
        Url = "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=landing&section=scene4_swiped&width=390&height=844"
    },
    @{
        OutFile = Join-Path $afterDir "mobile_features_today_390.png"
        Width = 390
        Height = 844
        Url = "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=landing&section=features_today&width=390&height=844"
    },
    @{
        OutFile = Join-Path $afterDir "mobile_offline_control_centre_390.png"
        Width = 390
        Height = 844
        Url = "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=landing&section=offline_control_centre&width=390&height=844"
    },
    @{
        OutFile = Join-Path $afterDir "mobile_offline_pull_to_refresh_390.png"
        Width = 390
        Height = 844
        Url = "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=landing&section=offline_pull_to_refresh&width=390&height=844"
    },
    @{
        OutFile = Join-Path $afterDir "mobile_simulator_390.png"
        Width = 390
        Height = 844
        Url = "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=landing&section=simulator&width=390&height=844"
    },
    @{
        OutFile = Join-Path $afterDir "mobile_faq_390.png"
        Width = 390
        Height = 844
        Url = "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=landing&section=faq&width=390&height=844"
    },
    @{
        OutFile = Join-Path $afterDir "mobile_closing_appstore_390.png"
        Width = 390
        Height = 844
        Url = "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=landing&section=closing_appstore&width=390&height=844"
    },

    # 2. Desktop Parity Captures (1024px & 1440px)
    @{
        OutFile = Join-Path $afterDir "landing_desktop_1024.png"
        Width = 1024
        Height = 768
        Url = "http://127.0.0.1:$port/index.html"
    },
    @{
        OutFile = Join-Path $afterDir "landing_desktop_1440.png"
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

Write-Host "`nAll 'after' captures finished. Checking file sizes..." -ForegroundColor Cyan
$allFiles = Get-ChildItem -Path $afterDir -Filter "*.png"
$failCount = 0
foreach ($f in $allFiles) {
    if ($f.Length -lt 20000) {
        Write-Warning "File too small: $($f.Name) ($($f.Length) bytes < 20KB)"
        $failCount++
    } else {
        Write-Host "  [OK] $($f.Name): $($f.Length) bytes" -ForegroundColor Green
    }
}

Write-Host "`nAuditing Desktop Parity (1024px and 1440px)..." -ForegroundColor Cyan
$d1024Before = Join-Path $beforeDir "landing_desktop_1024.png"
$d1024After  = Join-Path $afterDir  "landing_desktop_1024.png"
$d1440Before = Join-Path $beforeDir "landing_desktop_1440.png"
$d1440After  = Join-Path $afterDir  "landing_desktop_1440.png"

function Compare-Images($p1, $p2) {
    if (-not (Test-Path $p1) -or -not (Test-Path $p2)) {
        return "Missing file"
    }
    $b1 = [System.IO.File]::ReadAllBytes($p1)
    $b2 = [System.IO.File]::ReadAllBytes($p2)
    if ($b1.Length -ne $b2.Length) {
        return "Size delta: $($b1.Length) vs $($b2.Length)"
    }
    $diffs = 0
    for ($i = 0; $i -lt $b1.Length; $i++) {
        if ($b1[$i] -ne $b2[$i]) { $diffs++ }
    }
    return "Identical bytes: $([math]::Round((($b1.Length - $diffs) / $b1.Length) * 100, 2))%"
}

Write-Host "1024px Desktop Parity: $(Compare-Images $d1024Before $d1024After)" -ForegroundColor Green
Write-Host "1440px Desktop Parity: $(Compare-Images $d1440Before $d1440After)" -ForegroundColor Green
