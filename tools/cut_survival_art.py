"""Cuts the survival drawing into the sprites in public/img/survival/.

Usage: python3 tools/cut_survival_art.py path/to/survival-design.png
Needs numpy, scipy and Pillow. Boxes are in the 2224x1668 drawing.

The blue blobs become the enemies and the black outlines become the platforms.
layout.json says how big each piece was and, for platforms, the solid outline
(a convex hull, in sprite pixels) that the game turns into a physics shape.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'img' / 'survival'
PAD = 8

src = np.array(Image.open(sys.argv[1]).convert('RGBA'))
H, W = src.shape[:2]
rgb = src[..., :3].astype(int)
visible = src[..., 3] > 30
dark = visible & (rgb.max(-1) < 70)
# The blobs are pure blue; the background is purple (lots of red in it)
blue = visible & (rgb[..., 0] < 50) & (rgb[..., 2] > 150)

# Where each piece is in the drawing (x0, y0, x1, y1)
ENEMIES = {
    'enemy-1': (480, 370, 780, 580),
    'enemy-2': (1300, 495, 1520, 680),
    'enemy-3': (860, 830, 1170, 1090),
}
PLATFORMS = {
    'platform-bar': (340, 540, 860, 770),
    'platform-box': (1170, 650, 1590, 970),
    'platform-hill': (480, 1010, 1540, 1370),
}
# The inside of a platform is coloured in so it reads as solid
PLATFORM_FILL = (64, 0, 150, 255)


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def largest(mask):
    labels, n = ndi.label(mask)
    if n == 0:
        return mask
    sizes = ndi.sum(mask, labels, range(1, n + 1))
    return labels == (np.argmax(sizes) + 1)


def crop(box):
    x0, y0, x1, y1 = box
    return (slice(y0, y1), slice(x0, x1))


def save(name, rgba, mask, origin):
    ys, xs = np.nonzero(mask)
    top, bottom, left, right = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    out = np.zeros((bottom - top + 2 * PAD, right - left + 2 * PAD, 4), np.uint8)
    piece = rgba[top:bottom, left:right].copy()
    piece[..., 3] = np.where(mask[top:bottom, left:right], piece[..., 3], 0)
    out[PAD:-PAD, PAD:-PAD] = piece
    Image.fromarray(out).save(OUT / f'{name}.png')
    return {'x': int(origin[0] + left - PAD), 'y': int(origin[1] + top - PAD),
            'w': int(out.shape[1]), 'h': int(out.shape[0])}, (left - PAD, top - PAD)


OUT.mkdir(parents=True, exist_ok=True)
layout = {}

for name, box in ENEMIES.items():
    sl = crop(box)
    body = largest(blue[sl])
    # Close over the eyes and any line crossing the blob, then keep everything inside
    body = ndi.binary_fill_holes(ndi.binary_closing(body, disk(14)))
    layout[name], _ = save(name, src[sl], body, box[:2])

for name, box in PLATFORMS.items():
    sl = crop(box)
    lines = dark[sl] & ~blue[sl]
    labels, n = ndi.label(ndi.binary_dilation(lines, disk(3)))
    sizes = ndi.sum(lines, labels, range(1, n + 1))
    keep = np.isin(labels, [i + 1 for i, s in enumerate(sizes) if s > 2500]) & lines
    inside = ndi.binary_fill_holes(ndi.binary_closing(keep, disk(10))) & ~keep
    rgba = src[sl].copy()
    rgba[inside] = PLATFORM_FILL
    rgba[keep, 3] = 255
    # The solid part: the coloured-in shape without thin tails sticking out of it
    solid = ndi.binary_opening(inside | keep, disk(16))
    info, (ox, oy) = save(name, rgba, keep | inside, box[:2])
    ys, xs = np.nonzero(solid)
    points = np.stack([xs - ox, ys - oy], 1)
    hull = points[ConvexHull(points).vertices]
    info['hull'] = [[int(x), int(y)] for x, y in hull]
    layout[name] = info

(OUT / 'layout.json').write_text(json.dumps(layout, indent=1) + '\n')
print(json.dumps({k: {kk: v for kk, v in d.items() if kk != 'hull'} for k, d in layout.items()}, indent=1))
