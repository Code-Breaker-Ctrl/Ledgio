# ==============================================================================
# Mobile Polish Measurement & Screenshot Capture Runner
# Usage: powershell -ExecutionPolicy Bypass -File scripts\run_mobile_audit.ps1 -Mode "before" (or "after")
# ==============================================================================
param(
    [string]$Mode = "before"
)

$ErrorActionPreference = "Stop"
$port = 8117
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$artifactDir = "C:\Users\stand\.gemini\antigravity\brain\3da55abb-6c31-42f5-964b-0f216dcbc73f"
if (-not (Test-Path $artifactDir)) { New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null }

$jsonOut = Join-Path $baseDir "docs\ui\mobile_polish_measurement_$Mode.json"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()

$sharedReport = [hashtable]::Synchronized(@{ LastResult = $null; Ready = $false })

$serverJob = [powershell]::Create().AddScript({
    param($listener, $serverDir, $reportState, $jsonOut)
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
            $req = $context.Request
            $res = $context.Response

            if ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/save-measurements") {
                $sr = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
                $body = $sr.ReadToEnd()
                $sr.Close()
                [System.IO.File]::WriteAllText($jsonOut, $body, [System.Text.Encoding]::UTF8)
                $reportState.LastResult = $body
                $reportState.Ready = $true
                $res.StatusCode = 200
                $msg = [System.Text.Encoding]::UTF8.GetBytes("Measurement received")
                $res.OutputStream.Write($msg, 0, $msg.Length)
                $res.OutputStream.Close()
                continue
            }

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
}).AddArgument($listener).AddArgument($baseDir).AddArgument($sharedReport).AddArgument($jsonOut)

$asyncHandle = $serverJob.BeginInvoke()

$edgePaths = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
$edgeExe = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edgeExe) { throw "Microsoft Edge binary not found!" }

$userData = "C:\Users\stand\AppData\Local\Temp\edge_mobile_audit_userData"

try {
    Write-Host "`n>>> Running $Mode Measurement Audit via Edge Headless..." -ForegroundColor Cyan
    if (Test-Path $userData) { Remove-Item -Recurse -Force $userData -ErrorAction SilentlyContinue }

    $procArgs = @(
        "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--window-size=1200,1000",
        "--user-data-dir=$userData",
        "--no-first-run", "--no-default-browser-check",
        "http://127.0.0.1:$port/tests/measure_mobile_audit.html"
    )
    $proc = Start-Process -FilePath $edgeExe -ArgumentList $procArgs -PassThru -NoNewWindow
    
    $timeout = 25
    $elapsed = 0
    while (-not $sharedReport.Ready -and $elapsed -lt $timeout) {
        Start-Sleep -Milliseconds 500
        $elapsed += 0.5
    }
    if ($proc -and -not $proc.HasExited) { $proc.Kill() }

    if ($sharedReport.Ready) {
        Write-Host ">>> Measurements captured and saved to $jsonOut" -ForegroundColor Green
    } else {
        Write-Warning ">>> Measurement collection timed out!"
    }

    Write-Host "`n>>> Capturing Screenshots for Mode: $Mode..." -ForegroundColor Cyan

    $shots = @(
        @{ Name = "v1106_${Mode}_320_nav"; W = 320; H = 640; Target = "nav" },
        @{ Name = "v1106_${Mode}_320_hero"; W = 320; H = 640; Target = "hero" },
        @{ Name = "v1106_${Mode}_320_replica"; W = 320; H = 640; Target = "replica" },

        @{ Name = "v1106_${Mode}_360_nav"; W = 360; H = 740; Target = "nav" },
        @{ Name = "v1106_${Mode}_360_hero"; W = 360; H = 740; Target = "hero" },
        @{ Name = "v1106_${Mode}_360_replica"; W = 360; H = 740; Target = "replica" },

        @{ Name = "v1106_${Mode}_390_nav"; W = 390; H = 844; Target = "nav" },
        @{ Name = "v1106_${Mode}_390_hero"; W = 390; H = 844; Target = "hero" },
        @{ Name = "v1106_${Mode}_390_replica"; W = 390; H = 844; Target = "replica" },

        @{ Name = "v1106_${Mode}_430_nav"; W = 430; H = 932; Target = "nav" },
        @{ Name = "v1106_${Mode}_430_hero"; W = 430; H = 932; Target = "hero" },
        @{ Name = "v1106_${Mode}_430_replica"; W = 430; H = 932; Target = "replica" },

        @{ Name = "v1106_${Mode}_390_fullpage"; W = 390; H = 3400; Target = "full" },
        @{ Name = "v1106_${Mode}_1440_hero"; W = 1440; H = 900; Target = "desktop_hero" }
    )

    $results = @()

    foreach ($shot in $shots) {
        $outFile = Join-Path $artifactDir "$($shot.Name).png"
        $url = "http://127.0.0.1:$port/tests/capture_mobile_target.html?target=$($shot.Target)&delay=400&t=" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

        Write-Host "Capturing $($shot.Name) ($($shot.W)x$($shot.H))..." -ForegroundColor Cyan
        $args = @(
            "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--window-size=$($shot.W),$($shot.H)",
            "--virtual-time-budget=3200",
            "--user-data-dir=$userData",
            "--no-first-run", "--no-default-browser-check",
            "--screenshot=$outFile",
            "$url"
        )
        $p = Start-Process -FilePath $edgeExe -ArgumentList $args -PassThru -NoNewWindow
        $p.WaitForExit(20000) | Out-Null

        if (Test-Path $outFile) {
            $item = Get-Item $outFile
            $len = $item.Length
            $hash = (Get-FileHash -Path $outFile -Algorithm MD5).Hash
            $results += [PSCustomObject]@{
                Name = $shot.Name
                Bytes = $len
                MD5 = $hash
                Dimensions = "$($shot.W)x$($shot.H)"
            }
            Write-Host "  -> OK: $($len) bytes, MD5: $hash" -ForegroundColor Green
        } else {
            Write-Warning "Failed to capture $($shot.Name)"
        }
    }

    Write-Host "`n================ Screenshot Summary ($Mode) ================" -ForegroundColor Cyan
    $results | Format-Table Name, Dimensions, Bytes, MD5 -AutoSize

} finally {
    $listener.Stop()
    $serverJob.Dispose()
    if (Test-Path $userData) { Remove-Item -Recurse -Force $userData -ErrorAction SilentlyContinue }
}
