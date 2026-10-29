"""Restore the selected lossless generation and matte inputs into staging."""
from pathlib import Path
from PIL import Image
ROOT=Path('/tmp/art-work');ROOT.mkdir(exist_ok=True)
INPUT=Path(__file__).with_name('inputs')
for name in ['generated-night-v3','generated-day-v1']:
 Image.open(INPUT/f'{name}.webp').save(ROOT/f'{name}.png')
for name in ['mask-girl-night-raw','mask-girl-day-raw']:
 Image.open(INPUT/f'{name}.png').save(ROOT/f'{name}.png')
