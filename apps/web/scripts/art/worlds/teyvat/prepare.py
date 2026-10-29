"""Fit generated paintings to the delivery stage and gently quiet the copy zone."""
from pathlib import Path
import json, sys
import numpy as np
from PIL import Image, ImageFilter
ROOT=Path('/tmp/art-teyvat')

def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)

for p in sorted(ROOT.glob('*-source.png')):
    name=p.name.removesuffix('-source.png')
    target=ROOT/f'{name}-master.png'
    if target.exists():continue
    original=Image.open(p).convert('RGB')
    im=original.resize((2400,1350),Image.Resampling.LANCZOS)
    rgb=np.array(im).astype(np.float32)
    x=np.linspace(0,1,2400)[None,:,None]
    # Keep regional silhouettes intact; the copy-side mist loses only small details.
    quiet=smooth(.61,.84,x)
    soft=np.array(im.filter(ImageFilter.GaussianBlur(2.2))).astype(np.float32)
    rgb=rgb*(1-.6*quiet)+soft*(.6*quiet)
    if '-night' in name:
        rgb*=1-.32*quiet
        rgb*=1-.10*(1-smooth(.30,.46,x))
    else:
        rgb*=1-.07*(1-smooth(.28,.46,x))
    Image.fromarray(np.uint8(np.rint(np.clip(rgb,0,255)))).save(target)
    print(name, original.size, '-> 2400x1350', flush=True)
