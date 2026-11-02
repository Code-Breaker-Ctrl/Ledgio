# ==============================================================================
# Ledgio Refactor Screenshot Capture Runner (Before / After)
# Usage: powershell -ExecutionPolicy Bypass -File scripts\capture_refactor.ps1 -Stage before
#        powershell -ExecutionPolicy Bypass -File scripts\capture_refactor.ps1 -Stage after
# ==============================================================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("before", "after")]
    [string]$Stage = "before"
)

$ErrorActionPreference = "Stop"
$port = 8128
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$outDir = Join-Path $baseDir "docs\ui\refactor\$Stage"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
try {
    $listener.Start()
} catch {
    $port = 8129
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Start()
}
Write-Host "Server listening on http://127.0.0.1:$port/ for Stage: $Stage" -ForegroundColor Green

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

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$userDataDir = "C:\Users\stand\AppData\Local\Temp\edge_refactor_captures_" + [System.Guid]::NewGuid().ToString("N")

$items = @(
    @{ Name = "index"; Page = "index" },
    @{ Name = "login"; Page = "login" },
    @{ Name = "signup"; Page = "signup" },
    @{ Name = "reset_password"; Page = "reset-password" },
    @{ Name = "privacy"; Page = "privacy" },
    @{ Name = "terms"; Page = "terms" },
    @{ Name = "dashboard_overview"; Page = "dashboard"; Tab = "dashboard" },
    @{ Name = "dashboard_expenses"; Page = "dashboard"; Tab = "expenses" },
    @{ Name = "dashboard_reports"; Page = "dashboard"; Tab = "reports" },
    @{ Name = "dashboard_loans"; Page = "dashboard"; Tab = "loans" },
    @{ Name = "dashboard_goals"; Page = "dashboard"; Tab = "goals" },
    @{ Name = "dashboard_settings"; Page = "dashboard"; Tab = "settings" },
    @{ Name = "dashboard_modal"; Page = "dashboard"; Tab = "dashboard"; Modal = "expense" }
)

$viewports = @(
    @{ Device = "desktop_1440"; Width = 1440; Height = 900 },
    @{ Device = "mobile_390"; Width = 390; Height = 844 }
)

$themes = @("dark", "light")

try {
    $total = $items.Count * $viewports.Count * $themes.Count
    $idx = 0

    foreach ($item in $items) {
        foreach ($vp in $viewports) {
            foreach ($th in $themes) {
                $idx++
                $fileName = "$($item.Name)_$($vp.Device)_$($th).png"
                $outFile = Join-Path $outDir $fileName
                
                $query = "page=$($item.Page)&theme=$th&width=$($vp.Width)&height=$($vp.Height)"
                if ($item.Tab) { $query += "&tab=$($item.Tab)" }
                if ($item.Modal) { $query += "&modal=$($item.Modal)" }

                $url = "http://127.0.0.1:$port/tests/capture_refactor_harness.html?$query"

                Write-Host "[$idx/$total] Capturing $fileName..." -ForegroundColor Cyan

                $args = @(
                    "--headless=new",
                    "--disable-gpu",
                    "--hide-scrollbars",
                    "--window-size=$($vp.Width),$($vp.Height)",
                    "--virtual-time-budget=3000",
                    "--user-data-dir=$userDataDir",
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--screenshot=`"$outFile`"",
                    "`"$url`""
                )
                $p = Start-Process -FilePath $edgePath -ArgumentList $args -PassThru -NoNewWindow
                $p.WaitForExit(15000) | Out-Null
                if (Test-Path $outFile) {
                    $len = (Get-Item $outFile).Length
                    Write-Host "  -> OK ($len bytes)" -ForegroundColor Green
                } else {
                    Write-Warning "  -> FAILED to capture $fileName"
                }
            }
        }
    }
} finally {
    $listener.Stop()
    $serverJob.Dispose()
    Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue
    Write-Host "`nCapture run for $Stage complete." -ForegroundColor Yellow
}
