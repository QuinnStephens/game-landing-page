"""Cuts the character creator drawing into the sprites in public/img/creator/.

Usage: python3 tools/cut_creator_art.py path/to/character-creator-design.png
Needs numpy, scipy and Pillow. Item positions are in the 2224x1668 drawing.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'img' / 'creator'
PAD = 40  # room around each sprite for its glow

src = np.array(Image.open(sys.argv[1]).convert('RGBA'))
H, W = src.shape[:2]
rgb = src[..., :3].astype(float)
alpha = src[..., 3]
mx, mn = rgb.max(-1), rgb.min(-1)
sat = (mx - mn) / np.maximum(mx, 1)
hue = np.array(Image.fromarray(src[..., :3]).convert('HSV'))[..., 0].astype(float) * 360 / 255
visible = alpha > 30
dark = visible & (mx < 80)
bright = visible & (mx > 90) & (sat > 0.35)

COLORS = {
    'pink': (290, 335), 'blue': (225, 250), 'purple': (250, 290),
    'yellow': (40, 78), 'green': (78, 160), 'brown': (10, 45),
}


def hue_mask(name):
    lo, hi = COLORS[name]
    return bright & (hue >= lo) & (hue < hi)


def box_mask(x0, y0, x1, y1):
    m = np.zeros((H, W), bool)
    m[y0:y1, x0:x1] = True
    return m


def poly_mask(points):
    img = Image.new('L', (W, H), 0)
    ImageDraw.Draw(img).polygon(points, fill=255)
    return np.array(img) > 0


def hull(mask):
    ys, xs = np.nonzero(mask)
    pts = np.stack([xs, ys], 1)
    return poly_mask([tuple(map(int, pts[i])) for i in ConvexHull(pts).vertices])


def filled(mask, close=6):
    """The mask with its holes filled, so drawings inside a shape come along."""
    m = ndi.binary_closing(mask, iterations=close)
    return ndi.binary_fill_holes(m) | mask


def save_sprite(name, mask, glow=True):
    ys, xs = np.nonzero(mask)
    x0, x1, y0, y1 = xs.min() - PAD, xs.max() + PAD + 1, ys.min() - PAD, ys.max() + PAD + 1
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    sub = mask[max(y0, 0):y1, max(x0, 0):x1]
    oy, ox = max(y0, 0) - y0, max(x0, 0) - x0
    region = src[max(y0, 0):y1, max(x0, 0):x1].copy()
    region[..., 3] = np.where(sub, region[..., 3], 0)
    out[oy:oy + sub.shape[0], ox:ox + sub.shape[1]] = region
    Image.fromarray(out).save(OUT / f'{name}.png', optimize=True)
    if glow:
        a = Image.fromarray(((out[..., 3] > 40) * 255).astype(np.uint8))
        a = a.filter(ImageFilter.MaxFilter(23)).filter(ImageFilter.GaussianBlur(6))
        g = np.zeros_like(out)
        g[..., :3] = (255, 150, 0)  # a strong orange, so it shows up on the white background
        g[..., 3] = np.array(a)
        Image.fromarray(g).save(OUT / f'{name}-glow.png', optimize=True)
    return {'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}


def save_tintable(name, mask):
    """A white-ish copy of the shape that Pixi tints to any colour. Gaps in the scribble are filled in."""
    full = hull(mask)
    lum = rgb.mean(-1)
    ref = np.median(lum[mask])
    shade = np.clip(0.88 * lum / ref, 0.6, 1.0)
    value = np.where(mask, shade, 1.0)
    ys, xs = np.nonzero(full)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    v = (value[y0:y1, x0:x1] * 255).astype(np.uint8)
    out[..., 0] = out[..., 1] = out[..., 2] = v
    a = Image.fromarray((full[y0:y1, x0:x1] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    out[..., 3] = np.array(a)
    Image.fromarray(out).save(OUT / f'{name}.png', optimize=True)
    return {'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}


OUT.mkdir(parents=True, exist_ok=True)
layout = {}
erase = np.zeros((H, W), bool)

# Pants and skirts (upper left panel)
ITEMS = {
    'pants-skirt-pink': ('pink', box_mask(195, 440, 372, 630)),
    'pants-blue': ('blue', box_mask(365, 395, 512, 600)),
    'pants-skirt-blue': ('blue', box_mask(195, 600, 372, 770)),
    'pants-purple': ('purple', box_mask(390, 605, 570, 780)),
    'pants-skirt-purple': ('purple', box_mask(205, 765, 445, 895)),
    'pants-pink': ('pink', box_mask(438, 790, 615, 895)),
    # Hairstyles (the tall oval)
    'hair-yellow': ('yellow', box_mask(1475, 385, 1610, 500)),
    'hair-purple': ('purple', box_mask(1545, 530, 1675, 710)),
    'hair-blue': ('blue', box_mask(1435, 605, 1580, 780)),
    # Shirts (far right)
    'shirt-blue': ('blue', box_mask(1940, 325, 2120, 610)),
    'shirt-purple': ('purple', box_mask(1730, 750, 1910, 975)),
    'shirt-pink': ('pink', box_mask(1945, 700, 2140, 985)),
    'shirt-green': ('green', box_mask(1775, 1095, 1975, 1335)),
    'shirt-yellow': ('yellow', box_mask(1900, 1095, 2105, 1335)),
}
for name, (color, region) in ITEMS.items():
    m = hue_mask(color) & region
    m = ndi.binary_opening(m, iterations=1)
    if name in ('shirt-blue', 'shirt-green'):
        # Keep the heart and the rainbow drawn inside, but not the panel's border
        red = bright & ((hue < 10) | (hue > 340)) & region
        m = m | red
        inside = hull(m) & visible & ~hue_mask('yellow') & ~box_mask(2118, 0, W, H)
        m = m | inside
    layout[name] = save_sprite(name, m)
    erase |= ndi.binary_dilation(m, iterations=3)

# Skin tones (top panel)
skins = {}
for i, (x0, x1) in enumerate([(670, 805), (915, 1100), (1140, 1370)]):
    m = bright & box_mask(x0, 220, x1, 440)
    m = ndi.binary_opening(m, iterations=1)
    name = f'skin-{i}'
    layout[name] = save_sprite(name, m)
    skins[name] = '#%02x%02x%02x' % tuple(int(c) for c in np.median(rgb[m], 0))
    erase |= ndi.binary_dilation(m, iterations=3)

# The black ones: the curly hair and the dress
curly = dark & box_mask(1555, 180, 1728, 335)
lab, _ = ndi.label(curly)
sizes = ndi.sum(curly, lab, range(1, lab.max() + 1))
curly = lab == (np.argmax(sizes) + 1)
layout['hair-black'] = save_sprite('hair-black', curly)
erase |= ndi.binary_dilation(curly, iterations=3)

dress = dark & poly_mask([(1792, 336), (1900, 322), (1912, 495), (1975, 492), (1975, 545),
                          (1915, 552), (1915, 612), (1768, 620)])
dress = ndi.binary_opening(dress, iterations=2)
layout['shirt-dress'] = save_sprite('shirt-dress', dress)
erase |= ndi.binary_dilation(dress, iterations=3)

# Species (lower left), left in the background too since lines cross them
for name, region in {'species-bear': box_mask(235, 935, 458, 1545), 'species-human': box_mask(445, 1165, 650, 1545)}.items():
    layout[name] = save_sprite(name, dark & region)

# The character in the middle: its head and face. Its body is drawn by the game.
center = box_mask(778, 556, 1398, 1630)
skin = hue_mask('brown') & center
skin = ndi.binary_opening(skin, iterations=2)
layout['human-skin'] = save_tintable("human-skin", skin)
face = dark & box_mask(900, 850, 1220, 1100)
layout['human-face'] = save_sprite('human-face', face, glow=False)
erase |= center

# The background: everything else, on white
bg = src.copy()
bg[..., 3] = np.where(erase, 0, bg[..., 3])
white = Image.new('RGBA', (W, H), (255, 255, 255, 255))
white.alpha_composite(Image.fromarray(bg))
white.convert('RGB').save(OUT / 'background.jpg', quality=88)

layout['skinColors'] = skins
(OUT / 'layout.json').write_text(json.dumps(layout, indent=1))
print(json.dumps(layout, indent=1))
