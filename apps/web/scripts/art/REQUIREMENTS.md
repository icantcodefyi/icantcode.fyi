# Local art tools

Shared tools copied byte-for-byte from `/tmp/hero-art/*.py` and `/tmp/hero-depth/build.py` on 2026-10-29. These retain the original hero-specific paths and are reference tools; job-specific entrypoints live in `work/`, `seams/`, and `finale/`. Do not run the hero entrypoints to rebuild Work.

The existing environment remains at `/tmp/hero-art/venv`; no environment or weights are committed. Original pinned dependencies: `requirements-hero.txt`. Depth: `depth-anything/Depth-Anything-V2-Base-hf` with PyTorch MPS, HF cache `/tmp/hero-art/hf-cache`.

Work adds local `rembg[cpu]` (isnet-anime ONNX segmentation) and `realesrgan` (Real-ESRGAN x4plus_anime_6B). Staging and previews: `/tmp/art-work`. Reproduction commands and validation are in `work/MANIFEST.md`.
