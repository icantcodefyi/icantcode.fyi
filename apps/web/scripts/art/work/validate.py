"""Validate original-pixel cuts, alignment, atlas bounds, encodes and budgets."""
from pathlib import Path
import sys,json,hashlib
import numpy as np
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from verify import verify_cut
ROOT=Path('/tmp/art-work')
WEB=Path(__file__).resolve().parents[3]
PUBLIC=WEB/'public/site/scenes'
checks={'cuts':[],'encoded':[],'totals_KB':{}}
for mode in ['night','day']:
 src=PUBLIC/('ship-launch.webp' if mode=='night' else 'ship-launch-day.webp')
 for kind,y in [('girl',0),('flowers',962)]:
  checks['cuts'].append(verify_cut(src,ROOT/f'work-{kind}-{mode}.png',0,y))
  rgba=np.array(Image.open(ROOT/f'work-{kind}-{mode}.png'))
  dep=np.array(Image.open(ROOT/f'depth-{kind}-{mode}.png'))
  assert np.array_equal(rgba[...,3],dep[...,3])
 for kind in ['girl','flowers']:
  assert np.array_equal(np.array(Image.open(ROOT/f'work-{kind}-night.png'))[...,3],np.array(Image.open(ROOT/f'work-{kind}-day.png'))[...,3])
 total=0
 for kind,limit in [('sky',220),('girl',150),('flowers',40),('depth',35)]:
  base=f'work-{kind}-{mode}'
  master=Image.open(ROOT/f'{base}.png')
  for suffix in ([''] if kind=='depth' else ['','-half']):
   size=master.size if not suffix else (master.width//2,master.height//2)
   for ext in ['avif','webp']:
    path=PUBLIC/f'{base}{suffix}.{ext}';im=Image.open(path);im.load()
    assert im.size==size,(path,im.size,size)
    if ext=='avif' and not suffix:
     assert path.stat().st_size<=limit*1024,(path,path.stat().st_size)
     total+=path.stat().st_size
    if kind=='depth':
     rgb=np.array(im.convert('RGB'));assert np.array_equal(rgb[...,0],rgb[...,1]) and np.array_equal(rgb[...,0],rgb[...,2])
     if ext=='webp':assert np.array_equal(np.array(im.convert('L')),np.array(master))
    if kind in ['girl','flowers'] and ext=='webp':
     ref=master if not suffix else master.resize(size,Image.Resampling.LANCZOS)
     assert np.array_equal(np.array(im.convert('RGBA'))[...,3],np.array(ref)[...,3])
    checks['encoded'].append({'file':path.name,'size':list(size),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 checks['totals_KB'][mode]=round(total/1024,2)
 assert total<=445*1024
atlas=json.loads((ROOT/'depth-validation.json').read_text())
for data in atlas['plates'].values():
 x,y,w,h=data['tile'];assert x+w<=1173 and y+h<=921
checks['atlas_all_tiles_in_bounds']=True
checks['common_day_night_alpha']=True
checks['depth_source_alpha_identical']=True
checks['composition']=json.loads((ROOT/'composition.json').read_text())
checks['lossy_delivery_note']='Original RGB/recomposite checks apply to lossless staging masters; AVIF and color WebP are intentionally lossy per plan.'
(ROOT/'verification.json').write_text(json.dumps(checks,indent=2))
Path(__file__).with_name('verification.json').write_text(json.dumps(checks,indent=2))
print(json.dumps({k:v for k,v in checks.items() if k!='encoded'},indent=2))
