"""Write the handoff from measured encoder output, never guessed sizes."""
from pathlib import Path
import json

HERE = Path(__file__).resolve().parent
files = json.loads((HERE / 'files.json').read_text())
by_name = {item['file']: item for item in files}
lines = ['# Valorant stage environment', '',
    'Fan-made Ascent-inspired painted rooftop vista, generated with the built-in `image_gen` tool. '
    'One composition in two lighting treatments: red-black night with illuminated windows and a radiant floating city; '
    'coral/cream day with crisp architectural shadows. No characters, lettering, or logos in the shipped plates.', '',
    '## Deliverables', '',
    'Public root: `apps/web/public/lobby/val/stage/`. All sizes below are decimal KB (1 KB = 1000 bytes). '
    'Each row represents two actual files. 32 files total.', '',
    '| Base filename | Pixels | AVIF KB | WebP KB |',
    '| --- | --- | ---: | ---: |']
for mode in ('night', 'day'):
    for layer in ('sky', 'far', 'near', 'depth'):
        for suffix in ('', '-800'):
            base = f'{mode}-{layer}{suffix}'
            a, w = by_name[base+'.avif'], by_name[base+'.webp']
            lines.append(f'| `{base}.{{avif,webp}}` | {a["px"][0]} × {a["px"][1]} | {a["kb"]:.2f} | {w["kb"]:.2f} |')
lines += ['', '| Mode / resolution | AVIF total KB | WebP total KB |', '| --- | ---: | ---: |']
for mode in ('night', 'day'):
    for half in (False, True):
        totals = [sum(r['bytes'] for r in files if r['file'].startswith(mode)
                      and ('-800.' in r['file']) == half and r['file'].endswith(ext))/1000
                  for ext in ('avif', 'webp')]
        lines.append(f'| {mode} / {800 if half else 1600}px | {totals[0]:.2f} | {totals[1]:.2f} |')
lines += ['', f'All formats, modes, and resolutions on disk: **{sum(r["bytes"] for r in files)/1000:.2f} KB**. '
    'A client should fetch one format, one resolution, and one lighting mode.', '',
    '## Left-edge repair and comparison', '',
    'The original preparation translated the far layer 192px right and exposed a full-height transparent cut. '
    'Built-in image_gen repainted the missing left architecture in both lighting modes. The repaired sources are already registered, '
    'so preparation no longer translates them. Sky and near PNG masters are pixel-identical to the pre-repair plates; '
    'inspection found no other cut boundaries. Generated far-layer details have small repainting differences outside the extension, '
    'but the major landmarks, perspective, palette, and overall composition remain matched.', '',
    'Native-scale before/after crops show continuous roofs, walls, and vegetation across the old boundary. '
    'At x=192 below y=600, the original 1200 rows with an alpha jump above 200/255 became zero in each repaired PNG. '
    'Both full composites were rerun through Depth Anything V2; alpha and depth orientation checks pass. '
    'See [seam-validation.json](./seam-validation.json).', '',
    'Full AVIF sets including depth: night **230.89 → 188.11 KB (18.53% smaller)**; '
    'day **294.85 → 243.29 KB (17.49% smaller)**. Trials compared art quality 52/speed 6 with quality 50, 48, and 46 at speed 4. '
    'Selected quality 46/speed 4 retains the reviewed roof edges, window mullions, cloud gradients, and stone texture without a material visible regression '
    'at native-scale crops and desktop/mobile preview sizes. This is lossy encoding, not pixel equality. '
    'WebP grows with the added painted architecture and retains the exact requested encoder flags.', '',
    '## Registration, crop, and integration', '',
    '- Every exported layer and depth map shares an uncropped **1600 × 1800** canvas; half assets are **800 × 900**. '
    'All placement offsets are **[0, 0]**. Stack sky → far → near; agent, outline name, and HUD stay above the environment.',
    '- Sky is opaque. Far and near have genuine alpha, with no checkerboard or sky baked into transparent regions. '
    'The far layer contains the complete floating city, campanile, arcades, and plaza; the near layer contains only the rooftop ventilation housing, parapet, and floor.',
    '- The repaired far sources already contain the registered city and a painted extension to the left canvas edge. '
    '**Do not translate the far layer.** The former +192px translation and straight transparent left margin have been removed from preparation; '
    'the campanile and floating city retain their composition while the architecture now continues naturally to the left edge.',
    '- Use a common `cover` transform and **object-position: 42% 50%** for all plates and the depth map. '
    'Retain the stage clip `polygon(40% 0, 100% 0, 100% 100%, 14% 100%)`. '
    'Offline previews verify 840 × 900 desktop and 390 × 600 phone crops.',
    '- Preview tint is a normal source-over **#ff4655** wash applied after environment composition: **22% night**, **18% day**. '
    'The tint is not baked into any asset. Do not tint the agent or HUD.',
    '- Suggested starting plane distances, using the current `1/d` convention: sky **36**, far **26**, near **19**; '
    'keep the current name **16**, HUD **12.5**, and agent **11.5**. Keep environmental movement modest (about 3/5/8 CSS px), '
    'with a shared 3% overscan if moving the plates; use the same overscan on depth. These motion values are suggestions, not browser-tested settings.',
    '- Each depth image is an **opaque full-composite inverse-depth map**, not a per-layer atlas. '
    'White means near. Sample the same UV/crop as the composite. For independent layer translations, use plane distances; '
    'the single composite map describes the resting composition, not separately translated objects.', '',
    '## Suggested TypeScript constant (handoff only)', '', '```ts', 'export const VALORANT_STAGE = {']
for mode in ('night', 'day'):
    lines.append(f'  {mode}: {{')
    for layer in ('sky', 'far', 'near', 'depth'):
        lines.append(f'    {layer}: "/lobby/val/stage/{mode}-{layer}",')
    for layer in ('sky', 'far', 'near', 'depth'):
        lines.append(f'    {layer}Half: "/lobby/val/stage/{mode}-{layer}-800",')
    lines.append('  },')
lines += ['  size: [1600, 1800],', '  halfSize: [800, 900],',
          '  offset: [0, 0],', '  objectPosition: "42% 50%",',
          '  tint: { color: "#ff4655", night: 0.22, day: 0.18 },',
          '} as const;', '```', '',
          'Add these extensionless entries to the existing AVIF set when integrating (not applied by this task):', '', '```ts']
for mode in ('night', 'day'):
    for layer in ('sky', 'far', 'near', 'depth'):
        for suffix in ('', '-800'):
            lines.append(f'"/lobby/val/stage/{mode}-{layer}{suffix}",')
lines += ['```', '', '## Pipeline and validation', '',
    'Generation prompts: [prompts.json](./prompts.json), [day-prompts.json](./day-prompts.json), and [seam-repair-prompts.json](./seam-repair-prompts.json). '
    'Lossless sources and composites are staged in `/tmp/art-valorant/`; their hashes, dimensions, alpha bounds, and transforms are in '
    '[provenance.json](./provenance.json). Native tool output was **1182 × 1330**, resampled with Lanczos to the requested export sizes. '
    'Day and night are relit generated variants with small painted differences; they are registered to the same canvas, not pixel-identical masks.', '',
    'Near-layer extraction discarded disconnected low-alpha specks, retaining the connected rooftop silhouette and a 2px edge guard. '
    'No scene geometry was hand-drawn or substituted. Other generated transparency was preserved.', '',
    'Depth uses the existing `scripts/art/build_depth.py` pipeline in `/tmp/hero-art/venv`: '
    '`depth-anything/Depth-Anything-V2-Base-hf`, MPS, 756px processor target, aspect-preserving model input **854 × 756**, '
    'bicubic prediction resize to **1800 × 1600**, robust 0.2–99.8 percentile normalization, and a light bilateral filter. '
    'Inference is performed on each final untinted, registered composite. No depth image was generated by image_gen.', '',
    'AVIF: Pillow/libavif, quality **46** for art / **70** for depth, speed **4**, 4:2:0, two threads per encode. '
    'Fallbacks use exactly `cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv`. Depth is intentionally also encoded in both requested formats, '
    'with lossless grayscale PNG masters retained in staging. Full depth maps remain **1600 × 1800**; no depth downsampling was used for the savings.', '',
    'All 32 files were reopened and checked for dimensions and alpha. '
    f'Maximum decoded alpha mean absolute error: **{max(r["alpha_mae"] for r in files):.4f}/255**. '
    'Far/near retain transparent pixels; sky/depth remain fully opaque. Both depth maps span 0–255 and pass the near-rooftop > sky orientation check. '
    'See [files.json](./files.json), [depth-validation.json](./depth-validation.json), and [depth-metadata.json](./depth-metadata.json).', '',
    'Visually reviewed the decoded AVIF layers on checkerboard, assembled paintings, and both desktop/phone mocks. '
    'Additional actual-Jett previews check silhouette legibility using existing official art; no character is baked into a delivered backdrop. '
    'Previews are offline composition studies, not screenshots of an integrated app. No app build, source edits, or commit were performed.', '',
    'Reproduce asset processing from the retained PNG sources, from the repository root:', '', '```sh',
    '/tmp/hero-art/venv/bin/python apps/web/scripts/art/worlds/valorant/prepare.py',
    '/tmp/hero-art/venv/bin/python apps/web/scripts/art/worlds/valorant/depth.py',
    '/tmp/hero-art/venv/bin/python apps/web/scripts/art/worlds/valorant/encode.py',
    '/tmp/hero-art/venv/bin/python apps/web/scripts/art/worlds/valorant/previews.py --encoded',
    '/tmp/hero-art/venv/bin/python apps/web/scripts/art/worlds/valorant/review_seams.py',
    '/tmp/hero-art/venv/bin/python apps/web/scripts/art/worlds/valorant/write_manifest.py', '```', '',
    '## Previews', '',
    '- `/tmp/art-valorant/preview-paintings.png` — full night/day paintings.',
    '- `/tmp/art-valorant/preview-desktop.png` — 840 × 900 stages, mock silhouettes and coral tint.',
    '- `/tmp/art-valorant/preview-mobile.png` — 390 × 600 stages, mock silhouettes and coral tint.',
    '- `/tmp/art-valorant/preview-layers.png` — alpha-layer and depth contact sheet.',
    '- `/tmp/art-valorant/before-seam-fix/preview-paintings.png` — preserved before preview.',
    '- `/tmp/art-valorant/preview-seam-comparison.png` — before/after left-edge crops at native scale.',
    '- `/tmp/art-valorant/{night,day}-quality-comparison.png` — PNG / original AVIF settings / optimized AVIF crops at native scale.',
    '- `/tmp/art-valorant/{night,day}-depth-preview.png` — color/depth registration.',
    '- `/tmp/art-valorant/{night,day}-{desktop,mobile}-agent-check.png` — existing Jett art over the decoded environment.', '',
    'Generation sources and PNG previews remain in staging; only the requested compressed assets and this script/documentation folder are added to the repository.', '']
(HERE / 'MANIFEST.md').write_text('\n'.join(lines))
print(HERE / 'MANIFEST.md')
