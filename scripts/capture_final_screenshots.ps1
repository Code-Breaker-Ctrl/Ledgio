# ==============================================================================
# Ledgio Landing Page v2 — Final Verification Screenshot Capture Harness
# Usage: powershell -ExecutionPolicy Bypass -File scripts\capture_final_screenshots.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"
$port = 8117
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$outDir = Join-Path $baseDir "docs\ui\landing-v2\final"
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

$userDataDir = "C:\Users\stand\AppData\Local\Temp\edge_final_screenshots_userData"

$targets = @(
    # 375px (Mobile)
    @{ Name = "landing_dark_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=hero&width=375&height=812" },
    @{ Name = "landing_light_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=light&section=hero&width=375&height=812" },
    @{ Name = "carousel_dark_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=features&width=375&height=812" },
    @{ Name = "simulator_dark_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=simulator&width=375&height=812" },
    @{ Name = "stats_dark_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=stats&width=375&height=812" },
    @{ Name = "steps_dark_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=how-it-works&width=375&height=812" },
    @{ Name = "faq_dark_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=faq&width=375&height=812" },
    @{ Name = "closing_dark_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=closing-cta&width=375&height=812" },

    # 768px (Tablet)
    @{ Name = "landing_dark_768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=hero&width=768&height=1024" },
    @{ Name = "landing_light_768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=light&section=hero&width=768&height=1024" },
    @{ Name = "carousel_dark_768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=features&width=768&height=1024" },
    @{ Name = "simulator_dark_768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=simulator&width=768&height=1024" },
    @{ Name = "stats_dark_768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=stats&width=768&height=1024" },

    # 1024px (Laptop)
    @{ Name = "landing_dark_1024.png"; Width = 1024; Height = 800; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=hero&width=1024&height=800" },
    @{ Name = "landing_light_1024.png"; Width = 1024; Height = 800; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=light&section=hero&width=1024&height=800" },
    @{ Name = "carousel_dark_1024.png"; Width = 1024; Height = 800; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=features&width=1024&height=800" },
    @{ Name = "simulator_dark_1024.png"; Width = 1024; Height = 800; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=simulator&width=1024&height=800" },
    @{ Name = "stats_dark_1024.png"; Width = 1024; Height = 800; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=stats&width=1024&height=800" },

    # 1440px (Desktop)
    @{ Name = "landing_dark_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=hero&width=1440&height=900" },
    @{ Name = "landing_light_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=light&section=hero&width=1440&height=900" },
    @{ Name = "carousel_dark_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=features&width=1440&height=900" },
    @{ Name = "simulator_dark_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=simulator&width=1440&height=900" },
    @{ Name = "stats_dark_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=stats&width=1440&height=900" },
    @{ Name = "steps_dark_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=how-it-works&width=1440&height=900" },
    @{ Name = "faq_dark_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=faq&width=1440&height=900" },
    @{ Name = "closing_dark_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&section=closing-cta&width=1440&height=900" },

    # Accessibility & Fallback
    @{ Name = "landing_reduced_motion_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&reduced_motion=1&width=1440&height=900" },
    @{ Name = "landing_reduced_motion_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&reduced_motion=1&width=375&height=812" },
    @{ Name = "landing_nojs_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&no_js=1&width=1440&height=900" },
    @{ Name = "landing_nojs_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_final.html?theme=dark&no_js=1&width=375&height=812" }
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
            "--virtual-time-budget=3000",
            "--user-data-dir=$userDataDir",
            "--no-first-run",
            "--no-default-browser-check",
            "--screenshot=`"$outFile`"",
            "`"$($t.Url)`""
        )
        
        $p = Start-Process -FilePath $edgeExe -ArgumentList $procArgs -PassThru -NoNewWindow
        $p.WaitForExit(15000) | Out-Null
        if (-not (Test-Path $outFile)) {
            Write-Warning "Failed to capture $($t.Name)"
        } else {
            $bytes = (Get-Item $outFile).Length
            Write-Host "  -> Saved: $outFile ($bytes bytes)" -ForegroundColor Green
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
    $serverJob.Dispose()
    if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue }
}

Write-Host "`nAll final review screenshots successfully saved into $outDir!" -ForegroundColor Green
