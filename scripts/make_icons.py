"""Render the extension's icon set (original artwork) with Pillow."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "extension/icons")
S = 1024  # supersampled canvas


def render(store_padding=False):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = 128 if store_padding else 24  # Web Store asks for ~16px transparent padding at 128px
    # vertical teal -> indigo gradient tile
    tile = Image.new("RGBA", (S, S))
    td = ImageDraw.Draw(tile)
    top, bottom = (20, 184, 166), (49, 46, 129)
    for y in range(S):
        t = y / (S - 1)
        td.line([(0, y), (S, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([pad, pad, S - pad, S - pad], radius=int((S - 2 * pad) * 0.24), fill=255)
    img.paste(tile, (0, 0), mask)

    inner = S - 2 * pad
    cx = S / 2
    u = inner / 100.0
    # play triangle (upper)
    py = pad + 18 * u
    d.polygon([(cx - 15 * u, py), (cx - 15 * u, py + 34 * u), (cx + 17 * u, py + 17 * u)], fill=(255, 255, 255, 255))
    # download arrow (lower)
    ay = pad + 58 * u
    d.polygon([(cx - 20 * u, ay), (cx + 20 * u, ay), (cx, ay + 17 * u)], fill=(255, 255, 255, 255))
    d.rounded_rectangle([cx - 26 * u, ay + 22 * u, cx + 26 * u, ay + 29 * u], radius=3.5 * u, fill=(255, 255, 255, 255))
    return img


OUT.mkdir(parents=True, exist_ok=True)
base = render()
for size in (16, 32, 48, 128):
    base.resize((size, size), Image.LANCZOS).save(OUT / f"icon-{size}.png")
render(store_padding=True).resize((128, 128), Image.LANCZOS).save(OUT.parent.parent / "store" / "store-icon-128.png") if (OUT.parent.parent / "store").exists() else None
print("icons written to", OUT)
