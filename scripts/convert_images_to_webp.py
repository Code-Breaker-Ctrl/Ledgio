import os
from PIL import Image

raw_dir = r"D:\Programs\Ledgio\docs\ui\landing-v2\raw_png"
out_dir = r"D:\Programs\Ledgio\assets\img\landing"

os.makedirs(out_dir, exist_ok=True)

files = [
    "screen_dashboard_dark",
    "screen_dashboard_light",
    "screen_stat_cards_percent",
    "screen_budgets",
    "screen_goals",
    "screen_loans_list",
    "screen_reports",
    "screen_loan_modal",
    "screen_categories"
]

print("=== Converting Landing Assets to WebP (Quality 85, Method 6) ===")

for name in files:
    png_path = os.path.join(raw_dir, f"{name}.png")
    webp_path = os.path.join(out_dir, f"{name}.webp")
    
    if not os.path.exists(png_path):
        print(f"[MISSING] {png_path}")
        continue
        
    with Image.open(png_path) as img:
        # Convert RGBA or RGB to WebP with optimal compression
        img.save(webp_path, "WEBP", quality=85, method=6)
        
    size_kb = os.path.getsize(webp_path) / 1024
    print(f"[OK] {name}.webp: {size_kb:.1f} KB (<= 150 KB limit: {size_kb <= 150})")

print("=== All WebP Assets Converted Successfully ===")
