# ==============================================================================
# Ledgio — Automated Asset Minifier & Build Script
# Usage: powershell -ExecutionPolicy Bypass -File scripts\build.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Ledgio Production Asset Minification Engine   " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

function Minify-Css($code) {
    $code = [regex]::Replace($code, '/\*[\s\S]*?\*/', '')
    $code = [regex]::Replace($code, '\s+', ' ')
    $code = [regex]::Replace($code, '\s*([{};:,>+~])\s*', '$1')
    $code = [regex]::Replace($code, ';}', '}')
    return $code.Trim()
}

function Minify-Js($code) {
    $code = [regex]::Replace($code, '/\*[\s\S]*?\*/', '')
    $lines = $code -split "`r?`n"
    $cleanLines = foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if (-not $trimmed.StartsWith('//')) {
            $line
        }
    }
    return ($cleanLines -join "`n")
}

$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

# Minify CSS
$cssFiles = @("styles.css", "dashboard.css")
foreach ($css in $cssFiles) {
    $srcPath = Join-Path $baseDir "assets\css\$css"
    $minName = $css.Replace(".css", ".min.css")
    $dstPath = Join-Path $baseDir "assets\css\$minName"
    
    if (Test-Path $srcPath) {
        Write-Host "Minifying CSS: $css -> $minName" -ForegroundColor Green
        $content = [System.IO.File]::ReadAllText($srcPath, [System.Text.Encoding]::UTF8)
        $minified = Minify-Css $content
        [System.IO.File]::WriteAllText($dstPath, $minified, $utf8NoBom)
    }
}

# Minify JS
$jsFiles = @("app.js", "auth.js", "pwa-installer.js", "supabase-config.js")
foreach ($js in $jsFiles) {
    $srcPath = Join-Path $baseDir "assets\js\$js"
    $minName = $js.Replace(".js", ".min.js")
    $dstPath = Join-Path $baseDir "assets\js\$minName"
    
    if (Test-Path $srcPath) {
        Write-Host "Minifying JS:  $js -> $minName" -ForegroundColor Yellow
        $content = [System.IO.File]::ReadAllText($srcPath, [System.Text.Encoding]::UTF8)
        $minified = Minify-Js $content
        [System.IO.File]::WriteAllText($dstPath, $minified, $utf8NoBom)
    }
}

Write-Host "`nBuild complete! All bundles successfully compiled in UTF-8." -ForegroundColor Cyan