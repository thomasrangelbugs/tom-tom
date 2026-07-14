from PIL import Image
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "assets" / "tomtom-spritesheet.png"
im = Image.open(SRC).convert("RGBA")
w, h = im.size
print("size", w, h)
px = im.load()

def is_content(x, y):
    r, g, b, a = px[x, y]
    return a > 20 and (r > 22 or g > 22 or b > 22)

rows = [any(is_content(x, y) for x in range(w)) for y in range(h)]
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
print("bands", len(bands))
for i, (a, b) in enumerate(bands):
    sub_cols = [any(is_content(x, y) for y in range(a, b + 1)) for x in range(w)]
    segs = []
    inb = False
    for x, v in enumerate(sub_cols):
        if v and not inb:
            s = x
            inb = True
        elif not v and inb:
            segs.append((s, x - 1))
            inb = False
    if inb:
        segs.append((s, w - 1))
    widths = [e - s + 1 for s, e in segs]
    print(f"{i}: y={a}-{b} h={b-a+1} frames={len(segs)} firstx={segs[0][0] if segs else None} lastx={segs[-1][1] if segs else None} wspan={min(widths) if widths else 0}-{max(widths) if widths else 0}")
