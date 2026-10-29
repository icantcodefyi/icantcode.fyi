"""Local anime segmentation; source RGB is never replaced or decontaminated."""
from pathlib import Path
import os
os.environ['U2NET_HOME']='/tmp/hero-art/models'
from rembg import new_session
from PIL import Image
import numpy as np
ROOT=Path('/tmp/art-work')
SRC=Path(__file__).resolve().parents[3]/'public/site/scenes'
session=new_session('isnet-anime',providers=['CPUExecutionProvider'])
for mode in ['night','day']:
    src=Image.open(SRC/('ship-launch.webp' if mode=='night' else 'ship-launch-day.webp')).convert('RGB')
    mask=session.predict(src)[0]
    mask.save(ROOT/f'mask-girl-{mode}-raw.png')
    rgba=src.convert('RGBA');rgba.putalpha(mask)
    rgba.save(ROOT/f'girl-{mode}-raw.png')
    neutral=Image.new('RGBA',src.size,(85,110,100,255))
    Image.alpha_composite(neutral,rgba).convert('RGB').save(ROOT/f'preview-matte-{mode}-raw.jpg',quality=94)
    print(mode,'done',flush=True)
