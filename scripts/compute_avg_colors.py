#!/usr/bin/env python3
"""
Compute per-image average RGB and normalize to 0..1.
Scans the directory: state_flags_png_1024/state_flags_png
Outputs:
 - outputs/avg_colors.json  (list of {"file": name, "r":.., "g":.., "b":..})
 - outputs/avg_colors.csv   (file,r,g,b)
"""
import os
import json
from pathlib import Path

try:
    from PIL import Image
except Exception:
    raise

SRC_DIR = Path("state_flags_png_1024/state_flags_png")
OUT_DIR = Path("outputs")
OUT_DIR.mkdir(exist_ok=True)

results = []

files = sorted([p for p in SRC_DIR.iterdir() if p.is_file() and p.suffix.lower() == ".png"])
if not files:
    print(f"No PNG files found in {SRC_DIR.resolve()}")
    raise SystemExit(1)

for p in files:
    with Image.open(p) as img:
        img = img.convert('RGB')
        pixels = img.getdata()
        n = len(pixels)
        r_sum = g_sum = b_sum = 0
        for r, g, b in pixels:
            r_sum += r
            g_sum += g
            b_sum += b
        r_avg = r_sum / n
        g_avg = g_sum / n
        b_avg = b_sum / n
        # normalize to 0..1
        r_n = r_avg / 255.0
        g_n = g_avg / 255.0
        b_n = b_avg / 255.0
        results.append({
            "file": p.name,
            "r": round(r_n, 6),
            "g": round(g_n, 6),
            "b": round(b_n, 6),
        })

json_out = OUT_DIR / "avg_colors.json"
csv_out = OUT_DIR / "avg_colors.csv"

with json_out.open('w', encoding='utf-8') as f:
    json.dump(results, f, indent=2)

with csv_out.open('w', encoding='utf-8') as f:
    f.write('file,r,g,b\n')
    for r in results:
        f.write(f"{r['file']},{r['r']},{r['g']},{r['b']}\n")

print(f"Processed {len(results)} images")
print(f"Wrote: {json_out} and {csv_out}")
print("Sample (first 10):")
for item in results[:10]:
    print(item)
