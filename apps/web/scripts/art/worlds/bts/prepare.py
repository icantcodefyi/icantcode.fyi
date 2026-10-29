"""Register generated stage layers, encode delivery assets, and make crop proofs.

Run with /tmp/hero-art/venv/bin/python; no app build or source changes.
Original generated RGBA masters and rejected iterations live in /tmp/art-bts.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps
from scipy.ndimage import distance_transform_edt

HERE = Path(__file__).resolve().parent
WEB = HERE.parents[3]
STAGING = Path('/tmp/art-bts')
OUT = WEB / 'public/bts/stage'
SIZE = (2000, 1400)
LAYERS = ('back', 'beams', 'mid', 'front')


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def load(name):
    return Image.open(STAGING / name).convert('RGBA').resize(SIZE, Image.Resampling.LANCZOS)


def save_alpha(image, alpha):
    image = image.copy()
    image.putalpha(Image.fromarray(np.round(np.clip(alpha, 0, 255)).astype('uint8')))
    return image


def prepare():
    STAGING.mkdir(exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    yy, xx = np.mgrid[:SIZE[1], :SIZE[0]].astype('float32')
    # Feather OUTSIDE the reserved centre. This enforces transparent pixels in
    # x=[500,1500), y=[210,1400), even if generated bloom overshoots its brief.
    side = (1 - smooth(430, 494, xx)) + smooth(1506, 1570, xx)
    clearance = 1 - smooth(178, 204, yy) * (1 - side)
    # Rig and rays came from ONE registered painting, so their origins align.
    split = smooth(154, 174, yy)
    records = {}
    for mode in ('night', 'day'):
        back = load(f'{mode}-back-generated.png').convert('RGB')
        fx = load(f'{mode}-rig-fx-generated.png')
        alpha = np.asarray(fx)[:, :, 3].astype('float32') * clearance
        # Baked exposure is restrained at night and subtler in sunlight.
        exposure = .57 if mode == 'night' else .23
        beams_alpha = alpha * split * exposure
        beams = save_alpha(fx, beams_alpha)
        # Solve alpha-over across the narrow split without a visible dark seam.
        target = alpha * ((1 - split) + split * exposure)
        mid_alpha = np.divide(target - beams_alpha, 1 - beams_alpha / 255,
                              out=np.zeros_like(alpha), where=beams_alpha < 255)
        mid = save_alpha(fx, mid_alpha)
        front = Image.new('RGBA', SIZE)
        front_source = load(f'{mode}-front-generated.png')
        # A physical foreground lip, only in the bottom tenth, preserving alpha.
        shift = 140 if mode == 'night' else 160
        front.alpha_composite(front_source, (0, shift))
        front_alpha = np.asarray(front)[:, :, 3].astype('float32')
        front = save_alpha(front, front_alpha * smooth(1160, 1250, yy))
        plates = dict(back=back, beams=beams, mid=mid, front=front)
        for name, im in plates.items():
            im.save(STAGING / f'{mode}-{name}.png')
        composite = compose(plates)
        composite.save(STAGING / f'{mode}-composite-master.png')
        composite.save(STAGING / f'{mode}-composite.png')
        source_names = [f'{mode}-{part}-generated.png' for part in ('back', 'rig-fx', 'front')]
        records[mode] = {
            'sources': {n: {'sha256': hashlib.sha256((STAGING/n).read_bytes()).hexdigest(),
                            'native_size': list(Image.open(STAGING/n).size)} for n in source_names},
            'output_size': list(SIZE), 'beam_exposure_baked': exposure,
            'rig_beam_split_y': [154, 174], 'front_translation_y': shift,
            'reserved_photo_rect': [500, 210, 1500, 1400],
            'centre_beam_alpha_max': int(np.asarray(beams)[210:, 500:1500, 3].max()),
        }
        assert records[mode]['centre_beam_alpha_max'] == 0
    (HERE/'provenance.json').write_text(json.dumps(records, indent=2)+'\n')


def compose(plates):
    im = plates['back'].convert('RGBA')
    for layer in ('beams', 'mid', 'front'):
        im = Image.alpha_composite(im, plates[layer].convert('RGBA'))
    return im.convert('RGB')


def encode():
    records = []
    for mode in ('night', 'day'):
        for layer in (*LAYERS, 'depth'):
            master = Image.open(STAGING / f'{mode}-{layer}.png')
            for width in (2000, 1000):
                suffix = '' if width == 2000 else '-1000'
                stem = f'{mode}-{layer}{suffix}'
                im = master.resize((width, width*7//10), Image.Resampling.LANCZOS)
                # Re-apply the exact reserved alpha box after resampling.
                if layer in ('beams', 'mid'):
                    a = np.asarray(im).copy()
                    a[round(im.height*.15):, width//4:width*3//4, 3] = 0
                    im = Image.fromarray(a)
                if im.mode == 'RGBA':
                    # Avoid encoding invisible unused painting. An 8px colour
                    # bleed preserves clean filtered edges on light/dark surfaces.
                    a = np.asarray(im).copy()
                    hidden = a[:, :, 3] == 0
                    distance, indices = distance_transform_edt(hidden, return_indices=True)
                    guard = hidden & (distance <= 8)
                    a[guard, :3] = a[tuple(indices[:, guard])][:, :3]
                    a[hidden & ~guard, :3] = 0
                    im = Image.fromarray(a)
                png = STAGING / f'{stem}-encode.png'
                im.save(png)
                webp = OUT / f'{stem}.webp'
                subprocess.run(['cwebp', '-quiet', '-q', '82', '-alpha_q', '90',
                                '-m', '6', '-sharp_yuv', str(png), '-o', str(webp)], check=True)
                avif = OUT / f'{stem}.avif'
                # Smooth depth fields use high quality; scene plates use AV1 Q58.
                im.save(avif, quality=80 if layer == 'depth' else 58, speed=6,
                        subsampling='4:4:4' if layer in ('depth','mid') else '4:2:0',
                        codec='aom', max_threads=2,
                        advanced={'a:lossless':'1'} if im.mode == 'RGBA' else {})
                for path in (avif, webp):
                    decoded = Image.open(path)
                    assert decoded.size == im.size
                    if layer in ('beams', 'mid', 'front'):
                        assert decoded.mode == 'RGBA', (path, decoded.mode)
                        if path.suffix == '.avif':
                            assert np.array_equal(np.asarray(decoded)[:, :, 3], np.asarray(im)[:, :, 3])
                    records.append({'file': path.name, 'px': list(im.size),
                                    'bytes': path.stat().st_size,
                                    'kb': round(path.stat().st_size/1000, 2),
                                    'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
                print(stem, f'AVIF {avif.stat().st_size/1000:.1f} KB',
                      f'WebP {webp.stat().st_size/1000:.1f} KB', flush=True)
    (HERE/'files.json').write_text(json.dumps(records, indent=2)+'\n')


def font(size):
    return ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', size)


def mock_rect(im, wide=False):
    im = im.convert('RGBA')
    w, h = im.size
    overlay = Image.new('RGBA', im.size)
    d = ImageDraw.Draw(overlay)
    # Physical output image: a neutral rectangle, never a person in the art.
    d.rectangle((round(w*.25),round(h*.15),round(w*.75)-1,h-1), fill=(35,29,49,245),
                outline=(206,190,226,255), width=2)
    title = 'MEMBER PHOTO'
    size = 20 if w >= 600 else 13
    d.text((w*.5,h*.47), title, font=font(size), anchor='mm', fill=(239,229,251,255))
    d.text((w*.5,h*.47+29), 'above every art layer', font=font(max(10,size-5)),
           anchor='mm', fill=(180,162,202,255))
    return Image.alpha_composite(im,overlay).convert('RGB')


def previews(encoded=False):
    for mode in ('night','day'):
        plates = {k: Image.open(OUT/f'{mode}-{k}.avif' if encoded else STAGING/f'{mode}-{k}.png') for k in LAYERS}
        im = compose(plates)
        im.save(STAGING/f'{mode}-composite.png')
        mock_rect(im).save(STAGING/f'{mode}-mock-full.png')
        for name, size in [('desktop',(700,600)),('current-desktop',(696,720)),('phone',(358,540))]:
            cropped = ImageOps.fit(im,size,Image.Resampling.LANCZOS,centering=(.5,.5))
            cropped.save(STAGING/f'{mode}-{name}-crop.png')
            mock_rect(cropped).save(STAGING/f'{mode}-{name}-mock.png')
        # Alpha checks use both light and dark backgrounds to reveal matte halos.
        sheet = Image.new('RGB',(1200,900),(27,22,35))
        d = ImageDraw.Draw(sheet)
        for i,k in enumerate(LAYERS):
            layer = plates[k].convert('RGBA').resize((580,406),Image.Resampling.LANCZOS)
            x=10+(i%2)*600; y=28+(i//2)*450
            yy,xx=np.indices((406,580));a=(xx//20+yy//20)%2
            base=np.where(a[:,:,None],np.array([70,64,78]),np.array([95,88,103])).astype('uint8')
            check=Image.fromarray(base).convert('RGBA')
            sheet.paste(Image.alpha_composite(check,layer).convert('RGB'),(x,y))
            d.text((x,y-23),f'{mode} / {k}',font=font(15),fill=(235,223,247))
        sheet.save(STAGING/f'{mode}-layers.png')
    sheet=Image.new('RGB',(1430,1336),(14,10,23));d=ImageDraw.Draw(sheet)
    for i,mode in enumerate(('night','day')):
        x=10+i*710
        d.text((x,16),mode.upper()+' / EMPTY STAGE',font=font(19),fill=(224,207,246))
        full=Image.open(STAGING/f'{mode}-composite.png').resize((700,490),Image.Resampling.LANCZOS)
        sheet.paste(full,(x,48))
        d.text((x,562),'700 × 600 / PHOTO CLEARANCE',font=font(17),fill=(224,207,246))
        sheet.paste(Image.open(STAGING/f'{mode}-desktop-mock.png'),(x,594))
        d.text((x,1222),'Centre 50% kept clear. All art remains behind the photograph.',font=font(16),fill=(175,155,201))
    sheet.save(STAGING/'preview-overview.png')


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('action',choices=['prepare','encode','preview','preview-encoded'])
    args=parser.parse_args()
    {'prepare':prepare,'encode':encode,'preview':previews,
     'preview-encoded':lambda:previews(True)}[args.action]()
