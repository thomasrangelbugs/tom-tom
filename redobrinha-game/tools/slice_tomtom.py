"""Fatiar sprites do sheet ORIGINAL (assests.png) sem redimensionar / perder qualidade."""
from PIL import Image
import json
from pathlib import Path
from collections import deque
import shutil

ROOT = Path(__file__).resolve().parents[1]
PROJ = ROOT.parent
SRC_CANDIDATES = [
    PROJ / "assests.png",
    ROOT / "assets" / "assests.png",
    ROOT / "assets" / "tomtom-spritesheet.png",
]
OUT = ROOT / "assets" / "sprites"

# Só faixas de corpo inteiro (prancheta/luneta cortadas — fora)
ROW_NAMES = [
    "idle_front",  # 6
    "run",         # 8
    "walk",        # 8
    "wave",        # 4
    "jump",        # 5
    "emotion",     # 8
    "think",       # 6
]

# Bandas do sheet 1536x1872 (altura uniforme 168)
FIXED_BANDS = [
    (20, 187),
    (228, 395),
    (436, 603),
    (644, 811),
    (852, 1019),
    (1060, 1227),
    (1268, 1435),
]


def is_sheet_bg(r, g, b, a=255, thr=10):
    return a < 8 or (r <= thr and g <= thr and b <= thr)


def flood_clear_cell(cell, thr=10):
    cell = cell.copy()
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


def find_segs(im, y0, y1, min_w=60):
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
    return [(a, b) for a, b in segs if (b - a) >= min_w]


def extract_frame(im, x0, x1, y0, y1):
    """Recorte 1:1 da faixa — altura completa, só limpa fundo e laterais vazias."""
    pad = 2
    cell = im.crop((
        max(0, x0 - pad),
        y0,
        min(im.width, x1 + 1 + pad),
        y1 + 1,
    ))
    cell = flood_clear_cell(cell, thr=10)
    bbox = cell.getbbox()
    if not bbox:
        return Image.new("RGBA", (80, y1 - y0 + 1), (0, 0, 0, 0))
    l, _t, r, _b = bbox
    # Mantém altura FULL da faixa (pés alinhados como no original)
    return cell.crop((l, 0, r, cell.height))


def main():
    src = next((p for p in SRC_CANDIDATES if p.exists()), None)
    if not src:
        raise SystemExit("assests.png não encontrado")

    # Copia o original intacto para assets do jogo
    dest_sheet = ROOT / "assets" / "tomtom-spritesheet.png"
    if src.resolve() != dest_sheet.resolve():
        shutil.copy2(src, dest_sheet)
        print(f"Copied original -> {dest_sheet}")

    im = Image.open(src).convert("RGBA")
    print(f"Source {src.name} {im.size} {im.mode}")

    for name in ROW_NAMES:
        d = OUT / name
        d.mkdir(parents=True, exist_ok=True)
        for old in d.glob("*.png"):
            old.unlink()

    # Remove pastas cortadas se existirem
    for dead in ("magic", "inspect"):
        d = OUT / dead
        if d.exists():
            for f in d.glob("*.png"):
                f.unlink()

    manifest = {}
    frame_h = FIXED_BANDS[0][1] - FIXED_BANDS[0][0] + 1

    for name, (y0, y1) in zip(ROW_NAMES, FIXED_BANDS):
        segs = find_segs(im, y0, y1)
        files = []
        max_w = 0
        for i, (x0, x1) in enumerate(segs):
            frame = extract_frame(im, x0, x1, y0, y1)
            # PNG sem reamostragem — pixels originais
            out = OUT / name / f"{i}.png"
            frame.save(out, format="PNG", optimize=False)
            files.append(f"sprites/{name}/{i}.png")
            max_w = max(max_w, frame.width)
            print(f"{name}/{i}.png {frame.size}")
        manifest[name] = {
            "count": len(segs),
            "w": max_w,
            "h": frame_h,
            "files": files,
            "source": "assests.png (original, no rescale)",
        }

    run_dir = ROOT / "assets" / "run"
    run_dir.mkdir(exist_ok=True)
    for old in run_dir.glob("*.png"):
        old.unlink()
    for i in range(manifest["run"]["count"]):
        shutil.copy2(OUT / "run" / f"{i}.png", run_dir / f"{i}.png")

    (ROOT / "assets" / "sprite-manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    print("OK", json.dumps({k: v["count"] for k, v in manifest.items()}))
    print(f"FRAME_H={frame_h} (native)")


if __name__ == "__main__":
    main()
