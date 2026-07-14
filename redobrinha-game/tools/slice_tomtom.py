"""Slice Tom-Tom spritesheet into animation folders using content detection."""
from PIL import Image
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "tomtom-spritesheet.png"
OUT = ROOT / "assets" / "sprites"

# Row names (top → bottom). Row 2 is run-right, row 3 is run-left art.
ROW_NAMES = [
    "idle_front",  # 6
    "run",         # 8 right
    "walk",        # 8 left-facing art
    "wave",        # 4
    "jump",        # 5
    "emotion",     # 8 hurt/crouch/getup
    "think",       # 6 idle variants (extra folder)
    "magic",       # 6 laptop
    "inspect",     # 6 magnify + thumbs
]

def is_content(px, x, y):
    r, g, b, a = px[x, y]
    return a > 20 and (r > 22 or g > 22 or b > 22)

def find_bands(im):
    w, h = im.size
    px = im.load()
    rows = [any(is_content(px, x, y) for x in range(w)) for y in range(h)]
    bands = []
    inb = False
    for i, v in enumerate(rows):
        if v and not inb:
            s = i
            inb = True
        elif not v and inb:
            bands.append((s, i - 1))
            inb = False
    if inb:
        bands.append((s, h - 1))
    return bands

def find_segs(im, y0, y1):
    w, _ = im.size
    px = im.load()
    cols = [any(is_content(px, x, y) for y in range(y0, y1 + 1)) for x in range(w)]
    segs = []
    inb = False
    for x, v in enumerate(cols):
        if v and not inb:
            s = x
            inb = True
        elif not v and inb:
            segs.append((s, x - 1))
            inb = False
    if inb:
        segs.append((s, w - 1))
    return segs

def make_transparent(im):
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r < 18 and g < 18 and b < 18:
                px[x, y] = (0, 0, 0, 0)
    return im

def main():
    im = make_transparent(Image.open(SRC).convert("RGBA"))
    bands = find_bands(im)
    assert len(bands) == len(ROW_NAMES), f"Expected {len(ROW_NAMES)} rows, got {len(bands)}"

    # remove old animation folders we manage + think
    for name in set(ROW_NAMES) | {"idle_front", "run", "walk", "wave", "jump", "emotion", "magic", "inspect", "think"}:
        d = OUT / name
        if d.exists():
            for old in d.glob("*.png"):
                old.unlink()
        d.mkdir(parents=True, exist_ok=True)

    manifest = {}
    for name, (y0, y1) in zip(ROW_NAMES, bands):
        segs = find_segs(im, y0, y1)
        files = []
        max_w = max_h = 0
        for i, (x0, x1) in enumerate(segs):
            # slight pad
            pad = 2
            cell = im.crop((
                max(0, x0 - pad),
                max(0, y0 - pad),
                min(im.width, x1 + 1 + pad),
                min(im.height, y1 + 1 + pad),
            ))
            bbox = cell.getbbox()
            if bbox:
                cell = cell.crop(bbox)
            out = OUT / name / f"{i}.png"
            cell.save(out)
            files.append(f"sprites/{name}/{i}.png")
            max_w = max(max_w, cell.width)
            max_h = max(max_h, cell.height)
            print(f"{name}/{i}.png {cell.size}")
        manifest[name] = {"count": len(segs), "w": max_w, "h": max_h, "files": files}

    # assets/run sync
    run_dir = ROOT / "assets" / "run"
    run_dir.mkdir(exist_ok=True)
    for old in run_dir.glob("*.png"):
        old.unlink()
    for i in range(manifest["run"]["count"]):
        Image.open(OUT / "run" / f"{i}.png").save(run_dir / f"{i}.png")

    (ROOT / "assets" / "sprite-manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    print("OK", json.dumps({k: v["count"] for k, v in manifest.items()}))

if __name__ == "__main__":
    main()
