"""Prepare the generated plates; run with /tmp/hero-art/venv/bin/python."""
from pathlib import Path
import hashlib
import json
import numpy as np
from scipy import ndimage
from PIL import Image

HERE = Path(__file__).resolve().parent
STAGING = Path('/tmp/art-valorant')
SIZE = (1600, 1800)
LAYERS = ('sky', 'far', 'near')
MODES = ('night', 'day')


def prepare():
    records = {}
    for mode in MODES:
        composite = Image.new('RGBA', SIZE)
        for layer in LAYERS:
            source = STAGING / f'{mode}-{layer}-source.png'
            original = Image.open(source)
            plate = original.convert('RGBA').resize(SIZE, Image.Resampling.LANCZOS)
            if layer == 'near':
                # Generated cutouts contain a handful of invisible alpha specks.
                rgba = np.array(plate)
                labels, count = ndimage.label(rgba[:, :, 3] > 8)
                areas = np.bincount(labels.ravel())
                areas[0] = 0
                foreground = labels == areas.argmax()
                guard = ndimage.binary_dilation(foreground, iterations=2)
                rgba[:, :, 3][~guard] = 0
                plate = Image.fromarray(rgba)
            # Repaired far sources already include the original registration
            # and painted left extension. Translating again recreates the cut.
            if layer == 'sky':
                plate = plate.convert('RGB').convert('RGBA')
            plate.save(STAGING / f'{mode}-{layer}.png')
            composite = Image.alpha_composite(composite, plate)
            a = np.array(plate)[:, :, 3]
            records[f'{mode}-{layer}'] = {
                'source': str(source), 'source_px': original.size,
                'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'export_px': SIZE, 'baked_translation_px': [0, 0],
                'placement_offset_px': [0, 0], 'alpha_bbox': plate.getchannel('A').getbbox(),
                'alpha_cleanup': 'largest connected rooftop + 2px edge guard' if layer == 'near' else 'none',
                'transparent_fraction': float((a == 0).mean()),
                'alpha_levels': int(np.unique(a).size),
            }
        composite.convert('RGB').save(STAGING / f'{mode}-composite.png')
    (HERE / 'provenance.json').write_text(json.dumps(records, indent=2) + '\n')
    print(json.dumps(records, indent=2))


if __name__ == '__main__':
    prepare()
