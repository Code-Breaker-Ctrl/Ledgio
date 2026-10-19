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

# Validate Application Version Consistency across codebase
$supabaseConfigContent = [System.IO.File]::ReadAllText((Join-Path $baseDir "assets\js\supabase-config.js"), [System.Text.Encoding]::UTF8)
$swContent = [System.IO.File]::ReadAllText((Join-Path $baseDir "sw.js"), [System.Text.Encoding]::UTF8)
$readmeContent = [System.IO.File]::ReadAllText((Join-Path $baseDir "README.md"), [System.Text.Encoding]::UTF8)

$cfgVerMatch = [regex]::Match($supabaseConfigContent, 'LEDGIO_VERSION\s*=\s*[''"]([^''"]+)[''"]')
$swVerMatch = [regex]::Match($swContent, 'LEDGIO_VERSION\s*=\s*[''"]([^''"]+)[''"]')
if (-not $swVerMatch.Success) {
    $swVerMatch = [regex]::Match($swContent, 'CACHE_NAME\s*=\s*[''"]ledgio-v([^''"]+)[''"]')
}
$readmeVerMatch = [regex]::Match($readmeContent, 'badge/Version-([0-9.]+)-emerald')

if (-not $cfgVerMatch.Success -or -not $swVerMatch.Success -or -not $readmeVerMatch.Success) {
    throw "Failed to extract version strings for consistency validation! (Config: $($cfgVerMatch.Success), SW: $($swVerMatch.Success), README: $($readmeVerMatch.Success))"
}

$cfgVer = $cfgVerMatch.Groups[1].Value
$swVer = $swVerMatch.Groups[1].Value
$readmeVer = $readmeVerMatch.Groups[1].Value

if ($cfgVer -ne $swVer -or $cfgVer -ne $readmeVer) {
    throw "Version mismatch detected! supabase-config.js: '$cfgVer', sw.js: '$swVer', README.md: '$readmeVer'"
}
Write-Host "Version consistency verified: v$cfgVer (supabase-config.js, sw.js, README.md)" -ForegroundColor Green

# Validate that all HTML files referencing asset query versions match LEDGIO_VERSION
$htmlFiles = Get-ChildItem -Path $baseDir -Filter "*.html" -Recurse | Where-Object { $_.FullName -notmatch '[\\/](node_modules|\.git)[\\/]' }
$htmlVersionMismatches = @()
$totalCheckedVQueries = 0

foreach ($htmlFile in $htmlFiles) {
    $htmlContent = [System.IO.File]::ReadAllText($htmlFile.FullName, [System.Text.Encoding]::UTF8)
    $vMatches = [regex]::Matches($htmlContent, '[\?&]v=([^"''\s>&]+)')
    foreach ($vm in $vMatches) {
        $totalCheckedVQueries++
        $foundVer = $vm.Groups[1].Value
        if ($foundVer -ne $cfgVer) {
            $relPath = $htmlFile.FullName.Substring($baseDir.Length).TrimStart('\', '/')
            $htmlVersionMismatches += "$relPath references '?v=$foundVer' (expected '$cfgVer')"
        }
    }
}

if ($htmlVersionMismatches.Count -gt 0) {
    throw "HTML Asset Query Version Mismatch detected!`n$($htmlVersionMismatches -join "`n")"
}
Write-Host "HTML asset query version consistency verified: $totalCheckedVQueries queries across $($htmlFiles.Count) HTML files match v$cfgVer" -ForegroundColor Green

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
$jsFiles = @("app.js", "auth.js", "categories.js", "expenses.js", "goals.js", "hero-living.js", "income.js", "loans.js", "pwa-installer.js", "supabase-config.js", "sync-engine.js", "vault.js")
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

# Synchronize Database Migrations (backend/migrations -> supabase/migrations)
$srcMigDir = Join-Path $baseDir "backend\migrations"
$dstMigDir = Join-Path $baseDir "supabase\migrations"
if (Test-Path $srcMigDir) {
    if (-not (Test-Path $dstMigDir)) { New-Item -ItemType Directory -Path $dstMigDir -Force | Out-Null }
    $migFiles = Get-ChildItem -Path $srcMigDir -Filter "*.sql"
    foreach ($mig in $migFiles) {
        $destPath = Join-Path $dstMigDir $mig.Name
        Copy-Item -Path $mig.FullName -Destination $destPath -Force
    }
    Write-Host "Synchronized $($migFiles.Count) migrations from backend\migrations to supabase\migrations" -ForegroundColor Magenta
}

Write-Host "`nBuild complete! All bundles successfully compiled in UTF-8." -ForegroundColor Cyan