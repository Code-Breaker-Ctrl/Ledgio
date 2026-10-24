# ==============================================================================
# Ledgio — Mobile Landing: "After" Captures & Desktop Parity Audit
# ==============================================================================

$ErrorActionPreference = "Stop"
$port = 8119
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$afterDir = Join-Path $baseDir "docs\ui\mobile-landing\after"
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
    # 1. Scenes: Start, Mid, Payoff
    @{ OutFile = Join-Path $afterDir "mobile_scene1_start_390.png"; Section = "scene1_start"; Width = 390; Height = 844 },
    @{ OutFile = Join-Path $afterDir "mobile_scene1_mid_390.png"; Section = "scene1_mid"; Width = 390; Height = 844 },
    @{ OutFile = Join-Path $afterDir "mobile_scene1_payoff_390.png"; Section = "scene1_payoff"; Width = 390; Height = 844 },
    @{ OutFile = Join-Path $afterDir "mobile_scene2_start_390.png"; Section = "scene2_start"; Width = 390; Height = 844 },
    @{ OutFile = Join-Path $afterDir "mobile_scene2_mid_390.png"; Section = "scene2_mid"; Width = 390; Height = 844 },
    @{ OutFile = Join-Path $afterDir "mobile_scene2_payoff_390.png"; Section = "scene2_payoff"; Width = 390; Height = 844 },
    @{ OutFile = Join-Path $afterDir "mobile_scene3_start_390.png"; Section = "scene3_start"; Width = 390; Height = 844 },
    @{ OutFile = Join-Path $afterDir "mobile_scene3_mid_390.png"; Section = "scene3_mid"; Width = 390; Height = 844 },
    @{ OutFile = Join-Path $afterDir "mobile_scene3_payoff_390.png"; Section = "scene3_payoff"; Width = 390; Height = 844 },
    @{ OutFile = Join-Path $afterDir "mobile_scene4_start_390.png"; Section = "scene4_start"; Width = 390; Height = 844 },
    @{ OutFile = Join-Path $afterDir "mobile_scene4_mid_390.png"; Section = "scene4_mid"; Width = 390; Height = 844 },
    @{ OutFile = Join-Path $afterDir "mobile_scene4_payoff_390.png"; Section = "scene4_payoff"; Width = 390; Height = 844 },

    # 2. Vault: Mid-Hold & Revealed
    @{ OutFile = Join-Path $afterDir "mobile_vault_mid_hold_390.png"; Section = "vault_mid_hold"; Width = 390; Height = 844 },
    @{ OutFile = Join-Path $afterDir "mobile_vault_revealed_390.png"; Section = "vault_revealed"; Width = 390; Height = 844 },

    # 3. Category Inspector: Food, Bills, Transit
    @{ OutFile = Join-Path $afterDir "mobile_category_food_390.png"; Section = "category_food"; Width = 390; Height = 844 },
    @{ OutFile = Join-Path $afterDir "mobile_category_bills_390.png"; Section = "category_bills"; Width = 390; Height = 844 },
    @{ OutFile = Join-Path $afterDir "mobile_category_transit_390.png"; Section = "category_transit"; Width = 390; Height = 844 },

    # 4. Donut Selected Segment
    @{ OutFile = Join-Path $afterDir "mobile_donut_selected_390.png"; Section = "donut_selected"; Width = 390; Height = 844 },

    # 5. Install Card
    @{ OutFile = Join-Path $afterDir "mobile_install_card_390.png"; Section = "install_card"; Width = 390; Height = 844 },

    # 6. Simulator: Positive & Negative Scenarios
    @{ OutFile = Join-Path $afterDir "mobile_simulator_positive_390.png"; Section = "simulator_positive"; Width = 390; Height = 844 },
    @{ OutFile = Join-Path $afterDir "mobile_simulator_negative_390.png"; Section = "simulator_negative"; Width = 390; Height = 844 },

    # 7. Single Closing Card
    @{ OutFile = Join-Path $afterDir "mobile_single_closing_390.png"; Section = "single_closing"; Width = 390; Height = 844 },

    # 8. Desktop Parity Captures (1024px & 1440px)
    @{
        OutFile = Join-Path $afterDir "landing_desktop_1024.png"
        Width = 1024
        Height = 768
        DirectUrl = "http://127.0.0.1:$port/index.html"
    },
    @{
        OutFile = Join-Path $afterDir "landing_desktop_1440.png"
        Width = 1440
        Height = 900
        DirectUrl = "http://127.0.0.1:$port/index.html"
    }
)

try {
    foreach ($t in $targets) {
        $url = if ($t.DirectUrl) { $t.DirectUrl } else { "http://127.0.0.1:$port/tests/capture_mobile_study.html?mode=landing&section=$($t.Section)&width=$($t.Width)&height=$($t.Height)" }
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
            "`"$url`""
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
    Write-Host "Harness server stopped." -ForegroundColor Yellow
}

# MD5 Hash Verification
Write-Host "`nVerifying Unique MD5 Hashes on Captured Screenshots..." -ForegroundColor Cyan
$capturedFiles = Get-ChildItem -Path $afterDir -Filter "*.png"
$hashMap = @{}
$collisionCount = 0

foreach ($f in $capturedFiles) {
    $hash = (Get-FileHash -Path $f.FullName -Algorithm MD5).Hash
    Write-Host "$($f.Name) -> $hash"
    if ($hashMap.ContainsKey($hash)) {
        Write-Warning "COLLISION: $($f.Name) shares hash with $($hashMap[$hash])"
        $collisionCount++
    } else {
        $hashMap[$hash] = $f.Name
    }
}

if ($collisionCount -eq 0) {
    Write-Host "`nSUCCESS: All $($capturedFiles.Count) screenshots have unique MD5 hashes!" -ForegroundColor Green
} else {
    throw "Screenshot MD5 collision detected ($collisionCount collisions)!"
}
