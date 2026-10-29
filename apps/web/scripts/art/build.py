"""Edge-aware, half-res depth atlas per mode for the hero plates.

Layout (px): sky 836x471 at (0,0), hill 836x471 at (0,471), char 512x768 at (836,0).
Transparent regions of hill/char take the depth of the nearest opaque pixel,
so silhouettes move rigidly with their own depth (no halos), then everything
is lightly smoothed and halved.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = "/tmp/hero-art/depth-{}-{}.png"
OUT = sys.argv[1]

def load(mode, plate, size):
    a = np.asarray(Image.open(SRC.format(mode, plate))).astype(np.float32) / 255
    d, al = a[..., 0], a[..., 3]
    if plate != "sky":
        solid = al >= 0.5
        _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
        d = d[iy, ix]
    d = ndimage.gaussian_filter(d, 1.2)
    img = Image.fromarray(np.clip(d * 255 + 0.5, 0, 255).astype(np.uint8), "L")
    return img.resize(size, Image.LANCZOS)

for mode in ["night", "day"]:
    atlas = Image.new("L", (1348, 942), 0)
    atlas.paste(load(mode, "sky", (836, 471)), (0, 0))
    atlas.paste(load(mode, "hill", (836, 471)), (0, 471))
    atlas.paste(load(mode, "char", (512, 768)), (836, 0))
    atlas.save(f"{OUT}/depth-{mode}.png")
    print(mode, "ok")
