param(
    [ValidateSet("before", "after")]
    [string]$Stage = "before",
    [switch]$Quick390Only
)

$ErrorActionPreference = "Stop"
$port = 8102
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$outDir = Join-Path $baseDir "docs\ui\mobile-redesign\$Stage"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()
Write-Host "Server started on http://127.0.0.1:$port/ for $Stage capture" -ForegroundColor Green

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
                $msg = [System.Text.Encoding]::UTF8.GetBytes("Not found: $rawPath")
                $res.ContentLength64 = $msg.Length
                $res.OutputStream.Write($msg, 0, $msg.Length)
            }
            $res.OutputStream.Close()
        } catch {
            if (-not $listener.IsListening) { break }
        }
    }
}).AddArgument($listener).AddArgument($baseDir)
$asyncHandle = $serverJob.BeginInvoke()

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$userDataDir = "C:\Users\stand\AppData\Local\Temp\edge_screenshot_userData_redesign_$Stage"

$tasks = @(
    # 1. Dashboard stat cards
    @{ Name = "dashboard_percent_dark_390"; Width = 390; Height = 844; Query = "?screen=dashboard&case=percent&theme=dark" },
    @{ Name = "dashboard_number_dark_390"; Width = 390; Height = 844; Query = "?screen=dashboard&case=number&theme=dark" },
    @{ Name = "dashboard_percent_light_390"; Width = 390; Height = 844; Query = "?screen=dashboard&case=percent&theme=light" },
    @{ Name = "dashboard_overspend_dark_390"; Width = 390; Height = 844; Query = "?screen=dashboard&case=overspend&theme=dark" },
    @{ Name = "dashboard_negative_dark_390"; Width = 390; Height = 844; Query = "?screen=dashboard&case=negative&theme=dark" },
    @{ Name = "dashboard_stealth_dark_390"; Width = 390; Height = 844; Query = "?screen=dashboard&case=stealth&theme=dark" },

    # 2. Loan modal
    @{ Name = "loan_modal_lent_dark_390"; Width = 390; Height = 844; Query = "?screen=loan-modal&case=lent&theme=dark" },
    @{ Name = "loan_modal_borrowed_dark_390"; Width = 390; Height = 844; Query = "?screen=loan-modal&case=borrowed&theme=dark" },
    @{ Name = "loan_modal_lent_light_390"; Width = 390; Height = 844; Query = "?screen=loan-modal&case=lent&theme=light" },
    @{ Name = "loan_modal_borrowed_light_390"; Width = 390; Height = 844; Query = "?screen=loan-modal&case=borrowed&theme=light" },
    @{ Name = "loan_modal_keyboard_dark_390"; Width = 390; Height = 520; Query = "?screen=loan-modal&case=keyboard&theme=dark" },

    # 3. Reports
    @{ Name = "reports_data_dark_390"; Width = 390; Height = 844; Query = "?screen=reports&case=data&theme=dark" },
    @{ Name = "reports_data_light_390"; Width = 390; Height = 844; Query = "?screen=reports&case=data&theme=light" },
    @{ Name = "reports_empty_dark_390"; Width = 390; Height = 844; Query = "?screen=reports&case=empty&theme=dark" },
    @{ Name = "reports_many_categories_dark_390"; Width = 390; Height = 844; Query = "?screen=reports&case=many-categories&theme=dark" }
)

if (-not $Quick390Only) {
    # Additional mobile widths (360x800 and 430x932) and desktop (1440x900)
    $tasks += @(
        # 360x800 Compact Mobile
        @{ Name = "dashboard_percent_dark_360"; Width = 360; Height = 800; Query = "?screen=dashboard&case=percent&theme=dark" },
        @{ Name = "dashboard_number_dark_360"; Width = 360; Height = 800; Query = "?screen=dashboard&case=number&theme=dark" },
        @{ Name = "loan_modal_borrowed_dark_360"; Width = 360; Height = 800; Query = "?screen=loan-modal&case=borrowed&theme=dark" },
        @{ Name = "reports_data_dark_360"; Width = 360; Height = 800; Query = "?screen=reports&case=data&theme=dark" },

        # 430x932 Large Mobile
        @{ Name = "dashboard_percent_dark_430"; Width = 430; Height = 932; Query = "?screen=dashboard&case=percent&theme=dark" },
        @{ Name = "dashboard_number_dark_430"; Width = 430; Height = 932; Query = "?screen=dashboard&case=number&theme=dark" },
        @{ Name = "loan_modal_borrowed_dark_430"; Width = 430; Height = 932; Query = "?screen=loan-modal&case=borrowed&theme=dark" },
        @{ Name = "reports_data_dark_430"; Width = 430; Height = 932; Query = "?screen=reports&case=data&theme=dark" },

        # 1440x900 Desktop Regression Baseline
        @{ Name = "dashboard_percent_dark_1440"; Width = 1440; Height = 900; Query = "?screen=dashboard&case=percent&theme=dark" },
        @{ Name = "loan_modal_borrowed_dark_1440"; Width = 1440; Height = 900; Query = "?screen=loan-modal&case=borrowed&theme=dark" },
        @{ Name = "reports_data_dark_1440"; Width = 1440; Height = 900; Query = "?screen=reports&case=data&theme=dark" }
    )
}

try {
    foreach ($t in $tasks) {
        if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue }
        $outPath = Join-Path $outDir "$($t.Name).png"
        if (Test-Path $outPath) { Remove-Item $outPath -Force }

        $w = $t.Width
        $h = $t.Height
        $q = $t.Query
        Write-Host "Capturing $($t.Name) at ${w}x${h}..." -ForegroundColor Yellow

        $edgeArgs = @(
            "--headless=new",
            "--disable-gpu",
            "--window-size=$w,$h",
            "--virtual-time-budget=6000",
            "--screenshot=$outPath",
            "--user-data-dir=$userDataDir",
            "--no-first-run",
            "--no-default-browser-check",
            "http://127.0.0.1:$port/tests/screenshot_mobile_redesign.html$q"
        )

        $proc = Start-Process -FilePath $edgePath -ArgumentList $edgeArgs -PassThru -NoNewWindow
        $proc.WaitForExit(15000)

        if (Test-Path $outPath) {
            $bytes = (Get-Item $outPath).Length
            Write-Host "  -> OK: $outPath ($bytes bytes)" -ForegroundColor Green
        } else {
            Write-Host "  -> FAILED: $outPath" -ForegroundColor Red
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
    $serverJob.Dispose()
    if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue }
}

Write-Host "`nAll $Stage captures completed in $outDir" -ForegroundColor Cyan
