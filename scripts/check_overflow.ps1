# ==============================================================================
# Ledgio Landing Page v3 — Real Horizontal Overflow & Clipped Content Check Harness
# Tests: 320, 360, 375, 390, 412, 430, 768, 1024, 1440
# Usage: powershell -ExecutionPolicy Bypass -File scripts\check_overflow.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"
$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  HORIZONTAL OVERFLOW & CLIPPED CONTENT CHECK (320px - 1440px) " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$nodeRunner = Join-Path $PSScriptRoot "run_overflow_check.js"

$runnerCode = @"
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8118;
const BASE_DIR = path.resolve(__dirname, '..');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/report-overflow') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      fs.writeFileSync(path.join(__dirname, 'overflow_report.json'), body, 'utf8');
      cleanup(0);
    });
    return;
  }
  let p = req.url.split('?')[0].replace(/^\//, '');
  if (!p) p = 'index.html';
  const fp = path.join(BASE_DIR, p);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(fp));
  } else {
    res.writeHead(404);
    res.end();
  }
});

let proc = null;
const udir = path.join('C:\\\\Users\\\\stand\\\\AppData\\\\Local\\\\Temp', 'edge_overflow_' + Date.now());

function cleanup(code) {
  if (proc) {
    try { proc.kill(); } catch (e) {}
  }
  server.close();
  try {
    fs.rmSync(udir, { recursive: true, force: true });
  } catch (e) {}
  process.exit(code);
}

server.listen(PORT, () => {
  const edgePaths = [
    'C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',
    'C:\\\\Program Files\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe'
  ];
  const edgeExe = edgePaths.find(p => fs.existsSync(p));
  if (!edgeExe) {
    console.error('Edge executable not found!');
    cleanup(1);
  }

  proc = spawn(edgeExe, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1600,1000',
    '--user-data-dir=' + udir,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:' + PORT + '/tests/check_overflow.html'
  ]);

  setTimeout(() => {
    console.error('Timeout waiting for overflow report (45s)');
    cleanup(1);
  }, 45000);
});
"@

Set-Content -Path $nodeRunner -Value $runnerCode -Encoding UTF8

$reportJson = Join-Path $PSScriptRoot "overflow_report.json"
if (Test-Path $reportJson) { Remove-Item -Force $reportJson }

try {
    $nodeProc = Start-Process -FilePath "node" -ArgumentList "`"$nodeRunner`"" -PassThru -NoNewWindow
    $nodeProc.WaitForExit()
} finally {
    if (Test-Path $nodeRunner) { Remove-Item -Force $nodeRunner }
}

$allPassed = $true

if (Test-Path $reportJson) {
    $results = Get-Content $reportJson -Raw | ConvertFrom-Json
    Remove-Item -Force $reportJson
    
    foreach ($data in $results) {
        $w = $data.targetWidth
        $scrollW = $data.scrollWidth
        $innerW = $data.viewportWidth
        $overflowElements = $data.overflowingElements
        $clippedElements = $data.clippedElements

        if ($data.hasOverflow) {
            $allPassed = $false
            Write-Host "  [FAIL] Width: ${w}px -> innerWidth: ${innerW}px, scrollWidth: ${scrollW}px (DEFECT DETECTED)" -ForegroundColor Red
            if ($overflowElements) {
                foreach ($el in $overflowElements) {
                    Write-Host "         Overflow: <$($el.tag)> id='$($el.id)' class='$($el.className)' right=$($el.right)px (+$(($el.overflowPx))px)" -ForegroundColor Yellow
                }
            }
            if ($clippedElements) {
                foreach ($el in $clippedElements) {
                    Write-Host "         Clipped: <$($el.tag)> id='$($el.id)' class='$($el.className)' scrollWidth=$($el.scrollWidth)px > clientWidth=$($el.clientWidth)px (+$(($el.clippedPx))px) $($el.childInfo)" -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host "  [PASS] Width: ${w}px -> innerWidth: ${innerW}px, scrollWidth: ${scrollW}px (zero overflow, zero clipped elements)" -ForegroundColor Green
        }
    }
} else {
    $allPassed = $false
    Write-Host "  [FAIL] Did not receive measurement report from browser!" -ForegroundColor Red
}

Write-Host "============================================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "  >>> OVERFLOW & CLIPPED CONTENT AUDIT VERIFIED: ALL 9 VIEWPORTS PASS <<<`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "  >>> AUDIT FAILED: OVERFLOW OR CLIPPED CONTENT DETECTED ON ONE OR MORE VIEWPORTS <<<`n" -ForegroundColor Red
    exit 1
}
