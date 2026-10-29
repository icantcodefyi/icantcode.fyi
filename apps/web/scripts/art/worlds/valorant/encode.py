"""Encode and validate all 32 public assets without running the app build."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json
import subprocess
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
WEB = HERE.parents[3]
OUT = WEB / 'public/lobby/val/stage'
STAGING = Path('/tmp/art-valorant')
OUT.mkdir(parents=True, exist_ok=True)


def encode(job):
    mode, layer, half = job
    name = f'{mode}-{layer}' + ('-800' if half else '')
    source = Image.open(STAGING / f'{mode}-{layer}.png')
    if half:
        source = source.resize((800, 900), Image.Resampling.LANCZOS)
    intermediate = STAGING / f'{name}-encode.png'
    source.save(intermediate)
    avif = OUT / f'{name}.avif'
    webp = OUT / f'{name}.webp'
    source.save(avif, quality=70 if layer == 'depth' else 46,
                speed=4, max_threads=2, subsampling='4:2:0')
    subprocess.run(['cwebp', '-quiet', '-q', '82', '-alpha_q', '90', '-m', '6',
                    '-sharp_yuv', str(intermediate), '-o', str(webp)], check=True)
    original = np.asarray(source.convert('RGBA')).astype(np.float32)
    visible = original[:, :, 3] > 128
    checks = []
    for path in (avif, webp):
        decoded = Image.open(path).convert('RGBA')
        assert decoded.size == source.size
        pixels = np.asarray(decoded).astype(np.float32)
        alpha_mae = float(np.abs(pixels[:, :, 3] - original[:, :, 3]).mean())
        # Alpha remains truly transparent outside the generated silhouettes.
        if layer in ('far', 'near'):
            assert (pixels[:, :, 3] == 0).mean() > 0.30
            assert alpha_mae < 2.5
        else:
            assert pixels[:, :, 3].min() == 255
        checks.append({
            'file': path.name, 'px': decoded.size, 'bytes': path.stat().st_size,
            'kb': round(path.stat().st_size / 1000, 2),
            'alpha_mae': round(alpha_mae, 4),
            'visible_rgb_mae': round(float(np.abs(pixels[:, :, :3] - original[:, :, :3])[visible].mean()), 3),
        })
    print(name, [(c['file'], c['kb']) for c in checks], flush=True)
    return checks


jobs = [(mode, layer, half) for mode in ('night', 'day')
        for layer in ('sky', 'far', 'near', 'depth') for half in (False, True)]
with ThreadPoolExecutor(max_workers=3) as pool:
    results = [item for pair in pool.map(encode, jobs) for item in pair]
(HERE / 'files.json').write_text(json.dumps(results, indent=2) + '\n')
print('Total bytes:', sum(item['bytes'] for item in results))
