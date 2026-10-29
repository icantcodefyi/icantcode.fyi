import os
os.environ['HF_HOME']='/tmp/hero-art/hf-cache'
os.environ['XDG_CACHE_HOME']='/tmp/hero-art/cache'
os.environ['PYTORCH_ENABLE_MPS_FALLBACK']='1'
from pathlib import Path
import json, time, hashlib
import numpy as np
from PIL import Image, ImageDraw
import cv2
import torch
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

ROOT=Path('/tmp/hero-art')
SOURCE=Path('/Users/aniruddhdubge/Desktop/ani/icantcode.fyi/apps/web/public/site')
SOURCES={'night-sky':'plate-night-sky.webp','night-hill':'plate-night-hill.webp','night-char':'hero-night-cutout.webp','day-sky':'plate-day-sky.webp','day-hill':'plate-day-hill.webp','day-char':'hero-cutout.webp'}
MODEL='depth-anything/Depth-Anything-V2-Base-hf'

def infer():
    device='mps' if torch.backends.mps.is_available() else 'cpu'
    print('Loading',MODEL,'on',device,flush=True)
    processor=AutoImageProcessor.from_pretrained(MODEL)
    model=AutoModelForDepthEstimation.from_pretrained(MODEL).to(device).eval()
    (ROOT/'intermediates').mkdir(exist_ok=True)
    records={}
    for name,filename in SOURCES.items():
        src=Image.open(SOURCE/filename).convert('RGBA')
        a=np.array(src)[:,:,3]
        neutral=Image.new('RGBA',src.size,(128,128,128,255))
        rgb=Image.alpha_composite(neutral,src).convert('RGB')
        rgb.save(ROOT/'intermediates'/f'input-{name}.png')
        t=time.time()
        # Preserve aspect ratio, no crop/perspective change; increased 756px short side.
        inputs=processor(images=rgb,return_tensors='pt',size={'height':756,'width':756})
        inputs={k:v.to(device) for k,v in inputs.items()}
        print(name,src.size,'input',inputs['pixel_values'].shape,'alpha',np.unique(a).size,'opaque',round(float((a==255).mean()),3),'transparent',round(float((a==0).mean()),3),flush=True)
        with torch.inference_mode():
            pred=model(**inputs).predicted_depth
            d=torch.nn.functional.interpolate(pred.unsqueeze(1),size=(src.height,src.width),mode='bicubic',align_corners=False)[0,0].cpu().numpy()
        np.save(ROOT/'intermediates'/f'raw-{name}.npy',d)
        records[name]={'source':str(SOURCE/filename),'size':list(src.size),'sha256':hashlib.sha256((SOURCE/filename).read_bytes()).hexdigest(),'model':MODEL,'device':device,'model_input':list(inputs['pixel_values'].shape),'seconds':round(time.time()-t,2),'alpha_levels':int(np.unique(a).size),'opaque_fraction':float((a==255).mean()),'transparent_fraction':float((a==0).mean())}
        print('Saved',name,records[name]['seconds'],'sec',flush=True)
        if device=='mps': torch.mps.empty_cache()
    (ROOT/'depth-metadata.json').write_text(json.dumps(records,indent=2))

if __name__=='__main__': infer()
