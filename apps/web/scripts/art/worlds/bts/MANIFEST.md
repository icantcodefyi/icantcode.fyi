# BTS painted stadium stage

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
| night | 2000 × 1400 | 538.43 | 641.29 |
| night | 1000 × 700 | 193.06 | 231.08 |
| day | 2000 × 1400 | 492.34 | 595.40 |
| day | 1000 × 700 | 189.98 | 238.43 |

## Exact file list

| File | Pixels | KB |
|---|---:|---:|
| `night-back.avif` | 2000 × 1400 | 119.91 |
| `night-back.webp` | 2000 × 1400 | 166.51 |
| `night-back-1000.avif` | 1000 × 700 | 41.24 |
| `night-back-1000.webp` | 1000 × 700 | 62.66 |
| `night-beams.avif` | 2000 × 1400 | 228.07 |
| `night-beams.webp` | 2000 × 1400 | 260.89 |
| `night-beams-1000.avif` | 1000 × 700 | 81.61 |
| `night-beams-1000.webp` | 1000 × 700 | 92.80 |
| `night-mid.avif` | 2000 × 1400 | 116.47 |
| `night-mid.webp` | 2000 × 1400 | 134.49 |
| `night-mid-1000.avif` | 1000 × 700 | 42.32 |
| `night-mid-1000.webp` | 1000 × 700 | 46.22 |
| `night-front.avif` | 2000 × 1400 | 57.81 |
| `night-front.webp` | 2000 × 1400 | 67.08 |
| `night-front-1000.avif` | 1000 × 700 | 20.83 |
| `night-front-1000.webp` | 1000 × 700 | 24.61 |
| `night-depth.avif` | 2000 × 1400 | 16.17 |
| `night-depth.webp` | 2000 × 1400 | 12.32 |
| `night-depth-1000.avif` | 1000 × 700 | 7.06 |
| `night-depth-1000.webp` | 1000 × 700 | 4.80 |
| `day-back.avif` | 2000 × 1400 | 146.63 |
| `day-back.webp` | 2000 × 1400 | 209.99 |
| `day-back-1000.avif` | 1000 × 700 | 52.27 |
| `day-back-1000.webp` | 1000 × 700 | 83.98 |
| `day-beams.avif` | 2000 × 1400 | 170.46 |
| `day-beams.webp` | 2000 × 1400 | 186.28 |
| `day-beams-1000.avif` | 1000 × 700 | 70.84 |
| `day-beams-1000.webp` | 1000 × 700 | 81.51 |
| `day-mid.avif` | 2000 × 1400 | 119.14 |
| `day-mid.webp` | 2000 × 1400 | 134.40 |
| `day-mid-1000.avif` | 1000 × 700 | 43.71 |
| `day-mid-1000.webp` | 1000 × 700 | 47.53 |
| `day-front.avif` | 2000 × 1400 | 39.09 |
| `day-front.webp` | 2000 × 1400 | 51.31 |
| `day-front-1000.avif` | 1000 × 700 | 15.95 |
| `day-front-1000.webp` | 1000 × 700 | 19.90 |
| `day-depth.avif` | 2000 × 1400 | 17.02 |
| `day-depth.webp` | 2000 × 1400 | 13.43 |
| `day-depth-1000.avif` | 1000 × 700 | 7.20 |
| `day-depth-1000.webp` | 1000 × 700 | 5.50 |

## Suggested constants — documentation only

This art task did not edit any `.ts`, `.tsx`, `.css`, or `src/lib/art.ts` files. Copy this into the owning implementation only when integrating the art.

```ts
export const BTS_STAGE = {
  night: {
    back: "/bts/stage/night-back",
    backHalf: "/bts/stage/night-back-1000",
    mid: "/bts/stage/night-mid",
    midHalf: "/bts/stage/night-mid-1000",
    beams: "/bts/stage/night-beams",
    beamsHalf: "/bts/stage/night-beams-1000",
    front: "/bts/stage/night-front",
    frontHalf: "/bts/stage/night-front-1000",
    depth: "/bts/stage/night-depth",
    depthHalf: "/bts/stage/night-depth-1000",
  },
  day: {
    back: "/bts/stage/day-back",
    backHalf: "/bts/stage/day-back-1000",
    mid: "/bts/stage/day-mid",
    midHalf: "/bts/stage/day-mid-1000",
    beams: "/bts/stage/day-beams",
    beamsHalf: "/bts/stage/day-beams-1000",
    front: "/bts/stage/day-front",
    frontHalf: "/bts/stage/day-front-1000",
    depth: "/bts/stage/day-depth",
    depthHalf: "/bts/stage/day-depth-1000",
  },
} as const;
```

Add these extensionless entries to the existing `AVIF` set when integrating:

```ts
  "/bts/stage/night-back",
  "/bts/stage/night-back-1000",
  "/bts/stage/night-mid",
  "/bts/stage/night-mid-1000",
  "/bts/stage/night-beams",
  "/bts/stage/night-beams-1000",
  "/bts/stage/night-front",
  "/bts/stage/night-front-1000",
  "/bts/stage/night-depth",
  "/bts/stage/night-depth-1000",
  "/bts/stage/day-back",
  "/bts/stage/day-back-1000",
  "/bts/stage/day-mid",
  "/bts/stage/day-mid-1000",
  "/bts/stage/day-beams",
  "/bts/stage/day-beams-1000",
  "/bts/stage/day-front",
  "/bts/stage/day-front-1000",
  "/bts/stage/day-depth",
  "/bts/stage/day-depth-1000",
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
