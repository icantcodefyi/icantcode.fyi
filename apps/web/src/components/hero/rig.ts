/**
 * One camera for the whole hero. Every layer, DOM or WebGL, is a picture at
 * some distance from the eye; moving the eye shifts and scales each picture
 * by that distance, so the name, the painted plates and the petals all agree
 * on where things are.
 *
 * World units are the petal field's: the eye rests at z = EYE looking down
 * -z. An `Eye` is the offset from that rest pose in screen axes: x right,
 * y down, z forward (into the painting).
 */

export const EYE = 14;

export interface Eye {
  x: number;
  y: number;
  z: number;
}

export interface Lens {
  /** stage size, css px */
  w: number;
  h: number;
  /** focal length, css px per world unit at distance 1 */
  f: number;
  /** principal point (where the dive heads), css px */
  vx: number;
  vy: number;
  fov: number;
}

/**
 * Distance from the resting eye for each depth-map value: black → `far`,
 * white → `near`, interpolated in 1/distance (as a lens sees it). `flat` is
 * the single distance the plain <img> plate uses, and what the WebGL plate
 * starts from before its relief eases in.
 */
export const PLATE = {
  sky: { far: 500, near: 28, flat: 120 },
  char: { far: 14, near: 12.2, flat: 13.1 },
  hill: { far: 12, near: 4.2, flat: 7.5 },
} as const;
export type PlateName = keyof typeof PLATE;

/** The name sits just behind her. */
export const NAME_DEPTH = 14.4;

/** How far the eye travels into the scene over the hero's first screen of scroll. */
const DIVE = 9;

export function lens(w: number, h: number): Lens {
  // tall phones widen the vertical fov so the petal volume stays framed, and
  // aim the dive left of her (she stands near the middle there) so she passes on the right
  const tall = w / h < 0.8;
  const fov = tall ? 52 : 38;
  const f = h / 2 / Math.tan((fov * Math.PI) / 360);
  return { w, h, f, vx: w * (tall ? 0.36 : 0.5), vy: h * 0.46, fov };
}

const TAU = Math.PI * 2;

/**
 * pointer `mx`/`my` (-1..1), dive progress `p` (0..1), idle weight (0..1)
 * and time in seconds → eye offset.
 */
export function eye(mx: number, my: number, p: number, idle: number, t: number): Eye {
  // a slow, uneven breath: incommensurate periods so it never visibly loops
  const bx = Math.sin((t * TAU) / 13.7) * 0.05 + Math.sin((t * TAU) / 5.9 + 1.1) * 0.012;
  const by = Math.sin((t * TAU) / 10.3 + 0.6) * 0.028;
  const bz = Math.sin((t * TAU) / 17.9 + 2.3) * 0.12;
  // eases out: the first stretch of scroll moves furthest, while the whole scene is in view
  const dive = p * (1.5 - 0.5 * p);
  return {
    x: mx * 0.26 + bx * idle,
    y: my * 0.12 + by * idle - dive * 0.35,
    z: dive * DIVE + bz * idle,
  };
}

/**
 * CSS transform for a flat layer at distance `d`. `ox`/`oy` is the layer's
 * transform-origin minus the principal point (stage px) and `base` the scale
 * the layer rests at, so the result equals the stylesheet's transform when
 * the eye is at rest.
 */
export function place(d: number, e: Eye, l: Lens, ox: number, oy: number, base: number) {
  const z = Math.max(0.35, d - e.z);
  const k = d / z;
  const tx = (-l.f * e.x) / z + (k - 1) * ox;
  const ty = (-l.f * e.y) / z + (k - 1) * oy;
  return `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${(k * base).toFixed(5)})`;
}
