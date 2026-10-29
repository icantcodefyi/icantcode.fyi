"""Compare retained pre-repair exports with final encoded assets, offline."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
STAGING = Path('/tmp/art-valorant')
BEFORE = STAGING / 'before-seam-fix'
OUT = HERE.parents[3] / 'public/lobby/val/stage'
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 20)
sheet = Image.new('RGB', (1600, 1648), '#101013')
report = {}
for row, mode in enumerate(('night', 'day')):
    for col, (label, root) in enumerate((('BEFORE', BEFORE / 'encoded'), ('AFTER', OUT))):
        composite = Image.new('RGBA', (1600, 1800))
        for layer in ('sky', 'far', 'near'):
            composite = Image.alpha_composite(composite, Image.open(root / f'{mode}-{layer}.avif').convert('RGBA'))
        sheet.paste(composite.convert('RGB').crop((0, 400, 800, 1176)), (col * 800, row * 824 + 48))
        ImageDraw.Draw(sheet).text((col * 800 + 16, row * 824 + 12), f'{mode.upper()} / {label} / left-edge native pixels', font=font, fill='white')
    old = np.asarray(Image.open(BEFORE / f'{mode}-far.png').convert('RGBA'))[:, :, 3].astype(int)
    new = np.asarray(Image.open(STAGING / f'{mode}-far.png').convert('RGBA'))[:, :, 3].astype(int)
    # The old translation cut is specifically at column 192, below the skyline.
    old_jump = np.abs(old[600:, 192] - old[600:, 191])
    new_jump = np.abs(new[600:, 192] - new[600:, 191])
    assert (old_jump > 200).sum() > 1000
    assert (new_jump > 200).sum() == 0
    assert (new[600:, 0] > 240).mean() > 0.99
    unchanged = {}
    for layer in ('sky', 'near'):
        unchanged[layer] = bool(np.array_equal(np.asarray(Image.open(BEFORE / f'{mode}-{layer}.png')), np.asarray(Image.open(STAGING / f'{mode}-{layer}.png'))))
        assert unchanged[layer]
    old_bytes = sum((BEFORE / 'encoded' / f'{mode}-{layer}.avif').stat().st_size for layer in ('sky', 'far', 'near', 'depth'))
    new_bytes = sum((OUT / f'{mode}-{layer}.avif').stat().st_size for layer in ('sky', 'far', 'near', 'depth'))
    report[mode] = {
        'old_cut_high_alpha_jump_rows_below_y600': int((old_jump > 200).sum()),
        'new_cut_high_alpha_jump_rows_below_y600': int((new_jump > 200).sum()),
        'left_city_opaque_fraction_below_y600': float((new[600:, 0] > 240).mean()),
        'unchanged_png_layers': unchanged,
        'full_avif_before_bytes': old_bytes, 'full_avif_after_bytes': new_bytes,
        'full_avif_reduction_percent': round(100 * (1 - new_bytes / old_bytes), 2),
    }
sheet.save(STAGING / 'preview-seam-comparison.png')
(HERE / 'seam-validation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
