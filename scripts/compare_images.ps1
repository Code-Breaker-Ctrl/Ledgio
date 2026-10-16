param(
    [string]$File1,
    [string]$File2,
    [double]$ThresholdPct = 0.1
)

Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class ImageComparer {
    public static double Compare(string path1, string path2) {
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
                // Compare B, G, R, A with a tiny color tolerance to ignore sub-pixel anti-aliasing jitter
                int db = Math.Abs(rgb1[i] - rgb2[i]);
                int dg = Math.Abs(rgb1[i + 1] - rgb2[i + 1]);
                int dr = Math.Abs(rgb1[i + 2] - rgb2[i + 2]);
                int da = Math.Abs(rgb1[i + 3] - rgb2[i + 3]);
                if (db > 2 || dg > 2 || dr > 2 || da > 2) {
                    diffCount++;
                }
            }

            return ((double)diffCount / totalPixels) * 100.0;
        }
    }
}
"@ -ReferencedAssemblies "System.Drawing"

$diff = [ImageComparer]::Compare((Resolve-Path $File1).Path, (Resolve-Path $File2).Path)
Write-Host "Pixel diff: $([math]::Round($diff, 4))%"
if ($diff -gt $ThresholdPct) {
    Write-Host "FAILED: Diff exceeds threshold ($ThresholdPct%)" -ForegroundColor Red
    exit 1
} else {
    Write-Host "PASSED: Within threshold ($ThresholdPct%)" -ForegroundColor Green
    exit 0
}
