from pathlib import Path
import hashlib,json
from PIL import Image
import numpy as np
ROOT=Path('/tmp/hero-art')
metadata=json.loads((ROOT/'depth-metadata.json').read_text())
checks={}
for name,m in metadata.items():
    source=Path(m['source']);s=Image.open(source).convert('RGBA');d=Image.open(ROOT/f'depth-{name}.png');a=np.array(d)
    assert s.size==d.size
    assert np.array_equal(np.array(s)[:,:,3],a[:,:,3])
    assert hashlib.sha256(source.read_bytes()).hexdigest()==m['sha256']
    visible=a[:,:,3]>0
    assert int(a[:,:,0][visible].min())==0 and int(a[:,:,0][visible].max())==255
    checks[name]={'source_unchanged':True,'exact_pixel_dimensions':True,'alpha_identical':True,'near_white_far_black_range':[0,255]}
for name,size in [('clouds-day',(2400,500)),('clouds-night',(2400,500)),('birds-day',(768,128))]:
    im=Image.open(ROOT/f'{name}.png');a=np.array(im)[:,:,3]
    assert im.size==size and im.mode=='RGBA'
    assert not a[0].any() and not a[-1].any() and not a[:,0].any() and not a[:,-1].any()
    checks[name]={'exact_pixel_dimensions':True,'rgba_png':True,'transparent_outer_edges':True}
(ROOT/'verification.json').write_text(json.dumps(checks,indent=2))
intro='''# Hero art assets

All requested deliverables are in `/tmp/hero-art/`. No repository file was edited. Six input files were inspected before work; their SHA-256 hashes are unchanged after the build.

## Ready-to-use assets

White is near and black is far in all six depth maps. They are 8-bit RGBA PNGs with identical R, G and B channels. Their source alpha channels are copied byte for byte, including partially transparent edge pixels.

| File | Pixels | What it is / how made |
| --- | --- | --- |
'''
for name in ['night-sky','night-hill','night-char','day-sky','day-hill','day-char']:
    w,h=metadata[name]['size'];kind=name.split('-')[1]
    method='Depth Anything V2 Base inference; source-derived cloud relief and measured moon disk; bilateral smoothing.' if name=='night-sky' else ('Depth Anything V2 Base inference; source-derived cloud relief and gentle sky gradient; bilateral smoothing.' if name=='day-sky' else 'Depth Anything V2 Base on neutral-gray RGB composite; bilateral smoothing; exact source alpha.')
    intro+=f'| [depth-{name}.png](depth-{name}.png) | {w} × {h} | {name.replace("-"," ")} relative depth. {method} |\n'
intro+='''| [clouds-day.png](clouds-day.png) | 2400 × 500 | Four separate ivory/blush/lavender painted clouds. Built-in image generation using the day plate as style reference, then cropped and packed without distorting cloud proportions. |
| [clouds-night.png](clouds-night.png) | 2400 × 500 | Four thin pink-violet moonlit cloud groups with translucent wisps. Built-in image generation using the night plate, then cropped and packed. |
| [birds-day.png](birds-day.png) | 768 × 128 | Six 128 × 128 frames in one row, muted mauve silhouette. Built-in image generation, then fixed-scale packing with the body centered at (64,64) in every frame. |

## Preview files

Depth previews show the source on the left and depth on the right at native resolution, with a 36px title strip. Transparent source pixels are composited over neutral gray; depth is composited over black. The clouds are previewed at full opacity over their matching sky. No preview is a replacement for its transparent PNG.

| File | Pixels | What it is / how made |
| --- | --- | --- |
'''
for name,m in metadata.items():
    w,h=m['size'];intro+=f'| [preview-{name}.jpg](preview-{name}.jpg) | {2*w} × {h+36} | Source and final depth, side by side, composed with Pillow. |\n'
intro+='''| [preview-clouds-day.jpg](preview-clouds-day.jpg) | 1672 × 941 | Final day strip alpha-composited over the day plate. |
| [preview-clouds-night.jpg](preview-clouds-night.jpg) | 1672 × 941 | Final night strip alpha-composited over the night plate. |
| [preview-birds-day.jpg](preview-birds-day.jpg) | 1672 × 1133 | All six poses at 28px over the day sky, with a full-size frame row below. |
| [preview-depth-overview.jpg](preview-depth-overview.jpg) | 2000 × 1260 | Contact sheet of all six final depth previews. |
| [preview-birds-cycle.gif](preview-birds-cycle.gif) | 480 × 240 | Six-frame, 8fps animation proof at 64px and 28px over a crop of the original sky. |

## Method and alignment

The actual local model was [`depth-anything/Depth-Anything-V2-Base-hf`](https://huggingface.co/depth-anything/Depth-Anything-V2-Base-hf), running with PyTorch on Apple MPS. No generated depth-map fallback was needed. The model card identifies the checkpoint weights as CC-BY-NC-4.0; that is provenance for the checkpoint, not a legal determination about generated outputs.

1. Decode the complete source without cropping, translating, or warping it. Composite transparent input RGB onto neutral (128,128,128) for inference only.
2. Run aspect-preserving inference at a 756px short-side target. Model tensors are 1344 × 756 for landscape and 756 × 1134 for character inputs. Bicubic interpolation returns the prediction to the **exact original dimensions and framing**.
3. Preserve model terrain/character depth. The sky maps additionally receive smooth color-derived cloud relief at the original pixel coordinates, a gentle gradient, and a measured night moon disk centered at (1436.5,151.5), radius approximately 76px. The day plate has no distinct sun disk, so none was invented. Sky relief is intentionally low relative to the mountains and lake foreground.
4. Apply an 11px bilateral kernel with spatial sigma 4px and range sigma 0.045 in normalized depth. Normalize visible pixels again to 0–255. Every map reaches both endpoints; 255–256 distinct levels remain, with no deliberate depth bands.
5. Copy source alpha exactly. The hidden RGB under alpha=0 is extended 8px outward from the silhouette to reduce linear-sampling dark fringes; beyond that band it is black. Alpha is **still zero throughout that guard band**. Thus these maps use the requested “matching alpha” option, rather than making every hidden RGB pixel black.

### Practical caveats

- Exact dimensions, framing, and alpha were verified. **Internal object depth is a monocular estimate**, not ground-truth geometry; fine hair, ribbons, stems and flower boundaries can still have small estimation/upsampling errors. No claim of subpixel-accurate internal geometry is made. Use modest displacement and inspect in the actual shader; the repository shader was not changed or run.
- Each map is normalized independently. White in a sky map and white in a character map do not represent the same physical distance. Set each layer's overall depth/parallax amount separately; keep sky/cloud relief subtle.
- Treat the depth texture as linear data, without sRGB decoding or alpha premultiplication. Sample its red channel for depth, and preserve the color layer's own alpha for compositing. Pair source and depth with identical UV transforms, aspect fitting and orientation.
- The supplied hill cutouts have rough edge pixels, and the day character contains faint residual background RGB/alpha. These source properties were deliberately preserved rather than silently repaired. Very low-alpha RGB can look dramatic in viewers that ignore alpha; the neutral-background previews show the actual composite.
- Sprite backgrounds are real transparency. Cloud strips have four separate groups, transparent gaps, and empty left/right edges so their wrap seam is invisible. Their partly transparent painted fringes are retained. No checkerboard is baked in.
- Bird frames run left to right: raised, shallow raised, extended, lowered, shallow lowered, extended return. Suggested starting point: 8fps, looping. At 20–30px frame display size the visible wingspan is smaller because of the safe frame padding.

## Reproduction and supporting files

The sprite originals came from the built-in image-generation tool with `transparent_background=true`, using the relevant inspected sky plate as reference. The exact three prompts are in `generation-prompts.json`. Outputs were copied from the tool-managed generation location into this directory. `finish_sprites.py` preserves their generated color and alpha, clears only alpha values below 4/255, trims transparent padding, and resizes in premultiplied-alpha space before converting back to straight RGBA. No cloud shape or bird pose was drawn procedurally.

The following files preserve provenance and make the local depth/final packing steps repeatable. Non-image files have no pixel dimensions.

| File | Pixels | What it is / how made |
| --- | --- | --- |
'''
desc={
'build_depth.py':'Local model inference script; writes neutral RGB inputs, float depth arrays, source hashes and timing metadata.',
'finish_depth.py':'Normalization, sky tuning, bilateral smoothing, alpha copy, edge padding and depth preview generation.',
'finish_sprites.py':'Transparent sprite packing, fixed bird anchors, dimensions checks and sky-composite JPG previews.',
'write_readme.py':'Produces this inventory and re-verifies source hashes, dimensions, alpha and sprite edges.',
'requirements.txt':'Exact installed Python package versions, captured with uv pip freeze.',
'generation-prompts.json':'Exact prompts for the three built-in image-generation calls.',
'depth-metadata.json':'Source paths, SHA-256 hashes, model ID, tensor dimensions, device and inference timings.',
'depth-validation.json':'Per-map dimension, grayscale, alpha equality and normalized range checks.',
'sprite-metadata.json':'Original sprite crop boxes, packed positions, frame anchors, and alpha checks.',
'verification.json':'Final source-unchanged, dimension, alpha and range assertions.',
'depth-run.log':'Model loading and inference log.',
'depth-finish.log':'Depth post-processing assertions and runtime log.',
'README.md':'This delivery inventory, methods and caveats.'}
for name,text in desc.items():intro+=f'| [{name}]({name}) | N/A | {text} |\n'
for p in sorted((ROOT/'generated').glob('*.png')):
    w,h=Image.open(p).size;intro+=f'| [{p.relative_to(ROOT)}]({p.relative_to(ROOT)}) | {w} × {h} | Unpacked transparent original from built-in image generation. |\n'
for name,m in metadata.items():
    w,h=m['size']
    for prefix,ext,desc2 in [('input','png','Original-framing RGB image composited onto neutral gray for model inference.'),('raw','npy','Float32 model prediction bicubically returned to source dimensions, before final processing.')]:
        path=f'intermediates/{prefix}-{name}.{ext}';intro+=f'| [{path}]({path}) | {w} × {h} | {desc2} |\n'
intro+='''
`venv/` contains the requested isolated Python environment. `hf-cache/` holds the downloaded model weights and processor configuration; `uv-cache/`, `cache/`, and `__pycache__/` are build/runtime caches. Their installed package/cache contents are tooling, not art assets, and have no pixel dimensions.

To rebuild model depth and final PNG/JPG assets, run these from any directory:

```sh
/tmp/hero-art/venv/bin/python /tmp/hero-art/build_depth.py
/tmp/hero-art/venv/bin/python /tmp/hero-art/finish_depth.py
/tmp/hero-art/venv/bin/python /tmp/hero-art/finish_sprites.py
/tmp/hero-art/venv/bin/python /tmp/hero-art/write_readme.py
```

The overview JPG and optional animated GIF are supplementary verification exports; the primary PNGs and nine requested JPG previews are reproduced by the scripts above. Original source paths must still exist. Image generation itself is stochastic; retained generated originals make sprite packing deterministic.
'''
(ROOT/'README.md').write_text(intro)
print('Verified six unchanged sources, six exact-size/alpha depth maps, and three RGBA sprites. README written.')
