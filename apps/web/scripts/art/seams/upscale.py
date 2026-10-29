"""Real-ESRGAN anime 6B RGB upscale with independent, original-alpha resampling."""
from pathlib import Path
import sys
import cv2
import numpy as np
import torch
import torchvision.transforms.functional as functional
from PIL import Image
from scipy.ndimage import distance_transform_edt

sys.modules['torchvision.transforms.functional_tensor'] = functional
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer

HERE = Path(__file__).resolve().parent
STAGE = Path('/tmp/art-seams')
STAGE.mkdir(exist_ok=True)
model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64,
               num_block=6, num_grow_ch=32, scale=4)
up = RealESRGANer(scale=4,
    model_path='/tmp/hero-art/models/RealESRGAN_x4plus_anime_6B.pth',
    model=model, tile=192, tile_pad=24, pre_pad=10,
    half=False, device=torch.device('mps'))
for src in sorted((HERE / 'sources').glob('*.png')):
    dst = STAGE / f'{src.stem}-2x.png'
    if dst.exists():
        continue
    im = Image.open(src).convert('RGBA')
    arr = np.array(im)
    # Extend cloud pigment under empty alpha before learned RGB interpolation.
    solid = arr[:, :, 3] > 127
    _, indices = distance_transform_edt(~solid, return_indices=True)
    empty = arr[:, :, 3] < 8
    arr[empty, :3] = arr[indices[0][empty], indices[1][empty], :3]
    rgb = cv2.cvtColor(arr[:, :, :3], cv2.COLOR_RGB2BGR)
    result, _ = up.enhance(rgb, outscale=2)
    out = Image.fromarray(cv2.cvtColor(result, cv2.COLOR_BGR2RGB)).convert('RGBA')
    out.putalpha(im.getchannel('A').resize(out.size, Image.Resampling.LANCZOS))
    out.save(dst)
    print(src.stem, 'upscaled', out.size, flush=True)
    torch.mps.empty_cache()
