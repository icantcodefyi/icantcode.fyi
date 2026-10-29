import { BREATH, breath } from "@/lib/motion";
import type { CameraSpec } from "./types";

/**
 * The site camera: hero/rig.ts generalised from the hero's stage to the
 * whole page. Same units: layers are pictures at distance d from an eye
 * looking down -z, and moving the eye shifts each by f·e/d. Every section
 * uses the viewport's lens, so the same eye motion gives the same pixel
 * parallax everywhere.
 */

export interface Eye {
  x: number;
  y: number;
  z: number;
}

export interface Lens {
  /** viewport, css px */
  w: number;
  h: number;
  /** focal length, css px per world unit at distance 1 */
  f: number;
  /** principal point: the viewport's centre */
  vx: number;
  vy: number;
  fov: number;
}

/** The eye's resting distance from the scene, as in the hero. */
export const EYE = 14;
/** The focus plane (character / copy): moves 1:1 with the page. */
export const FOCUS = 13;

/** Distance vocabulary, world units. DOM layers never go nearer than `min`. */
export const DEPTH = {
  farSky: [80, 300],
  backdrop: [16, 30],
  focus: FOCUS,
  near: [8, 11],
  foreground: [6, 8],
  min: 6,
} as const;

/** Parallax strength k per kind of section. */
export const STRENGTH = { main: 0.15, seam: 0.2, world: 0.08 } as const;

/** No layer drifts further than this from its section, css px (size overscan from it). */
export const OFFSET_CAP = 160;

/** The hero's pointer gains (rig.ts `eye()`); sections scale them by CameraSpec.pointer. */
const POINTER = { x: 0.26, y: 0.12 };

export type Camera = Required<CameraSpec>;

export function camera(spec: CameraSpec = {}): Camera {
  return {
    focus: spec.focus ?? FOCUS,
    strength: spec.strength ?? STRENGTH.main,
    pointer: spec.pointer ?? 0.5,
    breath: spec.breath ?? BREATH,
    arrival: spec.arrival ?? { z: 0.6, ms: 1400 },
  };
}

/** The hero's lens on the viewport: fov 38° (52° on tall screens), centred. */
export function siteLens(w: number, h: number): Lens {
  const fov = w / h < 0.8 ? 52 : 38;
  return { w, h, f: h / 2 / Math.tan((fov * Math.PI) / 360), vx: w / 2, vy: h / 2, fov };
}

/** px of drift per px of `s` for a layer at distance d: k·(1 − d0/d). */
export const reach = (cam: Camera, d: number) => cam.strength * (1 - cam.focus / d);

/**
 * The eye for a section: pointer `mx`/`my` (-1..1), the breath at time `t`
 * weighted by `idle` (0..1), the arrival's forward offset `z`, and the
 * section's scroll offset `s` (scroll-loop Frame.s).
 */
export function eyeFor(cam: Camera, l: Lens, i: { mx: number; my: number; t: number; idle: number; z: number; s: number }): Eye {
  const b = breath(i.t);
  const w = cam.breath * i.idle;
  return {
    x: i.mx * POINTER.x * cam.pointer + b.x * w,
    y: i.my * POINTER.y * cam.pointer + b.y * w + (cam.strength * i.s * cam.focus) / l.f,
    z: i.z + b.z * w,
  };
}

/**
 * The view offset (css px, down) that pins the focus plane to its section
 * while the scroll term of the eye moves: with it, a layer at distance d
 * drifts k·s·(1 − d0/d) and the focus plane not at all.
 */
export const viewOffset = (cam: Camera, s: number, e: Eye) => (cam.strength * s * cam.focus) / Math.max(0.35, cam.focus - e.z);

/**
 * Where a flat layer at distance d lands for eye `e`: a translate (css px)
 * and a scale about its transform-origin. `ox`/`oy` is that origin's
 * on-screen offset from the principal point and `pin` the viewOffset().
 */
export function place(d: number, e: Eye, l: Lens, ox: number, oy: number, pin: number) {
  const z = Math.max(0.35, d - e.z);
  const k = d / z;
  return { x: (-l.f * e.x) / z + (k - 1) * ox, y: (-l.f * e.y) / z + (k - 1) * oy + pin, s: k };
}
