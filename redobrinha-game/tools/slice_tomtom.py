"""Slice Tom-Tom spritesheet: mesmos escala e pés alinhados embaixo."""
from PIL import Image
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "tomtom-spritesheet.png"
OUT = ROOT / "assets" / "sprites"
FRAME_H = 96
# Largura máxima do canvas (poses largas cabem sem estourar o jogo)
FRAME_MAX_W = 110

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

def content_crop(im, x0, x1, y0, y1):
    cell = im.crop((x0, y0, x1 + 1, y1 + 1))
    bbox = cell.getbbox()
    if not bbox:
        return Image.new("RGBA", (40, FRAME_H), (0, 0, 0, 0))
    return cell.crop(bbox)

def pack_frame(content, body_scale):
    """Escala pelo body_scale (idle em pé) e cola os pés embaixo."""
    nw = max(1, int(round(content.width * body_scale)))
    nh = max(1, int(round(content.height * body_scale)))
    # não ultrapassar altura do frame
    if nh > FRAME_H - 2:
        k = (FRAME_H - 2) / nh
        nw = max(1, int(round(nw * k)))
        nh = max(1, int(round(nh * k)))
    if nw > FRAME_MAX_W:
        k = FRAME_MAX_W / nw
        nw = max(1, int(round(nw * k)))
        nh = max(1, int(round(nh * k)))
    resized = content.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas_w = max(nw, 48)
    canvas = Image.new("RGBA", (canvas_w, FRAME_H), (0, 0, 0, 0))
    # pés na base
    x = (canvas_w - nw) // 2
    y = FRAME_H - nh
    canvas.paste(resized, (x, y), resized)
    return canvas

def main():
    im = make_transparent(Image.open(SRC).convert("RGBA"))
    bands = find_bands(im)
    assert len(bands) == len(ROW_NAMES), f"Expected {len(ROW_NAMES)} rows, got {len(bands)}"

    # Escala baseada na altura média do idle em pé (bolsos)
    idle_y0, idle_y1 = bands[0]
    idle_segs = find_segs(im, idle_y0, idle_y1)
    idle_heights = []
    for x0, x1 in idle_segs:
        c = content_crop(im, max(0, x0 - 2), min(im.width - 1, x1 + 2), idle_y0, idle_y1)
        idle_heights.append(c.height)
    avg_stand = sum(idle_heights) / len(idle_heights)
    # personagem em pé ocupa ~92% da altura do frame
    body_scale = (FRAME_H * 0.92) / avg_stand
    print(f"avg_stand={avg_stand:.1f} body_scale={body_scale:.3f}")

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
            content = content_crop(im, max(0, x0 - 2), min(im.width - 1, x1 + 2), y0, y1)
            canvas = pack_frame(content, body_scale)
            out = OUT / name / f"{i}.png"
            canvas.save(out, optimize=True)
            files.append(f"sprites/{name}/{i}.png")
            max_w = max(max_w, canvas.width)
            print(f"{name}/{i}.png {canvas.size} content~{content.size}")
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
