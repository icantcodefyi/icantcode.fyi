"""Verify delivered images, source-preserving split, geometry and codec caveats."""
from pathlib import Path
import hashlib,json
from PIL import Image
import numpy as np
WEB=Path(__file__).resolve().parents[3];SITE=WEB/'public/site'; HERE=Path(__file__).resolve().parent
PRE=Path('/tmp/art-finale'); records=[]
expected={}
for n in ['trophy-girl','trophy-confetti']:
 expected[f'scenes/{n}']=(1122,1402);expected[f'scenes/{n}-600']=(600,750)
for m in ['night','day']:
 expected[f'finale/meadow-{m}']=(2400,1100);expected[f'finale/meadow-{m}-1200']=(1200,550);expected[f'finale/meadow-depth-{m}']=(1200,550)
for base,size in expected.items():
 for ext in ['avif','webp']:
  p=SITE/f'{base}.{ext}';im=Image.open(p);im.load();assert im.size==size,(p,im.size)
  records.append({'file':f'public/site/{base}.{ext}','px':list(size),'bytes':p.stat().st_size,'KB':round(p.stat().st_size/1000,2),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
source=np.array(Image.open(SITE/'scenes/trophy-cutout.webp').convert('RGBA'))
g=Image.open(SITE/'scenes/trophy-girl.webp').convert('RGBA');c=Image.open(SITE/'scenes/trophy-confetti.webp').convert('RGBA')
result=np.array(Image.alpha_composite(g,c));visible=source[:,:,3]>0
assert np.array_equal(result[visible],source[visible]);assert np.array_equal(result[:,:,3],source[:,:,3])
assert not ((np.array(g)[:,:,3]>0)&(np.array(c)[:,:,3]>0)).any()
checks={'trophy':{'visible_rgba_max_error':0,'alpha_max_error':0,'shared_nonzero_alpha_pixels':0,'master_and_full_webp_recomposite':'byte-identical visible RGBA','avif':'lossy q45 delivery; preservation gate applies to masters/full WebP'}}
for mode,target in [('night',(18,10,16)),('day',(255,241,246))]:
 checks[mode]={}
 for ext in ['avif','webp']:
  arr=np.array(Image.open(SITE/f'finale/meadow-{mode}.{ext}').convert('RGBA'))
  assert not arr[:300,:,3].any()
  assert (arr[-100:,:,3]==255).all()
  band=arr[-100:,:,:3];delta=int(np.abs(band.astype(int)-np.array(target)).max())
  if ext=='webp':assert delta==0
  else:assert delta<=2
  checks[mode][ext]={'top_300px_fully_transparent':True,'bottom_rgb':np.unique(band.reshape(-1,3),axis=0).tolist(),'bottom_target_rgb':list(target),'max_bottom_channel_delta':delta}
 depth=np.array(Image.open(SITE/f'finale/meadow-depth-{mode}.webp').convert('RGB'))
 assert (depth[:,:,0]==depth[:,:,1]).all() and (depth[:,:,1]==depth[:,:,2]).all()
 checks[mode]['depth_grayscale']=True
checks['placement']=json.loads((PRE/'meadow-validation.json').read_text())['placement']
checks['trophy_avif_full_KB']=round(sum(x['bytes'] for x in records if x['file'] in ['public/site/scenes/trophy-girl.avif','public/site/scenes/trophy-confetti.avif'])/1000,2)
assert checks['trophy_avif_full_KB']<=140
for m in ['night','day']:
 assert (SITE/f'finale/meadow-{m}.avif').stat().st_size<=170000
(HERE/'manifest.json').write_text(json.dumps({'files':records,'checks':checks},indent=2))
(PRE/'final-validation.json').write_text(json.dumps(checks,indent=2))
print(json.dumps(checks,indent=2))
for r in records:print(f"{r['file']} | {r['px'][0]}×{r['px'][1]} | {r['KB']} KB")
