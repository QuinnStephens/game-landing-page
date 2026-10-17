"""Cut Creative mode's pieces out of Violeta's notebook photos.

    python3 tools/cut_creative_art.py <folder with the photos>

The folder needs people.jpeg, places.jpeg, interiors.jpeg, furniture.jpeg and items.jpeg.
Each piece below is a box on its photo (measured on the photo shrunk to 1500 pixels wide),
plus optional boxes to rub out (labels that sit too close to a drawing). The paper is
taken out, so only her pencil, crayon and marker are left, and each piece is saved to
public/img/creative/<name>.png. Needs numpy, scipy and Pillow.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage

# name: (photo, (left, top, right, bottom), [boxes to rub out], height in pixels to save at)
PIECES = {
    # People
    'teacher': ('people', (355, 535, 548, 1000), [(512, 560, 548, 668)], 420),
    'zookeeper': ('people', (845, 612, 1010, 955), [], 330),
    'waiter': ('people', (405, 1075, 615, 1585), [], 460),
    # Places, from the outside
    'school': ('places', (470, 490, 800, 880), [], 420),
    'zoo': ('places', (930, 455, 1295, 860), [], 420),
    'home': ('places', (455, 885, 680, 1245), [(640, 940, 680, 1080)], 420),
    'park': ('places', (925, 1070, 1200, 1285), [], 340),
    'restaurant': ('places', (460, 1385, 830, 1760), [], 420),
    'library': ('places', (955, 1300, 1300, 1750), [], 440),
    # Insides
    'restaurant-table': ('interiors', (285, 300, 700, 800), [(600, 300, 790, 390)], 420),
    'zoo-bunny': ('interiors', (995, 325, 1125, 505), [], 220),
    'zoo-koala': ('interiors', (835, 555, 965, 840), [], 300),
    'zoo-lion': ('interiors', (1025, 580, 1225, 960), [(1025, 900, 1225, 960)], 340),
    'park-slide': ('interiors', (232, 1012, 372, 1192), [], 300),
    'park-swings': ('interiors', (372, 960, 625, 1210), [], 360),
    'school-desk': ('interiors', (725, 1015, 1215, 1460), [], 380),
    'ball-pit': ('interiors', (275, 1520, 570, 1795), [], 300),
    # Furniture
    'baby-bed': ('furniture', (280, 470, 850, 840), [(640, 450, 1060, 620)], 380),
    'big-kid-bed': ('furniture', (875, 640, 1260, 930), [(1010, 560, 1160, 650)], 300),
    'chair': ('furniture', (260, 880, 690, 1170), [(340, 790, 560, 890)], 320),
    'fridge': ('furniture', (845, 945, 1062, 1240), [], 360),
    'table-and-chairs': ('furniture', (1040, 1040, 1265, 1380), [(1040, 1040, 1080, 1130)], 340),
    'baby-swing': ('furniture', (390, 1430, 580, 1645), [], 320),
    'toilet': ('furniture', (780, 1370, 990, 1655), [], 320),
    # Items
    'phone': ('items', (275, 450, 485, 590), [(330, 380, 460, 455)], 200),
    'book': ('items', (535, 438, 755, 610), [], 200),
    'teddy-bear': ('items', (250, 640, 385, 900), [(280, 590, 430, 650)], 240),
    'doll': ('items', (600, 660, 795, 925), [(720, 590, 810, 692), (690, 590, 720, 668)], 260),
    'block': ('items', (255, 970, 415, 1150), [(320, 920, 470, 990)], 200),
    'dollhouse': ('items', (355, 910, 870, 1600), [(355, 910, 420, 1150)], 420),
}


def load(folder, name):
    image = ImageOps.exif_transpose(Image.open(os.path.join(folder, name + '.jpeg'))).convert('RGB')
    return np.asarray(image).astype(np.float32) / 255.0


def cut(photo, box, rubs, height):
    scale = photo.shape[1] / 1500.0
    l, t, r, b = (int(v * scale) for v in box)
    rgb = photo[t:b, l:r].copy()

    # The paper's colour, which changes across the photo: shut out the thin ink lines, then blur
    grey = rgb.mean(axis=2)
    size = max(15, int(28 * scale))
    paper = np.stack([ndimage.gaussian_filter(ndimage.grey_closing(rgb[..., c], size=(size, size)), size) for c in range(3)], axis=2)
    paper = np.maximum(paper, 0.25)

    # How far each pixel is from the paper: darker, or more colourful
    ratio = np.clip(rgb / paper, 0, 1)
    darkness = 1 - ratio.min(axis=2)
    colour = ratio.max(axis=2) - ratio.min(axis=2)
    ink = np.maximum(darkness, colour * 1.2)
    alpha = np.clip((ink - 0.09) / 0.18, 0, 1) ** 0.7  # her pencil is light, so make it count

    for rl, rt, rr, rb in rubs:
        x0, y0 = int(rl * scale) - l, int(rt * scale) - t
        x1, y1 = int(rr * scale) - l, int(rb * scale) - t
        alpha[max(0, y0):max(0, y1), max(0, x0):max(0, x1)] = 0

    # Drop specks of paper grain
    mask = alpha > 0.3
    labels, count = ndimage.label(ndimage.binary_dilation(mask, iterations=int(3 * scale)))
    if count:
        sizes = ndimage.sum(mask, labels, range(1, count + 1))
        keep = np.isin(labels, 1 + np.flatnonzero(sizes >= max(sizes.max() * 0.02, 60 * scale * scale)))
        alpha = alpha * keep

    # Her colours, white-balanced against the paper and a bit bolder, since the photo is dim
    colour_out = 1 - (1 - ratio) * 1.6
    colour_out = np.clip(colour_out, 0, 1)
    mean = colour_out.mean(axis=2, keepdims=True)
    colour_out = np.clip(mean + (colour_out - mean) * 1.5, 0, 1)
    alpha = np.clip(alpha * 1.15, 0, 1)

    ys, xs = np.nonzero(alpha > 0.05)
    pad = int(6 * scale)
    y0, y1 = max(0, ys.min() - pad), min(alpha.shape[0], ys.max() + pad)
    x0, x1 = max(0, xs.min() - pad), min(alpha.shape[1], xs.max() + pad)
    out = np.dstack([colour_out, alpha])[y0:y1, x0:x1]
    image = Image.fromarray((out * 255).astype(np.uint8), 'RGBA')
    w = round(image.width * height / image.height)
    return paper_backing(image.resize((w, height), Image.LANCZOS))


def disk(radius):
    y, x = np.ogrid[-radius:radius + 1, -radius:radius + 1]
    return x * x + y * y <= radius * radius


def paper_backing(image, border=7, reach=14):
    """Put white paper behind the drawing, cut around it like a sticker, so light pencil shows up on any background."""
    pad = border + reach
    rgba = np.asarray(image).astype(np.float32) / 255.0
    rgba = np.pad(rgba, ((pad, pad), (pad, pad), (0, 0)))
    alpha = rgba[..., 3]
    shape = ndimage.binary_closing(alpha > 0.2, structure=disk(reach))
    shape = ndimage.binary_fill_holes(shape)
    shape = ndimage.binary_dilation(shape, structure=disk(border))
    paper = np.clip(ndimage.gaussian_filter(shape.astype(np.float32), 1.0) * 1.4, 0, 1)
    colour = rgba[..., :3] * alpha[..., None] + (1 - alpha[..., None])
    out = np.dstack([colour, np.maximum(paper, alpha)])
    return Image.fromarray((out * 255).astype(np.uint8), 'RGBA')


def main():
    folder = sys.argv[1]
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(here, '..', 'public', 'img', 'creative')
    os.makedirs(out_dir, exist_ok=True)
    only = set(sys.argv[2:])
    photos = {}
    layout = {}
    for name, (photo, box, rubs, height) in PIECES.items():
        if only and name not in only:
            continue
        if photo not in photos:
            photos[photo] = load(folder, photo)
        image = cut(photos[photo], box, rubs, height)
        image.quantize(256, method=Image.Quantize.FASTOCTREE).save(os.path.join(out_dir, name + '.png'), optimize=True)
        layout[name] = {'w': image.width, 'h': image.height}
        print(name, image.size)
    if not only:
        with open(os.path.join(out_dir, 'layout.json'), 'w') as f:
            json.dump(layout, f, indent=1)


if __name__ == '__main__':
    main()
