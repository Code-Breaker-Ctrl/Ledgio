# ==============================================================================
# Ledgio v1.10.8 Sheet Motion Frame-by-Frame Capture Harness
# Usage: powershell -ExecutionPolicy Bypass -File scripts\capture_v1108.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$artifactDir = "C:\Users\stand\.gemini\antigravity\brain\3da55abb-6c31-42f5-964b-0f216dcbc73f"
if (-not (Test-Path $artifactDir)) {
    New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
}

$port = 8156
$listener = New-Object System.Net.HttpListener
try {
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Start()
} catch {
    $port = 8157
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
            if ([System.IO.File]::Exists($filePath)) {
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
$userData = "C:\Users\stand\AppData\Local\Temp\edge_v1108_snap_" + [System.Guid]::NewGuid().ToString("N")

$frames = @(
    # Opening 6 frames (~0, 50, 100, 150, 200, 320ms)
    @{ Name = "v1108_open_000ms"; Action = "open"; Delay = 0;   VirtualTime = 2500 },
    @{ Name = "v1108_open_050ms"; Action = "open"; Delay = 50;  VirtualTime = 2600 },
    @{ Name = "v1108_open_100ms"; Action = "open"; Delay = 100; VirtualTime = 2700 },
    @{ Name = "v1108_open_150ms"; Action = "open"; Delay = 150; VirtualTime = 2800 },
    @{ Name = "v1108_open_200ms"; Action = "open"; Delay = 200; VirtualTime = 2900 },
    @{ Name = "v1108_open_320ms"; Action = "open"; Delay = 320; VirtualTime = 3100 },

    # Closing 6 frames (~0, 50, 100, 150, 200, 250ms)
    @{ Name = "v1108_close_000ms"; Action = "close"; Delay = 0;   VirtualTime = 3000 },
    @{ Name = "v1108_close_050ms"; Action = "close"; Delay = 50;  VirtualTime = 3100 },
    @{ Name = "v1108_close_100ms"; Action = "close"; Delay = 100; VirtualTime = 3200 },
    @{ Name = "v1108_close_150ms"; Action = "close"; Delay = 150; VirtualTime = 3300 },
    @{ Name = "v1108_close_200ms"; Action = "close"; Delay = 200; VirtualTime = 3400 },
    @{ Name = "v1108_close_250ms"; Action = "close"; Delay = 250; VirtualTime = 3500 }
)

try {
    foreach ($f in $frames) {
        $outFile = Join-Path $artifactDir "$($f.Name).png"
        $url = "http://127.0.0.1:$port/tests/capture_sheet_motion.html?action=$($f.Action)&delay=$($f.Delay)&t=" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

        Write-Host "Capturing $($f.Name)..." -ForegroundColor Cyan
        $edgeArgs = @(
            "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--window-size=390,844",
            "--virtual-time-budget=$($f.VirtualTime)",
            "--user-data-dir=$userData",
            "--no-first-run", "--no-default-browser-check",
            "--screenshot=$outFile",
            $url
        )
        $p = Start-Process -FilePath $edgePath -ArgumentList $edgeArgs -PassThru -Wait -WindowStyle Hidden
        if (Test-Path $outFile) {
            $sz = (Get-Item $outFile).Length
            Write-Host "  -> Saved $outFile ($([Math]::Round($sz/1KB, 1)) KB)" -ForegroundColor Green
        } else {
            Write-Host "  -> Failed to capture $($f.Name)" -ForegroundColor Red
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
    if (Test-Path $userData) {
        try { Remove-Item -Path $userData -Recurse -Force -ErrorAction SilentlyContinue } catch {}
    }
}

Write-Host "Frame capture complete." -ForegroundColor Green
