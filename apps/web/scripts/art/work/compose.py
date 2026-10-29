"""Register generated scenery, restore protected original pixels with an 8px feather."""
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
import cv2
from scipy import ndimage as ndi
from scipy.interpolate import RBFInterpolator
import json
from harmonize import match_boundary
ROOT=Path('/tmp/art-work')
SRC=Path(__file__).resolve().parents[3]/'public/site/scenes'
H,W=1836,1224
char=np.array(Image.open(ROOT/'mask-girl-shared.png'))>0
flowers=np.zeros((1402,1122),bool);flowers[962:]=np.array(Image.open(ROOT/'mask-flowers-shared.png'))>0
# Removal includes all silhouette/feathered foreground, with required guard bands.
remove=ndi.binary_dilation(char,iterations=16)|ndi.binary_dilation(flowers,iterations=10)
known=np.zeros((H,W),bool);known[434:,51:1173]=~remove
# Explicitly avoid canvas boundary discontinuities with an inward 8px feather.
dist=ndi.distance_transform_edt(known)
weight=np.clip(dist/8,0,1);weight=weight*weight*(3-2*weight)
Image.fromarray(np.round(weight*255).astype('uint8')).save(ROOT/'restore-mask.png')
meta={}
for mode in ['night','day']:
 p=ROOT/f'upscaled-{mode}.png'
 if not p.exists():continue
 original=Image.open(SRC/('ship-launch.webp' if mode=='night' else 'ship-launch-day.webp')).convert('RGB')
 target=np.zeros((H,W,3),np.uint8);target[434:,51:1173]=np.array(original)
 gen=np.array(Image.open(p).convert('RGB'))
 sift=cv2.SIFT_create(nfeatures=12000)
 k1,d1=sift.detectAndCompute(cv2.cvtColor(target,cv2.COLOR_RGB2GRAY),(known*255).astype('uint8'))
 k2,d2=sift.detectAndCompute(cv2.cvtColor(gen,cv2.COLOR_RGB2GRAY),None)
 matches=cv2.BFMatcher().knnMatch(d1,d2,k=2)
 pairs=[]
 for m,n in matches:
  p1=np.array(k1[m.queryIdx].pt);p2=np.array(k2[m.trainIdx].pt)
  if m.distance<.70*n.distance and np.linalg.norm(p1-p2)<130:pairs.append((p1,p2))
 a=np.array([x[0] for x in pairs]);b=np.array([x[1] for x in pairs])
 affine,inliers=cv2.estimateAffinePartial2D(a,b,method=cv2.RANSAC,ransacReprojThreshold=8)
 good=inliers[:,0]>0;a=a[good];b=b[good]
 # One sample per 40px cell prevents clustered descriptors biasing the fit.
 _,ix=np.unique((a//40).astype(int),axis=0,return_index=True);a=a[ix];b=b[ix]
 # Low-frequency correction interpolated from stable unchanged scenery features.
 anchors=np.array([[0,0],[W/2,0],[W,0]],float)
 a=np.vstack([a,anchors]);b=np.vstack([b,anchors])
 warp=RBFInterpolator(a/1000,(b-a),kernel='thin_plate_spline',smoothing=.003)
 y,x=np.mgrid[0:H:6,0:W:6];delta=warp(np.column_stack([x.ravel(),y.ravel()])/1000).reshape(*x.shape,2).astype('float32')
 delta=cv2.resize(delta,(W,H),interpolation=cv2.INTER_CUBIC)
 yy,xx=np.mgrid[:H,:W].astype('float32')
 delta[...,0]*=np.minimum(1,xx/51)*np.minimum(1,(W-1-xx)/51)
 delta[...,1]*=np.minimum(1,yy/51)*np.minimum(1,(H-1-yy)/51)
 registered=cv2.remap(gen,xx+delta[...,0],yy+delta[...,1],cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
 if mode=='night':
  # Measured residual at the upper-left pane rim: align generated edge to x139 at y434.
  rise=np.clip((yy-330)/100,0,1);rise=rise*rise*(3-2*rise)
  fall=np.clip((yy-434)/24,0,1);fall=fall*fall*(3-2*fall)
  local_shift=10*np.exp(-((xx-140)/60)**2/2)*rise*(1-fall)
  registered=cv2.remap(registered,xx+local_shift.astype('float32'),yy,cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
 Image.fromarray(registered).save(ROOT/f'registered-{mode}.png')
 seamless=match_boundary(registered,target,known)
 result=np.round(target*weight[...,None]+seamless*(1-weight[...,None])).clip(0,255).astype('uint8')
 plate=Image.fromarray(result);plate.save(ROOT/f'work-sky-{mode}.png')
 plate.save(ROOT/f'preview-sky-{mode}.jpg',quality=95)
 composite=plate.convert('RGBA')
 composite.alpha_composite(Image.open(ROOT/f'work-girl-{mode}.png'),(51,434))
 composite.alpha_composite(Image.open(ROOT/f'work-flowers-{mode}.png'),(51,1396))
 composite.convert('RGB').save(ROOT/f'preview-composite-{mode}.jpg',quality=96)
 Image.fromarray(np.round(remove*255).astype('uint8')).save(ROOT/'removal-mask.png')
 meta[mode]={'feature_landmarks':int(len(a)-len(anchors)),'max_warp_px':float(np.abs(delta).max()),'protected_pixel_count':int((weight==1).sum()),'protected_rgb_max_error':int(np.abs(result.astype(int)-target.astype(int))[weight==1].max())}
 print(mode,meta[mode],flush=True)
(ROOT/'composition.json').write_text(json.dumps(meta,indent=2))
