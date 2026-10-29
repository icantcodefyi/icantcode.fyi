/**
 * The site's motion tokens: one source of truth, mirrored as CSS custom
 * properties in site.css (:root). Change a value in both places.
 */

/** Easing curves as CSS strings (--ease, --ease-io, --ease-in, --ease-pop). */
export const EASE = {
  /** settle: entrances, hovers, camera arrivals */
  settle: "cubic-bezier(0.22, 1, 0.36, 1)",
  /** crossfades: mode, world and element swaps, the portal wash */
  io: "cubic-bezier(0.65, 0, 0.35, 1)",
  /** exits only (the portal wash closing in) */
  in: "cubic-bezier(0.55, 0, 1, 0.45)",
  /** tiny pops only: toggle knob, SFX, pins, medals */
  pop: "cubic-bezier(0.34, 1.32, 0.5, 1)",
} as const;

/** Durations in ms (--dur-*). */
export const DUR = {
  micro: 160, // press, colour hover
  short: 320, // hover transforms, labels
  in: 700, // text entrances ([data-reveal])
  scene: 1100, // mode crossfade, art swaps (the hero's MODE_FADE)
  arrive: 1400, // relief easing in, camera arrival (the hero's RELIEF_IN)
  portalIn: 520,
  portalOut: 420,
} as const;

/** Sibling stagger (--stagger), at most STAGGER_STEPS steps. */
export const STAGGER = 70;
export const STAGGER_STEPS = 5;
/** Text entrance distance in px (--rise). */
export const RISE = 24;

/** `--d` for the i-th sibling: `style={{ "--d": delay(i) }}`. */
export const delay = (i: number, base = 0) => `${base + Math.min(i, STAGGER_STEPS) * STAGGER}ms`;

/** Damping rates per second, the hero's: `cur += (goal - cur) * damp(rate, dt)`. */
export const DAMP = { scroll: 9.5, pointer: 4.5, breathIn: 0.7, breathOut: 3 } as const;
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const clamp01 = (x: number) => clamp(x, 0, 1);
/** Smoothstep of `x` between `a` and `b`. */
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** A CSS cubic-bezier as a JS easing function (x → y on 0..1). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (u: number) => ((ax * u + bx) * u + cx) * u;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // bisection: x(u) is monotonic for every curve above, and 20 steps is sub-pixel
    let lo = 0;
    let hi = 1;
    let u = x;
    for (let i = 0; i < 20; i++) {
      if (sx(u) < x) lo = u;
      else hi = u;
      u = (lo + hi) / 2;
    }
    return ((ay * u + by) * u + cy) * u;
  };
}

/** The curves above as JS easings, for rAF-driven motion. */
export const ease = {
  settle: cubicBezier(0.22, 1, 0.36, 1),
  io: cubicBezier(0.65, 0, 0.35, 1),
  in: cubicBezier(0.55, 0, 1, 0.45),
  pop: cubicBezier(0.34, 1.32, 0.5, 1),
} as const;

/** Sections breathe at this fraction of the hero's breath. */
export const BREATH = 0.6;

const TAU = Math.PI * 2;

/**
 * The hero's idle breath (hero/rig.ts `eye()`), at full amplitude: an eye
 * offset in world units. Incommensurate periods (13.7 / 5.9 / 10.3 / 17.9 s)
 * so it never visibly loops. Scale it by BREATH (or a CameraSpec's breath).
 */
export function breath(t: number) {
  return {
    x: Math.sin((t * TAU) / 13.7) * 0.05 + Math.sin((t * TAU) / 5.9 + 1.1) * 0.012,
    y: Math.sin((t * TAU) / 10.3 + 0.6) * 0.028,
    z: Math.sin((t * TAU) / 17.9 + 2.3) * 0.12,
  };
}

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const finePointer = () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
