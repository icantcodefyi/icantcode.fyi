"""IMG-10/11: Real-ESRGAN anime 6B ×2 intermediate; retain source alpha."""
from pathlib import Path
import shutil,sys
import torch, torchvision.transforms.functional as functional
sys.modules['torchvision.transforms.functional_tensor']=functional
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer
import cv2
from PIL import Image
PRE=Path('/tmp/art-finale'); PRE.mkdir(exist_ok=True)
GEN=Path(__file__).resolve().parent/'masters'
SOURCES={mode:f'meadow-{mode}-generated.png' for mode in ['night','day']}
model=RRDBNet(num_in_ch=3,num_out_ch=3,num_feat=64,num_block=6,num_grow_ch=32,scale=4)
up=RealESRGANer(scale=4,model_path='/tmp/hero-art/models/RealESRGAN_x4plus_anime_6B.pth',model=model,tile=256,tile_pad=24,pre_pad=10,half=False,device=torch.device('mps'))
for mode,filename in SOURCES.items():
 src=PRE/f'generated-{mode}.png'; shutil.copy2(GEN/filename,src)
 dst=PRE/f'upscaled-{mode}-2x.png'
 if dst.exists(): continue
 im=Image.open(src).convert('RGBA')
 # Run learned upsampling only on RGB; geometrically resample the original alpha.
 rgb=cv2.cvtColor(__import__('numpy').array(im.convert('RGB')),cv2.COLOR_RGB2BGR)
 result,_=up.enhance(rgb,outscale=2)
 out=Image.fromarray(cv2.cvtColor(result,cv2.COLOR_BGR2RGB)).convert('RGBA')
 out.putalpha(im.getchannel('A').resize(out.size,Image.Resampling.LANCZOS));out.save(dst)
 print(mode,'upscaled',out.size,flush=True)
