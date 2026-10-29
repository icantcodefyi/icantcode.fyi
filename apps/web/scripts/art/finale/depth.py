"""Shared DA-V2 Base/MPS inference + half-resolution edge-safe depth exports."""
from pathlib import Path
import sys,json
import numpy as np
from scipy import ndimage
from PIL import Image
WEB=Path(__file__).resolve().parents[3]; SHARED=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(SHARED if (SHARED/'build_depth.py').exists() else Path('/tmp/hero-art')))
import build_depth as shared
from finish_depth import norm
PRE=Path('/tmp/art-finale');OUT=WEB/'public/site/finale'
shared.ROOT=PRE;shared.SOURCE=PRE
shared.SOURCES={f'meadow-{m}':f'meadow-{m}-master.png' for m in ['night','day']}
shared.infer()
reports={}
for mode in ['night','day']:
 src=np.array(Image.open(PRE/f'meadow-{mode}-master.png').convert('RGBA'))
 alpha=src[:,:,3]; solid=alpha>=128
 raw=np.load(PRE/'intermediates'/f'raw-meadow-{mode}.npy')
 d=norm(raw,solid)
 # Same nearest-solid silhouette extension as shared build.py (hero atlas).
 _,indices=ndimage.distance_transform_edt(~solid,return_indices=True)
 d=d[tuple(indices)]
 d=ndimage.gaussian_filter(d,1.2)
 img=Image.fromarray(np.round(d*255).astype('uint8')).resize((1200,550),Image.Resampling.LANCZOS)
 img.save(PRE/f'meadow-depth-{mode}.png')
 img.save(OUT/f'meadow-depth-{mode}.webp',lossless=True,method=6)
 img.save(OUT/f'meadow-depth-{mode}.avif',quality=85,speed=4)
 reports[mode]={'size':[1200,550],'white_is_near':True,'normalization':'independent solid-pixel min/max','transparent_rgb':'nearest solid (alpha >= 128) dilation','gaussian_sigma_full_resolution':1.2,'range':[int(np.array(img).min()),int(np.array(img).max())],'source_alpha_untouched':True}
 # Side-by-side diagnostic uses source alpha only on color; depth is opaque L.
 color=Image.fromarray(src).resize((1200,550),Image.Resampling.LANCZOS)
 sheet=Image.new('RGB',(2400,550),'#333333');sheet.paste(color,(0,0),color);sheet.paste(img.convert('RGB'),(1200,0));sheet.save(PRE/f'depth-preview-{mode}.png')
(PRE/'depth-export-validation.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports,indent=2))
