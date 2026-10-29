"""Verify local source-preserving cuts before lossy delivery encoding.

Usage: python verify.py ORIGINAL CUTOUT [--x 0 --y 0]
RGB on every nontransparent cutout pixel must equal the corresponding original
within one 8-bit level. Recomposition against its retained original complement
must also meet that limit. This is provenance validation, not a matte-quality test.
"""
import argparse
import json
import numpy as np
from PIL import Image

def verify_cut(source, cutout, x=0, y=0):
    original=np.asarray(Image.open(source).convert('RGB'))
    cut=np.asarray(Image.open(cutout).convert('RGBA'))
    h,w=cut.shape[:2]
    reference=original[y:y+h,x:x+w]
    assert reference.shape==cut[...,:3].shape, 'Cutout lies outside source'
    alpha=cut[...,3:4].astype(np.float64)/255
    visible=alpha[...,0]>0
    rgb_error=int(np.abs(cut[...,:3].astype(int)-reference.astype(int))[visible].max())
    recomposed=np.round(cut[...,:3]*alpha+reference*(1-alpha)).astype(np.uint8)
    composite_error=int(np.abs(recomposed.astype(int)-reference.astype(int)).max())
    assert rgb_error<=1 and composite_error<=1,(rgb_error,composite_error)
    return {'source':str(source),'cutout':str(cutout),'offset':[x,y],'visible_rgb_max_error_255':rgb_error,'recomposite_max_error_255':composite_error,'visible_pixels':int(visible.sum())}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('cutout');p.add_argument('--x',type=int,default=0);p.add_argument('--y',type=int,default=0)
    a=p.parse_args();print(json.dumps(verify_cut(a.source,a.cutout,a.x,a.y),indent=2))
