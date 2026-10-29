/**
 * The manga page, laid out the way a mangaka rules one: each page's live
 * area is cut into panels by straight gutters (some slanted), the gutters
 * between tiers about twice as wide as the ones between panels side by
 * side, as in Japanese tankōbon. Templates are drawn in live-area widths
 * (x 0..1, y 0..h); `layout()` turns one into px for a given container
 * width: a two-page spread on desktop, stacked pages on tablets, and on
 * phones a strip of full-width tiers.
 */

export type Pt = [number, number];
type Quad = [Pt, Pt, Pt, Pt]; // TL, TR, BR, BL, clockwise on screen

export type PanelId = "title" | "hxh" | "mob" | "sg" | "bebop" | "frieren" | "jjk";
export type Kind = "spread" | "pages" | "strip";

interface Template {
  /** live-area height in live-area widths */
  h: number;
  panels: { id: PanelId; quad: Quad }[];
}

/** Page templates (tablet and desktop): both pages share one height. */
const PAGE_H = 1.5;

const PAGE_TEMPLATES: Template[] = [
  {
    h: PAGE_H,
    panels: [
      // the chapter splash, its foot cut on a fall to the left
      { id: "title", quad: [[0, 0], [1, 0], [1, 0.5], [0, 0.58]] },
      { id: "hxh", quad: [[0, 0.58], [0.53, 0.5376], [0.48, PAGE_H], [0, PAGE_H]] },
      { id: "mob", quad: [[0.53, 0.5376], [1, 0.5], [1, PAGE_H], [0.48, PAGE_H]] },
    ],
  },
  {
    h: PAGE_H,
    panels: [
      { id: "bebop", quad: [[0, 0], [1, 0], [1, 0.42], [0, 0.46]] },
      // the page's one hard diagonal: Steins;Gate and Frieren split on a steep cut
      { id: "sg", quad: [[0, 0.46], [0.58, 0.4368], [0.44, 1.0576], [0, 1.04]] },
      { id: "frieren", quad: [[0.58, 0.4368], [1, 0.42], [1, 1.08], [0.44, 1.0576]] },
      { id: "jjk", quad: [[0, 1.04], [1, 1.08], [1, PAGE_H], [0, PAGE_H]] },
    ],
  },
];

/** Phone: the same two pages as strips of full-width tiers, cut on alternating slants. */
function strip(tiers: [PanelId, number][], slopes: number[]): Template {
  let y = 0;
  const lines: { y: number; s: number }[] = [{ y: 0, s: 0 }];
  tiers.forEach(([, h], i) => {
    y += h;
    lines.push({ y, s: i < tiers.length - 1 ? slopes[i] : 0 });
  });
  const at = (l: { y: number; s: number }, x: number) => l.y + l.s * (x - 0.5);
  return {
    h: y,
    panels: tiers.map(([id], i) => {
      const a = lines[i];
      const b = lines[i + 1];
      return { id, quad: [[0, at(a, 0)], [1, at(a, 1)], [1, at(b, 1)], [0, at(b, 0)]] };
    }),
  };
}

/** The widest strip whose tiers keep their phone proportions, px. */
const STRIP_DEEP = 440;

const STRIP_TEMPLATES: Template[] = [
  strip([["title", 0.98], ["hxh", 1.24], ["mob", 1.18]], [-0.07, 0.06]),
  strip([["bebop", 0.9], ["sg", 1.0], ["frieren", 0.96], ["jjk", 1.1]], [0.06, -0.08, 0.05]),
];

export interface PanelBox {
  id: PanelId;
  /** box in px, relative to the spread container */
  x: number;
  y: number;
  w: number;
  h: number;
  /** the inked frame's corners, px relative to the box (TL, TR, BR, BL) */
  quad: Quad;
  /** which edges lie on the page's live-area boundary (edge i runs corner i → i+1) */
  outer: boolean[];
  /** px of page margin beyond each edge (top, right, bottom, left): 0 where a gutter is */
  room: [number, number, number, number];
  page: number;
}

export interface PageBox {
  n: number;
  side: "l" | "r";
  x: number;
  y: number;
  w: number;
  h: number;
  /** live area, relative to the page */
  live: { x: number; y: number; w: number; h: number };
}

export interface Layout {
  kind: Kind;
  w: number;
  h: number;
  pages: PageBox[];
  panels: PanelBox[];
  /** stroke of the frames, px */
  stroke: number;
}

/** The first page's folio: the watchlist sits mid-volume. */
const FIRST_FOLIO = 112;

function intersect(p1: Pt, d1: Pt, p2: Pt, d2: Pt): Pt {
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-9) return p2;
  const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den;
  return [p1[0] + d1[0] * t, p1[1] + d1[1] * t];
}

/** Move each edge of `q` inward by `by(i)` px and re-meet the corners. */
function inset(q: Quad, by: (i: number) => number): Quad {
  const lines = q.map((p, i) => {
    const n = q[(i + 1) % 4];
    const dx = n[0] - p[0];
    const dy = n[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    // clockwise on a y-down screen: the inside is to the right of travel
    const o = by(i);
    return { p: [p[0] - (dy / len) * o, p[1] + (dx / len) * o] as Pt, d: [dx, dy] as Pt };
  });
  return q.map((_, i) => {
    const a = lines[(i + 3) % 4];
    const b = lines[i];
    return intersect(a.p, a.d, b.p, b.d);
  }) as Quad;
}

interface Metrics {
  /** page margins: top, bottom, outer, inner (spine side) */
  m: [number, number, number, number];
  /** gutters: between tiers (horizontal) and between panels side by side (vertical) */
  gh: number;
  gv: number;
  stroke: number;
  /** sheet beyond the page edge (the phone strip's side padding), px: top, right, bottom, left */
  bleed?: [number, number, number, number];
  /** px per template unit down the page, if not the live area's width (a wide strip's tiers) */
  uy?: number;
}

function placePage(
  t: Template,
  page: PageBox,
  met: Metrics,
  out: PanelBox[],
) {
  const { live } = page;
  const u = live.w;
  const uy = met.uy ?? u;
  const eps = 1e-6;
  for (const { id, quad } of t.panels) {
    const outer = quad.map((p, i) => {
      const q = quad[(i + 1) % 4];
      return (
        (Math.abs(p[0]) < eps && Math.abs(q[0]) < eps) ||
        (Math.abs(p[0] - 1) < eps && Math.abs(q[0] - 1) < eps) ||
        (Math.abs(p[1]) < eps && Math.abs(q[1]) < eps) ||
        (Math.abs(p[1] - t.h) < eps && Math.abs(q[1] - t.h) < eps)
      );
    });
    const px = quad.map(([x, y]) => [x * u, y * uy] as Pt) as Quad;
    const cut = inset(px, (i) => {
      if (outer[i]) return 0;
      const a = px[i];
      const b = px[(i + 1) % 4];
      return (Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) ? met.gh : met.gv) / 2;
    });
    const xs = cut.map((p) => p[0]);
    const ys = cut.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const x1 = Math.max(...xs);
    const y1 = Math.max(...ys);
    const margin = [live.y, page.w - live.x - live.w, page.h - live.y - live.h, live.x] as const;
    out.push({
      id,
      x: page.x + live.x + x0,
      y: page.y + live.y + y0,
      w: x1 - x0,
      h: y1 - y0,
      quad: cut.map(([x, y]) => [x - x0, y - y0] as Pt) as Quad,
      outer,
      room: [0, 1, 2, 3].map((i) => (outer[i] ? margin[i] + (met.bleed?.[i] ?? 0) : 0)) as PanelBox["room"],
      page: page.n,
    });
  }
}

/**
 * Lettering is set at one size (as a letterer would), so the layout steps
 * rather than shrinks: a spread once each page's panels can hold their
 * balloons beside the faces (a 530 px live area, so a 1280 laptop gets the
 * spread), stacked pages below that, and a strip on phones. The pages start
 * past the widest sheet a window under 640 px has (anime.css: its margins
 * are 14 px there, 32 px from 640), so narrowing a window never switches the
 * kind back and forth.
 */
export function kindFor(w: number): Kind {
  return w >= 1200 ? "spread" : w >= 612 ? "pages" : "strip";
}

export function layout(width: number): Layout {
  const w = Math.max(280, Math.round(width));
  const kind = kindFor(w);
  const pages: PageBox[] = [];
  const panels: PanelBox[] = [];

  if (kind === "spread") {
    const met: Metrics = { m: [46, 58, 42, 28], gh: 22, gv: 12, stroke: 3.4 };
    const pw = Math.floor(w / 2);
    const lw = pw - met.m[2] - met.m[3];
    const lh = Math.round(lw * PAGE_H);
    const ph = lh + met.m[0] + met.m[1];
    PAGE_TEMPLATES.forEach((t, i) => {
      const side = i === 0 ? "l" : "r";
      const page: PageBox = {
        n: FIRST_FOLIO + i,
        side,
        x: i * pw,
        y: 0,
        w: pw,
        h: ph,
        live: { x: side === "l" ? met.m[2] : met.m[3], y: met.m[0], w: lw, h: lh },
      };
      pages.push(page);
      placePage(t, page, met, panels);
    });
    return { kind, w, h: ph, pages, panels, stroke: met.stroke };
  }

  if (kind === "pages") {
    const met: Metrics = { m: [40, 54, 36, 30], gh: 22, gv: 12, stroke: 3.2 };
    const pw = Math.min(w, 780);
    const lw = pw - met.m[2] - met.m[3];
    const lh = Math.round(lw * PAGE_H);
    const ph = lh + met.m[0] + met.m[1];
    const gap = 36;
    // with room to spare, the pages lie a little apart like loose sheets: the left-hand page left, the right-hand right
    const shift = Math.max(0, Math.min(120, (w - pw) / 2 - 28));
    PAGE_TEMPLATES.forEach((t, i) => {
      const side = i === 0 ? "l" : "r";
      const page: PageBox = {
        n: FIRST_FOLIO + i,
        side,
        x: Math.round((w - pw) / 2 + (i === 0 ? -shift : shift)),
        y: i * (ph + gap),
        w: pw,
        h: ph,
        live: { x: side === "l" ? met.m[2] : met.m[3], y: met.m[0], w: lw, h: lh },
      };
      pages.push(page);
      placePage(t, page, met, panels);
    });
    return { kind, w, h: 2 * ph + gap, pages, panels, stroke: met.stroke };
  }

  // past a phone's width the tiers stop growing taller and only get wider, so a
  // small tablet or a phone on its side reads wide panels, not a strip twice its height
  const uy = Math.min(w, STRIP_DEEP);
  const met: Metrics = { m: [30, 50, 0, 0], gh: 16, gv: 10, stroke: 2.8, bleed: [0, 8, 0, 8], uy };
  const lw = w;
  let y = 0;
  STRIP_TEMPLATES.forEach((t, i) => {
    const lh = Math.round(uy * t.h);
    const ph = lh + met.m[0] + met.m[1];
    const page: PageBox = {
      n: FIRST_FOLIO + i,
      side: i === 0 ? "l" : "r",
      x: 0,
      y,
      w,
      h: ph,
      live: { x: 0, y: met.m[0], w: lw, h: lh },
    };
    pages.push(page);
    placePage(t, page, met, panels);
    y += ph + 18;
  });
  return { kind, w, h: y - 18, pages, panels, stroke: met.stroke };
}

/** An SVG path for a quad, px. */
export const quadPath = (q: Quad) => `M${q.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;

/** A CSS clip-path polygon for a quad, px, grown outward by `g` px (so the frame's stroke covers the cut). */
export function quadClip(q: Quad, g = 0) {
  const c = g ? inset(q, () => -g) : q;
  return `polygon(${c.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;
}

/** A point `d` px inside corner `i` of the quad, along both of its edges' normals. */
export function cornerIn(q: Quad, i: number, d: number): Pt {
  return inset(q, () => d)[i];
}
