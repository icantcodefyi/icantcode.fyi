import type { Mode } from "@/lib/mode";

export type { Mode };

/**
 * One painted layer of a <DepthStage>. Every field is honoured by the GL
 * backend; the DOM backend (the first paint and the fallback) places the
 * plate's <img> as a flat card at `range.flat`.
 *
 * GL plates are drawn in paint order (z, then array order) on as few
 * canvases (WebGL contexts) as the stage allows: a new one only where a DOM
 * child or a `backend: "dom"` plate paints between two of them, read from
 * the computed z-index when the stage comes near.
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
  /** GL mesh cells [cols, rows]; default about one cell per 4 css px of the plate, long side ≤ 288 */
  grid?: [number, number];
  /** GL overscan as fractions of the plate [top, right, bottom, left] */
  pad?: [number, number, number, number];
  /**
   * Feathered edges: fractions of the plate [top, right, bottom, left] over
   * which it fades out to that edge, a linear ramp like a CSS mask gradient.
   * Both backends draw it the same; a CSS mask, filter or opacity on the
   * plate's <img> is invisible to GL, so use this instead.
   */
  fade?: [number, number, number, number];
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

/**
 * Ambient sprites drawn inside the painting (GL backend only; the DOM
 * backend ignores them): petals tumbling down on a breeze, or motes (soft
 * points of light that wander and twinkle: fireflies at night, sun motes by
 * day). They are drawn right after the last plate of their canvas that
 * reaches as far back as `depth[0]`, depth-tested against it (so they pass
 * behind its nearer parts) and painted over by the plates after it.
 */
export interface AmbientSpec {
  kind: "petals" | "motes";
  /** ≤ 40 */
  count: number;
  /** [near, far] world units the sprites live between */
  depth: [number, number];
  /** where they live, % of the stage box. Default: all of it. */
  area?: { x: number; y: number; w: number; h: number };
  /** areas to keep clear (faces, panes, screenshots), % of the stage box; up to 8, feathered */
  mask?: { x: number; y: number; w: number; h: number }[];
  /** the canvas to draw in: the one holding the GL plates with this `z`. Default: the lowest. */
  z?: number;
  /** peak opacity, ≤ 0.8 (the default) */
  opacity?: number;
  /** CSS hex per mode, instead of the kind's own palette */
  color?: Record<Mode, string>;
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

interface SeamLayers {
  back: string;
  front: string;
}

/** The two painted layers of a <Seam> (components/seam.tsx). */
export interface SeamArt {
  /** base paths for art(); omit `day` to use the night layers in both modes */
  night: SeamLayers;
  day?: SeamLayers;
  /** half-width files, same shape, offered to 1x screens through halfSet() */
  half?: { night: SeamLayers; day?: SeamLayers };
  /** natural px, shared by both layers */
  size: [number, number];
}
