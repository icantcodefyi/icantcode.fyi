# Teyvat region vistas

Generated with the built-in imagegen tool: three region paintings, matching day relights, one Fontaine rainbow refinement, and six clean sky/sea underpaintings. Exact prompts and generation paths are in `prompts.json`. All art is fan-made environment art; delivery paintings contain no characters, text, or UI. Characters and text appear only in staging mockups.

## Delivery

96 assets in `apps/web/public/lobby/gi/vista/`: 6 scenes × 4 textures × 2 resolutions × 2 codecs. KB means 1024 bytes. Full and half variants are alternatives, as are AVIF and WebP. Totals below include sky + far + near + depth.

| Scene | Full AVIF KB | Half AVIF KB | Full WebP KB | Half WebP KB |
|---|---:|---:|---:|---:|
| inazuma-night | 137.08 | 82.34 | 288.00 | 132.06 |
| inazuma-day | 160.22 | 83.04 | 474.08 | 213.36 |
| liyue-night | 145.96 | 79.77 | 259.19 | 117.80 |
| liyue-day | 167.00 | 79.26 | 462.79 | 207.06 |
| fontaine-night | 147.94 | 78.52 | 330.19 | 148.27 |
| fontaine-day | 143.98 | 77.55 | 392.52 | 185.90 |

## Layers and placement

All textures share exactly the same stage: **2400×1350**, with **1200×675** half versions. No cropping or trimmed-card offsets. Composite in the order sky → far → near.

| Texture | Alpha | Offset x/y | Suggested maximum travel at 2400px stage |
|---|---|---|---|
| sky | opaque | 0 / 0 | ±2 px |
| far | transparent above distant terrain; includes water and its reflections | 0 / 0 | ±6 px |
| near | transparent; nearest bottom foliage/rocks | 0 / 0 | ±12 px |
| depth | opaque grayscale, white near | 0 / 0 | same UVs as the combined painting |

Use a shared 1.04 overscan for all color layers, centered at 50% 50%, and scale travel with rendered width. Depth uses that same crop/UV transform. Disable travel with reduced motion. These are subtle decorative parallax plates, not geometry for large camera moves. The scene depth belongs to the combined painting; it is not a packed per-layer depth atlas.

Far silhouettes come from Depth Anything V2; nearest detail is split at normalized inverse depth 0.50 and constrained to the bottom region. Edges use a 3.4px feather with 8px RGB bleed. Hidden regions contain separately generated sky and open water, avoiding duplicate landmark silhouettes or stretched fill. Day/night geography is closely matched by relighting; generated details are not guaranteed pixel-identical, so crossfade all color layers together.

## Depth and encoding

Local `/tmp/hero-art/venv` runs cached `depth-anything/Depth-Anything-V2-Base-hf` on MPS. Final depth is inferred from the **actual recombined clean-underpainting image**, interpolated to exactly 1350×2400 with bicubic `align_corners=False`, normalized using the 0.2/99.8 percentiles. It is relative inverse depth, not meters. Raw floating maps, lossless PNGs, input hashes and normalization values remain in staging; `final-inference.json` records provenance.

Color AVIF uses adaptive quality, speed 6, 4:2:0; depth AVIF uses q82 and 4:4:4. Every fallback uses exactly `cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv`, including depth. Both codecs decode with grayscale depth and retained transparent alpha. Full matrices and per-file checksums are in `verification.json`.

## Copy and preview treatment

Generated source canvases were approximately 1672×941 and resampled with Lanczos to the exact delivery size. The three AVIF color plates together meet the approximate 60–150 KB painting target; the aligned depth map is an additional transfer. Night paintings have a soft 32% exposure falloff toward the copy side and a 10% left-side reduction. Day keeps colored light values and a 7% left-side reduction. Fine detail on the far right is softened. Region hues stay intact. Suggested night panel tint: #08403f at 24%; mock right copy block: rgba(4,35,37,.875). Day mocks use 10% teal tint and the same dark text container to prove the requested overlay. Existing app day copy is dark teal; if omitting the dark block, use that existing dark copy palette with a pale translucent day veil.

Previews are mockups, not a running implementation. No application source, art registry, build output, or git commit was changed by this task.

## Suggested TypeScript constant

```ts
export const TEYVAT_VISTA = {
  "inazuma": {
    "night": {
      "sky": "/lobby/gi/vista/inazuma-night-sky",
      "far": "/lobby/gi/vista/inazuma-night-far",
      "near": "/lobby/gi/vista/inazuma-night-near",
      "depth": "/lobby/gi/vista/inazuma-night-depth",
      "skyHalf": "/lobby/gi/vista/inazuma-night-sky-1200",
      "farHalf": "/lobby/gi/vista/inazuma-night-far-1200",
      "nearHalf": "/lobby/gi/vista/inazuma-night-near-1200",
      "depthHalf": "/lobby/gi/vista/inazuma-night-depth-1200"
    },
    "day": {
      "sky": "/lobby/gi/vista/inazuma-day-sky",
      "far": "/lobby/gi/vista/inazuma-day-far",
      "near": "/lobby/gi/vista/inazuma-day-near",
      "depth": "/lobby/gi/vista/inazuma-day-depth",
      "skyHalf": "/lobby/gi/vista/inazuma-day-sky-1200",
      "farHalf": "/lobby/gi/vista/inazuma-day-far-1200",
      "nearHalf": "/lobby/gi/vista/inazuma-day-near-1200",
      "depthHalf": "/lobby/gi/vista/inazuma-day-depth-1200"
    }
  },
  "liyue": {
    "night": {
      "sky": "/lobby/gi/vista/liyue-night-sky",
      "far": "/lobby/gi/vista/liyue-night-far",
      "near": "/lobby/gi/vista/liyue-night-near",
      "depth": "/lobby/gi/vista/liyue-night-depth",
      "skyHalf": "/lobby/gi/vista/liyue-night-sky-1200",
      "farHalf": "/lobby/gi/vista/liyue-night-far-1200",
      "nearHalf": "/lobby/gi/vista/liyue-night-near-1200",
      "depthHalf": "/lobby/gi/vista/liyue-night-depth-1200"
    },
    "day": {
      "sky": "/lobby/gi/vista/liyue-day-sky",
      "far": "/lobby/gi/vista/liyue-day-far",
      "near": "/lobby/gi/vista/liyue-day-near",
      "depth": "/lobby/gi/vista/liyue-day-depth",
      "skyHalf": "/lobby/gi/vista/liyue-day-sky-1200",
      "farHalf": "/lobby/gi/vista/liyue-day-far-1200",
      "nearHalf": "/lobby/gi/vista/liyue-day-near-1200",
      "depthHalf": "/lobby/gi/vista/liyue-day-depth-1200"
    }
  },
  "fontaine": {
    "night": {
      "sky": "/lobby/gi/vista/fontaine-night-sky",
      "far": "/lobby/gi/vista/fontaine-night-far",
      "near": "/lobby/gi/vista/fontaine-night-near",
      "depth": "/lobby/gi/vista/fontaine-night-depth",
      "skyHalf": "/lobby/gi/vista/fontaine-night-sky-1200",
      "farHalf": "/lobby/gi/vista/fontaine-night-far-1200",
      "nearHalf": "/lobby/gi/vista/fontaine-night-near-1200",
      "depthHalf": "/lobby/gi/vista/fontaine-night-depth-1200"
    },
    "day": {
      "sky": "/lobby/gi/vista/fontaine-day-sky",
      "far": "/lobby/gi/vista/fontaine-day-far",
      "near": "/lobby/gi/vista/fontaine-day-near",
      "depth": "/lobby/gi/vista/fontaine-day-depth",
      "skyHalf": "/lobby/gi/vista/fontaine-day-sky-1200",
      "farHalf": "/lobby/gi/vista/fontaine-day-far-1200",
      "nearHalf": "/lobby/gi/vista/fontaine-day-near-1200",
      "depthHalf": "/lobby/gi/vista/fontaine-day-depth-1200"
    }
  },
  "size": [
    2400,
    1350
  ],
  "halfSize": [
    1200,
    675
  ],
  "layers": {
    "sky": {
      "size": [
        2400,
        1350
      ],
      "offset": [
        0,
        0
      ],
      "maxTravelPx": 2
    },
    "far": {
      "size": [
        2400,
        1350
      ],
      "offset": [
        0,
        0
      ],
      "maxTravelPx": 6
    },
    "near": {
      "size": [
        2400,
        1350
      ],
      "offset": [
        0,
        0
      ],
      "maxTravelPx": 12
    }
  },
  "characterRegion": {
    "kazuha": "inazuma",
    "zhongli": "liyue",
    "hu-tao": "liyue",
    "furina": "fontaine"
  }
} as const;
```

## AVIF Set entries

Append these extensionless paths to the existing `AVIF` Set when integrating. `art()` supplies the extension; `halfSet()` widths are 2400 and 1200.

```ts
  "/lobby/gi/vista/fontaine-day-depth-1200",
  "/lobby/gi/vista/fontaine-day-depth",
  "/lobby/gi/vista/fontaine-day-far-1200",
  "/lobby/gi/vista/fontaine-day-far",
  "/lobby/gi/vista/fontaine-day-near-1200",
  "/lobby/gi/vista/fontaine-day-near",
  "/lobby/gi/vista/fontaine-day-sky-1200",
  "/lobby/gi/vista/fontaine-day-sky",
  "/lobby/gi/vista/fontaine-night-depth-1200",
  "/lobby/gi/vista/fontaine-night-depth",
  "/lobby/gi/vista/fontaine-night-far-1200",
  "/lobby/gi/vista/fontaine-night-far",
  "/lobby/gi/vista/fontaine-night-near-1200",
  "/lobby/gi/vista/fontaine-night-near",
  "/lobby/gi/vista/fontaine-night-sky-1200",
  "/lobby/gi/vista/fontaine-night-sky",
  "/lobby/gi/vista/inazuma-day-depth-1200",
  "/lobby/gi/vista/inazuma-day-depth",
  "/lobby/gi/vista/inazuma-day-far-1200",
  "/lobby/gi/vista/inazuma-day-far",
  "/lobby/gi/vista/inazuma-day-near-1200",
  "/lobby/gi/vista/inazuma-day-near",
  "/lobby/gi/vista/inazuma-day-sky-1200",
  "/lobby/gi/vista/inazuma-day-sky",
  "/lobby/gi/vista/inazuma-night-depth-1200",
  "/lobby/gi/vista/inazuma-night-depth",
  "/lobby/gi/vista/inazuma-night-far-1200",
  "/lobby/gi/vista/inazuma-night-far",
  "/lobby/gi/vista/inazuma-night-near-1200",
  "/lobby/gi/vista/inazuma-night-near",
  "/lobby/gi/vista/inazuma-night-sky-1200",
  "/lobby/gi/vista/inazuma-night-sky",
  "/lobby/gi/vista/liyue-day-depth-1200",
  "/lobby/gi/vista/liyue-day-depth",
  "/lobby/gi/vista/liyue-day-far-1200",
  "/lobby/gi/vista/liyue-day-far",
  "/lobby/gi/vista/liyue-day-near-1200",
  "/lobby/gi/vista/liyue-day-near",
  "/lobby/gi/vista/liyue-day-sky-1200",
  "/lobby/gi/vista/liyue-day-sky",
  "/lobby/gi/vista/liyue-night-depth-1200",
  "/lobby/gi/vista/liyue-night-depth",
  "/lobby/gi/vista/liyue-night-far-1200",
  "/lobby/gi/vista/liyue-night-far",
  "/lobby/gi/vista/liyue-night-near-1200",
  "/lobby/gi/vista/liyue-night-near",
  "/lobby/gi/vista/liyue-night-sky-1200",
  "/lobby/gi/vista/liyue-night-sky",
```

## Exact file inventory

| File | Pixels | KB | Encoding |
|---|---|---:|---|
| `fontaine-day-depth-1200.avif` | 1200×675 | 11.03 | AVIF q82 / speed6 |
| `fontaine-day-depth-1200.webp` | 1200×675 | 6.59 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `fontaine-day-depth.avif` | 2400×1350 | 22.99 | AVIF q82 / speed6 |
| `fontaine-day-depth.webp` | 2400×1350 | 16.43 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `fontaine-day-far-1200.avif` | 1200×675 | 33.71 | AVIF q42 / speed6 |
| `fontaine-day-far-1200.webp` | 1200×675 | 93.84 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `fontaine-day-far.avif` | 2400×1350 | 62.19 | AVIF q32 / speed6 |
| `fontaine-day-far.webp` | 2400×1350 | 202.71 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `fontaine-day-near-1200.avif` | 1200×675 | 15.09 | AVIF q42 / speed6 |
| `fontaine-day-near-1200.webp` | 1200×675 | 39.81 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `fontaine-day-near.avif` | 2400×1350 | 25.92 | AVIF q32 / speed6 |
| `fontaine-day-near.webp` | 2400×1350 | 75.18 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `fontaine-day-sky-1200.avif` | 1200×675 | 17.71 | AVIF q42 / speed6 |
| `fontaine-day-sky-1200.webp` | 1200×675 | 45.65 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `fontaine-day-sky.avif` | 2400×1350 | 32.88 | AVIF q32 / speed6 |
| `fontaine-day-sky.webp` | 2400×1350 | 98.21 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `fontaine-night-depth-1200.avif` | 1200×675 | 10.91 | AVIF q82 / speed6 |
| `fontaine-night-depth-1200.webp` | 1200×675 | 6.34 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `fontaine-night-depth.avif` | 2400×1350 | 22.51 | AVIF q82 / speed6 |
| `fontaine-night-depth.webp` | 2400×1350 | 16.33 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `fontaine-night-far-1200.avif` | 1200×675 | 34.39 | AVIF q48 / speed6 |
| `fontaine-night-far-1200.webp` | 1200×675 | 78.08 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `fontaine-night-far.avif` | 2400×1350 | 62.85 | AVIF q38 / speed6 |
| `fontaine-night-far.webp` | 2400×1350 | 165.26 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `fontaine-night-near-1200.avif` | 1200×675 | 10.66 | AVIF q48 / speed6 |
| `fontaine-night-near-1200.webp` | 1200×675 | 23.39 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `fontaine-night-near.avif` | 2400×1350 | 19.29 | AVIF q38 / speed6 |
| `fontaine-night-near.webp` | 2400×1350 | 47.36 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `fontaine-night-sky-1200.avif` | 1200×675 | 22.56 | AVIF q48 / speed6 |
| `fontaine-night-sky-1200.webp` | 1200×675 | 40.46 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `fontaine-night-sky.avif` | 2400×1350 | 43.29 | AVIF q38 / speed6 |
| `fontaine-night-sky.webp` | 2400×1350 | 101.24 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-day-depth-1200.avif` | 1200×675 | 11.55 | AVIF q82 / speed6 |
| `inazuma-day-depth-1200.webp` | 1200×675 | 6.70 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-day-depth.avif` | 2400×1350 | 24.45 | AVIF q82 / speed6 |
| `inazuma-day-depth.webp` | 2400×1350 | 16.35 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-day-far-1200.avif` | 1200×675 | 37.34 | AVIF q42 / speed6 |
| `inazuma-day-far-1200.webp` | 1200×675 | 113.21 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-day-far.avif` | 2400×1350 | 71.32 | AVIF q32 / speed6 |
| `inazuma-day-far.webp` | 2400×1350 | 252.95 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-day-near-1200.avif` | 1200×675 | 12.27 | AVIF q42 / speed6 |
| `inazuma-day-near-1200.webp` | 1200×675 | 33.83 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-day-near.avif` | 2400×1350 | 23.50 | AVIF q32 / speed6 |
| `inazuma-day-near.webp` | 2400×1350 | 73.04 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-day-sky-1200.avif` | 1200×675 | 21.87 | AVIF q42 / speed6 |
| `inazuma-day-sky-1200.webp` | 1200×675 | 59.62 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-day-sky.avif` | 2400×1350 | 40.95 | AVIF q32 / speed6 |
| `inazuma-day-sky.webp` | 2400×1350 | 131.74 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-night-depth-1200.avif` | 1200×675 | 11.00 | AVIF q82 / speed6 |
| `inazuma-night-depth-1200.webp` | 1200×675 | 6.45 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-night-depth.avif` | 2400×1350 | 23.60 | AVIF q82 / speed6 |
| `inazuma-night-depth.webp` | 2400×1350 | 15.81 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-night-far-1200.avif` | 1200×675 | 37.51 | AVIF q51 / speed6 |
| `inazuma-night-far-1200.webp` | 1200×675 | 69.71 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-night-far.avif` | 2400×1350 | 58.94 | AVIF q38 / speed6 |
| `inazuma-night-far.webp` | 2400×1350 | 144.34 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-night-near-1200.avif` | 1200×675 | 8.98 | AVIF q51 / speed6 |
| `inazuma-night-near-1200.webp` | 1200×675 | 16.29 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-night-near.avif` | 2400×1350 | 15.09 | AVIF q38 / speed6 |
| `inazuma-night-near.webp` | 2400×1350 | 36.86 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-night-sky-1200.avif` | 1200×675 | 24.85 | AVIF q51 / speed6 |
| `inazuma-night-sky-1200.webp` | 1200×675 | 39.62 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `inazuma-night-sky.avif` | 2400×1350 | 39.45 | AVIF q38 / speed6 |
| `inazuma-night-sky.webp` | 2400×1350 | 90.99 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-day-depth-1200.avif` | 1200×675 | 15.99 | AVIF q82 / speed6 |
| `liyue-day-depth-1200.webp` | 1200×675 | 9.51 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-day-depth.avif` | 2400×1350 | 32.27 | AVIF q82 / speed6 |
| `liyue-day-depth.webp` | 2400×1350 | 21.34 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-day-far-1200.avif` | 1200×675 | 33.48 | AVIF q39 / speed6 |
| `liyue-day-far-1200.webp` | 1200×675 | 111.42 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-day-far.avif` | 2400×1350 | 73.66 | AVIF q32 / speed6 |
| `liyue-day-far.webp` | 2400×1350 | 257.60 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-day-near-1200.avif` | 1200×675 | 13.67 | AVIF q39 / speed6 |
| `liyue-day-near-1200.webp` | 1200×675 | 40.64 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-day-near.avif` | 2400×1350 | 27.54 | AVIF q32 / speed6 |
| `liyue-day-near.webp` | 2400×1350 | 83.16 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-day-sky-1200.avif` | 1200×675 | 16.12 | AVIF q39 / speed6 |
| `liyue-day-sky-1200.webp` | 1200×675 | 45.48 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-day-sky.avif` | 2400×1350 | 33.53 | AVIF q32 / speed6 |
| `liyue-day-sky.webp` | 2400×1350 | 100.69 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-night-depth-1200.avif` | 1200×675 | 16.42 | AVIF q82 / speed6 |
| `liyue-night-depth-1200.webp` | 1200×675 | 9.58 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-night-depth.avif` | 2400×1350 | 33.40 | AVIF q82 / speed6 |
| `liyue-night-depth.webp` | 2400×1350 | 21.16 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-night-far-1200.avif` | 1200×675 | 34.98 | AVIF q51 / speed6 |
| `liyue-night-far-1200.webp` | 1200×675 | 64.35 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-night-far.avif` | 2400×1350 | 61.11 | AVIF q41 / speed6 |
| `liyue-night-far.webp` | 2400×1350 | 135.88 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-night-near-1200.avif` | 1200×675 | 11.59 | AVIF q51 / speed6 |
| `liyue-night-near-1200.webp` | 1200×675 | 21.06 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-night-near.avif` | 2400×1350 | 21.03 | AVIF q41 / speed6 |
| `liyue-night-near.webp` | 2400×1350 | 41.02 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-night-sky-1200.avif` | 1200×675 | 16.78 | AVIF q51 / speed6 |
| `liyue-night-sky-1200.webp` | 1200×675 | 22.80 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |
| `liyue-night-sky.avif` | 2400×1350 | 30.44 | AVIF q41 / speed6 |
| `liyue-night-sky.webp` | 2400×1350 | 61.12 | cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv |

## Staging previews

- `/tmp/art-teyvat/contact-preview.png` — all six decoded AVIF composites.
- `/tmp/art-teyvat/contact-mock.png` — all six teal/character/copy mocks.
- `/tmp/art-teyvat/{region}-{mode}-preview.png` — full 2400×1350 decoded composite.
- `/tmp/art-teyvat/{region}-{mode}-mock.png` — 1440×810 panel mock.
- `/tmp/art-teyvat/layers-{night,day}.png` — decoded layers on sage matte.
- `/tmp/art-teyvat/parallax-night.gif` — bounded three-region motion proof.
- `/tmp/art-teyvat/gallery.html` — self-contained local review gallery.

## Reproduce

Keep the `*-source.png` and `*-cleanplate-source.png` files in `/tmp/art-teyvat/` (generation paths are recorded in `prompts.json`). From repo root, use `/tmp/hero-art/venv/bin/python` for each of these scripts, in order:

```sh
python apps/web/scripts/art/worlds/teyvat/prepare.py
python apps/web/scripts/art/worlds/teyvat/infer.py
python apps/web/scripts/art/worlds/teyvat/split.py
python apps/web/scripts/art/worlds/teyvat/infer.py --combined
python apps/web/scripts/art/worlds/teyvat/encode.py
python apps/web/scripts/art/worlds/teyvat/previews.py
python apps/web/scripts/art/worlds/teyvat/verify.py
python apps/web/scripts/art/worlds/teyvat/manifest.py
```

`prepare.py` caches staged masters. If deliberately replacing a source, remove only that source’s derived master and segmentation-depth PNG before rerunning. Model depth caching is keyed by the input SHA-256.
