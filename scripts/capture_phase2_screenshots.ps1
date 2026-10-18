# ==============================================================================
# Ledgio Landing Page v2 — Phase 2 Automated Screenshot Verification Harness
# Usage: powershell -ExecutionPolicy Bypass -File scripts\capture_phase2_screenshots.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"
$port = 8112
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$outDir = Join-Path $baseDir "docs\ui\landing-v2\phase-2"
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
    # 375px (Mobile)
    @{ Name = "manifesto_dark_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=manifesto&width=375&height=812" },
    @{ Name = "manifesto_light_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=light&section=manifesto&width=375&height=812" },
    @{ Name = "walkthrough_dark_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=walkthrough&width=375&height=812" },
    @{ Name = "walkthrough_light_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=light&section=walkthrough&width=375&height=812" },
    @{ Name = "showcase_dark_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=showcase&width=375&height=812" },
    @{ Name = "showcase_light_375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=light&section=showcase&width=375&height=812" },

    # 768px (Tablet)
    @{ Name = "manifesto_dark_768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=manifesto&width=768&height=1024" },
    @{ Name = "manifesto_light_768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=light&section=manifesto&width=768&height=1024" },
    @{ Name = "walkthrough_dark_768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=walkthrough&width=768&height=1024" },
    @{ Name = "walkthrough_light_768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=light&section=walkthrough&width=768&height=1024" },
    @{ Name = "showcase_dark_768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=showcase&width=768&height=1024" },
    @{ Name = "showcase_light_768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=light&section=showcase&width=768&height=1024" },

    # 1024px (Laptop)
    @{ Name = "manifesto_dark_1024.png"; Width = 1024; Height = 800; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=manifesto&width=1024&height=800" },
    @{ Name = "manifesto_light_1024.png"; Width = 1024; Height = 800; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=light&section=manifesto&width=1024&height=800" },
    @{ Name = "walkthrough_dark_1024.png"; Width = 1024; Height = 800; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=walkthrough&width=1024&height=800" },
    @{ Name = "walkthrough_light_1024.png"; Width = 1024; Height = 800; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=light&section=walkthrough&width=1024&height=800" },
    @{ Name = "showcase_dark_1024.png"; Width = 1024; Height = 800; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=showcase&width=1024&height=800" },
    @{ Name = "showcase_light_1024.png"; Width = 1024; Height = 800; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=light&section=showcase&width=1024&height=800" },

    # 1440px (Desktop)
    @{ Name = "manifesto_dark_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=manifesto&width=1440&height=900" },
    @{ Name = "manifesto_light_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=light&section=manifesto&width=1440&height=900" },
    @{ Name = "walkthrough_dark_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=walkthrough&width=1440&height=900" },
    @{ Name = "walkthrough_light_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=light&section=walkthrough&width=1440&height=900" },
    @{ Name = "showcase_dark_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=showcase&width=1440&height=900" },
    @{ Name = "showcase_light_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=light&section=showcase&width=1440&height=900" },

    # Walkthrough Active Steps on Desktop
    @{ Name = "walkthrough_desktop_step1.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=walkthrough&step=1&width=1440&height=900" },
    @{ Name = "walkthrough_desktop_step3.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=walkthrough&step=3&width=1440&height=900" },
    @{ Name = "walkthrough_desktop_step5.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=walkthrough&step=5&width=1440&height=900" },

    # Reduced Motion Static
    @{ Name = "reduced_motion_walkthrough_1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:$port/tests/screenshot_landing_phase2.html?theme=dark&section=walkthrough&reduced_motion=1&width=1440&height=900" }
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
            $len = (Get-Item $outFile).Length
            Write-Host "  -> Saved: $outFile ($len bytes)" -ForegroundColor Green
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
    $serverJob.Dispose()
}

Write-Host "Phase 2 screenshots capture completed!" -ForegroundColor Green
