"""Encode Work assets and true half-size color variants. Does not edit app code."""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage as ndi
import json
ROOT=Path('/tmp/art-work')
OUT=Path(__file__).resolve().parents[3]/'public/site/scenes'
records=[]
def clean_hidden(im):
 if im.mode!='RGBA':return im
 a=np.array(im);visible=a[:,:,3]>0
 dist,ix=ndi.distance_transform_edt(~visible,return_indices=True)
 guard=(~visible)&(dist<4)
 a[guard,:3]=a[ix[0][guard],ix[1][guard],:3]
 a[(~visible)&(~guard),:3]=0
 return Image.fromarray(a)
for mode in ['night','day']:
 for kind in ['sky','girl','flowers','depth']:
  base=f'work-{kind}-{mode}'
  master=Image.open(ROOT/f'{base}.png')
  variants=[('',master)]
  if kind!='depth':variants.append(('-half',master.resize((master.width//2,master.height//2),Image.Resampling.LANCZOS)))
  for suffix,im in variants:
   im=clean_hidden(im)
   for ext in ['avif','webp']:
    path=OUT/f'{base}{suffix}.{ext}'
    if ext=='avif':
     quality=85 if kind=='depth' else 60
     im.save(path,quality=quality,speed=6)
     limit={'sky':220,'girl':150,'flowers':40,'depth':35}[kind]*1024
     if suffix:limit/=2
     while path.stat().st_size>limit and kind!='depth' and quality>46:
      quality-=2;im.save(path,quality=quality,speed=6)
     encoding=f'AVIF q{quality}'
    else:
     if kind=='depth':im.save(path,lossless=True,method=6);encoding='WebP lossless'
     else:im.save(path,quality=84,method=6,alpha_quality=100,exact=True);encoding='WebP q84 / alpha100'
    records.append({'file':path.name,'width':im.width,'height':im.height,'bytes':path.stat().st_size,'KB':round(path.stat().st_size/1024,2),'encoding':encoding})
    print(records[-1],flush=True)
(ROOT/'encoded-files.json').write_text(json.dumps(records,indent=2))
