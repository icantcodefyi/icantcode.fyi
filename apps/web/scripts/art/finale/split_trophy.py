"""Lossless connected-component split: attached pixels stay with the girl."""
from pathlib import Path
import json
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw
WEB=Path(__file__).resolve().parents[3]
OUT=WEB/'public/site/scenes'
PRE=Path('/tmp/art-finale'); PRE.mkdir(exist_ok=True)
a=np.asarray(Image.open(OUT/'trophy-cutout.webp').convert('RGBA'))
labels,n=ndimage.label(a[:,:,3]>=16,structure=np.ones((3,3)))
sizes=np.bincount(labels.ravel()); sizes[0]=0
main=int(sizes.argmax())
# Ignore tiny alpha bridges from the original matte; reassign all original fringe
# pixels to their nearest solid object without changing their color or opacity.
nearest=ndimage.distance_transform_edt(labels==0,return_distances=False,return_indices=True)
labels=labels[tuple(nearest)]
mask=labels==main
layers=[]
for name,keep in [('girl',mask),('confetti',~mask)]:
 b=a.copy(); b[~keep,3]=0; b[b[:,:,3]==0,:3]=0
 im=Image.fromarray(b); im.save(PRE/f'trophy-{name}-master.png')
 # Lossless full WebP preserves original pixel values, with transparent RGB cleared for efficient compression.
 im.save(OUT/f'trophy-{name}.webp',lossless=True,exact=True,method=6)
 layers.append(im)
 # A -600 filename is the existing art convention: 600px wide, 750px tall.
 small=im.resize((600,750),Image.Resampling.LANCZOS)
 small.save(OUT/f'trophy-{name}-600.webp',lossless=True,exact=True,method=6)
 for suffix,img in [('',im),('-600',small)]:
  img.save(OUT/f'trophy-{name}{suffix}.avif',quality=45,subsampling='4:2:0',speed=4)
re=Image.alpha_composite(*layers); re.save(PRE/'trophy-recomposite.png')
# Compare premultiplied color; hidden RGB does not affect rendering.
def premul(arr):
 f=arr.astype(float)/255
 return np.dstack((f[:,:,:3]*f[:,:,3:],f[:,:,3]))
err=np.max(np.abs(premul(np.asarray(re))-premul(a)))
assert err<=1/255
webp=Image.alpha_composite(Image.open(OUT/'trophy-girl.webp').convert('RGBA'),Image.open(OUT/'trophy-confetti.webp').convert('RGBA'))
assert np.max(np.abs(premul(np.asarray(webp))-premul(a)))<=1/255
report={'components':n,'attached_component_pixels':int(sizes[main]),'detached_pixels':int(((a[:,:,3]>0)&~mask).sum()),'max_premultiplied_error':float(err),'source_visible_rgba_preserved':True,'full_webp_lossless':True}
(PRE/'trophy-verification.json').write_text(json.dumps(report,indent=2))
canvas=Image.new('RGB',(1683,735),'#ffb3d1'); draw=ImageDraw.Draw(canvas)
for i,(title,im) in enumerate([('ORIGINAL',Image.fromarray(a)),('GIRL: ALL ATTACHED PIECES',layers[0]),('DETACHED CONFETTI',layers[1])]):
 thumb=im.resize((561,701),Image.Resampling.LANCZOS); canvas.paste(thumb,(i*561,30),thumb)
 draw.text((i*561+12,10),title,fill='#29101d')
canvas.save(PRE/'trophy-split-preview.png')
print(json.dumps(report,indent=2))
print('largest components',sorted(sizes.tolist(),reverse=True)[:20])
