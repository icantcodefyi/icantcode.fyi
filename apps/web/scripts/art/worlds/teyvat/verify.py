"""Decode every deliverable; verify dimensions, alpha, depth and composite fidelity."""
from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image
ROOT=Path('/tmp/art-teyvat')
HERE=Path(__file__).resolve().parent
OUT=HERE.parents[3]/'public/lobby/gi/vista'
records=json.loads((ROOT/'files.json').read_text())
assert len(records)==96, len(records)
report={'file_count':len(records),'paintings':{},'files':[]}
for r in records:
    p=OUT/r['file'];im=Image.open(p);im.load()
    assert list(im.size)==r['px'],p
    assert p.stat().st_size==r['bytes'],p
    rgba=np.array(im.convert('RGBA'));a=rgba[:,:,3]
    kind=p.stem.split('-')[2]
    if kind in ['far','near']:
        assert np.any(a==0) and np.any(a>240) and np.any((a>0)&(a<255)),p
        assert np.max(a[:100])<=1,p  # AVIF quantization may leave one alpha LSB.
    else:assert a.min()==255,p
    if kind=='depth':
        rgb=rgba[:,:,:3].astype(int)
        assert np.max(np.max(rgb,axis=2)-np.min(rgb,axis=2))<=1,p
    report['files'].append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'mode':im.mode,'alpha_min':int(a.min()),'alpha_max':int(a.max())})
for region in ['inazuma','liyue','fontaine']:
    for mode in ['night','day']:
        name=f'{region}-{mode}'
        reference=np.array(Image.open(ROOT/f'{name}-composite.png').convert('RGB')).astype(float)
        metrics={}
        for ext in ['avif','webp']:
            im=Image.open(OUT/f'{name}-sky.{ext}').convert('RGBA')
            for k in ['far','near']:im=Image.alpha_composite(im,Image.open(OUT/f'{name}-{k}.{ext}').convert('RGBA'))
            actual=np.array(im.convert('RGB')).astype(float)
            rmse=float(np.sqrt(np.mean((reference-actual)**2)))
            metrics[ext]={'full_KB':round(sum(r['bytes'] for r in records if r['file'].startswith(name) and r['file'].endswith('.'+ext) and '-1200' not in r['file'])/1024,2),'rmse_8bit':round(rmse,3),'psnr_dB':round(float(20*np.log10(255/max(rmse,1e-10))),2)}
            assert metrics[ext]['psnr_dB']>28,(name,ext,metrics)
        depth=np.array(Image.open(OUT/f'{name}-depth.avif').convert('L')).astype(float)
        assert float(depth[-150:].mean())>float(depth[:300].mean())+70,name
        metrics['depth_top_mean']=round(float(depth[:300].mean()),2)
        metrics['depth_bottom_mean']=round(float(depth[-150:].mean()),2)
        report['paintings'][name]=metrics
        print(name,metrics,flush=True)
(ROOT/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
(HERE/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
print('96 assets passed',flush=True)
