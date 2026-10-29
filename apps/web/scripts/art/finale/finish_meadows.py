"""Crop ×2 anime upscales, impose exact ground, export and prove sitter geometry."""
from pathlib import Path
import json
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
WEB=Path(__file__).resolve().parents[3]; SITE=WEB/'public/site'; OUT=SITE/'finale'; OUT.mkdir(exist_ok=True)
PRE=Path('/tmp/art-finale'); SIZE=(2400,1100)
GROUND={'night':(18,10,16),'day':(255,241,246)}
# Coordinates measured on the unchanged 1448×1086 sitting cutout.
SIT_ANCHOR=(710,675); SIT_WIDTH=864; SEAT=(1488,570)
SCALE=SIT_WIDTH/1448; SIT_XY=(round(SEAT[0]-SIT_ANCHOR[0]*SCALE),round(SEAT[1]-SIT_ANCHOR[1]*SCALE))
report={}
for mode in ['night','day']:
 im=Image.open(PRE/f'upscaled-{mode}-2x.png').convert('RGBA')
 # 1536×704 window, with top offset 160 in original 1536×1024 canvas.
 im=im.crop((0,320,3072,1728)).resize(SIZE,Image.Resampling.LANCZOS)
 a=np.array(im)
 # Generated alpha has isolated values 1–2 above the ridge: remove that noise.
 a[a[:,:,3]<=2,3]=0
 y=np.arange(1100)[:,None,None]
 t=np.clip((y-710)/(900-710),0,1); t=t*t*(3-2*t)
 a[:,:,:3]=np.rint(a[:,:,:3]*(1-t)+np.array(GROUND[mode])*t).astype('uint8')
 a[710:,:,3]=255
 # Clear hidden RGB; no paint or alpha changes above the ridge.
 a[a[:,:,3]==0,:3]=0
 im=Image.fromarray(a); im.save(PRE/f'meadow-{mode}-master.png')
 for suffix,size in [('',SIZE),('-1200',(1200,550))]:
  img=im if not suffix else im.resize(size,Image.Resampling.LANCZOS)
  # Lossless fallback: exact bottom hex and source alpha survive encoding.
  img.save(OUT/f'meadow-{mode}{suffix}.webp',lossless=True,method=6)
  img.save(OUT/f'meadow-{mode}{suffix}.avif',quality=60,subsampling='4:2:0',speed=4)
 # Existing hero sky is preview only, never re-exported as a new site asset.
 sky=Image.open(SITE/f'plate-{mode}-sky.webp').convert('RGBA').resize(SIZE,Image.Resampling.LANCZOS)
 stage=Image.alpha_composite(sky,im)
 stage.save(PRE/f'meadow-{mode}-preview.png')
 sitter=Image.open(SITE/'scenes/sit-cutout.webp').convert('RGBA').resize((SIT_WIDTH,round(1086*SCALE)),Image.Resampling.LANCZOS)
 # A separate preview contact shadow, below the original unmodified sitter.
 shadow=Image.new('RGBA',SIZE); d=ImageDraw.Draw(shadow)
 d.ellipse((SEAT[0]-170,SEAT[1]-10,SEAT[0]+180,SEAT[1]+12),fill=(12,5,14,115 if mode=='night' else 72))
 shadow=shadow.filter(ImageFilter.GaussianBlur(8)); stage=Image.alpha_composite(stage,shadow)
 stage.alpha_composite(sitter,SIT_XY);stage.save(PRE/f'sit-composite-{mode}.png')
 # Transparency check over a deliberately incompatible flat blue.
 test=Image.alpha_composite(Image.new('RGBA',SIZE,'#24576a'),im);test.save(PRE/f'alpha-check-{mode}.png')
 report[mode]={'size':SIZE,'transparent_fraction':float((a[:,:,3]==0).mean()),'solid_bottom_rgb':list(GROUND[mode]),'solid_bottom_from_y':900,'top_20_percent_clear':bool((a[:220,:,3]==0).all())}
report['placement']={'seat_px':SEAT,'seat_pct':[62,570/11],'sit_original_px':[1448,1086],'sit_width_px':SIT_WIDTH,'sit_scale':SCALE,'sit_top_left_px':SIT_XY,'sit_top_left_pct':[SIT_XY[0]/24,SIT_XY[1]/11],'sit_width_percent_of_meadow':36,'sit_contact_anchor_source_px':SIT_ANCHOR,'rotation_degrees':0}
(PRE/'meadow-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
