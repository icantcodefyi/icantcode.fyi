"""Depth Anything V2 Base on the exact final, untinted plate composites."""
from pathlib import Path
import sys
import json
import numpy as np
import cv2
from PIL import Image

HERE = Path(__file__).resolve().parent
STAGING = Path('/tmp/art-valorant')
sys.path.insert(0, str(HERE.parents[1]))
import build_depth as shared

shared.ROOT = STAGING
shared.SOURCE = STAGING
shared.SOURCES = {mode: f'{mode}-composite.png' for mode in ('night', 'day')}
shared.infer()

report = {}
for mode in ('night', 'day'):
    raw = np.load(STAGING / 'intermediates' / f'raw-{mode}.npy')
    lo, hi = np.percentile(raw, [0.2, 99.8])
    d = np.clip((raw - lo) / (hi - lo), 0, 1).astype(np.float32)
    d = cv2.bilateralFilter(d, 7, 0.035, 2.0)
    # DA-V2 gives inverse depth: high values = near. Do not invert.
    depth = Image.fromarray(np.round(d * 255).astype('uint8'))
    depth.save(STAGING / f'{mode}-depth.png')
    a = np.array(Image.open(STAGING / f'{mode}-near.png'))[:, :, 3]
    f = np.array(Image.open(STAGING / f'{mode}-far.png'))[:, :, 3]
    sky = (a < 2) & (f < 2)
    near = a > 240
    assert d[near].mean() > d[sky].mean(), 'Depth orientation is incorrect'
    report[mode] = {
        'size': depth.size, 'white_is_near': True,
        'source': f'{mode}-composite.png', 'source_transform': 'none',
        'normalization_percentiles': [0.2, 99.8], 'raw_limits': [float(lo), float(hi)],
        'near_mean': float(d[near].mean()), 'sky_mean': float(d[sky].mean()),
        'range': [int(np.array(depth).min()), int(np.array(depth).max())],
    }
    color = Image.open(STAGING / f'{mode}-composite.png')
    sheet = Image.new('RGB', (1600, 900))
    sheet.paste(color.resize((800, 900), Image.Resampling.LANCZOS), (0, 0))
    sheet.paste(depth.resize((800, 900), Image.Resampling.LANCZOS), (800, 0))
    sheet.save(STAGING / f'{mode}-depth-preview.png')
(HERE / 'depth-validation.json').write_text(json.dumps(report, indent=2) + '\n')
(HERE / 'depth-metadata.json').write_text((STAGING / 'depth-metadata.json').read_text())
print(json.dumps(report, indent=2))
