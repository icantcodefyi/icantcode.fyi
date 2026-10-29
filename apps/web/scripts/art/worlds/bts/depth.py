"""Pixel-aligned Depth Anything V2 maps, white near, following art/build_depth.py."""
import os
os.environ['HF_HOME'] = '/tmp/hero-art/hf-cache'
os.environ['XDG_CACHE_HOME'] = '/tmp/hero-art/cache'
os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'
os.environ['HF_HUB_OFFLINE'] = '1'

import hashlib
import json
import time
import cv2
import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation
from prepare import STAGING, HERE

MODEL = 'depth-anything/Depth-Anything-V2-Base-hf'


def main():
    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    print('Loading', MODEL, 'on', device, flush=True)
    processor = AutoImageProcessor.from_pretrained(MODEL, local_files_only=True)
    model = AutoModelForDepthEstimation.from_pretrained(MODEL, local_files_only=True).to(device).eval()
    records = {}
    for mode in ('night', 'day'):
        path = STAGING / f'{mode}-composite-master.png'
        rgb = Image.open(path).convert('RGB')
        t = time.time()
        inputs = processor(images=rgb, return_tensors='pt', size={'height':756, 'width':756})
        inputs = {k:v.to(device) for k,v in inputs.items()}
        with torch.inference_mode():
            prediction = model(**inputs).predicted_depth
            depth = torch.nn.functional.interpolate(prediction.unsqueeze(1),
                    size=(rgb.height,rgb.width), mode='bicubic',
                    align_corners=False)[0,0].cpu().numpy()
        np.save(STAGING/f'{mode}-depth-raw.npy', depth)
        lo, hi = float(depth.min()), float(depth.max())
        depth = np.clip((depth-lo)/(hi-lo),0,1).astype('float32')
        depth = cv2.bilateralFilter(depth,11,.035,4)
        depth = np.clip((depth-depth.min())/(depth.max()-depth.min()),0,1)
        pixels = np.round(depth*255).astype('uint8')
        Image.fromarray(pixels).save(STAGING/f'{mode}-depth.png')
        assert pixels.shape == (1400,2000)
        # This model predicts inverse relative depth; near floor must be brighter
        # than distant central sky. Do not silently invert a failed map.
        sky = float(pixels[220:360,650:1350].mean())
        floor = float(pixels[1280:1390,650:1350].mean())
        assert floor > sky+30, (mode, sky, floor)
        proof=Image.new('RGB',(2000,700))
        proof.paste(rgb.resize((1000,700)),(0,0))
        proof.paste(Image.fromarray(pixels).convert('RGB').resize((1000,700)),(1000,0))
        proof.save(STAGING/f'{mode}-depth-preview.png')
        records[mode] = {'model':MODEL,'device':device,
            'model_input':list(inputs['pixel_values'].shape), 'output_px':[2000,1400],
            'interpolation':'bicubic, align_corners=False, no crop',
            'normalization':'min-max inverse relative depth; white=near',
            'filter':'bilateral 11 / sigmaColor .035 / sigmaSpace 4',
            'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'depth_sha256':hashlib.sha256((STAGING/f'{mode}-depth.png').read_bytes()).hexdigest(),
            'raw_range':[lo,hi], 'output_range':[int(pixels.min()),int(pixels.max())],
            'sky_mean':round(sky,2), 'near_floor_mean':round(floor,2),
            'seconds':round(time.time()-t,2)}
        print(mode, records[mode], flush=True)
        if device=='mps':torch.mps.empty_cache()
    (HERE/'depth-metadata.json').write_text(json.dumps(records,indent=2)+'\n')


if __name__=='__main__':main()
