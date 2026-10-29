"""Pixel-aligned Depth Anything V2 Base inference; uses the shared offline cache."""
import os
os.environ['HF_HOME'] = '/tmp/hero-art/hf-cache'
os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'
from pathlib import Path
import sys, json, hashlib
import numpy as np
from PIL import Image
import torch
from transformers import AutoImageProcessor, AutoModelForDepthEstimation
ROOT = Path('/tmp/art-teyvat')
MODEL = 'depth-anything/Depth-Anything-V2-Base-hf'

def infer(names, combined=False):
    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    processor = AutoImageProcessor.from_pretrained(MODEL, local_files_only=True)
    model = AutoModelForDepthEstimation.from_pretrained(MODEL, local_files_only=True).to(device).eval()
    metadata_path = ROOT/('final-inference.json' if combined else 'inference.json')
    metadata = json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
    for name in names:
        path = ROOT/f'{name}-composite.png' if combined else ROOT/f'{name}-master.png'
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if (ROOT/f'{name}-raw-depth.npy').exists() and metadata.get(name, {}).get('sha256') == digest:
            continue
        im = Image.open(path).convert('RGB')
        inputs = {k:v.to(device) for k,v in processor(images=im, return_tensors='pt', size={'height':756,'width':756}).items()}
        with torch.inference_mode():
            raw = model(**inputs).predicted_depth
            d = torch.nn.functional.interpolate(raw.unsqueeze(1), size=(im.height,im.width), mode='bicubic', align_corners=False)[0,0].cpu().numpy()
        np.save(ROOT/f'{name}-raw-depth.npy', d)
        lo,hi = np.percentile(d,[.2,99.8])
        normalized = np.clip((d-lo)/(hi-lo),0,1)
        Image.fromarray(np.uint8(np.rint(normalized*255))).save(ROOT/f'{name}-depth.png')
        metadata[name] = {'model':MODEL,'device':device,'sha256':digest,'size':list(im.size),'model_input':list(inputs['pixel_values'].shape),'normalization':[float(lo),float(hi)],'convention':'white near / black far; inverse relative depth'}
        metadata_path.write_text(json.dumps(metadata,indent=2)+'\n')
        print(name, 'depth done',flush=True)
        if device=='mps': torch.mps.empty_cache()

if __name__ == '__main__':
    infer([a for a in sys.argv[1:] if not a.startswith('--')] or [f'{r}-{m}' for r in ['inazuma','liyue','fontaine'] for m in ['night','day']], combined='--combined' in sys.argv)
