#!/usr/bin/env python3
"""
Generate square thumbnails for all PNGs in state_flags_png_1024/state_flags_png.

Defaults:
 - size: 128x128 (change SIZE variable to adjust)
 - output: outputs/thumbnails (created if missing)

Thumbnails preserve aspect ratio and are centered on a white background.
"""
from pathlib import Path
from PIL import Image

SRC_DIR = Path("state_flags_png_1024/state_flags_png")
OUT_DIR = Path("outputs/thumbnails")
OUT_DIR.mkdir(parents=True, exist_ok=True)

SIZE = (128, 128)  # width, height in pixels

pngs = sorted([p for p in SRC_DIR.iterdir() if p.is_file() and p.suffix.lower() == ".png"]) 
if not pngs:
    print(f"No PNG files found in {SRC_DIR.resolve()}")
    raise SystemExit(1)

created = []
for p in pngs:
    with Image.open(p) as im:
        im = im.convert("RGBA")
        im.thumbnail(SIZE, Image.LANCZOS)

        # white background
        background = Image.new("RGBA", SIZE, (255, 255, 255, 255))
        x = (SIZE[0] - im.width) // 2
        y = (SIZE[1] - im.height) // 2
        background.paste(im, (x, y), im)

        out_path = OUT_DIR / p.name
        # save as PNG
        background.convert("RGBA").save(out_path, format="PNG", optimize=True)
        created.append(out_path.name)

print(f"Created {len(created)} thumbnails in: {OUT_DIR}")
print("Sample:")
for name in created[:10]:
    print(name)
