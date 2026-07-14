"""Slice Tom-Tom spritesheet with uniform frame height (no giant/tiny frames)."""
from PIL import Image
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "tomtom-spritesheet.png"
OUT = ROOT / "assets" / "sprites"
# Altura fixa de todos os frames (pés alinhados embaixo)
FRAME_H = 96

ROW_NAMES = [
    "idle_front",
    "run",
    "walk",
    "wave",
    "jump",
    "emotion",
    "think",
    "magic",
    "inspect",
]

def is_content(px, x, y):
    r, g, b, a = px[x, y]
    return a > 20 and (r > 22 or g > 22 or b > 22)

def find_bands(im):
    w, h = im.size
    px = im.load()
    rows = [any(is_content(px, x, y) for x in range(w)) for y in range(h)]
    bands, inb = [], False
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
    segs, inb = [], False
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

    for name in ROW_NAMES:
        d = OUT / name
        d.mkdir(parents=True, exist_ok=True)
        for old in d.glob("*.png"):
            old.unlink()

    manifest = {}
    for name, (y0, y1) in zip(ROW_NAMES, bands):
        segs = find_segs(im, y0, y1)
        files = []
        max_w = 0
        for i, (x0, x1) in enumerate(segs):
            pad_x = 2
            # Mantém a altura da faixa inteira (não corta em cima/baixo)
            cell = im.crop((
                max(0, x0 - pad_x),
                y0,
                min(im.width, x1 + 1 + pad_x),
                y1 + 1,
            ))
            # Alinha o conteúdo no fundo e redimensiona para FRAME_H fixo
            canvas = Image.new("RGBA", (cell.width, FRAME_H), (0, 0, 0, 0))
            # escala proporcional se a faixa for maior/menor que FRAME_H
            scale = FRAME_H / cell.height
            new_w = max(1, int(round(cell.width * scale)))
            resized = cell.resize((new_w, FRAME_H), Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", (new_w, FRAME_H), (0, 0, 0, 0))
            canvas.paste(resized, (0, 0), resized)

            out = OUT / name / f"{i}.png"
            canvas.save(out, optimize=True)
            files.append(f"sprites/{name}/{i}.png")
            max_w = max(max_w, canvas.width)
            print(f"{name}/{i}.png {canvas.size}")
        manifest[name] = {"count": len(segs), "w": max_w, "h": FRAME_H, "files": files}

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
