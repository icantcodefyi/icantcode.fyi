"""Decoded-asset proofs, text-safe panel mocks, layer contact sheets, and motion GIF."""
from pathlib import Path
import math, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT=Path('/tmp/art-teyvat')
HERE=Path(__file__).resolve().parent
APP=HERE.parents[3]
OUT=APP/'public/lobby/gi/vista'
REGIONS=['inazuma','liyue','fontaine']
NAMES={'inazuma':('kazuha','KAEDEHARA\nKAZUHA','Anemo','Acer Palmatum'), 'liyue':('zhongli','ZHONGLI','Geo','Lapis Dei'),'fontaine':('furina','FURINA','Hydro','Animula Choragi')}
FONTS=Path('/System/Library/Fonts/Supplemental')
def font(size,serif=False):return ImageFont.truetype(str(FONTS/('Georgia.ttf' if serif else 'Arial.ttf')),size)

def decoded(name,ext='avif',suffix=''):
    im=Image.open(OUT/f'{name}-sky{suffix}.{ext}').convert('RGBA')
    for kind in ['far','near']:im=Image.alpha_composite(im,Image.open(OUT/f'{name}-{kind}{suffix}.{ext}').convert('RGBA'))
    return im

def mock(name):
    region,mode=name.split('-')
    base=decoded(name).resize((1440,810),Image.Resampling.LANCZOS)
    a=np.array(base).astype(float)
    tint=np.array([8,64,63,255])
    opacity=.24 if mode=='night' else .10
    a=a*(1-opacity)+tint*opacity
    im=Image.fromarray(np.uint8(a)).convert('RGBA')
    overlay=Image.new('RGBA',im.size)
    d=ImageDraw.Draw(overlay)
    # Deliberately simple proxy for the existing gold instrument, not replacement UI.
    gold=(238,202,121,175)
    cx,cy=345,418
    for radius in [284,279,264,245,236,211,119,110]:
        d.ellipse((cx-radius,cy-radius,cx+radius,cy+radius),outline=gold,width=1)
    for angle in range(0,360,5):
        r=267 if angle%30 else 258
        rad=math.radians(angle)
        d.line((cx+math.cos(rad)*r,cy+math.sin(rad)*r,cx+math.cos(rad)*277,cy+math.sin(rad)*277),fill=gold,width=1)
    d.rounded_rectangle((842,69,1402,741),radius=14,fill=(4,35,37,223))
    im=Image.alpha_composite(im,overlay)
    char,title,element,constellation=NAMES[region]
    portrait=Image.open(APP/f'public/lobby/gi/{char}-portrait.webp').convert('RGBA')
    portrait.thumbnail((690,700),Image.Resampling.LANCZOS)
    im.alpha_composite(portrait,(int(cx-portrait.width/2),int(cy-portrait.height/2)))
    d=ImageDraw.Draw(im)
    gold=(239,207,142,255);white=(243,248,246,255);soft=(195,218,211,255)
    d.text((878,103),'TEYVAT',font=font(43,True),fill=gold)
    d.text((878,174),f'{element}  ·  {region.title()}',font=font(20),fill=soft)
    d.multiline_text((875,229),title,font=font(45,True),spacing=4,fill=white)
    d.line((878,372,1076,372),fill=gold,width=1)
    descriptions={'inazuma':['A wandering blade, a distant shore.','Violet skies over Narukami Island.'], 'liyue':['Mountains hold a thousand stories.','Lanterns light the harbor far below.'], 'fontaine':['Where the waters take the stage.','A court of light above the falls.']}
    for i,line in enumerate(descriptions[region]):d.text((878,407+i*32),line,font=font(21),fill=white)
    rows=[('Region',region.title()),('Constellation',constellation),('Home of',{'inazuma':'Kazuha','liyue':'Zhongli · Hu Tao','fontaine':'Furina'}[region])]
    for i,(label,value) in enumerate(rows):
        y=521+i*48
        d.line((878,y-10,1364,y-10),fill=(136,161,143,120),width=1)
        d.text((878,y),label,font=font(17),fill=gold)
        d.text((1022,y),value,font=font(17),fill=white)
    d.text((878,691),f'{mode.upper()}  /  2400 × 1350',font=font(14),fill=soft)
    im.convert('RGB').save(ROOT/f'{name}-mock.png')
    return im.convert('RGB')

for region in REGIONS:
    for mode in ['night','day']:
        name=f'{region}-{mode}'
        if not (OUT/f'{name}-near.avif').exists():continue
        decoded(name).convert('RGB').save(ROOT/f'{name}-preview.png')
        mock(name)

for kind in ['preview','mock']:
    sheet=Image.new('RGB',(1440,3*440),(13,28,32))
    d=ImageDraw.Draw(sheet)
    for row,region in enumerate(REGIONS):
        for col,mode in enumerate(['night','day']):
            p=ROOT/f'{region}-{mode}-{kind}.png'
            if not p.exists():continue
            im=Image.open(p).resize((720,405),Image.Resampling.LANCZOS)
            sheet.paste(im,(col*720,row*440+35))
            d.text((col*720+16,row*440+9),f'{region.title()} / {mode}',font=font(18),fill=(234,218,180))
    sheet.save(ROOT/f'contact-{kind}.png')

for mode in ['night','day']:
    sheet=Image.new('RGB',(1440,3*350),(100,122,119))
    d=ImageDraw.Draw(sheet)
    for row,region in enumerate(REGIONS):
        for col,kind in enumerate(['sky','far','near']):
            p=OUT/f'{region}-{mode}-{kind}.avif'
            if not p.exists():continue
            im=Image.open(p).convert('RGBA').resize((480,270),Image.Resampling.LANCZOS)
            sheet.paste(im,(col*480,row*350+36),im)
            d.text((col*480+12,row*350+10),f'{region.title()} {kind}',font=font(18),fill='white')
    sheet.save(ROOT/f'layers-{mode}.png')

# Deliberately bounded motion: all layers share the same 1.04 overscan.
frames=[]
for frame in range(24):
    canvas=Image.new('RGB',(960,540*3))
    t=2*math.pi*frame/24
    for row,region in enumerate(REGIONS):
        comp=None
        for kind,travel in [('sky',1),('far',3),('near',6)]:
            p=OUT/f'{region}-night-{kind}.avif'
            if not p.exists():continue
            layer=Image.open(p).convert('RGBA').resize((1000,562),Image.Resampling.LANCZOS)
            dx=round(20+math.sin(t)*travel);dy=round(11+math.cos(t)*travel*.4)
            layer=layer.crop((dx,dy,dx+960,dy+540))
            comp=layer if comp is None else Image.alpha_composite(comp,layer)
        if comp:canvas.paste(comp.convert('RGB'),(0,row*540))
    frames.append(canvas.resize((640,1080),Image.Resampling.LANCZOS))
frames[0].save(ROOT/'parallax-night.gif',save_all=True,append_images=frames[1:],duration=80,loop=0)
print('previews done',flush=True)
