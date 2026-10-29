/**
 * The page's ink, as deterministic geometry: hand-ruled balloons, focus
 * lines, SFX glyph placement and their motion trails, and the colour tables
 * that separate a poster into two riso plates.
 */

export type Pt = [number, number];

export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const f = (n: number) => Math.round(n * 10) / 10;

function smoothPath(pts: Pt[], corners: Set<number>) {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = corners.has(i) ? p1 : [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = corners.has((i + 1) % n) ? p2 : [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

/** Balloons are drawn in a 300 × 180 box and stretched to their text. */
export const BW = 300;
export const BH = 180;
const BC: Pt = [150, 90];

function offsetOutline(pts: Pt[], widths: number[]): Pt[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    let nx = b[1] - a[1];
    let ny = -(b[0] - a[0]);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    if (nx * (p[0] - BC[0]) + ny * (p[1] - BC[1]) < 0) {
      nx = -nx;
      ny = -ny;
    }
    return [p[0] + nx * widths[i], p[1] + ny * widths[i]];
  });
}

/**
 * A speech balloon as a pen would ink it: the line swells on the lower
 * right (the pen's pressure side) and thins to a point at the tail.
 * `tailDeg`: 0 is right, 90 down. `inner` is the paper, `ring` the ink.
 */
export function bubbleGeometry(seed: number, kind: "round" | "burst", tailDeg: number) {
  const r = rng(seed);
  const ta = (tailDeg * Math.PI) / 180;
  const rx = 142;
  const ry = 84;
  const ink = (a: number) => 2.2 + 3.4 * (0.5 + 0.5 * Math.cos(a - Math.PI / 4)) + r() * 0.6;
  const pts: Pt[] = [];
  const widths: number[] = [];
  const corners = new Set<number>();
  let tip: Pt;

  if (kind === "round") {
    const s1 = r() * 6;
    const s2 = r() * 6;
    const wob = (a: number) => 1 + 0.02 * Math.sin(3 * a + s1) + 0.012 * Math.sin(5 * a + s2);
    const at = (a: number): Pt => [BC[0] + rx * wob(a) * Math.cos(a), BC[1] + ry * wob(a) * Math.sin(a)];
    const a0 = ta - 0.24;
    const a1 = ta + 0.13;
    const steps = 44;
    for (let i = 0; i < steps; i++) {
      const a = a1 + ((2 * Math.PI - (a1 - a0)) * i) / steps;
      pts.push(at(a));
      widths.push(ink(a));
    }
    const b0 = at(a0);
    const b1 = at(a1);
    tip = [BC[0] + rx * 1.42 * Math.cos(ta + 0.1), BC[1] + ry * 1.78 * Math.sin(ta + 0.1)];
    const bend = (p: Pt, q: Pt, k: number): Pt => {
      const mx = (p[0] + q[0]) / 2;
      const my = (p[1] + q[1]) / 2;
      return [mx - (q[1] - p[1]) * k, my + (q[0] - p[0]) * k];
    };
    pts.push(b0, bend(b0, tip, 0.12));
    widths.push(ink(a0), 2.4);
    corners.add(pts.length);
    pts.push(tip, bend(tip, b1, 0.1));
    widths.push(0.7, 1.8);
  } else {
    const spikes = 17;
    let longest = 0;
    let best = Infinity;
    for (let i = 0; i < spikes; i++) {
      const a = (2 * Math.PI * i) / spikes;
      const diff = Math.abs(Math.atan2(Math.sin(a - ta), Math.cos(a - ta)));
      if (diff < best) {
        best = diff;
        longest = i;
      }
    }
    tip = BC;
    for (let i = 0; i < spikes; i++) {
      const a = (2 * Math.PI * i) / spikes + (r() - 0.5) * 0.12;
      const reach = i === longest ? 1.4 : 1.02 + r() * 0.12;
      const p: Pt = [BC[0] + rx * reach * Math.cos(a), BC[1] + ry * reach * Math.sin(a)];
      if (i === longest) tip = p;
      corners.add(pts.length);
      pts.push(p);
      widths.push(ink(a) * 0.8);
      const m = a + Math.PI / spikes + (r() - 0.5) * 0.08;
      const dip = 0.8 + r() * 0.05;
      corners.add(pts.length);
      pts.push([BC[0] + rx * dip * Math.cos(m), BC[1] + ry * dip * Math.sin(m)]);
      widths.push(ink(m));
    }
  }

  const outer = offsetOutline(pts, widths);
  const inner = smoothPath(pts, corners);
  // the pop grows from the tail's tip, as % of the box
  const origin = `${f((tip[0] / BW) * 100)}% ${f((tip[1] / BH) * 100)}%`;
  return { inner, ring: `${smoothPath(outer, corners)}${inner}`, origin };
}

/** Radial focus lines (集中線) around a 400 × 300 box's centre: tapered wedges, a clear eye in the middle. */
export function focusLines(seed: number, count = 150) {
  const r = rng(seed);
  const cx = 200;
  const cy = 150;
  const R = 540;
  let d = "";
  for (let i = 0; i < count; i++) {
    const a = (2 * Math.PI * i) / count + (r() - 0.5) * 0.045;
    const w = 0.004 + r() * r() * 0.034;
    const rin = r() < 0.2 ? 48 + r() * 30 : 82 + r() * 96;
    d += `M${f(cx + rin * Math.cos(a))} ${f(cy + rin * Math.sin(a))}L${f(cx + R * Math.cos(a - w))} ${f(cy + R * Math.sin(a - w))}L${f(cx + R * Math.cos(a + w))} ${f(cy + R * Math.sin(a + w))}Z`;
  }
  return d;
}

/**
 * Motion lines (流線) for an SFX, in a 100 × 200 box whose top half is the
 * SFX's own: tapered vertical strokes that trail below it, longest at the
 * middle, as if it had just been flung upward. (Flipped, they trail above.)
 */
export function trailLines(seed: number, n = 12) {
  const r = rng(seed);
  let d = "";
  for (let i = 0; i < n; i++) {
    const x = 6 + (88 * (i + r() * 0.6)) / n;
    const mid = 1 - Math.abs(x - 50) / 56;
    const len = 22 + mid * 40 + r() * 18;
    const w = 0.6 + r() * 1.2;
    const y0 = 86 + r() * 8;
    // a wedge: blunt at the lettering, a hairline at the far end
    d += `M${f(x - w)} ${f(y0)}L${f(x + w)} ${f(y0)}L${f(x)} ${f(y0 + len)}Z`;
  }
  return d;
}

export interface Glyph {
  c: string;
  /** placement transform in the SFX's 100-unit grid */
  t: string;
  /** its centre in that grid */
  x: number;
  y: number;
}

/** SFX lettering: katakana thrown down at hand-set angles, a hair off size from each other. */
export function sfxGlyphs(text: string, vertical?: boolean) {
  const chars = [...text];
  const r = rng(text.length * 97 + text.charCodeAt(0));
  const w = vertical ? 140 : chars.length * 100 + 40;
  const h = vertical ? chars.length * 100 + 40 : 140;
  const glyphs: Glyph[] = chars.map((c, i) => {
    const x = vertical ? 70 : 70 + i * 100;
    const y = vertical ? 70 + i * 100 : 70;
    const rot = (r() - 0.5) * 16 + (vertical && c === "ー" ? 90 : 0);
    const s = 0.9 + r() * 0.24;
    return { c, t: `translate(${x} ${y}) rotate(${f(rot)}) scale(${f(s * 100) / 100})`, x, y };
  });
  return { glyphs, w, h };
}

/* ── Riso separations ──
 * Each poster prints as two plates through SVG colour filters: luminance,
 * then a table per channel. By day the base plate is black ink on paper
 * and the spot plate multiplies blue over it; by night the base is white
 * ink on black stock and the spot plate screens blue under it. */

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export interface Separation {
  id: string;
  /** levels: luminance mapped from lo..hi onto 0..1 */
  lo: number;
  hi: number;
  /** ink coverage for luminance 0..1 */
  cover: (l: number) => number;
  /** plate colour at no coverage and at full */
  from: string;
  to: string;
}

export const INK = { ink: "#0b0a0d", paper: "#fbfaf6", stock: "#111014", white: "#ecebe4", spot: "#0078bf" } as const;

export const SEPARATIONS: Separation[] = [
  { id: "an-sep-k-day", lo: 0.04, hi: 0.92, cover: (l) => 1 - smooth(0, 0.4, l), from: INK.paper, to: INK.ink },
  { id: "an-sep-b-day", lo: 0.04, hi: 0.92, cover: (l) => 1 - smooth(0.3, 0.84, l), from: "#ffffff", to: INK.spot },
  { id: "an-sep-k-night", lo: 0.04, hi: 0.92, cover: (l) => smooth(0.46, 0.88, l), from: INK.stock, to: INK.white },
  { id: "an-sep-b-night", lo: 0.04, hi: 0.92, cover: (l) => smooth(0.06, 0.42, l), from: "#000000", to: INK.spot },
];

/** feColorMatrix values and feComponentTransfer tables for one separation. */
export function separation(s: Separation, samples = 17) {
  const k = 1 / (s.hi - s.lo);
  const o = -s.lo * k;
  const row = `${f3(0.2126 * k)} ${f3(0.7152 * k)} ${f3(0.0722 * k)} 0 ${f3(o)}`;
  const matrix = `${row} ${row} ${row} 0 0 0 1 0`;
  const a = hex(s.from);
  const b = hex(s.to);
  const tables = [0, 1, 2].map((ch) =>
    Array.from({ length: samples }, (_, i) => {
      const c = s.cover(i / (samples - 1));
      return f3(a[ch] + (b[ch] - a[ch]) * c);
    }).join(" "),
  );
  return { matrix, tables };
}

function f3(n: number) {
  return (Math.round(n * 1000) / 1000).toString();
}
