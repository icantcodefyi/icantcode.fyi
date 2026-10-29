"""IMG-05..08: exact ground bands, DA-V2 split, alpha-safe texture exports."""
from pathlib import Path
import argparse
import json
import subprocess
import sys
import numpy as np
import cv2
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt

HERE = Path(__file__).resolve().parent
APP = HERE.parents[2]
OUT = APP / 'public/site/seams'
STAGE = Path('/tmp/art-seams')
OUT.mkdir(parents=True, exist_ok=True)
STAGE.mkdir(exist_ok=True)
COLORS = {'night': (255, 179, 209), 'day': (255, 198, 220)}
JOBS = [(kind, mode) for kind in ('rise', 'fall') for mode in ('night', 'day')]


def smooth(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def refine_fall(original, mode):
    """Keep the attachment painting; replace only the hanging undersides."""
    painted = Image.open(HERE / 'sources' / f'fall-{mode}-rounded.png').convert('RGBA')
    # Normalize the generated crop, retaining room for a completely clear footer.
    crop_height = 740 if mode == 'night' else 748
    painted = painted.crop((0, 0, painted.width, crop_height)).resize(original.size, Image.Resampling.LANCZOS)
    new = np.array(painted).astype(np.float32)
    old = np.array(original).astype(np.float32)
    h, w = new.shape[:2]
    yy = np.arange(h)[:, None]
    # Exclude the generated matte's contaminated low-alpha RGB and smooth away
    # tiny notches. The distance field follows the actual painted billows.
    mask = new[:, :, 3] > 210
    mask[:300] = True
    mask = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 12) > .5
    signed = distance_transform_edt(mask) - distance_transform_edt(~mask)
    # Let the painted vapor modulate the dissolve, rather than tracing a uniform
    # blurred outline. Both frequencies remain continuous, without hard holes.
    luma = new[:, :, :3].mean(axis=2)
    vapor = cv2.GaussianBlur(luma, (0, 0), 4) - cv2.GaussianBlur(luma, (0, 0), 24)
    signed += np.clip(vapor * .65, -12, 12)
    alpha = smooth(4, 104, signed) * (1-smooth(585, 625, yy))
    weight = smooth(290, 380, yy)[:, :, None]
    rgb = old[:, :, :3]*(1-weight) + new[:, :, :3]*weight
    a = old[:, :, 3]/255*(1-weight[:, :, 0]) + alpha*weight[:, :, 0]
    # Extend uncontaminated pigment under the feather; never blur the painting.
    valid = (new[:, :, 3] > 235) & mask
    valid[:300] = True
    _, ix = distance_transform_edt(~valid, return_indices=True)
    rgb[~valid] = rgb[ix[0][~valid], ix[1][~valid]]
    rgba = np.dstack([rgb, a*255]).round().clip(0,255).astype(np.uint8)
    rgba[:128] = np.array(original)[:128]
    return Image.fromarray(rgba)


def prepare(kind, mode):
    im = Image.open(STAGE / f'{kind}-{mode}-2x.png').convert('RGBA')
    if kind == 'rise':
        # 461 source pixels: 1536:461 is the requested panoramic ratio.
        im = im.crop((0, 1126, 3072, 2048)).resize((2400, 720), Image.Resampling.LANCZOS)
    else:
        # Preserve every hanging wisp, then fit the shallow ceiling to its slot.
        im = im.crop((0, 0, 3072, 1000)).resize((2400, 640), Image.Resampling.LANCZOS)
    arr = np.array(im).astype(np.float32)
    h, w = arr.shape[:2]
    yy = np.arange(h)[:, None] / h
    ground = smooth(.56, .80, yy) if kind == 'rise' else 1-smooth(.20, .43, yy)
    arr[:, :, :3] = arr[:, :, :3]*(1-ground[:, :, None])+np.array(COLORS[mode])*ground[:, :, None]
    arr[:, :, 3] = arr[:, :, 3]*(1-ground)+255*ground
    # Generated alpha has 1–3 LSB residual noise, never meaningful detail.
    arr[:, :, 3][arr[:, :, 3]<4] = 0
    arr[:, :, 3][arr[:, :, 3]>250] = 255
    band = np.broadcast_to(yy >= .80 if kind == 'rise' else yy < .20, (h, w))
    arr[band] = (*COLORS[mode], 255)
    im = Image.fromarray(np.rint(arr).astype(np.uint8))
    if kind == 'fall':
        im.save(STAGE / f'{kind}-{mode}-depth-reference.png')
        im = refine_fall(im, mode)
    im.save(STAGE / f'{kind}-{mode}-master.png')
    return im


def infer():
    # Shared copied hero pipeline sets the cache and MPS fallback configuration.
    sys.path.insert(0, str(HERE.parent))
    from build_depth import MODEL, AutoImageProcessor, AutoModelForDepthEstimation, torch
    processor = AutoImageProcessor.from_pretrained(MODEL, local_files_only=True)
    model = AutoModelForDepthEstimation.from_pretrained(MODEL, local_files_only=True).to('mps').eval()
    for kind, mode in JOBS:
        dest = STAGE / f'{kind}-{mode}-depth.npy'
        if dest.exists():
            continue
        reference = 'depth-reference' if kind == 'fall' else 'master'
        im = Image.open(STAGE / f'{kind}-{mode}-{reference}.png').convert('RGBA')
        neutral = Image.new('RGBA', im.size, (128, 128, 128, 255))
        rgb = Image.alpha_composite(neutral, im).convert('RGB')
        rgb.save(STAGE / f'{kind}-{mode}-depth-input.png')
        inputs = processor(images=rgb, return_tensors='pt', size={'height': 518, 'width': 518})
        inputs = {k: v.to('mps') for k, v in inputs.items()}
        with torch.inference_mode():
            pred = model(**inputs).predicted_depth
            depth = torch.nn.functional.interpolate(pred.unsqueeze(1), size=(im.height, im.width),
                mode='bicubic', align_corners=False)[0, 0].cpu().numpy()
        np.save(dest, depth)
        print(kind, mode, 'DA-V2 Base MPS', tuple(inputs['pixel_values'].shape), flush=True)
        torch.mps.empty_cache()


def split(kind, mode):
    rgba = np.array(Image.open(STAGE / f'{kind}-{mode}-master.png')).astype(np.float32)
    h, w = rgba.shape[:2]
    a = rgba[:, :, 3] / 255
    depth = np.load(STAGE / f'{kind}-{mode}-depth.npy')
    yy = np.arange(h)[:, None]/h
    band = np.broadcast_to(yy >= .80 if kind == 'rise' else yy < .20, (h, w))
    cloud = (a>.1) & ~band
    lo, hi = np.percentile(depth[cloud], [0, 100])
    depth = np.clip((depth-lo)/max(hi-lo, 1e-8), 0, 1)
    threshold = float(np.percentile(depth[cloud], 55))
    near = (depth >= threshold) & (a > 0)
    near[band] = True
    # Ten-pixel total feather, from -5 to +5 around each depth silhouette.
    signed = distance_transform_edt(near)-distance_transform_edt(~near)
    m = smooth(-40, 40, signed) if kind == 'fall' else smooth(-5, 5, signed)
    # The continuous ground must move with the front card; keep the model split
    # on billows, and hand the smooth foundation to front before the flat band.
    anchor = smooth(.46, .64, yy) if kind=='rise' else 1-smooth(.36, .58, yy)
    m = np.maximum(m, anchor)
    m[band] = 1
    fa = a*m
    # Overlap compensates for Porter-Duff alpha; a naïve complementary split
    # leaves a 25% transparency trough along every feathered split.
    ba = np.divide(a-fa, 1-fa, out=np.zeros_like(a), where=fa<.99999)
    # Continue painted cloud texture under near occlusions. A complementary cut
    # exposes holes under parallax; nearest-solid filling makes colored streaks.
    # Retain source pigment as a softer distant underpainting in covered regions.
    solid=a>.95
    _, source_indices=distance_transform_edt(~solid,return_indices=True)
    filled=rgba[:,:,:3].copy()
    filled[~solid]=filled[source_indices[0][~solid],source_indices[1][~solid]]
    painted=cv2.GaussianBlur(filled,(0,0),2.5)
    rgb_back=rgba[:,:,:3].copy()
    fill_weight=smooth(.97,1,m)[:,:,None]
    rgb_back=rgb_back*(1-fill_weight)+painted*fill_weight
    ba=np.maximum(ba,a*(~band))
    ba*=1-smooth(.76,.80,yy) if kind=='rise' else smooth(.20,.24,yy)
    ba[band] = 0
    layers = {}
    for layer, alpha, rgb in [('back', ba, rgb_back), ('front', fa, rgba[:, :, :3])]:
        visible = alpha > .002
        distance, edge = distance_transform_edt(~visible, return_indices=True)
        pigment = rgb.copy()
        pigment[~visible] = pigment[edge[0][~visible], edge[1][~visible]]
        pigment[distance > 6] = 0
        pixels = np.dstack([pigment, alpha*255]).round().clip(0, 255).astype(np.uint8)
        if kind == 'rise':
            pixels[:, :, 3] = (np.rint(pixels[:, :, 3].astype(float)/255*31)/31*255).round().astype(np.uint8)
        if layer == 'front':
            pixels[band] = (*COLORS[mode], 255)
        im = Image.fromarray(pixels)
        im.save(STAGE / f'cloud-{kind}-{mode}-{layer}.png')
        layers[layer] = im
    Image.fromarray((depth*255).astype(np.uint8)).save(STAGE / f'{kind}-{mode}-depth.png')
    Image.fromarray((m*255).astype(np.uint8)).save(STAGE / f'{kind}-{mode}-split.png')
    composite = Image.alpha_composite(layers['back'], layers['front'])
    composite.save(STAGE / f'{kind}-{mode}-composite.png')
    return {'threshold_percentile': 55, 'normalized_threshold': threshold,
            'size': [w, h], 'band_px': [int(.8*h), h] if kind=='rise' else [0, int(.2*h)]}


def avif_encode(src, dst, crf):
    # Identity RGB avoids YCbCr's unavoidable 1-LSB error in #FFB3D1.
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(src),
        '-filter_complex', '[0:v]split[c][a];[c]format=gbrp[color];[a]alphaextract[alpha]',
        '-map', '[color]', '-map', '[alpha]', '-c:v', 'libaom-av1', '-still-picture', '1',
        '-cpu-used', '4', '-crf', str(crf), '-crf:v:1', '24', '-threads', '4',
        '-colorspace:v:0', 'rgb', '-color_primaries:v:0', 'bt709',
        '-color_trc:v:0', 'iec61966-2-1', str(dst)], check=True)


def encode(half_only=False, back_only=False, refinement=False):
    records=[]
    if half_only or back_only or refinement:
        records=[r for r in json.loads((STAGE/'files.json').read_text())
                 if (half_only and '-1200' not in r['file']) or (back_only and '-front' in r['file'])
                 or (refinement and 'rise' in r['file'] and r['file'].endswith('.avif'))]
    for kind, mode in JOBS:
        for layer in ('back', 'front'):
            if back_only and layer!='back': continue
            base = f'cloud-{kind}-{mode}-{layer}'
            full = Image.open(STAGE / f'{base}.png').convert('RGBA')
            for half in (False, True):
                if half_only and not half: continue
                name = base + ('-1200' if half else '')
                im = full.resize((1200, full.height//2), Image.Resampling.LANCZOS) if half else full.copy()
                # Reassert the exact band AFTER resampling.
                if layer == 'front':
                    # Extend flat pigment to a 64px codec-block boundary; the
                    # declared fifth stays isolated from lossy boundary ringing.
                    box = (0, int(im.height*.8)//64*64, im.width, im.height) if kind=='rise' else (0, 0, im.width, ((int(im.height*.2)+63)//64)*64)
                    im.paste((*COLORS[mode], 255), box)
                tmp = STAGE / f'{name}-encode.png'
                im.save(tmp)
                avif = OUT / f'{name}.avif'
                avif_src = tmp
                if kind == 'fall' and layer == 'front' and half:
                    # Filter subpixel pigment detail before the small AVIF encode.
                    # Alpha and the exact 64-row band are independently retained.
                    filtered = np.array(im)
                    filtered[:, :, :3] = cv2.GaussianBlur(filtered[:, :, :3], (0, 0), 1.0)
                    filtered[:64] = (*COLORS[mode], 255)
                    avif_src = STAGE / f'{name}-avif-encode.png'
                    Image.fromarray(filtered).save(avif_src)
                if refinement and kind == 'rise':
                    setting = None
                elif layer == 'front':
                    # Keep the first exact-band candidate within the 40 KiB goal.
                    candidates=[]
                    preferred = [36 if mode == 'night' else 31] if kind == 'fall' and half else []
                    for crf in [*preferred, 52, 53, 54, 51, 55, 50, 56, 57, 58, 59, 60, *range(49, 25, -1)]:
                        trial=STAGE / f'{name}-crf{crf}.avif'
                        avif_encode(avif_src, trial, crf)
                        a=np.array(Image.open(trial).convert('RGBA'))
                        band=a[int(im.height*.8):] if kind=='rise' else a[:int(im.height*.2)]
                        exact=np.all(band[:,:,:3]==COLORS[mode]) and np.all(band[:,:,3]==255)
                        if exact:
                            candidates.append((trial.stat().st_size,trial,crf))
                            budget = min(20480, (OUT/f'{base}.avif').stat().st_size-1) if half else 40960
                            if trial.stat().st_size<=budget: break
                    if not candidates:
                        raise RuntimeError(f'No exact blush band encoding: {name}')
                    _,chosen,setting=min(candidates,key=lambda item:item[0])
                    avif.write_bytes(chosen.read_bytes())
                else:
                    for setting in [40,36,32,28,24]:
                        im.save(avif,quality=setting,speed=4,max_threads=4)
                        if avif.stat().st_size <= (20480 if half else 40960): break
                webp = OUT / f'{name}.webp'
                extra = ['-sns', '0'] if (kind, mode, layer, half) == ('fall', 'day', 'front', True) else []
                subprocess.run(['cwebp', '-quiet', '-q', '82', '-alpha_q', '90', '-m', '6', '-sharp_yuv', *extra,
                                str(tmp), '-o', str(webp)], check=True)
                paths = (webp,) if refinement and kind == 'rise' else (avif, webp)
                for path in paths:
                    decoded = Image.open(path).convert('RGBA')
                    arr = np.array(decoded)
                    record = {'file': path.name, 'px': list(im.size), 'bytes': path.stat().st_size,
                              'KB': round(path.stat().st_size/1024, 2), 'alpha_zero_pixels': int((arr[:,:,3]==0).sum())}
                    if path.suffix=='.avif':
                        record['encoding_quality_or_crf']=setting
                        if avif_src != tmp: record['rgb_prefilter_sigma']=1.0
                    else: record['encoder']='cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv' + (' -sns 0' if extra else '')
                    if layer == 'front':
                        band = arr[int(im.height*.8):] if kind=='rise' else arr[:int(im.height*.2)]
                        record['band_max_rgb_error'] = int(np.abs(band[:,:,:3].astype(int)-COLORS[mode]).max())
                        record['band_alpha_min'] = int(band[:,:,3].min())
                    records.append(record)
                    print(record, flush=True)
    (STAGE / 'files.json').write_text(json.dumps(records, indent=2))


def previews():
    for kind, mode in JOBS:
        layers = [Image.open(OUT / f'cloud-{kind}-{mode}-{layer}.avif').convert('RGBA') for layer in ('back','front')]
        combined = Image.alpha_composite(*layers)
        for label, color in [('black', '#000000'), ('blush', COLORS[mode])]:
            bg = Image.new('RGBA', combined.size, color)
            bg.alpha_composite(combined)
            bg.convert('RGB').save(STAGE / f'{kind}-{mode}-on-{label}.png')
        board = Image.new('RGB', (1200, 3*(combined.height//2+30)), '#0b0a0d')
        draw = ImageDraw.Draw(board)
        for i, (label, im) in enumerate([('BACK / d=30',layers[0]),('FRONT / d=8',layers[1]),('COMPOSITE',combined)]):
            y=i*(combined.height//2+30)
            draw.text((12,y+8),f'{kind} {mode} — {label}',fill='white')
            bg=Image.new('RGBA',combined.size,'#0b0a0d');bg.alpha_composite(im)
            board.paste(bg.convert('RGB').resize((1200,combined.height//2)),(0,y+30))
        board.save(STAGE / f'{kind}-{mode}-layers.png')
    for mode in COLORS:
        rise = Image.open(STAGE / f'rise-{mode}-on-black.png')
        fall = Image.open(STAGE / f'fall-{mode}-on-black.png')
        canvas = Image.new('RGB', (2400, 720+480+640), COLORS[mode])
        canvas.paste(rise,(0,0)); canvas.paste(fall,(0,1200))
        canvas.save(STAGE / f'journey-{mode}.png')


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('step', choices=['prepare','infer','split','encode','encode-half','encode-back','encode-refinement','previews','all'], default='all', nargs='?')
    step=parser.parse_args().step
    if step in ('prepare','all'):
        for kind,mode in JOBS: prepare(kind,mode)
    if step in ('infer','all'): infer()
    if step in ('split','all'):
        records={f'{kind}-{mode}':split(kind,mode) for kind,mode in JOBS}
        (STAGE/'split-metadata.json').write_text(json.dumps(records,indent=2))
    if step in ('encode','all'): encode()
    if step=='encode-half': encode(half_only=True)
    if step=='encode-back': encode(back_only=True)
    if step=='encode-refinement': encode(refinement=True)
    if step in ('previews','all'): previews()
