"""Slice Tom-Tom spritesheet: mesma escala, pés na base, preserva roupa escura."""
from PIL import Image
import json
from pathlib import Path
from collections import deque

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "tomtom-spritesheet.png"
OUT = ROOT / "assets" / "sprites"
FRAME_H = 96
FRAME_MAX_W = 110

# magic/inspect (prancheta/luneta) vieram cortados na cintura — fora
ROW_NAMES = [
    "idle_front",
    "run",
    "walk",
    "wave",
    "jump",
    "emotion",
    "think",
]

# Faixas detectadas no sheet 840x1024 (fundo preto puro)
FIXED_BANDS = [
    (11, 101),
    (125, 215),
    (239, 328),
    (353, 443),
    (467, 556),
    (581, 670),
    (694, 784),
]

def is_sheet_bg(r, g, b, a=255, thr=10):
    # só preto do fundo do sheet (roupa azul/marrom escura fica)
    return a < 8 or (r <= thr and g <= thr and b <= thr)

def flood_clear_cell(cell, thr=10):
    """Remove fundo preto a partir dos cantos da célula."""
    cell = cell.convert("RGBA")
    w, h = cell.size
    px = cell.load()
    seen = [[False] * w for _ in range(h)]
    q = deque()

    def try_push(x, y):
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            return
        r, g, b, a = px[x, y]
        if is_sheet_bg(r, g, b, a, thr):
            seen[y][x] = True
            q.append((x, y))

    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        try_push(x, y)
    # também varre a borda inteira (mais seguro)
    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            try_push(nx, ny)
    return cell

def is_content_pixel(r, g, b, a):
    return a > 16 and not is_sheet_bg(r, g, b, a, thr=10)

def find_segs(im, y0, y1):
    w, _ = im.size
    px = im.load()
    cols = [any(is_content_pixel(*px[x, y]) for y in range(y0, y1 + 1)) for x in range(w)]
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
    # ignora ruído entre frames
    return [(a, b) for a, b in segs if (b - a) >= 36]

def extract_content(im, x0, x1, y0, y1):
    pad = 3
    cell = im.crop((
        max(0, x0 - pad),
        y0,
        min(im.width, x1 + 1 + pad),
        y1 + 1,
    ))
    cell = flood_clear_cell(cell, thr=10)
    bbox = cell.getbbox()
    if not bbox:
        return Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    l, t, r, b = bbox
    return cell.crop((max(0, l - 1), max(0, t - 1), min(cell.width, r + 1), min(cell.height, b + 1)))

def pack_frame(content, body_scale):
    nw = max(1, int(round(content.width * body_scale)))
    nh = max(1, int(round(content.height * body_scale)))
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
    x = (canvas_w - nw) // 2
    y = FRAME_H - nh
    canvas.paste(resized, (x, y), resized)
    return canvas

def main():
    im = Image.open(SRC).convert("RGBA")
    bands = FIXED_BANDS
    assert len(bands) == len(ROW_NAMES)

    idle_y0, idle_y1 = bands[0]
    idle_segs = find_segs(im, idle_y0, idle_y1)
    idle_heights = []
    for x0, x1 in idle_segs:
        c = extract_content(im, x0, x1, idle_y0, idle_y1)
        idle_heights.append(c.height)
    avg_stand = sum(idle_heights) / max(1, len(idle_heights))
    body_scale = (FRAME_H * 0.92) / avg_stand
    print(f"avg_stand={avg_stand:.1f} body_scale={body_scale:.3f} segs_idle={len(idle_segs)}")

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
            content = extract_content(im, x0, x1, y0, y1)
            canvas = pack_frame(content, body_scale)
            out = OUT / name / f"{i}.png"
            canvas.save(out, optimize=True)
            files.append(f"sprites/{name}/{i}.png")
            max_w = max(max_w, canvas.width)
            print(f"{name}/{i}.png {canvas.size} src={content.size}")
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
