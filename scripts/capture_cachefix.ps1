# ==============================================================================
# Ledgio v1.10.9 Hero Background Capture & Verification Script
# ==============================================================================
$ErrorActionPreference = "Stop"
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$artifactDir = "C:\Users\stand\.gemini\antigravity\brain\799d4257-1f2a-4c7b-a9b7-f22a3c949a79"
if (-not (Test-Path $artifactDir)) {
    New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
}

$port = 8160
$listener = New-Object System.Net.HttpListener
try {
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Start()
} catch {
    $port = 8161
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
                    ".woff2"{ "font/woff2" }
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
$userData = "C:\Users\stand\AppData\Local\Temp\edge_cachefix_snap_" + [System.Guid]::NewGuid().ToString("N")

$shots = @(
    @{ Name = "v1109_hero_390x844_dpr2"; W = 390; H = 844; Dpr = 2; Delay = 1800 },
    @{ Name = "v1109_hero_360x740_dpr2"; W = 360; H = 740; Dpr = 2; Delay = 1800 },
    @{ Name = "v1109_hero_1440x900_desk"; W = 1440; H = 900; Dpr = 1; Delay = 1800 }
)

$results = @()

try {
    foreach ($shot in $shots) {
        $outFile = Join-Path $artifactDir "$($shot.Name).png"
        $url = "http://127.0.0.1:$port/index.html?t=" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        
        Write-Host "Capturing $($shot.Name) ($($shot.W)x$($shot.H), DPR $($shot.Dpr))..." -ForegroundColor Cyan
        $args = @(
            "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--window-size=$($shot.W),$($shot.H)",
            "--force-device-scale-factor=$($shot.Dpr)",
            "--virtual-time-budget=$([Math]::Max($shot.Delay + 1800, 3500))",
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
                Width = $shot.W
                Height = $shot.H
                Dpr = $shot.Dpr
                Size = $len
                MD5 = $hash
                Path = $outFile
            }
        } else {
            Write-Warning "Failed to capture $outFile"
        }
    }
} finally {
    $listener.Stop()
    $serverJob.Dispose()
    if (Test-Path $userData) {
        Remove-Item -Recurse -Force $userData -ErrorAction SilentlyContinue
    }
}

Write-Host "`nCapture Results:" -ForegroundColor Green
$results | Format-Table -AutoSize
