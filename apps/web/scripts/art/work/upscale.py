"""Anime-safe ×2 intermediate from x4plus_anime_6B, then target size."""
import sys
from pathlib import Path
import torch, torchvision.transforms.functional as tf
sys.modules['torchvision.transforms.functional_tensor']=tf
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer
import cv2
from PIL import Image
ROOT=Path('/tmp/art-work')
model=RRDBNet(num_in_ch=3,num_out_ch=3,num_feat=64,num_block=6,num_grow_ch=32,scale=4)
up=RealESRGANer(scale=4,model_path='/tmp/hero-art/models/RealESRGAN_x4plus_anime_6B.pth',model=model,tile=256,tile_pad=24,pre_pad=10,half=False,device=torch.device('mps'))
for mode in ['night','day']:
    version='v3' if mode=='night' else 'v1'
    source=ROOT/f'generated-{mode}-{version}.png'
    output=ROOT/f'upscaled-{mode}.png'
    if output.exists():continue
    result,_=up.enhance(cv2.imread(str(source)),outscale=2)
    cv2.imwrite(str(ROOT/f'upscaled-{mode}-2x.png'),result)
    Image.fromarray(cv2.cvtColor(result,cv2.COLOR_BGR2RGB)).resize((1224,1836),Image.Resampling.LANCZOS).save(output)
    print(mode,'done',flush=True)
