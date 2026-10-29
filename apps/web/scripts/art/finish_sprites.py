from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw
import cv2
ROOT=Path('/tmp/hero-art'); SOURCE=Path('/Users/aniruddhdubge/Desktop/ani/icantcode.fyi/apps/web/public/site')

def resize_alpha(im,size):
    return im.convert('RGBa').resize(size,Image.Resampling.LANCZOS).convert('RGBA')

def clean(im):
    a=np.array(im)
    a[a[:,:,3]<4]=0
    return Image.fromarray(a)

def cloud_strip(mode,split):
    original=Image.open(ROOT/'generated'/f'clouds-{mode}-original.png').convert('RGBA')
    strip=Image.new('RGBA',(2400,500),(0,0,0,0))
    records=[]
    widths=[480,440,490,460]
    for n,(left,right) in enumerate(zip(split,split[1:])):
        part=original.crop((left,0,right,original.height))
        ar=np.array(part);ys,xs=np.where(ar[:,:,3]>16)
        box=(max(0,int(xs.min())-9),max(0,int(ys.min())-9),min(part.width,int(xs.max())+10),min(part.height,int(ys.max())+10))
        crop=clean(part.crop(box))
        scale=widths[n]/crop.width
        size=(widths[n],round(crop.height*scale))
        sprite=resize_alpha(crop,size)
        xy=(600*n+(600-size[0])//2,[235,265,220,255][n]-size[1]//2)
        strip.alpha_composite(sprite,xy)
        records.append({'source_crop':[left+box[0],box[1],left+box[2],box[3]],'output_xy':list(xy),'output_size':list(size)})
    strip=clean(strip);strip.save(ROOT/f'clouds-{mode}.png')
    plate=Image.open(SOURCE/f'plate-{mode}-sky.webp').convert('RGBA')
    demo=resize_alpha(strip,(1672,348))
    plate.alpha_composite(demo,(0,32 if mode=='day' else 128))
    plate.convert('RGB').save(ROOT/f'preview-clouds-{mode}.jpg',quality=95,subsampling=0)
    a=np.array(strip)[:,:,3]
    assert not a[:,0].any() and not a[:,-1].any() and not a[0,:].any() and not a[-1,:].any()
    for x in [600,1200,1800]:assert not a[:,x].any()
    return {'size':[2400,500],'true_alpha':True,'outer_edges_transparent':True,'inter_cloud_gaps_transparent':True,'clouds':records}

def birds():
    original=Image.open(ROOT/'generated'/'birds-day-original.png').convert('RGBA')
    sheet=Image.new('RGBA',(768,128),(0,0,0,0));records=[];frames=[]
    scale=96/283
    for n in range(6):
        left=round(original.width*n/6);right=round(original.width*(n+1)/6)
        part=clean(original.crop((left,0,right,original.height)))
        a=np.array(part)[:,:,3];ys,xs=np.where(a>20)
        center_x=(int(xs.min())+int(xs.max()))/2
        # The short vertical body stays anchored while wing silhouettes change.
        body=a[:,round(center_x)-2:round(center_x)+3].max(axis=1)
        body_y=np.where(body>64)[0]
        center_y=(int(body_y.min())+int(body_y.max()))/2
        anchor=Image.new('RGBA',(378,378),(0,0,0,0))
        # A fixed scale and a fixed body anchor in all six square cells.
        anchor.alpha_composite(part,(round(189-center_x),round(189-center_y)))
        frame=resize_alpha(anchor,(128,128));frames.append(frame)
        sheet.alpha_composite(frame,(n*128,0))
        records.append({'source_body_anchor':[round(left+center_x,2),round(center_y,2)],'frame':[n*128,0,128,128],'output_body_anchor':[64,64]})
    sheet=clean(sheet);sheet.save(ROOT/'birds-day.png')
    plate=Image.open(SOURCE/'plate-day-sky.webp').convert('RGBA')
    # Six poses at actual distant-bird scale, plus an enlarged readable row.
    for n,frame in enumerate(frames):
        plate.alpha_composite(resize_alpha(frame,(28,28)),(540+n*72,170+(n%2)*14))
    full=Image.new('RGB',(1672,1133),(228,234,245));full.paste(plate.convert('RGB'),(0,0))
    draw=ImageDraw.Draw(full);draw.text((36,964),'Six-frame wingbeat | 128 x 128 cells | above: 28px display size',fill=(86,61,83))
    for n,frame in enumerate(frames):
        bg=Image.new('RGBA',(128,128),(228,234,245,255));bg.alpha_composite(frame)
        full.paste(bg.convert('RGB'),(390+n*150,990));draw.text((451+n*150,1114),str(n+1),fill=(86,61,83))
    full.save(ROOT/'preview-birds-day.jpg',quality=95,subsampling=0)
    a=np.array(sheet)[:,:,3]
    for n in range(6):
        cell=a[:,n*128:(n+1)*128]
        assert cell.max()>128 and not cell[0,:].any() and not cell[-1,:].any() and not cell[:,0].any() and not cell[:,-1].any()
    return {'size':[768,128],'frame_size':[128,128],'frames':records,'suggested_fps':8,'true_alpha':True,'all_cell_edges_transparent':True}

if __name__=='__main__':
    records={}
    records['clouds-day']=cloud_strip('day',[0,554,1080,1645,2172])
    records['clouds-night']=cloud_strip('night',[0,496,957,1440,1920])
    records['birds-day']=birds()
    (ROOT/'sprite-metadata.json').write_text(json.dumps(records,indent=2))
    print('All sprite dimensions, alpha margins and gaps validated.')
