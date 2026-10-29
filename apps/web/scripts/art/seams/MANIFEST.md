# Cloud seams / IMG-05–08

Delivered 32 RGBA files in `apps/web/public/site/seams/`: eight layers × full/half × AVIF/WebP. KB below means KiB (1024 bytes). No app source, build, or commit was changed by this track.

## Dimensions and solid bands

Coordinates are zero-based; end is exclusive. The guaranteed exact band belongs to `front`; `back` is transparent at the attachment edge.

| Kind | Full px | Half px | Full solid band | Half solid band | Colour |
|---|---|---|---|---|---|
| Rise, night | 2400×720 | 1200×360 | y=576–720 (80–100%) | y=288–360 (80–100%) | #FFB3D1 |
| Rise, day | 2400×720 | 1200×360 | y=576–720 (80–100%) | y=288–360 (80–100%) | #FFC6DC |
| Fall, night | 2400×640 | 1200×320 | y=0–128 (0–20%) | y=0–64 (0–20%) | #FFB3D1 |
| Fall, day | 2400×640 | 1200×320 | y=0–128 (0–20%) | y=0–64 (0–20%) | #FFC6DC |

The rise half-size encoder extends the flat colour upward to y=256 (71.11%) to protect the declared band from block ringing. The declared bands remain exact in PNG masters and decoded AVIF; decoded lossy WebP stays within 2/255 per RGB channel, with fully opaque alpha.

## File sizes

Every row names four files: `.avif`, `.webp`, `-1200.avif`, and `-1200.webp`.

| Base | AVIF KB | WebP KB | Half AVIF KB | Half WebP KB |
|---|---:|---:|---:|---:|
| `cloud-rise-night-back` | 38.36 | 117.51 | 16.88 | 56.24 |
| `cloud-rise-night-front` | 36.68 | 103.84 | 15.54 | 48.64 |
| `cloud-rise-day-back` | 31.42 | 82.63 | 14.32 | 42.01 |
| `cloud-rise-day-front` | 33.35 | 90.67 | 14.64 | 46.20 |
| `cloud-fall-night-back` | 31.73 | 135.39 | 12.78 | 56.14 |
| `cloud-fall-night-front` | 17.40 | 98.14 | 10.90 | 40.32 |
| `cloud-fall-day-back` | 28.68 | 123.18 | 12.55 | 50.44 |
| `cloud-fall-day-front` | 10.58 | 58.73 | 9.04 | 28.59 |

Totals (four layers per mode; one codec and resolution are loaded):

- **night**: avif full: 124.17 KB, avif half: 56.10 KB, webp full: 454.88 KB, webp half: 201.34 KB.
- **day**: avif full: 104.03 KB, avif half: 50.55 KB, webp full: 355.22 KB, webp half: 167.25 KB.

## Pipeline and verification

- Built-in image generation with attached references; final prompts and iteration notes: `PROMPTS.md`. Accepted raw RGBA masters: `sources/` (not shipped by the web app).
- Real-ESRGAN `x4plus_anime_6B`, MPS, ×4 learned inference reduced to ×2; original alpha independently resampled. RGB guard pigment is extended before upscaling to avoid dark fringes.
- Rise crop: `(0,1126,3072,2048)` on the ×2 canvas, fit to 2400×720. Fall crop: `(0,0,3072,1000)`, fit to 2400×640; this slightly compresses the vertical composition to retain all hanging tips.
- Depth Anything V2 Base, MPS, neutral RGB(128,128,128) composite, 518px short-side inference. Per-image normalization; cloud-only 55th-percentile threshold; rise 10px / fall 80px depth feather. Fall uses the original painting as its depth reference to retain the established near/far layout. Normalized thresholds are in `depth-split.json`.
- The solid foundation is attached continuously to front. Far regions retain their painting, with softened source pigment beneath near occlusions. This is an intentional hidden underpainting: a strict complementary cut exposed holes and nearest-pixel fill produced streaks when the layers separated.
- Fall undersides were repainted with the built-in image tool, then recomposited below y=290; y=0–127 is copied unchanged. A rounded distance-field alpha dissolve spans 100 native pixels, modulated by painted vapor. Fall alpha retains all 256 levels; rise retains its original 32-level alpha. Both fall depth layers use an 80px internal feather. Black/blush and separated-layer previews were inspected.
- Half-size fall front AVIFs prefilter RGB by 1px after downsampling, retaining the original alpha and reasserting the exact 64-row blush band. This removes subpixel pigment noise before encoding; no band extension or colour relaxation is used.
- Back AVIF uses YUV 4:2:0. Front AVIF uses RGB identity colour encoding with a separately encoded alpha plane: ordinary YUV changed the exact night blush by one RGB level. Per-file quality/CRF is recorded in `files.json`.
- Every WebP uses lossy `cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv`. The day fall half front additionally uses `-sns 0` to prevent three flat-band pixels exceeding the 2/255 tolerance. The sources retain their exact colours.
- `verify.py` decodes all 32 files and asserts natural size, RGBA, true zero/full alpha, intermediate alpha, and exact AVIF / ≤2-LSB WebP RGB bands with fully opaque alpha. It also checks lossy VP8 bitstreams and that each half AVIF is smaller than its full version. SHA-256, byte counts and codec settings are in `files.json`.

## Integration caveats

- Use both layers: back at d=30, front at d=8, from the same kind/mode. Full and half are alternatives, not four simultaneously loaded textures.
- Keep the panel colour behind the front band and overlap the section edge; a translated image rectangle by itself cannot fill pixels beyond its canvas. Maintain horizontal overscan for camera drift.
- Opposing ±48 native-pixel offsets were visually checked (96px relative separation). Live component geometry, its larger extrema, mobile cropping and `useDayArt` integration remain the integrating agent’s verification task.
- Day and night are references of the same family, not pixel-identical silhouettes. A normal crossfade is appropriate.
- Every full AVIF is below 40 KiB; every half AVIF is smaller than its full counterpart. Choose resolution by display size; AVIF remains primary.

## Reproduce

```sh
/tmp/hero-art/venv/bin/python apps/web/scripts/art/seams/upscale.py
/tmp/hero-art/venv/bin/python apps/web/scripts/art/seams/build.py all
/tmp/hero-art/venv/bin/python apps/web/scripts/art/seams/verify.py
```

Requires the shared `/tmp/hero-art/venv`, cached DA-V2 Base model, `/tmp/hero-art/models/RealESRGAN_x4plus_anime_6B.pth`, `ffmpeg` with libaom, and `cwebp`. Intermediates live in `/tmp/art-seams`; raw sources and scripts are retained here. Remove the relevant cached `*-depth.npy`/`*-2x.png` files before rebuilding from different source pixels.

## Previews

- Before: `/tmp/art-seams/before/journey-{night,day}.png`; after: `/tmp/art-seams/journey-{night,day}.png`, rise → 480px blush panel → fall, 2400×1840.
- `/tmp/art-seams/{rise,fall}-{night,day}-on-black.png` and `-on-blush.png`: decoded AVIF pairs on each test background.
- `/tmp/art-seams/{rise,fall}-{night,day}-layers.png`: back, front, composite.
- `/tmp/art-seams/fall-{night,day}-half-codec-review.png`: half-size AVIF/WebP pairs, on black and blush.
- `refinement-validation.json`: measured before/after alpha discontinuities; final 40px are fully clear on all four fall layers.
- `/tmp/art-seams/parallax-{night,day}.png`: opposing rise-layer offsets; exported canvas boundaries are deliberately visible for integration.

## Append to `src/lib/art.ts` (not applied)

Path keys are `SEAM_ART[kind][mode].back/front`; companion `backHalf/frontHalf` use the existing four-argument `halfSet` API. Widths are 2400 and 1200. Heights are 720/360 for rise and 640/320 for fall.

```ts
export const SEAM_ART = {
  "cloud-rise": {
    night: {
      back: "/site/seams/cloud-rise-night-back",
      front: "/site/seams/cloud-rise-night-front",
      backHalf: "/site/seams/cloud-rise-night-back-1200",
      frontHalf: "/site/seams/cloud-rise-night-front-1200",
    },
    day: {
      back: "/site/seams/cloud-rise-day-back",
      front: "/site/seams/cloud-rise-day-front",
      backHalf: "/site/seams/cloud-rise-day-back-1200",
      frontHalf: "/site/seams/cloud-rise-day-front-1200",
    },
  },
  "cloud-fall": {
    night: {
      back: "/site/seams/cloud-fall-night-back",
      front: "/site/seams/cloud-fall-night-front",
      backHalf: "/site/seams/cloud-fall-night-back-1200",
      frontHalf: "/site/seams/cloud-fall-night-front-1200",
    },
    day: {
      back: "/site/seams/cloud-fall-day-back",
      front: "/site/seams/cloud-fall-day-front",
      backHalf: "/site/seams/cloud-fall-day-back-1200",
      frontHalf: "/site/seams/cloud-fall-day-front-1200",
    },
  },
} as const;
```

Add these 16 base paths inside the existing `AVIF` set:

```ts
  "/site/seams/cloud-rise-night-back",
  "/site/seams/cloud-rise-night-back-1200",
  "/site/seams/cloud-rise-night-front",
  "/site/seams/cloud-rise-night-front-1200",
  "/site/seams/cloud-rise-day-back",
  "/site/seams/cloud-rise-day-back-1200",
  "/site/seams/cloud-rise-day-front",
  "/site/seams/cloud-rise-day-front-1200",
  "/site/seams/cloud-fall-night-back",
  "/site/seams/cloud-fall-night-back-1200",
  "/site/seams/cloud-fall-night-front",
  "/site/seams/cloud-fall-night-front-1200",
  "/site/seams/cloud-fall-day-back",
  "/site/seams/cloud-fall-day-back-1200",
  "/site/seams/cloud-fall-day-front",
  "/site/seams/cloud-fall-day-front-1200",
```
