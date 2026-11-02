# ==============================================================================
# Ledgio v1.10.4 High-Res Pixel Library Screenshots & Sequence Harness
# Usage: powershell -ExecutionPolicy Bypass -File scripts\capture_v1104.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$artifactDir = "C:\Users\stand\.gemini\antigravity\brain\3da55abb-6c31-42f5-964b-0f216dcbc73f"
if (-not (Test-Path $artifactDir)) {
    New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
}

$port = 8150
$listener = New-Object System.Net.HttpListener
try {
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Start()
} catch {
    $port = 8151
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Start()
}

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
                $res.ContentType = switch ($ext) {
                    ".html" { "text/html; charset=utf-8" }
                    ".js"   { "application/javascript; charset=utf-8" }
                    ".css"  { "text/css; charset=utf-8" }
                    ".json" { "application/json; charset=utf-8" }
                    ".png"  { "image/png" }
                    ".webp" { "image/webp" }
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
$userData = "C:\Users\stand\AppData\Local\Temp\edge_v1104_snap_" + [System.Guid]::NewGuid().ToString("N")

$shots = @(
    # 1. 1440x900 Desktop
    @{ Name = "v1104_1440_01_hero";      Pos = "hero";      W = 1440; H = 900; Delay = 600 },
    @{ Name = "v1104_1440_02_problem";   Pos = "problem";   W = 1440; H = 900; Delay = 600 },
    @{ Name = "v1104_1440_03_steps";     Pos = "steps";     W = 1440; H = 900; Delay = 600 },
    @{ Name = "v1104_1440_04_features";  Pos = "features";  W = 1440; H = 900; Delay = 600 },
    @{ Name = "v1104_1440_05_faq";       Pos = "faq";       W = 1440; H = 900; Delay = 600 },
    @{ Name = "v1104_1440_06_closing";   Pos = "closing";   W = 1440; H = 900; Delay = 600 },

    # 2. 1920x1080 Wide Desktop
    @{ Name = "v1104_1920_01_hero";      Pos = "hero";      W = 1920; H = 1080; Delay = 600 },

    # 3. 390x844 Mobile
    @{ Name = "v1104_390_01_hero";       Pos = "hero";      W = 390;  H = 844; Delay = 600 },
    @{ Name = "v1104_390_02_problem";    Pos = "problem";   W = 390;  H = 844; Delay = 600 },
    @{ Name = "v1104_390_03_steps";      Pos = "steps";     W = 390;  H = 844; Delay = 600 },
    @{ Name = "v1104_390_04_features";   Pos = "features";  W = 390;  H = 844; Delay = 600 },
    @{ Name = "v1104_390_05_faq";        Pos = "faq";       W = 390;  H = 844; Delay = 600 },
    @{ Name = "v1104_390_06_closing";    Pos = "closing";   W = 390;  H = 844; Delay = 600 },

    # 4. 6-Frame Hero Animation Sequence over 12 seconds (Desktop 1440x900)
    @{ Name = "v1104_seq_frame1_0s";     Pos = "hero";      W = 1440; H = 900; Delay = 100 },
    @{ Name = "v1104_seq_frame2_2400ms"; Pos = "hero";      W = 1440; H = 900; Delay = 2400 },
    @{ Name = "v1104_seq_frame3_4800ms"; Pos = "hero";      W = 1440; H = 900; Delay = 4800 },
    @{ Name = "v1104_seq_frame4_7200ms"; Pos = "hero";      W = 1440; H = 900; Delay = 7200 },
    @{ Name = "v1104_seq_frame5_9600ms"; Pos = "hero";      W = 1440; H = 900; Delay = 9600 },
    @{ Name = "v1104_seq_frame6_12000ms";Pos = "hero";      W = 1440; H = 900; Delay = 12000 }
)

$results = @()

try {
    foreach ($shot in $shots) {
        $outFile = Join-Path $artifactDir "$($shot.Name).png"
        $url = "http://127.0.0.1:$port/tests/capture_bgfx2.html?pos=$($shot.Pos)&delay=$($shot.Delay)&t=" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        
        Write-Host "Capturing $($shot.Name) ($($shot.W)x$($shot.H))..." -ForegroundColor Cyan
        $args = @(
            "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--window-size=$($shot.W),$($shot.H)",
            "--virtual-time-budget=$([Math]::Max($shot.Delay + 1800, 3000))",
            "--user-data-dir=$userData",
            "--no-first-run", "--no-default-browser-check",
            "--screenshot=$outFile",
            "$url"
        )
        $proc = Start-Process -FilePath $edgePath -ArgumentList $args -PassThru -NoNewWindow
        $proc.WaitForExit(25000) | Out-Null
        
        if (Test-Path $outFile) {
            $item = Get-Item $outFile
            $len = $item.Length
            $hash = (Get-FileHash -Path $outFile -Algorithm MD5).Hash
            $results += [PSCustomObject]@{
                Name = $shot.Name
                Path = $outFile
                Bytes = $len
                MD5 = $hash
                Dimensions = "$($shot.W)x$($shot.H)"
            }
            Write-Host "  -> OK: $($len) bytes, MD5: $hash" -ForegroundColor Green
        } else {
            Write-Warning "Failed to capture $($shot.Name)"
        }
    }
} finally {
    $listener.Stop()
    $serverJob.Dispose()
    if (Test-Path $userData) { Remove-Item -Recurse -Force $userData -ErrorAction SilentlyContinue }
}

# 5. Extract 400x300 native crops at a window and a candle for sharpness and alignment inspection
$pyScript = @"
from PIL import Image
import os, hashlib

art_dir = r'$artifactDir'

def make_crop(src_name, out_name, cx_pct, cy_pct, w_total, h_total):
    src_path = os.path.join(art_dir, src_name + '.png')
    out_path = os.path.join(art_dir, out_name + '.png')
    if not os.path.exists(src_path):
        print(f'Missing {src_path}')
        return
    im = Image.open(src_path)
    # Target center
    cx = int(cx_pct * w_total)
    cy = int(cy_pct * h_total)
    # Box 400x300
    left = max(0, min(im.width - 400, cx - 200))
    top = max(0, min(im.height - 300, cy - 150))
    crop_im = im.crop((left, top, left + 400, top + 300))
    crop_im.save(out_path, 'PNG')
    size = os.path.getsize(out_path)
    md5 = hashlib.md5(open(out_path, 'rb').read()).hexdigest()
    print(f'Crop {out_name}: {crop_im.size}, {size} bytes, MD5: {md5}')

# 1440x900: Window crop (upper right window ~91.5% x, 21% y) and Candle crop (candelabra mid-left ~29.8% x, 71.6% y)
make_crop('v1104_1440_01_hero', 'v1104_1440_crop_window', 0.915, 0.21, 1440, 900)
make_crop('v1104_1440_01_hero', 'v1104_1440_crop_candle', 0.298, 0.716, 1440, 900)

# 1920x1080: Window crop and Candle crop
make_crop('v1104_1920_01_hero', 'v1104_1920_crop_window', 0.915, 0.21, 1920, 1080)
make_crop('v1104_1920_01_hero', 'v1104_1920_crop_candle', 0.298, 0.716, 1920, 1080)
"@

& 'C:\Users\stand\AppData\Local\Programs\Python\Python312\python.exe' -c $pyScript

$cropNames = @("v1104_1440_crop_window", "v1104_1440_crop_candle", "v1104_1920_crop_window", "v1104_1920_crop_candle")
foreach ($cn in $cropNames) {
    $cp = Join-Path $artifactDir "$cn.png"
    if (Test-Path $cp) {
        $item = Get-Item $cp
        $hash = (Get-FileHash -Path $cp -Algorithm MD5).Hash
        $results += [PSCustomObject]@{
            Name = $cn
            Path = $cp
            Bytes = $item.Length
            MD5 = $hash
            Dimensions = "400x300"
        }
    }
}

Write-Host "`n================ Screenshot Summary ================" -ForegroundColor Cyan
$results | Format-Table Name, Dimensions, Bytes, MD5 -AutoSize

$uniqueHashes = ($results | Select-Object -ExpandProperty MD5 -Unique).Count
$allAbove20k = ($results | Where-Object { $_.Bytes -lt 20000 }).Count -eq 0

Write-Host "Total Screenshots: $($results.Count)"
Write-Host "Unique MD5 Hashes: $uniqueHashes / $($results.Count)"
Write-Host "All > 20KB: $allAbove20k"
