# ==============================================================================
# Ledgio v1.9.1 Mobile-Native Dashboard Real Screenshots Capture Harness
# Usage: powershell -ExecutionPolicy Bypass -File scripts\capture_v191.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$artifactDir = "C:\Users\stand\.gemini\antigravity\brain\3da55abb-6c31-42f5-964b-0f216dcbc73f"
if (-not (Test-Path $artifactDir)) {
    New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
}

$port = 8133
$listener = New-Object System.Net.HttpListener
try {
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Start()
} catch {
    $port = 8134
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
            if ([string]::IsNullOrWhiteSpace($rawPath)) { $rawPath = "dashboard.html" }
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
$userData = "C:\Users\stand\AppData\Local\Temp\edge_v191_snap_" + [System.Guid]::NewGuid().ToString("N")

$shots = @(
    # 390x844 Mobile Touch
    @{ Name = "v191_390_01_dashboard";       View = "dashboard";       W = 390;  H = 844 },
    @{ Name = "v191_390_02_expenses_modal";  View = "expenses_modal";  W = 390;  H = 844 },
    @{ Name = "v191_390_03_budget_modal";    View = "budget_modal";    W = 390;  H = 844 },
    @{ Name = "v191_390_04_bottom_sheet";    View = "bottom_sheet";    W = 390;  H = 844 },
    @{ Name = "v191_390_05_loan_modal";      View = "loan_modal";      W = 390;  H = 844 },
    @{ Name = "v191_390_06_settings";        View = "settings";        W = 390;  H = 844 },

    # 320x640 Small Mobile Touch
    @{ Name = "v191_320_01_dashboard";       View = "dashboard";       W = 320;  H = 640 },
    @{ Name = "v191_320_02_expenses_modal";  View = "expenses_modal";  W = 320;  H = 640 },
    @{ Name = "v191_320_03_budget_modal";    View = "budget_modal";    W = 320;  H = 640 },
    @{ Name = "v191_320_04_bottom_sheet";    View = "bottom_sheet";    W = 320;  H = 640 },
    @{ Name = "v191_320_05_loan_modal";      View = "loan_modal";      W = 320;  H = 640 },
    @{ Name = "v191_320_06_settings";        View = "settings";        W = 320;  H = 640 },

    # 1440x900 Desktop
    @{ Name = "v191_1440_01_dashboard";      View = "dashboard";       W = 1440; H = 900 },
    @{ Name = "v191_1440_02_desktop_modal";  View = "desktop_modal";   W = 1440; H = 900 }
)

$results = @()

try {
    foreach ($shot in $shots) {
        $outFile = Join-Path $artifactDir "$($shot.Name).png"
        $url = "http://127.0.0.1:$port/tests/capture_v191.html?view=$($shot.View)&t=" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        
        Write-Host "Capturing $($shot.Name) ($($shot.W)x$($shot.H))..." -ForegroundColor Cyan
        $args = @(
            "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--window-size=$($shot.W),$($shot.H)",
            "--virtual-time-budget=2500",
            "--user-data-dir=$userData",
            "--no-first-run", "--no-default-browser-check",
            "--screenshot=$outFile",
            "$url"
        )
        $proc = Start-Process -FilePath $edgePath -ArgumentList $args -PassThru -NoNewWindow
        $proc.WaitForExit(15000) | Out-Null
        
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
