"""Independently normalized white-near depth, neutral cutout inference, 1/2 res atlas."""
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage as ndi
import json
ROOT=Path('/tmp/art-work')
TILES={'sky':(0,0,612,918),'girl':(612,0,561,701),'flowers':(612,701,561,220)}
# The plan says 918 high but 701+220=921. Preserve every specified tile pixel.
SIZE=(1173,921)
meta={}
for mode in ['night','day']:
 atlas=Image.new('L',SIZE)
 for kind,(x,y,w,h) in TILES.items():
  src=Image.open(ROOT/f'work-{kind}-{mode}.png').convert('RGBA');a=np.array(src)[...,3]
  d=np.load(ROOT/f'raw-{kind}-{mode}.npy')
  solid=a>=128
  lo,hi=float(d[solid].min()),float(d[solid].max())
  d=np.clip((d-lo)/max(hi-lo,1e-6),0,1)
  if kind=='sky':
   # Galaxy, stars and remote sky stay close to infinity; terrain retains its relief.
   yy=np.arange(d.shape[0])[:,None]/d.shape[0]
   gate=np.clip((yy-.60)/.20,0,1);gate=gate*gate*(3-2*gate)
   d=d*(.12+.88*gate)
  else:
   _,indices=ndi.distance_transform_edt(~solid,return_indices=True)
   d=d[tuple(indices)]
  d=ndi.gaussian_filter(d,1.2)
  pixels=np.round(d*255).clip(0,255).astype('uint8')
  Image.fromarray(np.dstack([pixels,pixels,pixels,a])).save(ROOT/f'depth-{kind}-{mode}.png')
  tile=Image.fromarray(pixels).resize((w,h),Image.Resampling.LANCZOS)
  atlas.paste(tile,(x,y))
  meta[f'{kind}-{mode}']={'tile':[x,y,w,h],'raw_visible_range':[lo,hi],'alpha_byte_identical':True,'white_near':True,'sigma_source_px':1.2}
 atlas.save(ROOT/f'work-depth-{mode}.png')
 atlas.convert('RGB').save(ROOT/f'preview-depth-{mode}.jpg',quality=96)
(ROOT/'depth-validation.json').write_text(json.dumps({'atlas_size':SIZE,'plates':meta},indent=2))
print(json.dumps({'size':SIZE,'tiles':TILES}),flush=True)
