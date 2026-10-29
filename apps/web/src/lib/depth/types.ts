import type { Mode } from "@/lib/mode";

export type { Mode };

/**
 * One painted layer of a <DepthStage>. Every field is honoured by the GL
 * backend; the DOM backend (the fallback, and all there is until GL lands)
 * places the plate's <img> as a flat card at `range.flat`.
 */
export interface PlateSpec {
  /** "sky" | "girl" | "flowers" | ... (unique within the stage) */
  id: string;
  /** base paths for art(), e.g. "/site/scenes/work-sky-night"; the same path twice for a single set */
  art: Record<Mode, string>;
  /** natural px */
  size: [number, number];
  /** % of the stage box; the height follows from `size` */
  box: { x: number; y: number; w: number };
  /** opaque: GL mirrors a pad past the edges; cutout: GL discards alpha < 0.004 */
  kind: "opaque" | "cutout";
  /** world units, hero/rig.ts convention: depth black → far, white → near; `flat` is the plain <img>'s distance */
  range: { far: number; near: number; flat: number };
  /** depth atlas (base paths for art()) and this plate's tile in it, px [x, y, w, h]; omit for a flat card at `flat` */
  depth?: { atlas: Record<Mode, string>; tile: [number, number, number, number] };
  /** GL mesh cells; default by area, ≤ 288×192 */
  grid?: [number, number];
  /** GL overscan as fractions of the plate [top, right, bottom, left] */
  pad?: [number, number, number, number];
  /** "dom" keeps the plate a CSS-placed <img> even when the stage runs GL, so it can interleave with DOM layers. Default "gl". */
  backend?: "gl" | "dom";
  /** stacking order within the stage (z-index) */
  z: number;
  /** half-size files (base paths for art()) offered to 1x screens through halfSet() */
  half?: Record<Mode, string>;
}

export interface CameraSpec {
  /** d0: the distance that moves 1:1 with the page. Default 13 (the focus plane). */
  focus?: number;
  /** k in the parallax law: main stage 0.15 (default), seams 0.2, worlds 0.08 (see STRENGTH) */
  strength?: number;
  /** × the hero's pointer gain. Default 0.5; always 0 on touch. */
  pointer?: number;
  /** × the hero's breath. Default 0.6 (BREATH); 0 turns it off. */
  breath?: number;
  /** the eye eases from z forward to 0 over ms the first time the stage is ≥ 15% visible. Default { z: 0.6, ms: 1400 }; z: 0 turns it off. */
  arrival?: { z: number; ms: number };
}

/** Ambient sprites drawn inside the painting (GL backend only; the DOM backend ignores them). */
export interface AmbientSpec {
  kind: "petals" | "motes";
  /** ≤ 40 */
  count: number;
  /** world-unit range the sprites live in */
  depth: [number, number];
  /** areas to keep clear (faces, panes, screenshots), % of the stage box */
  mask?: { x: number; y: number; w: number; h: number }[];
}

export interface StageSpec {
  /** unique per stage (arrival is once per visit per id) */
  id: string;
  plates: PlateSpec[];
  camera?: CameraSpec;
  ambient?: AmbientSpec[];
  /** GL device-pixel-ratio caps. Default { desktop: 1.5, phone: 2 }. */
  dpr?: { desktop: number; phone: number };
}
