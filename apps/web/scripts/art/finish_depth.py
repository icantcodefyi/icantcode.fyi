from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt
from build_depth import ROOT, SOURCE, SOURCES

def norm(d,mask):
    lo=float(d[mask].min());hi=float(d[mask].max())
    return np.clip((d-lo)/max(hi-lo,1e-8),0,1).astype(np.float32)

def smoothstep(a,b,x):
    t=np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)

def finish():
    checks={}
    for name,filename in SOURCES.items():
        src=Image.open(SOURCE/filename).convert('RGBA'); arr=np.array(src); alpha=arr[:,:,3]
        visible=alpha>0
        raw=np.load(ROOT/'intermediates'/f'raw-{name}.npy')
        d=norm(raw,visible)
        h,w=d.shape
        if name.endswith('sky'):
            rgb=arr[:,:,:3].astype(np.float32)/255
            yy,xx=np.mgrid[:h,:w].astype(np.float32)
            # Restrict small corrections to sky, fading before the model's terrain.
            sky_gate=(1-smoothstep(.025,.16,d))*(1-smoothstep(.58,.76,yy/h))
            perspective=1-.75*np.clip(yy/(.7*h),0,1)
            gradient=.012+.018*(1-yy/h)
            if name.startswith('day'):
                clouds=smoothstep(-.30,-.015,rgb[:,:,0]-rgb[:,:,2])
            else:
                clouds=smoothstep(.005,.38,rgb[:,:,0]-1.02*rgb[:,:,2])
            clouds=cv2.GaussianBlur(clouds,(0,0),3)
            sky_relief=gradient+.115*clouds*perspective
            if name.startswith('night'):
                # Moon limb measured in the source, no generated/repainted geometry.
                radius=np.sqrt((xx-1436.5)**2+(yy-151.5)**2)
                moon=1-smoothstep(74.0,78.0,radius)
                sky_relief=sky_relief*(1-moon)+(.064+.004*(1-(radius/78)**2).clip(0,1))*moon
            d=d+sky_gate*sky_relief
            if name.startswith('night'):
                d=d*(1-moon)+(.17+.004*(1-(radius/78)**2).clip(0,1))*moon
        # Extend foreground values before filtering, so transparency cannot bleed
        # a dark depth rim into the original silhouette.
        if not visible.all():
            distance,indices=distance_transform_edt(~visible,return_indices=True)
            extension=(~visible)&(distance<=12)
            d[extension]=d[tuple(indices[:,extension])]
        d=cv2.bilateralFilter(d.astype(np.float32),11,.045,4.0)
        d=norm(d,visible)
        pixels=np.round(d*255).astype(np.uint8)
        if not visible.all():
            # Invisible RGB guard band for linear texture sampling; alpha untouched.
            pixels[~visible]=0
            guard=(~visible)&(distance<=8)
            pixels[guard]=pixels[tuple(indices[:,guard])]
        out=np.dstack([pixels,pixels,pixels,alpha]); Image.fromarray(out).save(ROOT/f'depth-{name}.png')
        # Full-resolution side by side, no source scaling or crop.
        canvas=Image.new('RGB',(2*w,h+36),(38,35,43));draw=ImageDraw.Draw(canvas)
        draw.text((12,11),f'SOURCE — {filename}',fill=(238,229,240))
        draw.text((w+12,11),'DEPTH — white = near / black = far',fill=(238,229,240))
        neutral=Image.new('RGBA',(w,h),(100,96,105,255))
        canvas.paste(Image.alpha_composite(neutral,src).convert('RGB'),(0,36))
        black=Image.new('RGBA',(w,h),(0,0,0,255))
        canvas.paste(Image.alpha_composite(black,Image.fromarray(out)).convert('RGB'),(w,36))
        canvas.save(ROOT/f'preview-{name}.jpg',quality=94,subsampling=0)
        saved=np.array(Image.open(ROOT/f'depth-{name}.png'))
        assert saved.shape==arr.shape
        assert np.array_equal(saved[:,:,3],alpha)
        assert np.array_equal(saved[:,:,0],saved[:,:,1]) and np.array_equal(saved[:,:,0],saved[:,:,2])
        assert saved[:,:,0][visible].min()==0 and saved[:,:,0][visible].max()==255
        checks[name]={'dimensions_match':True,'alpha_byte_identical':True,'grayscale':True,'visible_range':[0,255],'unique_visible_levels':int(np.unique(pixels[visible]).size),'hidden_rgb_edge_extension_px':8 if not visible.all() else 0}
        print(name,checks[name],flush=True)
    (ROOT/'depth-validation.json').write_text(json.dumps(checks,indent=2))

if __name__=='__main__':finish()
