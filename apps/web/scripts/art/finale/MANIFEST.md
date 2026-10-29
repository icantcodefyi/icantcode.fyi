# Finale / trophy art handoff — IMG-09, IMG-10, IMG-11

Completed 2026-10-29. App root: `apps/web`. All sizes below use decimal KB (1 KB = 1000 bytes). Only this script directory, the new trophy layers and `public/site/finale/` were written. No app source edit, build or git commit.

## Files

| File relative to apps/web | Pixels | KB |
|---|---:|---:|
| `public/site/scenes/trophy-girl.avif` | 1122×1402 | 105.55 |
| `public/site/scenes/trophy-girl.webp` | 1122×1402 | 1153.19 |
| `public/site/scenes/trophy-girl-600.avif` | 600×750 | 48.16 |
| `public/site/scenes/trophy-girl-600.webp` | 600×750 | 357.42 |
| `public/site/scenes/trophy-confetti.avif` | 1122×1402 | 32.21 |
| `public/site/scenes/trophy-confetti.webp` | 1122×1402 | 183.01 |
| `public/site/scenes/trophy-confetti-600.avif` | 600×750 | 16.56 |
| `public/site/scenes/trophy-confetti-600.webp` | 600×750 | 40.58 |
| `public/site/finale/meadow-night.avif` | 2400×1100 | 142.29 |
| `public/site/finale/meadow-night.webp` | 2400×1100 | 1423.44 |
| `public/site/finale/meadow-night-1200.avif` | 1200×550 | 58.92 |
| `public/site/finale/meadow-night-1200.webp` | 1200×550 | 442.52 |
| `public/site/finale/meadow-depth-night.avif` | 1200×550 | 11.24 |
| `public/site/finale/meadow-depth-night.webp` | 1200×550 | 70.43 |
| `public/site/finale/meadow-day.avif` | 2400×1100 | 137.94 |
| `public/site/finale/meadow-day.webp` | 2400×1100 | 1425.27 |
| `public/site/finale/meadow-day-1200.avif` | 1200×550 | 55.33 |
| `public/site/finale/meadow-day-1200.webp` | 1200×550 | 444.59 |
| `public/site/finale/meadow-depth-day.avif` | 1200×550 | 11.82 |
| `public/site/finale/meadow-depth-day.webp` | 1200×550 | 72.53 |

Full trophy AVIF pair: **137.76 KB** (≤140 KB). Full night meadow + optional depth: **153.53 KB**. Full day meadow + optional depth: **149.76 KB**. Each meadow alone is below 170 KB. Depth is already half-resolution; it does not need another half-size copy.

## Placement and seating proof

All percentages are relative to the **entire 2400×1100 meadow image**, including its transparent top. Keep its aspect ratio; if using object-fit, position the girl within the same fitted image rectangle, not the outer footer box.

- Contact/seat anchor: **(1488,570) px = (62%,51.8182%)**.
- Existing `sit-cutout.webp`: **1448×1086**. Its contact anchor is **(710,675)** in source coordinates, beneath the skirt at the hand/seat line.
- Render the sitter at **864×648** on a 2400px-wide meadow: **36% meadow width**, **0.596685×** the sitter's native size.
- Sitter top-left: **(1064,167) px = (44.3333%,15.1818%)**. No rotation. Its feet extend to about y815, safely over the rock's front.
- Same positioning works for both modes. The day and night boulder front lips are visually aligned; the generated flower tips have small natural differences.
- The sit previews use the exact existing cutout, resampled only. A subtle separate elliptical contact shadow is included only in the mock composites: center (1493,571), radius about (175,11), blur 8px; alpha 115 night / 72 day. It is optional for integration and is not baked into the shipped meadow.

## Verification and caveats

`verify.py` passed: all 20 output files decode with the specified dimensions; top 300px of both full meadow encodings is completely transparent; the bottom band is opaque; depth is grayscale; full trophy WebP layers have disjoint alpha and recombine to the source's **byte-identical visible RGBA, max error 0/255**. Hidden RGB under zero alpha is cleared to reduce bytes. No source or girl pixels were repainted.

IMG-09 uses alpha>=16 to identify real connected objects, bypassing the original matte's faint alpha bridges. Every original fringe pixel is assigned to its nearest connected object without changing its RGBA. The main girl/trophy/attached ribbons remain together; genuinely detached confetti and ribbon fragments form the other layer. There is no generation for IMG-09.

**Encoding tradeoffs:** trophy AVIF is q45/4:2:0 to meet the 140 KB budget and was inspected beside the source at displayed size. It is lossy; the exact-pixel proof applies to masters and full WebP files. WebP fallbacks are deliberately lossless and therefore larger (full trophy pair ~1.34 MB; each full meadow ~1.42 MB). AVIF is the compact delivery path. The `-600` trophy files follow the existing 600px naming convention (600×750), rather than a mathematically exact half of 1122×1402.

Meadow masters and WebP decode to exact **#120A10 night / #FFF1F6 day** at the bottom. AVIF q60's RGB↔YUV conversion decodes that flat band as **#110A0F / #FEF2F6**, respectively (maximum channel difference 1/255). Use the exact target ground in CSS; if a pixel-exact AVIF-to-CSS join is essential, a very short exact-color overlay at the bottom edge removes this one-unit codec difference. No app CSS was edited here.

The sitting cutout has its existing pink accents in daylight too; no recoloring or new girl art was authorized. The preview uses the existing hero sky for context; no duplicated sky asset ships. These are asset-level previews, not a browser integration/performance test.

## Depth

`meadow-depth-{night,day}` is 1200×550 opaque 8-bit grayscale, white near. Shared `scripts/art/build_depth.py` runs Depth Anything V2 Base on MPS with a neutral (128,128,128) alpha composite and 756×1652 model input. Each plate is independently normalized, then nearest-solid depth (alpha>=128) is extended beneath transparency, Gaussian sigma 1.2 is applied at full resolution, and the map is downsampled. AVIF q85; WebP lossless. The color plate keeps its own alpha. Use the full texture: pixel rect `[0,0,1200,550]`, normalized UV rect `[0,0,1,1]`. The alpha-free map is intentional: sample color alpha for discard.

## Constants to append to src/lib/art.ts (integration owner)

Do not duplicate existing sky/sitter AVIF entries. Add these 10 base strings to the existing `AVIF` set:

```ts
  "/site/scenes/trophy-girl",
  "/site/scenes/trophy-girl-600",
  "/site/scenes/trophy-confetti",
  "/site/scenes/trophy-confetti-600",
  "/site/finale/meadow-night",
  "/site/finale/meadow-night-1200",
  "/site/finale/meadow-day",
  "/site/finale/meadow-day-1200",
  "/site/finale/meadow-depth-night",
  "/site/finale/meadow-depth-day",
```

Append these exports (proposal only; not written to source):

```ts
export const FINALE_ART = {
  night: {
    sky: "/site/plate-night-sky",
    meadow: "/site/finale/meadow-night",
    meadowHalf: "/site/finale/meadow-night-1200",
    depth: "/site/finale/meadow-depth-night",
    sit: "/site/scenes/sit-cutout",
    ground: "#120A10",
  },
  day: {
    sky: "/site/plate-day-sky",
    meadow: "/site/finale/meadow-day",
    meadowHalf: "/site/finale/meadow-day-1200",
    depth: "/site/finale/meadow-depth-day",
    sit: "/site/scenes/sit-cutout",
    ground: "#FFF1F6",
  },
} as const;

export const FINALE_ART_LAYOUT = {
  meadowSize: [2400, 1100],
  meadowHalfSize: [1200, 550],
  depthSize: [1200, 550],
  depthUv: [0, 0, 1, 1],
  seatPercent: [62, 51.8181818182],
  sit: {
    sourceSize: [1448, 1086],
    x: 44.3333333333,
    y: 15.1818181818,
    w: 36,
    contactAnchor: [710, 675],
  },
} as const;

export const TROPHY_ART = {
  girl: "/site/scenes/trophy-girl",
  girlHalf: "/site/scenes/trophy-girl-600",
  confetti: "/site/scenes/trophy-confetti",
  confettiHalf: "/site/scenes/trophy-confetti-600",
} as const;

export const TROPHY_LAYERS = [
  { id: "girl", art: TROPHY_ART.girl, half: TROPHY_ART.girlHalf,
    size: [1122, 1402], halfSize: [600, 750], distance: 12.5 },
  { id: "confetti", art: TROPHY_ART.confetti, half: TROPHY_ART.confettiHalf,
    size: [1122, 1402], halfSize: [600, 750], distance: 7 },
] as const;
```

Both trophy layers share the complete original canvas and must share their layout rectangle before the camera applies their different depths. Never trim each layer to its nontransparent bounds.

## Previews (PNG files)

- `/tmp/art-finale/sit-composite-night.png`
- `/tmp/art-finale/sit-composite-day.png`
- `/tmp/art-finale/meadow-night-preview.png`
- `/tmp/art-finale/meadow-day-preview.png`
- `/tmp/art-finale/alpha-check-night.png`
- `/tmp/art-finale/alpha-check-day.png`
- `/tmp/art-finale/trophy-split-preview.png`
- `/tmp/art-finale/trophy-encoded-preview.png`
- `/tmp/art-finale/trophy-recomposite.png`
- `/tmp/art-finale/depth-preview-night.png`
- `/tmp/art-finale/depth-preview-day.png`

## Reproduction

Run from repo root, sequentially (MPS shared with other art jobs):

```sh
/tmp/hero-art/venv/bin/python apps/web/scripts/art/finale/upscale.py
/tmp/hero-art/venv/bin/python apps/web/scripts/art/finale/split_trophy.py
/tmp/hero-art/venv/bin/python apps/web/scripts/art/finale/finish_meadows.py
/tmp/hero-art/venv/bin/python apps/web/scripts/art/finale/depth.py
/tmp/hero-art/venv/bin/python apps/web/scripts/art/finale/verify.py
```

`masters/` archives the selected generated PNGs, so model-image generation need not be repeated. `PROMPTS.md` records the prompt set, references, selected generation IDs, rejected first-pass composition and finishing. Upscaler weights: `/tmp/hero-art/models/RealESRGAN_x4plus_anime_6B.pth`; inference cache/environment: `/tmp/hero-art`. The small torchvision compatibility alias is local to the script process. The shared depth tools are imported read-only.

`manifest.json` has every delivered file's bytes, dimensions and SHA-256, plus verification and placement. Temporary intermediates/previews are under `/tmp/art-finale/`. The input references and source cutouts remain untouched.
