"""Write the reviewable art handoff; never touches src/lib/art.ts."""
from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path('/tmp/art-work');JOB=Path(__file__).resolve().parent
WEB=JOB.parents[2];PUB=WEB/'public/site/scenes'
files=json.loads((ROOT/'encoded-files.json').read_text())
verification=json.loads((ROOT/'verification.json').read_text())
tiles={'sky':[0,0,612,918],'girl':[612,0,561,701],'flowers':[612,701,561,220]}
constants='export const WORK_ART = {\n'
for mode in ['night','day']:
 constants+=f'  {mode}: {{\n'
 for kind in ['sky','girl','flowers','depth']:
  constants+=f'    {kind}: "/site/scenes/work-{kind}-{mode}",\n'
 for kind in ['sky','girl','flowers']:
  constants+=f'    {kind}Half: "/site/scenes/work-{kind}-{mode}-half",\n'
 constants+='  },\n'
constants+='''  size: [1224, 1836],
  original: { size: [1122, 1402], offset: [51, 434] },
  atlas: {
    size: [1173, 921],
    tiles: {
      sky: [0, 0, 612, 918],
      girl: [612, 0, 561, 701],
      flowers: [612, 701, 561, 220],
    },
  },
  layers: {
    sky: { size: [1224, 1836], offset: [0, 0] },
    girl: { size: [1122, 1402], offset: [51, 434] },
    flowers: { size: [1122, 440], offset: [51, 1396] },
  },
} as const;'''
bases=sorted({f'/site/scenes/{Path(f["file"]).stem}' for f in files})
entries='\n'.join(f'  "{b}",' for b in bases)
metadata={'canvas':[1224,1836],'original':{'size':[1122,1402],'offset':[51,434]},'depth':{'size':[1173,921],'tiles':tiles,'white_is_near':True},'layers':{'sky':{'size':[1224,1836],'offset_in_stage':[0,0],'offset_in_original':[-51,-434]},'girl':{'size':[1122,1402],'offset_in_stage':[51,434],'offset_in_original':[0,0]},'flowers':{'size':[1122,440],'offset_in_stage':[51,1396],'offset_in_original':[0,962]}},'files':files,'totals_KB':verification['totals_KB'],'avif_entries':bases,'WORK_ART':constants}
(JOB/'manifest.json').write_text(json.dumps(metadata,indent=2))
# Merge only this job's key; preserve unrelated agents' entries.
shared=JOB.parent/'manifest.json';existing=json.loads(shared.read_text()) if shared.exists() else {}
existing['work']=metadata;shared.write_text(json.dumps(existing,indent=2))
rows='\n'.join(f'| `{f["file"]}` | {f["width"]}×{f["height"]} | {f["KB"]:.2f} | {f["encoding"]} |' for f in files)
text=f'''# Recent Work art handoff — IMG-01 through IMG-04

28 delivery files are in `apps/web/public/site/scenes/`. **Full AVIF per mode: night {verification['totals_KB']['night']:.2f} KB; day {verification['totals_KB']['day']:.2f} KB**, including depth (budget 445 KB). KB here means 1024 bytes. Half files are alternatives, not extra required transfers.

## Integration correction

**Use atlas 1173×921, not the plan's 1173×918.** The specified girl tile ends at y701, and the specified flower tile is 220px tall: 701 + 220 = 921. All three requested tile rectangles are preserved without cropping. Normalize UVs using the actual 921px height. Each mode's atlas is already half resolution; do not request another half-size atlas.

| Tile | Pixel rectangle `[x,y,w,h]` | Normalized rectangle (top-left origin) |
|---|---|---|
| sky | `[0,0,612,918]` | `[0,0,{612/1173:.9f},{918/921:.9f}]` |
| girl | `[612,0,561,701]` | `[{612/1173:.9f},0,{561/1173:.9f},{701/921:.9f}]` |
| flowers | `[612,701,561,220]` | `[{612/1173:.9f},{701/921:.9f},{561/1173:.9f},{220/921:.9f}]` |

## Layer placement

The original 1122×1402 canvas is translated by **(51,434)** in the 1224×1836 stage; it is never scaled or cropped for the master cutouts. Day and night use byte-identical alpha masks.

| Layer | Full px | Half px | Offset relative to original | Offset in extended stage | Stage box x/y/w (%) |
|---|---|---|---|---|---|
| sky | 1224×1836 | 612×918 | (-51,-434) | (0,0) | 0 / 0 / 100 |
| girl | 1122×1402 | 561×701 | (0,0) | (51,434) | 4.166667 / 23.638344 / 91.666667 |
| flowers | 1122×440 | 561×220 | (0,962) | (51,1396) | 4.166667 / 76.034858 / 91.666667 |

Retain the plan's depth ranges: sky far300/near26/flat80; girl far14/near12.2/flat13.1; flowers far9/near4.5/flat6.5. Sky is opaque; girl and flowers are cutouts. Use the original figure's location when placing DOM panes. The foreground threshold selects mainly the lower-left near flowers; the distant lake and farther flower field remain on the sky plate.

## Append to `src/lib/art.ts`

App source was not edited. Exact constant:

```ts
{constants}
```

Exact entries to append inside the existing `AVIF` Set:

```ts
{entries}
```

For `halfSet`, use `art(WORK_ART[mode].sky)` with width1224 and `art(WORK_ART[mode].skyHalf)` with width612; girl1122/561; flowers1122/561. The `layers` offsets are always full-stage pixels, even when a half texture is selected.

## Delivery files

| File | Pixels | KB | Encoding |
|---|---|---:|---|
{rows}

## Provenance and processing

- Built-in image generation produced the environment fills only. Exact prompts, rejected trials and the selected repair are in [PROMPTS.md](PROMPTS.md).
- Selected generation inputs and raw local matte masks are archived losslessly in `inputs/`; no model weights or venv are committed.
- Real-ESRGAN `x4plus_anime_6B` on MPS supplies a 2× intermediate, then Lanczos to1224×1836. The girl's RGB never passes through generation or upscaling.
- Local `isnet-anime` masks were checked on both originals. The day mask gave cleaner separation from the paper plane; its refined alpha is shared by both modes. Detached false positives are removed, and the original sole/foreground occlusion is retained.
- Flowers: mean of independently normalized original night/day DA-V2 estimates, threshold >0.68 in the exact bottom440px; exclude the character, Gaussian6px, with a24px smooth edge taper to avoid a rectangular moving-strip boundary. RGB always comes directly from the respective original crop.
- Sky repair mask: girl16px dilation, flower10px dilation. SIFT feature registration of generated scenery, harmonic boundary-color correction only in generated regions, and original RGB restoration with an8px inward feather. A measured local rim adjustment corrects the residual upper-left night pane join.
- 915,096 fully protected background pixels per mode are byte-identical to the original before delivery encoding, including the paper plane and existing trail.
- DA-V2 Base inference uses the existing `/tmp/hero-art/venv`, MPS, 756px short-side input. Cutouts are inferred on RGB128 neutral. Each plate is independently normalized; open sky relief is reduced. Nearest-solid extension under alpha, Gaussian sigma1.2 source pixels, then half resolution. Atlas WebP is lossless grayscale; AVIF is q85.
- Invisible color RGB is cleared outside a4px guard band for compact encoding. Visible source RGB is unaffected by that step.

## Verification and limits

`validate.py` passes: all28 delivery images decode at their declared dimensions; atlas tiles are in bounds; both cutouts share exact day/night alpha; depth master alpha is unchanged; WebP cutout alpha is exact; WebP atlas equals its grayscale master; all full AVIF assets meet their individual byte budgets.

**Original-pixel/recomposition error: 0/255** for all four lossless cut masters. These checks compare visible source RGB and reconstruct the source with its retained original complement; they are not a claim that the newly inpainted background equals the old painting. Full-resolution color delivery AVIF/WebP is intentionally lossy per the plan, so decoded delivery RGB is not mathematically pixel-identical. See `verification.json` for dimensions, file hashes and measurements.

No app source files were edited, no app build was run, and no git commit was made. The browser-level dive/double-face test belongs to integration after the new layer placement is wired up.

## Previews

- `/tmp/art-work/preview-work-pair.jpg` — actual decoded AVIF night/day composites.
- `/tmp/art-work/preview-encoded-night.jpg`, `/tmp/art-work/preview-encoded-day.jpg` — full-size encoded composites.
- `/tmp/art-work/preview-sky-night.jpg`, `/tmp/art-work/preview-sky-day.jpg` — isolated final backgrounds.
- `/tmp/art-work/preview-girl-night.jpg`, `/tmp/art-work/preview-girl-day.jpg` — cutouts on a neutral background.
- `/tmp/art-work/preview-flowers-night.jpg`, `/tmp/art-work/preview-flowers-day.jpg` — foreground alpha.
- `/tmp/art-work/preview-alpha-edges.jpg` — decoded character edges on light/dark grounds.
- `/tmp/art-work/preview-depth-night.jpg`, `/tmp/art-work/preview-depth-day.jpg` — packed depth atlases; rays outside silhouettes are the required nearest-solid fill, invisible in the color plates.

## Reproduction

Shared original tools are preserved at `scripts/art/`: `build_depth.py`, `finish_depth.py`, `finish_sprites.py`, `write_readme.py`, and `/tmp/hero-depth/build.py` copied as `build.py`. These preserve their original hero paths. Do not run them to rebuild Work. Requirements are in `../REQUIREMENTS.md` and `../requirements-hero.txt`.

From `apps/web`:

```sh
/tmp/hero-art/venv/bin/python scripts/art/work/rebuild.py
```

The replay uses archived generated inputs; no paid image call is made. For a clean full inference/upscale replay, use a fresh `/tmp/art-work` staging directory. All job scripts are inside `work/`. Model caches remain in `/tmp/hero-art`. `matte.py` is available to rerun the local model, but normal replay uses the archived selected raw masks.
'''
(JOB/'MANIFEST.md').write_text(text)
print('Manifest written:',JOB/'MANIFEST.md')
