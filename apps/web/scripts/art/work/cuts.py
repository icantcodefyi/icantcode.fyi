"""Refine a shared local matte and cut source-preserving character/flower plates."""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import cv2
ROOT=Path('/tmp/art-work')
SRC=Path(__file__).resolve().parents[3]/'public/site/scenes'
raw=np.asarray(Image.open(ROOT/'mask-girl-day-raw.png')).astype(np.float32)/255
# The day inference has no false positive paper plane. It is the common silhouette.
t=np.clip((raw-.10)/.80,0,1);a=t*t*(3-2*t)
labels,n=ndi.label(a>.05)
sizes=np.bincount(labels.ravel());sizes[0]=0
keep=labels==sizes.argmax()
keep=ndi.binary_dilation(keep,iterations=2)
a*=keep
# Remove the original petal trapped under the left coat hem and flower/ground below boots.
a[1350:]=0
# Retain the actual sole, discard the model's soft shadow extension on its right.
yy,xx=np.mgrid[:1402,:1122]
a[(yy>1325)&(xx>575)]=0
mask=np.round(a*255).astype(np.uint8)
Image.fromarray(mask).save(ROOT/'mask-girl-shared.png')
# Same flower mask in both modes, based on mean independently normalized DA-V2 predictions.
d=[]
for mode in ['night','day']:
 r=np.load(ROOT/f'raw-original-{mode}.npy');d.append((r-r.min())/(r.max()-r.min()))
near=(np.mean(d,axis=0)>.68)&(yy>=962)
# A girl's leg/boot can be near too. Remove it from flower selection before feathering.
near &= ~ndi.binary_dilation(mask>12,iterations=3)
f=ndi.gaussian_filter(near.astype(np.float32),6)
f*=1-a
# Feather crop edges as well, so the moving strip never exposes a rectangular side.
edge=np.clip(np.minimum(xx,1121-xx)/24,0,1)
f*=edge*edge*(3-2*edge)
f[:962]=0
fm=np.round(f[962:]*255).astype(np.uint8)
Image.fromarray(fm).save(ROOT/'mask-flowers-shared.png')
for mode in ['night','day']:
 im=Image.open(SRC/('ship-launch.webp' if mode=='night' else 'ship-launch-day.webp')).convert('RGBA')
 girl=im.copy();girl.putalpha(Image.fromarray(mask));girl.save(ROOT/f'work-girl-{mode}.png')
 flowers=im.crop((0,962,1122,1402));flowers.putalpha(Image.fromarray(fm));flowers.save(ROOT/f'work-flowers-{mode}.png')
 for kind,plate in [('girl',girl),('flowers',flowers)]:
  bg=Image.new('RGBA',plate.size,(79,100,95,255));Image.alpha_composite(bg,plate).convert('RGB').save(ROOT/f'preview-{kind}-{mode}.jpg',quality=95)
 print(mode,'girl',girl.size,'flowers',flowers.size,flush=True)
