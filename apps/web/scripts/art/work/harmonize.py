"""Harmonic boundary-color matching confined to generated scenery."""
import cv2
import numpy as np
from scipy import sparse
from scipy.sparse.linalg import splu

def match_boundary(generated, original, known):
    h,w=known.shape
    small=(w//4,h//4)
    mask=cv2.resize(known.astype('float32'),small,interpolation=cv2.INTER_AREA)>.75
    # Smooth residual observations so stars and individual grass blades are not copied into holes.
    weight=cv2.GaussianBlur(known.astype('float32'),(0,0),12)
    residual=(original.astype('float32')-generated.astype('float32'))*known[...,None]
    residual=cv2.GaussianBlur(residual,(0,0),12)/np.maximum(weight[...,None],1e-6)
    residual=cv2.resize(residual,small,interpolation=cv2.INTER_AREA)
    sh,sw=mask.shape
    unknown=~mask
    ids=np.full((sh,sw),-1,int);ids[unknown]=np.arange(unknown.sum())
    y,x=np.where(unknown);n=len(y)
    rr=[];cc=[];vv=[];rhs=np.zeros((n,3));diag=np.zeros(n)
    for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
        ny=y+dy;nx=x+dx;valid=(ny>=0)&(ny<sh)&(nx>=0)&(nx<sw)
        ii=np.where(valid)[0];ny=ny[valid];nx=nx[valid]
        diag[ii]+=1
        is_unknown=unknown[ny,nx]
        rr.extend(ii[is_unknown]);cc.extend(ids[ny[is_unknown],nx[is_unknown]]);vv.extend(np.full(is_unknown.sum(),-1))
        rhs[ii[~is_unknown]]+=residual[ny[~is_unknown],nx[~is_unknown]]
    rr.extend(range(n));cc.extend(range(n));vv.extend(diag)
    mat=sparse.csc_matrix((vv,(rr,cc)),shape=(n,n))
    residual[unknown]=splu(mat).solve(rhs)
    correction=cv2.resize(residual,(w,h),interpolation=cv2.INTER_CUBIC)
    correction=cv2.GaussianBlur(correction,(0,0),3)
    return np.clip(generated.astype('float32')+correction,0,255)
