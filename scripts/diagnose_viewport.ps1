param(
    [int]$Port = 8110
)

$ErrorActionPreference = "Stop"
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "Diagnostic Server started on http://127.0.0.1:$Port/" -ForegroundColor Green

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
$userDataDir = "C:\Users\stand\AppData\Local\Temp\edge_viewport_diagnostic"
if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue }

try {
    Write-Host "Launching Edge headless with mobile emulation (390x844, touch, dpr=3)..." -ForegroundColor Yellow
    $edgeArgs = @(
        "--headless=new",
        "--disable-gpu",
        "--window-size=390,844",
        "--user-data-dir=$userDataDir",
        "--no-first-run",
        "--no-default-browser-check",
        "--virtual-time-budget=10000",
        "--dump-dom",
        "http://127.0.0.1:$Port/tests/test_viewport_repro.html"
    )

    $proc = Start-Process -FilePath $edgePath -ArgumentList $edgeArgs -PassThru -NoNewWindow -RedirectStandardOutput "$baseDir\diag_dom.txt"
    $proc.WaitForExit(15000)

    if (Test-Path "$baseDir\diag_dom.txt") {
        $dom = Get-Content "$baseDir\diag_dom.txt" -Raw
        $match = [regex]::Match($dom, '(?s)<div id="output"[^>]*>(.*?)</div>')
        if ($match.Success) {
            Write-Host "`n=== DIAGNOSTIC HARNESS LOGS ===" -ForegroundColor Cyan
            Write-Host $match.Groups[1].Value
        } else {
            Write-Host "No output box found in dump-dom." -ForegroundColor Red
        }
        Remove-Item "$baseDir\diag_dom.txt" -Force
    }
} finally {
    $listener.Stop()
    $listener.Close()
    $serverJob.Dispose()
    if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir -ErrorAction SilentlyContinue }
}
