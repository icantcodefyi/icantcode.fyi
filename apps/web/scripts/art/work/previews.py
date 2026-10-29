"""Save previews of the actual decoded delivery assets."""
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path('/tmp/art-work')
PUB=Path(__file__).resolve().parents[3]/'public/site/scenes'
pair=Image.new('RGB',(1224,954),'#171119');draw=ImageDraw.Draw(pair)
for i,mode in enumerate(['night','day']):
 im=Image.open(PUB/f'work-sky-{mode}.avif').convert('RGBA')
 im.alpha_composite(Image.open(PUB/f'work-girl-{mode}.avif'),(51,434))
 im.alpha_composite(Image.open(PUB/f'work-flowers-{mode}.avif'),(51,1396))
 im.convert('RGB').save(ROOT/f'preview-encoded-{mode}.jpg',quality=96)
 pair.paste(im.resize((612,918)).convert('RGB'),(i*612,36))
 draw.text((i*612+16,12),f'{mode.upper()} / decoded AVIF composite',fill=(255,235,246))
pair.save(ROOT/'preview-work-pair.jpg',quality=96)
# A useful inspection sheet for alpha edges over contrasting neutral grounds.
sheet=Image.new('RGB',(1122,1426),'#171119')
for i,mode in enumerate(['night','day']):
 im=Image.open(PUB/f'work-girl-{mode}.avif').convert('RGBA')
 for j,color in enumerate([(45,48,54,255),(225,224,218,255)]):
  bg=Image.new('RGBA',im.size,color)
  result=Image.alpha_composite(bg,im).resize((561,701)).convert('RGB')
  sheet.paste(result,(i*561,24+j*701))
ImageDraw.Draw(sheet).text((12,7),'Night / Day — decoded alpha on dark and light grounds',fill='white')
sheet.save(ROOT/'preview-alpha-edges.jpg',quality=96)
