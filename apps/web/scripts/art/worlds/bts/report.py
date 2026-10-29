"""Verify delivered image contracts and write the integration manifest."""
import hashlib
import json
import numpy as np
from PIL import Image
from prepare import HERE, OUT, STAGING, LAYERS, compose


def main():
    files=json.loads((HERE/'files.json').read_text())
    assert len(files)==40
    checks=[]
    for row in files:
        path=OUT/row['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest()==row['sha256']
        im=Image.open(path)
        assert list(im.size)==row['px']
        stem=path.stem
        mode,part=stem.split('-')[:2]
        a=np.asarray(im)
        record={'file':path.name,'px':list(im.size),'decoded_mode':im.mode}
        if part in ('mid','beams','front'):
            assert im.mode=='RGBA'
            record['alpha_range']=[int(a[:,:,3].min()),int(a[:,:,3].max())]
            if part in ('mid','beams'):
                centre=a[round(im.height*.15):,im.width//4:im.width*3//4,3]
                record['photo_zone_alpha_max']=int(centre.max())
                assert centre.max()==0,record
            if path.suffix=='.avif':
                original=np.asarray(Image.open(STAGING/f'{stem}-encode.png'))
                record['alpha_exact']=bool(np.array_equal(original[:,:,3],a[:,:,3]))
                assert record['alpha_exact']
        elif part=='depth':
            rgb=np.asarray(im.convert('RGB'))
            assert np.max(rgb.max(axis=2)-rgb.min(axis=2))<=1
        checks.append(record)
    quality={}
    for mode in ('night','day'):
        originals={k:Image.open(STAGING/f'{mode}-{k}.png') for k in LAYERS}
        reference=np.asarray(compose(originals)).astype('float32')
        quality[mode]={}
        for ext in ('avif','webp'):
            decoded={k:Image.open(OUT/f'{mode}-{k}.{ext}') for k in LAYERS}
            final=np.asarray(compose(decoded)).astype('float32')
            mse=float(np.mean((reference-final)**2))
            quality[mode][ext]={'mean_absolute_rgb_error':round(float(np.abs(reference-final).mean()),3),
                              'psnr_db':round(float(10*np.log10(255**2/mse)),2)}
    validation={'file_count':40,'all_dimensions_correct':True,
                'reserved_rect_full':[500,210,1500,1400],
                'all_encoded_lighting_centre_alpha_zero':True,
                'all_avif_alpha_byte_exact':True,'quality':quality,'files':checks}
    (HERE/'validation.json').write_text(json.dumps(validation,indent=2)+'\n')
    table=['| File | Pixels | KB |','|---|---:|---:|']
    for row in files:
        table.append(f"| `{row['file']}` | {row['px'][0]} × {row['px'][1]} | {row['kb']:.2f} |")
    totals=[]
    for mode in ('night','day'):
        for half in (False,True):
            group=[r for r in files if r['file'].startswith(mode+'-') and ('-1000.' in r['file'])==half]
            sums={ext:sum(r['bytes'] for r in group if r['file'].endswith('.'+ext))/1000 for ext in ('avif','webp')}
            totals.append(f"| {mode} | {'1000 × 700' if half else '2000 × 1400'} | {sums['avif']:.2f} | {sums['webp']:.2f} |")
    constants=['export const BTS_STAGE = {']
    avif=[]
    for mode in ('night','day'):
        constants.append(f'  {mode}: {{')
        for part in ('back','mid','beams','front','depth'):
            base=f'/bts/stage/{mode}-{part}'
            constants.extend([f'    {part}: "{base}",',f'    {part}Half: "{base}-1000",'])
            avif.extend([f'  "{base}",',f'  "{base}-1000",'])
        constants.append('  },')
    constants.append('} as const;')
    text='''# BTS painted stadium stage

Two lighting variants of one empty concert stage. Generated with the built-in image_gen tool; no CLI image model fallback. The selected prompts and rejected lighting iterations are recorded in `prompts.json`. Masters, rejected attempts and PNG proofs are in `/tmp/art-bts/`.

## Delivery

Public asset root: `apps/web/public/bts/stage/` (URL `/bts/stage/`). 40 files: two modes × five plates × two resolutions × two codecs. KB below means 1,000 bytes. Both codecs have identical dimensions and placement; AVIF is primary, WebP the fallback.

Every full-size plate is 2000 × 1400; every `-1000` plate is 1000 × 700. Built-in generation returned approximately 1500 × 1049 masters; these were registered to the requested 2000 × 1400 with Lanczos resampling. No claim of native 2000px generation is implied. Source sizes and hashes are in `provenance.json`.

## Composition and placement

All offsets below refer to the DELIVERED full canvas. Do not trim transparent padding. Each image uses the same bounds and `object-position: 50% 50%`. Use a common centred cover transform for both art and depth. There are no runtime per-layer offset corrections.

| Layer | Canvas offset x,y | Alpha | Suggested depth | Stack order | Notes |
|---|---|---|---:|---:|---|
| back | 0,0 | Opaque | 18 | 0 | Empty stadium, ocean LED wall, floor underpainting |
| beams | 0,0 | Transparent | 16 | 1 | Violet shafts, side haze and sparse petals; opacity already baked |
| mid | 0,0 | Transparent | 16 | 2 | Truss, four heads and lens blooms, registered to beams |
| front | 0,0 | Transparent | 14 | 3 | Glossy floor lip, bottom tenth; padded full canvas |
| member photo (existing) | centred, bottom | Existing cutout | 12.5 | 4 | Must remain above ALL stage artwork |
| depth | 0,0 | Opaque grayscale | — | — | Whole composited scene, white near, black far |

Mid and beams are split from one generated RGBA painting (split band y=154–174), keeping all four light sources registered. Keep their parallax identical. The foreground translation is baked into the exported plate (night +140px, day +160px); exported offsets remain zero. The centre x=500–1499, y=210–1399 (middle 50%, bottom 85%) has **exactly zero lighting alpha in both delivery formats**, at both sizes. A smooth outer guard preserves the transition. Member photos remain above the complete artwork, including all lights and the floor edge. Do not add an unmasked global lighting overlay above the photograph.

Use normal alpha-over compositing at opacity 1 for the supplied default look. Beam exposure is already baked to 0.57 night / 0.23 day. Optional screen/additive blending can be used for the beams while keeping them below the photograph; it will appear brighter than the verified normal-blend proofs. Do not multiply the baked exposure a second time. Keep rig and beam motion together; use only subtle whole-stage drift or shared overscan so the truss and floor never reveal an edge.

The 700 × 600 desktop crop keeps all four fixture heads. The existing 696 × 720 card and 358 × 540 phone card are also proofed. The narrow phone crop deliberately sacrifices the outer fixtures/tiers while retaining the truss, violet LED texture and floor lip; the photograph stays dominant. All proofs use a neutral member-photo rectangle, with no people added to the artwork.

## Depth

`depth-anything/Depth-Anything-V2-Base-hf`, from the existing `/tmp/hero-art/venv` and cached weights. Follows `scripts/art/build_depth.py`: 756px model short side, aspect preserved (756 × 1078 tensor), bicubic upsampling to the exact 2000 × 1400 canvas, no crop, inverse relative depth normalized to 0–255, edge-preserving bilateral smoothing. Full provenance in `depth-metadata.json`; raw predictions remain in staging.

Maps align to the complete composed scene, not the member photograph. Use the suggested rigid layer distances for separate sprite planes, or use the map once for the whole stage composition. Do not independently warp individual layers with the full composite map, or displace the member using this map. The rig has its own silhouette in depth; the near floor is bright, the distant sky and LED wall remain dark.

## Encoding and validation

WebP: exactly `cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv` (plus `-quiet`). AVIF: Pillow/libaom quality 58, speed 6, 4:2:0 (mid 4:4:4), depth quality 80 / 4:4:4. RGBA AVIF uses lossless alpha via `advanced={"a:lossless":"1"}`; decoded alpha is byte-identical to the prepared master. Invisible RGB is cleared beyond an 8px colour bleed to reduce size while keeping clean edges. Depth is not regenerated or cropped for half-size delivery.

All 40 files decode, have the expected dimensions and hashes, preserve the reserved lighting clearance, and pass the alpha checks in `validation.json`. Composite RGB fidelity measurements compare decoded full-size files against the prepared lossless plate composites; see the same report. The near-floor-versus-sky polarity check is in `depth-metadata.json`.

Encoder references: [Pillow AVIF options](https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html#avif), [libavif alpha-specific codec options](https://github.com/AOMediaCodec/libavif/blob/main/doc/avifenc.1.md#aom-specific-advanced-options).

## Transfer totals (four art layers plus depth)

| Mode | Resolution | AVIF KB | WebP KB |
|---|---|---:|---:|
'''+ '\n'.join(totals)+'''

## Exact file list

'''+ '\n'.join(table)+'''

## Suggested constants — documentation only

This art task did not edit any `.ts`, `.tsx`, `.css`, or `src/lib/art.ts` files. Copy this into the owning implementation only when integrating the art.

```ts
'''+ '\n'.join(constants)+'''
```

Add these extensionless entries to the existing `AVIF` set when integrating:

```ts
'''+ '\n'.join(avif)+'''
```

## Reproduction

From the repository root, with the generated PNG masters retained in `/tmp/art-bts/`:

```sh
/tmp/hero-art/venv/bin/python apps/web/scripts/art/worlds/bts/prepare.py prepare
/tmp/hero-art/venv/bin/python apps/web/scripts/art/worlds/bts/depth.py
/tmp/hero-art/venv/bin/python apps/web/scripts/art/worlds/bts/prepare.py encode
/tmp/hero-art/venv/bin/python apps/web/scripts/art/worlds/bts/prepare.py preview-encoded
/tmp/hero-art/venv/bin/python apps/web/scripts/art/worlds/bts/report.py
```

No application build, commit or source integration was performed. Only the stage asset directory and this script directory are deliverables.

## PNG previews

- `/tmp/art-bts/preview-overview.png`
- `/tmp/art-bts/{night,day}-composite.png`
- `/tmp/art-bts/{night,day}-mock-full.png` (exact original safe rectangle)
- `/tmp/art-bts/{night,day}-desktop-mock.png` (700 × 600)
- `/tmp/art-bts/{night,day}-current-desktop-mock.png` (696 × 720)
- `/tmp/art-bts/{night,day}-phone-mock.png` (358 × 540)
- `/tmp/art-bts/{night,day}-{desktop,current-desktop,phone}-crop.png` (unobstructed crops)
- `/tmp/art-bts/{night,day}-layers.png` (alpha checkerboard proof)
- `/tmp/art-bts/{night,day}-depth-preview.png` (colour / depth side by side)

The public AVIF/WebP files are the integration assets; staging PNGs are review/reproduction material.
'''
    (HERE/'MANIFEST.md').write_text(text)
    print(json.dumps({'validated_files':len(files),'quality':quality,'totals':totals},indent=2))


if __name__=='__main__':main()
