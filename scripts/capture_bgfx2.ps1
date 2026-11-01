# ==============================================================================
# Ledgio v1.10.0 Living Background Real Screenshots & Sequence Capture Harness
# Usage: powershell -ExecutionPolicy Bypass -File scripts\capture_bgfx2.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$artifactDir = "C:\Users\stand\.gemini\antigravity\brain\3da55abb-6c31-42f5-964b-0f216dcbc73f"
if (-not (Test-Path $artifactDir)) {
    New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
}

$port = 8135
$listener = New-Object System.Net.HttpListener
try {
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Start()
} catch {
    $port = 8136
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
$userData = "C:\Users\stand\AppData\Local\Temp\edge_bgfx2_snap_" + [System.Guid]::NewGuid().ToString("N")

$shots = @(
    # 1. 1440x900 Desktop - 6 Scroll Positions
    @{ Name = "v110_1440_01_hero";      Pos = "hero";      W = 1440; H = 900; Delay = 400 },
    @{ Name = "v110_1440_02_problem";   Pos = "problem";   W = 1440; H = 900; Delay = 400 },
    @{ Name = "v110_1440_03_steps";     Pos = "steps";     W = 1440; H = 900; Delay = 400 },
    @{ Name = "v110_1440_04_features";  Pos = "features";  W = 1440; H = 900; Delay = 400 },
    @{ Name = "v110_1440_05_faq";       Pos = "faq";       W = 1440; H = 900; Delay = 400 },
    @{ Name = "v110_1440_06_closing";   Pos = "closing";   W = 1440; H = 900; Delay = 400 },

    # 2. 390x844 Mobile - 6 Scroll Positions
    @{ Name = "v110_390_01_hero";       Pos = "hero";      W = 390;  H = 844; Delay = 400 },
    @{ Name = "v110_390_02_problem";    Pos = "problem";   W = 390;  H = 844; Delay = 400 },
    @{ Name = "v110_390_03_steps";      Pos = "steps";     W = 390;  H = 844; Delay = 400 },
    @{ Name = "v110_390_04_features";   Pos = "features";  W = 390;  H = 844; Delay = 400 },
    @{ Name = "v110_390_05_faq";        Pos = "faq";       W = 390;  H = 844; Delay = 400 },
    @{ Name = "v110_390_06_closing";    Pos = "closing";   W = 390;  H = 844; Delay = 400 },

    # 3. 6-Frame Hero Animation Sequence over 12 seconds (Desktop 1440x900)
    @{ Name = "v110_seq_frame1_0s";     Pos = "hero";      W = 1440; H = 900; Delay = 100 },
    @{ Name = "v110_seq_frame2_2400ms"; Pos = "hero";      W = 1440; H = 900; Delay = 2400 },
    @{ Name = "v110_seq_frame3_4800ms"; Pos = "hero";      W = 1440; H = 900; Delay = 4800 },
    @{ Name = "v110_seq_frame4_7200ms"; Pos = "hero";      W = 1440; H = 900; Delay = 7200 },
    @{ Name = "v110_seq_frame5_9600ms"; Pos = "hero";      W = 1440; H = 900; Delay = 9600 },
    @{ Name = "v110_seq_frame6_12000ms";Pos = "hero";      W = 1440; H = 900; Delay = 12000 }
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
            "--virtual-time-budget=$([Math]::Max($shot.Delay + 1500, 2500))",
            "--user-data-dir=$userData",
            "--no-first-run", "--no-default-browser-check",
            "--screenshot=$outFile",
            "$url"
        )
        $proc = Start-Process -FilePath $edgePath -ArgumentList $args -PassThru -NoNewWindow
        $proc.WaitForExit(20000) | Out-Null
        
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

Write-Host "`n================ Screenshot Summary ================" -ForegroundColor Cyan
$results | Format-Table Name, Dimensions, Bytes, MD5 -AutoSize

$uniqueHashes = ($results | Select-Object -ExpandProperty MD5 -Unique).Count
$allAbove20k = ($results | Where-Object { $_.Bytes -lt 20000 }).Count -eq 0

Write-Host "Total Screenshots: $($results.Count)"
Write-Host "Unique MD5 Hashes: $uniqueHashes / $($results.Count)"
Write-Host "All > 20KB: $allAbove20k"
