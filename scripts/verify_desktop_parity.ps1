# ==============================================================================
# Ledgio — Automated Desktop & Tablet Landscape Parity Guard
# Compares before/after screenshots for 1440x900 (desktop) and 1024x768 (tablet landscape)
# Fails in CI (exit code 1) if pixel difference exceeds 0.1%
# Usage: powershell -ExecutionPolicy Bypass -File scripts\verify_desktop_parity.ps1
# ==============================================================================

param(
    [string]$BeforeDir = "docs\ui\mobile-redesign\before",
    [string]$AfterDir  = "docs\ui\mobile-redesign\after",
    [double]$ThresholdPct = 0.1
)

$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class DesktopParityChecker {
    public static double CompareImages(string path1, string path2) {
        using (Bitmap b1 = new Bitmap(path1))
        using (Bitmap b2 = new Bitmap(path2)) {
            if (b1.Width != b2.Width || b1.Height != b2.Height) {
                return 100.0;
            }
            int width = b1.Width;
            int height = b1.Height;
            int totalPixels = width * height;

            BitmapData d1 = b1.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            BitmapData d2 = b2.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);

            int diffCount = 0;
            int bytes = Math.Abs(d1.Stride) * height;
            byte[] rgb1 = new byte[bytes];
            byte[] rgb2 = new byte[bytes];

            Marshal.Copy(d1.Scan0, rgb1, 0, bytes);
            Marshal.Copy(d2.Scan0, rgb2, 0, bytes);

            b1.UnlockBits(d1);
            b2.UnlockBits(d2);

            for (int i = 0; i < bytes; i += 4) {
                int db = Math.Abs(rgb1[i] - rgb2[i]);
                int dg = Math.Abs(rgb1[i + 1] - rgb2[i + 1]);
                int dr = Math.Abs(rgb1[i + 2] - rgb2[i + 2]);
                int da = Math.Abs(rgb1[i + 3] - rgb2[i + 3]);
                // Tiny color tolerance to ignore sub-pixel anti-aliasing / font rendering jitter
                if (db > 3 || dg > 3 || dr > 3 || da > 3) {
                    diffCount++;
                }
            }

            return ((double)diffCount / totalPixels) * 100.0;
        }
    }
}
"@ -ReferencedAssemblies "System.Drawing"

$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$bPath = Join-Path $baseDir $BeforeDir
$aPath = Join-Path $baseDir $AfterDir

if (-not (Test-Path $bPath)) {
    throw "Before directory does not exist: $bPath"
}
if (-not (Test-Path $aPath)) {
    throw "After directory does not exist: $aPath"
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Ledgio Desktop & Tablet-Landscape Visual Parity Guard   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Threshold: <= $ThresholdPct% pixel difference`n" -ForegroundColor Yellow

# Targets: all 1440px and 1024px screenshots
$targets = Get-ChildItem -Path $bPath -Filter "*.png" | Where-Object {
    $_.Name -match "(_1440|_1024)\.png$"
}

if ($targets.Count -eq 0) {
    Write-Host "No desktop baseline images found matching *_1440.png or *_1024.png in $bPath" -ForegroundColor Red
    exit 1
}

$allPassed = $true
$results = @()

foreach ($item in $targets) {
    $beforeFile = $item.FullName
    $afterFile = Join-Path $aPath $item.Name

    if (-not (Test-Path $afterFile)) {
        Write-Host "[FAIL] $($item.Name) missing in after directory!" -ForegroundColor Red
        $allPassed = $false
        $results += [PSCustomObject]@{
            Screenshot = $item.Name
            DiffPct    = "MISSING"
            Status     = "FAIL"
        }
        continue
    }

    $diffPct = [DesktopParityChecker]::CompareImages($beforeFile, $afterFile)
    $rounded = [math]::Round($diffPct, 4)
    $passed = ($diffPct -le $ThresholdPct)

    if (-not $passed) {
        $allPassed = $false
        Write-Host "  [FAIL] $($item.Name) -> $rounded% (exceeds $ThresholdPct%)" -ForegroundColor Red
        $results += [PSCustomObject]@{
            Screenshot = $item.Name
            DiffPct    = "$rounded%"
            Status     = "FAIL"
        }
    } else {
        Write-Host "  [PASS] $($item.Name) -> $rounded% (<= $ThresholdPct%)" -ForegroundColor Green
        $results += [PSCustomObject]@{
            Screenshot = $item.Name
            DiffPct    = "$rounded%"
            Status     = "PASS"
        }
    }
}

Write-Host "`n=== PARITY SUMMARY TABLE ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize

if ($allPassed) {
    Write-Host "`n>>> ALL DESKTOP / TABLET-LANDSCAPE PARITY CHECKS PASSED <<<`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n>>> DESKTOP REGRESSION DETECTED! ONE OR MORE PARITY CHECKS FAILED <<<`n" -ForegroundColor Red
    exit 1
}
