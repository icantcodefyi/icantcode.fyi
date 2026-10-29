# Recent Work art handoff — IMG-01 through IMG-04

28 delivery files are in `apps/web/public/site/scenes/`. **Full AVIF per mode: night 318.67 KB; day 320.61 KB**, including depth (budget 445 KB). KB here means 1024 bytes. Half files are alternatives, not extra required transfers.

## Integration correction

**Use atlas 1173×921, not the plan's 1173×918.** The specified girl tile ends at y701, and the specified flower tile is 220px tall: 701 + 220 = 921. All three requested tile rectangles are preserved without cropping. Normalize UVs using the actual 921px height. Each mode's atlas is already half resolution; do not request another half-size atlas.

| Tile | Pixel rectangle `[x,y,w,h]` | Normalized rectangle (top-left origin) |
|---|---|---|
| sky | `[0,0,612,918]` | `[0,0,0.521739130,0.996742671]` |
| girl | `[612,0,561,701]` | `[0.521739130,0,0.478260870,0.761129207]` |
| flowers | `[612,701,561,220]` | `[0.521739130,0.761129207,0.478260870,0.238870793]` |

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
export const WORK_ART = {
  night: {
    sky: "/site/scenes/work-sky-night",
    girl: "/site/scenes/work-girl-night",
    flowers: "/site/scenes/work-flowers-night",
    depth: "/site/scenes/work-depth-night",
    skyHalf: "/site/scenes/work-sky-night-half",
    girlHalf: "/site/scenes/work-girl-night-half",
    flowersHalf: "/site/scenes/work-flowers-night-half",
  },
  day: {
    sky: "/site/scenes/work-sky-day",
    girl: "/site/scenes/work-girl-day",
    flowers: "/site/scenes/work-flowers-day",
    depth: "/site/scenes/work-depth-day",
    skyHalf: "/site/scenes/work-sky-day-half",
    girlHalf: "/site/scenes/work-girl-day-half",
    flowersHalf: "/site/scenes/work-flowers-day-half",
  },
  size: [1224, 1836],
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
} as const;
```

Exact entries to append inside the existing `AVIF` Set:

```ts
  "/site/scenes/work-depth-day",
  "/site/scenes/work-depth-night",
  "/site/scenes/work-flowers-day",
  "/site/scenes/work-flowers-day-half",
  "/site/scenes/work-flowers-night",
  "/site/scenes/work-flowers-night-half",
  "/site/scenes/work-girl-day",
  "/site/scenes/work-girl-day-half",
  "/site/scenes/work-girl-night",
  "/site/scenes/work-girl-night-half",
  "/site/scenes/work-sky-day",
  "/site/scenes/work-sky-day-half",
  "/site/scenes/work-sky-night",
  "/site/scenes/work-sky-night-half",
```

For `halfSet`, use `art(WORK_ART[mode].sky)` with width1224 and `art(WORK_ART[mode].skyHalf)` with width612; girl1122/561; flowers1122/561. The `layers` offsets are always full-stage pixels, even when a half texture is selected.

## Delivery files

| File | Pixels | KB | Encoding |
|---|---|---:|---|
| `work-sky-night.avif` | 1224×1836 | 210.11 | AVIF q54 |
| `work-sky-night.webp` | 1224×1836 | 376.56 | WebP q84 / alpha100 |
| `work-sky-night-half.avif` | 612×918 | 90.74 | AVIF q60 |
| `work-sky-night-half.webp` | 612×918 | 137.67 | WebP q84 / alpha100 |
| `work-girl-night.avif` | 1122×1402 | 77.29 | AVIF q60 |
| `work-girl-night.webp` | 1122×1402 | 122.36 | WebP q84 / alpha100 |
| `work-girl-night-half.avif` | 561×701 | 38.71 | AVIF q60 |
| `work-girl-night-half.webp` | 561×701 | 60.18 | WebP q84 / alpha100 |
| `work-flowers-night.avif` | 1122×440 | 8.77 | AVIF q60 |
| `work-flowers-night.webp` | 1122×440 | 17.36 | WebP q84 / alpha100 |
| `work-flowers-night-half.avif` | 561×220 | 4.76 | AVIF q60 |
| `work-flowers-night-half.webp` | 561×220 | 8.62 | WebP q84 / alpha100 |
| `work-depth-night.avif` | 1173×921 | 22.50 | AVIF q85 |
| `work-depth-night.webp` | 1173×921 | 103.59 | WebP lossless |
| `work-sky-day.avif` | 1224×1836 | 210.71 | AVIF q58 |
| `work-sky-day.webp` | 1224×1836 | 346.13 | WebP q84 / alpha100 |
| `work-sky-day-half.avif` | 612×918 | 79.99 | AVIF q60 |
| `work-sky-day-half.webp` | 612×918 | 126.29 | WebP q84 / alpha100 |
| `work-girl-day.avif` | 1122×1402 | 79.16 | AVIF q60 |
| `work-girl-day.webp` | 1122×1402 | 123.16 | WebP q84 / alpha100 |
| `work-girl-day-half.avif` | 561×701 | 39.19 | AVIF q60 |
| `work-girl-day-half.webp` | 561×701 | 60.86 | WebP q84 / alpha100 |
| `work-flowers-day.avif` | 1122×440 | 9.68 | AVIF q60 |
| `work-flowers-day.webp` | 1122×440 | 19.13 | WebP q84 / alpha100 |
| `work-flowers-day-half.avif` | 561×220 | 5.22 | AVIF q60 |
| `work-flowers-day-half.webp` | 561×220 | 9.61 | WebP q84 / alpha100 |
| `work-depth-day.avif` | 1173×921 | 21.06 | AVIF q85 |
| `work-depth-day.webp` | 1173×921 | 95.86 | WebP lossless |

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
