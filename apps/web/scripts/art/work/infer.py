"""Run cached DA-V2 Base on original canvases or final Work plates."""
import os
os.environ['HF_HOME']='/tmp/hero-art/hf-cache'
os.environ['PYTORCH_ENABLE_MPS_FALLBACK']='1'
from pathlib import Path
import sys, json, hashlib
import numpy as np
from PIL import Image
import torch
from transformers import AutoImageProcessor, AutoModelForDepthEstimation
ROOT=Path('/tmp/art-work')
SRC=Path(__file__).resolve().parents[3]/'public/site/scenes'
model_id='depth-anything/Depth-Anything-V2-Base-hf'
device='mps' if torch.backends.mps.is_available() else 'cpu'
p=AutoImageProcessor.from_pretrained(model_id)
m=AutoModelForDepthEstimation.from_pretrained(model_id).to(device).eval()
items={f'original-{mode}':SRC/('ship-launch.webp' if mode=='night' else 'ship-launch-day.webp') for mode in ['night','day']} if '--original' in sys.argv else {f'{kind}-{mode}':ROOT/f'work-{kind}-{mode}.png' for mode in ['night','day'] for kind in ['sky','girl','flowers']}
cache_path=ROOT/'inference-inputs.json'
cache=json.loads(cache_path.read_text()) if cache_path.exists() else {}
for name,path in items.items():
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    if (ROOT/f'raw-{name}.npy').exists() and cache.get(name)==digest: continue
    im=Image.open(path).convert('RGBA')
    rgb=Image.alpha_composite(Image.new('RGBA',im.size,(128,128,128,255)),im).convert('RGB')
    inputs={k:v.to(device) for k,v in p(images=rgb,return_tensors='pt',size={'height':756,'width':756}).items()}
    with torch.inference_mode():
        raw=m(**inputs).predicted_depth
        d=torch.nn.functional.interpolate(raw.unsqueeze(1),size=(im.height,im.width),mode='bicubic',align_corners=False)[0,0].cpu().numpy()
    np.save(ROOT/f'raw-{name}.npy',d)
    cache[name]=digest
    cache_path.write_text(json.dumps(cache,indent=2))
    print(name,im.size,float(d.min()),float(d.max()),flush=True)
    if device=='mps':torch.mps.empty_cache()
