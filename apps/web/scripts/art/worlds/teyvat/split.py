"""DA-V2 silhouettes, opaque underpainting, and feathered alpha with pigment bleed."""
from pathlib import Path
import json, sys
import numpy as np
import cv2
from PIL import Image
from scipy.ndimage import distance_transform_edt, binary_fill_holes, label
ROOT=Path('/tmp/art-teyvat')

def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)

def signed(mask):
    return distance_transform_edt(mask)-distance_transform_edt(~mask)

def underpaint(rgb, mask, clean):
    """Use a separately generated unobstructed sea behind the near silhouette."""
    weight=smooth(-1.7,1.7,signed(mask))[:,:,None]
    return rgb*(1-weight)+clean*weight


def cutout(rgb,alpha):
    valid=alpha>.01
    dist,ix=distance_transform_edt(~valid,return_indices=True)
    pigment=rgb.copy()
    invisible=~valid
    pigment[invisible]=pigment[ix[0][invisible],ix[1][invisible]]
    pigment[dist>8]=0
    return Image.fromarray(np.uint8(np.rint(np.clip(np.dstack([pigment,alpha*255]),0,255))))

records={}
for p in sorted(ROOT.glob('*-master.png')):
    name=p.name.removesuffix('-master.png')
    if 'cleanplate' in name or not (ROOT/f'{name}-depth.png').exists():continue
    rgb=np.array(Image.open(p).convert('RGB')).astype(np.float32)
    seg=ROOT/f'{name}-segmentation-depth.png'
    if not seg.exists():
        Image.open(ROOT/f'{name}-depth.png').save(seg)
    d=np.array(Image.open(seg)).astype(np.float32)/255
    clean=np.array(Image.open(ROOT/f'{name}-cleanplate-master.png').convert('RGB')).astype(np.float32)
    y=np.linspace(0,1,1350)[:,None]
    # Sky is near zero in the verified inverse-depth maps. A tiny threshold
    # retains the sacred tree, thin spires, torii and distant hazy mountain chain.
    far=(d>.012)&(y>.20)
    far|=np.broadcast_to(y>.65,far.shape)
    far=binary_fill_holes(far)
    far_distance=signed(far)
    far_alpha=smooth(-1.7,1.7,far_distance)
    near=(d>.50)&(y>.73)
    labels,n=label(near)
    areas=np.bincount(labels.ravel())
    near&=areas[labels]>32
    near=binary_fill_holes(near)
    near_distance=signed(near)
    near_alpha=smooth(-1.7,1.7,near_distance)
    hidden=smooth(8,36,far_distance)[:,:,None]
    sky_rgb=rgb*(1-far_alpha[:,:,None])+clean*far_alpha[:,:,None]
    sky_rgb=sky_rgb*(1-hidden)+cv2.GaussianBlur(clean,(0,0),10)*hidden
    sky=Image.fromarray(np.uint8(np.rint(sky_rgb)))
    far_rgb=underpaint(rgb,near,clean)
    fa=far_alpha[:,:,None]
    na=near_alpha[:,:,None]
    # Decontaminate feather pixels against their actual backing pigment.
    far_color=np.divide(far_rgb-sky_rgb*(1-fa),fa,out=far_rgb.copy(),where=fa>.01)
    near_color=np.divide(rgb-far_rgb*(1-na),na,out=rgb.copy(),where=na>.01)
    layers={'sky':sky,'far':cutout(np.clip(far_color,0,255),far_alpha),'near':cutout(np.clip(near_color,0,255),near_alpha)}
    composite=sky.convert('RGBA')
    for kind,im in layers.items():
        im.save(ROOT/f'{name}-{kind}.png')
        if kind!='sky':composite=Image.alpha_composite(composite,im)
    composite.convert('RGB').save(ROOT/f'{name}-composite.png')
    delta=np.abs(np.array(composite.convert('RGB')).astype(float)-rgb)
    records[name]={'size':[2400,1350],'offsets':{k:[0,0] for k in layers},'split_thresholds':{'far':.012,'near':.50},'far_alpha_fraction':float(far_alpha.mean()),'near_alpha_fraction':float(near_alpha.mean()),'reconstruction_mae':float(delta.mean()),'reconstruction_max_error':float(delta.max()),'edge_feather_px':3.4,'underpainting':'generated clean sky and sea, no duplicated landmarks','rgb_bleed_px':8}
    print(name,records[name],flush=True)
(ROOT/'split.json').write_text(json.dumps(records,indent=2)+'\n')
