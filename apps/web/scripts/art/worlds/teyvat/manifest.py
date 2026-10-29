"""Write the integration handoff without touching application source."""
from pathlib import Path
import json,shutil
ROOT=Path('/tmp/art-teyvat');HERE=Path(__file__).resolve().parent
files=json.loads((ROOT/'files.json').read_text())
report=json.loads((ROOT/'verification.json').read_text())
constant={}
for region in ['inazuma','liyue','fontaine']:
    constant[region]={}
    for mode in ['night','day']:
        base=f'/lobby/gi/vista/{region}-{mode}'
        constant[region][mode]={k:f'{base}-{k}' for k in ['sky','far','near','depth']}
        constant[region][mode].update({k+'Half':f'{base}-{k}-1200' for k in ['sky','far','near','depth']})
constant['size']=[2400,1350]
constant['halfSize']=[1200,675]
constant['layers']={k:{'size':[2400,1350],'offset':[0,0],'maxTravelPx':travel} for k,travel in [('sky',2),('far',6),('near',12)]}
constant['characterRegion']={'kazuha':'inazuma','zhongli':'liyue','hu-tao':'liyue','furina':'fontaine'}
lines=['# Teyvat region vistas','',
'Generated with the built-in imagegen tool: three region paintings, matching day relights, one Fontaine rainbow refinement, and six clean sky/sea underpaintings. Exact prompts and generation paths are in `prompts.json`. All art is fan-made environment art; delivery paintings contain no characters, text, or UI. Characters and text appear only in staging mockups.','',
'## Delivery','',
'96 assets in `apps/web/public/lobby/gi/vista/`: 6 scenes × 4 textures × 2 resolutions × 2 codecs. KB means 1024 bytes. Full and half variants are alternatives, as are AVIF and WebP. Totals below include sky + far + near + depth.','',
'| Scene | Full AVIF KB | Half AVIF KB | Full WebP KB | Half WebP KB |','|---|---:|---:|---:|---:|']
for region in ['inazuma','liyue','fontaine']:
    for mode in ['night','day']:
        name=f'{region}-{mode}'
        vals=[]
        for ext,half in [('avif',False),('avif',True),('webp',False),('webp',True)]:
            vals.append(sum(f['bytes'] for f in files if f['file'].startswith(name) and f['file'].endswith('.'+ext) and ('-1200' in f['file'])==half)/1024)
        lines.append('| '+name+' | '+' | '.join(f'{v:.2f}' for v in vals)+' |')
lines += ['', '## Layers and placement','',
'All textures share exactly the same stage: **2400×1350**, with **1200×675** half versions. No cropping or trimmed-card offsets. Composite in the order sky → far → near.','',
'| Texture | Alpha | Offset x/y | Suggested maximum travel at 2400px stage |','|---|---|---|---|',
'| sky | opaque | 0 / 0 | ±2 px |','| far | transparent above distant terrain; includes water and its reflections | 0 / 0 | ±6 px |','| near | transparent; nearest bottom foliage/rocks | 0 / 0 | ±12 px |','| depth | opaque grayscale, white near | 0 / 0 | same UVs as the combined painting |','',
'Use a shared 1.04 overscan for all color layers, centered at 50% 50%, and scale travel with rendered width. Depth uses that same crop/UV transform. Disable travel with reduced motion. These are subtle decorative parallax plates, not geometry for large camera moves. The scene depth belongs to the combined painting; it is not a packed per-layer depth atlas.','',
'Far silhouettes come from Depth Anything V2; nearest detail is split at normalized inverse depth 0.50 and constrained to the bottom region. Edges use a 3.4px feather with 8px RGB bleed. Hidden regions contain separately generated sky and open water, avoiding duplicate landmark silhouettes or stretched fill. Day/night geography is closely matched by relighting; generated details are not guaranteed pixel-identical, so crossfade all color layers together.','',
'## Depth and encoding','',
'Local `/tmp/hero-art/venv` runs cached `depth-anything/Depth-Anything-V2-Base-hf` on MPS. Final depth is inferred from the **actual recombined clean-underpainting image**, interpolated to exactly 1350×2400 with bicubic `align_corners=False`, normalized using the 0.2/99.8 percentiles. It is relative inverse depth, not meters. Raw floating maps, lossless PNGs, input hashes and normalization values remain in staging; `final-inference.json` records provenance.','',
'Color AVIF uses adaptive quality, speed 6, 4:2:0; depth AVIF uses q82 and 4:4:4. Every fallback uses exactly `cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv`, including depth. Both codecs decode with grayscale depth and retained transparent alpha. Full matrices and per-file checksums are in `verification.json`.','',
'## Copy and preview treatment','',
'Generated source canvases were approximately 1672×941 and resampled with Lanczos to the exact delivery size. The three AVIF color plates together meet the approximate 60–150 KB painting target; the aligned depth map is an additional transfer. Night paintings have a soft 32% exposure falloff toward the copy side and a 10% left-side reduction. Day keeps colored light values and a 7% left-side reduction. Fine detail on the far right is softened. Region hues stay intact. Suggested night panel tint: #08403f at 24%; mock right copy block: rgba(4,35,37,.875). Day mocks use 10% teal tint and the same dark text container to prove the requested overlay. Existing app day copy is dark teal; if omitting the dark block, use that existing dark copy palette with a pale translucent day veil.','',
'Previews are mockups, not a running implementation. No application source, art registry, build output, or git commit was changed by this task.','',
'## Suggested TypeScript constant','', '```ts','export const TEYVAT_VISTA = '+json.dumps(constant,indent=2)+' as const;','```','',
'## AVIF Set entries','', 'Append these extensionless paths to the existing `AVIF` Set when integrating. `art()` supplies the extension; `halfSet()` widths are 2400 and 1200.','', '```ts']
for f in files:
    if f['file'].endswith('.avif'):lines.append('  '+json.dumps('/lobby/gi/vista/'+f['file'][:-5])+',')
lines += ['```','', '## Exact file inventory','', '| File | Pixels | KB | Encoding |','|---|---|---:|---|']
for f in files:lines.append(f"| `{f['file']}` | {f['px'][0]}×{f['px'][1]} | {f['KB']:.2f} | {f['encoding']} |")
lines += ['', '## Staging previews','',
'- `/tmp/art-teyvat/contact-preview.png` — all six decoded AVIF composites.','- `/tmp/art-teyvat/contact-mock.png` — all six teal/character/copy mocks.','- `/tmp/art-teyvat/{region}-{mode}-preview.png` — full 2400×1350 decoded composite.','- `/tmp/art-teyvat/{region}-{mode}-mock.png` — 1440×810 panel mock.','- `/tmp/art-teyvat/layers-{night,day}.png` — decoded layers on sage matte.','- `/tmp/art-teyvat/parallax-night.gif` — bounded three-region motion proof.','- `/tmp/art-teyvat/gallery.html` — self-contained local review gallery.','',
'## Reproduce','',
'Keep the `*-source.png` and `*-cleanplate-source.png` files in `/tmp/art-teyvat/` (generation paths are recorded in `prompts.json`). From repo root, use `/tmp/hero-art/venv/bin/python` for each of these scripts, in order:','',
'```sh','python apps/web/scripts/art/worlds/teyvat/prepare.py','python apps/web/scripts/art/worlds/teyvat/infer.py','python apps/web/scripts/art/worlds/teyvat/split.py','python apps/web/scripts/art/worlds/teyvat/infer.py --combined','python apps/web/scripts/art/worlds/teyvat/encode.py','python apps/web/scripts/art/worlds/teyvat/previews.py','python apps/web/scripts/art/worlds/teyvat/verify.py','python apps/web/scripts/art/worlds/teyvat/manifest.py','```','',
'`prepare.py` caches staged masters. If deliberately replacing a source, remove only that source’s derived master and segmentation-depth PNG before rerunning. Model depth caching is keyed by the input SHA-256.']
(HERE/'MANIFEST.md').write_text('\n'.join(lines)+'\n')
for filename in ['files.json','split.json','inference.json','final-inference.json']:
    shutil.copy2(ROOT/filename,HERE/filename)
print('manifest written',flush=True)
