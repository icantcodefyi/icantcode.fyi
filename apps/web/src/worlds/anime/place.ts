import { BH, BW } from "./ink";
import type { PanelBox, Pt } from "./layout";
import type { Corner, Place, Pos, Show } from "./shows";

/**
 * Where a panel's lettering goes, worked out per layout the way a letterer
 * would: the narration box takes the corner that covers no one, the balloon
 * the clearest spot near its hint (it may lean out over the frame a little,
 * as balloons do), and the SFX what is left. Nothing may sit on a face, at
 * rest or as the near planes drift with the scroll. The balloon's tail is
 * aimed at whoever is speaking.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Solved {
  faces: Rect[];
  cap: { corner: Corner; rect: Rect };
  bubble: Rect & { tail: number };
  sfx: Rect;
}

/**
 * How far each plane drifts against the poster while its panel is in good
 * view (half a screen either side of centre, anime.tsx CAMERA), px: the
 * caption rides the frame, the balloon and the SFX lead it.
 */
const DRIFT = { caption: 8, bubble: 16, sfx: 20 };
const FACE_PAD = 10;

const area = (r: Rect) => Math.max(0, r.w) * Math.max(0, r.h);
function overlap(a: Rect, b: Rect) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
const grow = (r: Rect, gx: number, gy = gx): Rect => ({ x: r.x - gx, y: r.y - gy, w: r.w + 2 * gx, h: r.h + 2 * gy });

/** Is `p` inside the convex quad (clockwise on screen)? */
function inside(q: readonly Pt[], p: Pt) {
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) < 0) return false;
  }
  return true;
}

/** Is all of `r` inside the frame? (The frame is convex: its four corners say.) */
const within = (q: readonly Pt[], r: Rect) =>
  inside(q, [r.x, r.y]) && inside(q, [r.x + r.w, r.y]) && inside(q, [r.x, r.y + r.h]) && inside(q, [r.x + r.w, r.y + r.h]);

/** Fraction of `r` that lies outside the frame, sampled. */
function outside(q: readonly Pt[], r: Rect) {
  if (within(q, r)) return 0;
  let n = 0;
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (!inside(q, [r.x + (r.w * (i + 0.5)) / 5, r.y + (r.h * (j + 0.5)) / 5])) n++;
  return n / 25;
}

/** The poster's placement in its panel (anime.tsx Art): offset and size, px. */
export function fit(size: [number, number], focus: [number, number], w: number, h: number, zoom = 1) {
  const s = Math.max(w / size[0], h / size[1]) * zoom;
  const dw = size[0] * s;
  const dh = size[1] * s;
  const ox = Math.min(0, Math.max(w - dw, w / 2 - focus[0] * dw));
  const oy = Math.min(0, Math.max(h - dh, h / 2 - focus[1] * dh));
  return { ox, oy, dw, dh };
}

/** A rect from a hint (% of the box) and a size. */
function fromPos(p: Pos, w: number, h: number, box: PanelBox): Rect {
  const x = p.l !== undefined ? (p.l / 100) * box.w : box.w - (p.r ?? 0) / 100 * box.w - w;
  const y = p.t !== undefined ? (p.t / 100) * box.h : box.h - (p.b ?? 0) / 100 * box.h - h;
  return { x, y, w, h };
}

let ctx: CanvasRenderingContext2D | null | undefined;

/** `text`'s width in a CSS `font`, px (an estimate before the canvas can measure). */
export function textWidth(text: string, font: string, size: number) {
  if (ctx === undefined) ctx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (!ctx) return text.length * size * 0.62;
  ctx.font = font;
  return ctx.measureText(text).width;
}

/** Lines `text` breaks into at `width` px in the balloon's face (anime.css .an-bubble p), greedy like the browser. */
function lineCount(text: string, width: number, size: number) {
  if (ctx === undefined) ctx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (!ctx) return Math.max(1, Math.ceil((text.length * size * 0.53) / width));
  ctx.font = `600 ${size}px Onest, sans-serif`;
  const space = ctx.measureText(" ").width;
  let lines = 1;
  let run = 0;
  for (const word of text.split(/\s+/)) {
    const w = ctx.measureText(word).width;
    if (run && run + space + w > width) {
      lines++;
      run = w;
    } else run += (run ? space : 0) + w;
  }
  return lines;
}

/** A balloon's height for its text: its lines plus the padding, which CSS sets as % of the width. */
function balloonHeight(text: string, w: number, burst: boolean) {
  const padX = burst ? 0.38 : 0.28;
  const padY = burst ? 0.41 : 0.32;
  const size = 15;
  return lineCount(text, w * (1 - padX), size) * size * 1.3 + w * padY;
}

/**
 * The run of a balloon's tail, as a box: from its rim out to its tip, aimed at
 * the speaker the way anime/ink.ts bubbleGeometry draws it (in the balloon's
 * stretched 300 × 180 space), a little wider than the stroke.
 */
function tailRect(b: Rect, to: Rect, burst: boolean): Rect {
  const dx = ((to.x + to.w / 2 - (b.x + b.w / 2)) * BW) / b.w;
  const dy = ((to.y + to.h / 2 - (b.y + b.h / 2)) * BH) / b.h;
  const ta = Math.atan2(dy, dx) + (burst ? 0 : 0.1);
  const [kx, ky] = burst ? [1.4, 1.4] : [1.42, 1.78];
  const at = (k: number, l: number): Pt => [b.x + ((BW / 2 + 142 * k * Math.cos(ta)) / BW) * b.w, b.y + ((BH / 2 + 84 * l * Math.sin(ta)) / BH) * b.h];
  const [x0, y0] = at(1, 1);
  const [x1, y1] = at(kx, ky);
  return grow({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }, 5);
}

interface Options {
  overscan: number;
  small: boolean;
  /** each show's narration box, px: as wide as its longest line (anime.tsx captionSize) */
  cap: (show: Show) => { w: number; h: number };
  /** how far left and right lettering may go, in the spread's px, per page (never off the sheet, never over the fold) */
  bounds: (page: number) => [number, number];
}

/**
 * Where the poster's faces land in its panel, px (a poster may fill only
 * part of it: Place.art). Only what shows inside the frame counts (a face cropped
 * off it comes back empty, keeping its index for the speaker).
 */
export function facesIn(show: Show, box: PanelBox, overscan: number, place: Place): Rect[] {
  const { art } = place;
  const { ox, oy, dw, dh } = fit(show.size, place.focus ?? show.focus, box.w * (art?.span ?? 1), box.h + 2 * overscan, art?.zoom);
  return show.faces.map(([x0, y0, x1, y1]) => {
    const x = Math.max(0, ox + x0 * dw);
    const y = Math.max(0, oy + y0 * dh - overscan);
    return {
      x,
      y,
      w: Math.max(0, Math.min(box.w, ox + x1 * dw) - x),
      h: Math.max(0, Math.min(box.h, oy + y1 * dh - overscan) - y),
    };
  });
}

/**
 * One panel. `others`: faces of the neighbouring panels and the lettering
 * already placed on the page, in this panel's px, so a balloon leaning out
 * over the frame never lands on the next panel's faces or text.
 */
export function solve(
  show: Show,
  box: PanelBox,
  hint: Show["page"],
  o: Options,
  others: { faces: Rect[]; text: Rect[]; fixed: Rect[] },
): Solved {
  const q = box.quad;
  const [b0, b1] = o.bounds(box.page);
  const [bx0, bx1] = [b0 - box.x, b1 - box.x];
  const offSheet = (r: Rect) => (r.x < bx0 || r.x + r.w > bx1 ? 1e5 : 0);
  const faces = facesIn(show, box, o.overscan, hint);
  // only the faces anything placed here could reach (a balloon's tail, an SFX's trail, a narration box hanging off the frame)
  const near = grow({ x: 0, y: 0, w: box.w, h: box.h }, 0.6 * Math.max(box.w, box.h) + 60);
  const all = [...faces, ...others.faces].filter((r) => r.w > 0 && r.h > 0 && overlap(r, near) > 0);
  // each plane drifts against the poster by its own amount, so each keeps its own distance from the faces
  // lettering touching a face at all costs a step, so a small graze is never the cheap way out
  // (a faint motion line crossing one, only while the page moves, costs just what it covers)
  const faceCost = (drift: number, step = 0.25) => {
    const keep = all.map((r) => grow(r, FACE_PAD, FACE_PAD + drift));
    return (r: Rect) => keep.reduce((s, k) => { const o = overlap(r, k); return o > 0 ? s + step + o / area(k) : s; }, 0);
  };
  const capFaces = faceCost(DRIFT.caption);
  const bubbleFaces = faceCost(DRIFT.bubble);
  const sfxFaces = faceCost(DRIFT.sfx);
  const trailFaces = faceCost(DRIFT.sfx, 0);
  const tailOnFaces = (t: Rect) => all.reduce((s, f) => s + (overlap(t, f) / area(f)) * 0.4, 0);
  const burst = show.bubble === "burst";
  // a burst's spikes and a balloon's ink reach a little past its box all round, and its tail a long way towards the speaker
  const reach = burst ? 0.06 : 0.02;
  const speaker = faces[show.speaker] ?? faces[0];
  const tailOf = (b: Rect) => tailRect(b, speaker, burst);
  const { w: gw, h: gh } = sfxBox(show, hint.sfx.size);

  // Every corner for the narration box, the balloon and the SFX fitted around
  // each: the letterer's whole panel, not the first box's best corner.
  const capSize = o.cap(show);
  const capW = Math.min(capSize.w, box.w - 30);
  const capH = capSize.h;
  let best: (Solved & { cost: number }) | null = null;
  // Each corner, inside the frame or, where the page margin allows, hanging
  // off it: a narration box may break the frame into the margin, a third out.
  const options: { c: Corner; rect: Rect; capCost: number }[] = [];
  for (const c of ["bl", "br", "tl", "tr"] as Corner[]) {
    const [cx, cy] = q[{ tl: 0, tr: 1, br: 2, bl: 3 }[c]];
    const inset = 12;
    const vEdge = c[0] === "t" ? 0 : 2;
    const hEdge = c[1] === "l" ? 3 : 1;
    const oys = [0, Math.max(0, Math.min(capH * 0.42, box.room[vEdge] - 10))];
    const oxs = [0, Math.max(0, Math.min(capW * 0.3, box.room[hEdge] - 10))];
    for (const oy of new Set(oys)) {
      for (const ox of new Set(oxs)) {
        const rect = {
          x: c[1] === "l" ? cx + inset - ox - (ox ? inset : 0) : cx - inset - capW + ox + (ox ? inset : 0),
          y: c[0] === "t" ? cy + inset - oy - (oy ? inset : 0) : cy - inset - capH + oy + (oy ? inset : 0),
          w: capW,
          h: capH,
        };
        // the part over the art stays inside its frame
        const core = {
          x: rect.x + (c[1] === "l" ? ox + (ox ? inset : 0) : 0),
          y: rect.y + (c[0] === "t" ? oy + (oy ? inset : 0) : 0),
          w: rect.w - (ox ? ox + inset : 0),
          h: rect.h - (oy ? oy + inset : 0),
        };
        let capCost =
          capFaces(rect) * 1000 + (within(q, core) ? 0 : 1e4) + offSheet(rect) + (c === hint.cap ? 0 : 12) + (ox || oy ? 18 : 0);
        for (const p of others.text) capCost += (overlap(rect, p) / area(rect)) * 2400;
        // the page's furniture is small: hiding any of it is as bad as hiding all of it
        for (const p of others.fixed) capCost += (overlap(rect, p) / area(p)) * 2400;
        options.push({ c, rect, capCost });
      }
    }
  }
  options.sort((a, b) => a.capCost - b.capCost);
  // what a balloon costs on its own at each spot is the same whichever corner the narration box takes
  const bubbleMemo = [memo(), memo(), memo()];
  for (const { c, rect, capCost } of options) {
    if (best && capCost >= best.cost) continue;

    const placed: Rect[] = [grow(rect, 8, 8 + DRIFT.bubble - DRIFT.caption), ...others.text];
    // the balloon, near its hint; a narrower, taller one if the wide one has nowhere to go
    let bubble: Rect & { cost: number } = { x: 0, y: 0, w: 0, h: 0, cost: Infinity };
    for (const [n, k] of [1, 0.86, 0.76].entries()) {
      const bw = Math.min(hint.bubble.w, box.w * 0.9) * k;
      const bh = balloonHeight(show.line, bw, burst);
      const extra = k < 1 ? 40 + (1 - k) * 100 : 0;
      const r = search(box, bw, bh, fromPos(hint.bubble, bw, bh, box), {
        // only a spot that would beat the wider balloon is worth costing in full
        bound: bubble.cost - extra,
        memo: bubbleMemo[n],
        // its tail points at the speaker but stops short of any face
        faces: (b, t) => bubbleFaces(grow(b, b.w * reach, b.h * reach)) + tailOnFaces(t!),
        placed,
        // never over its own narration box, nor the page's furniture: any of either hidden is too much
        hard: [grow(rect, 6, 6 + DRIFT.bubble - DRIFT.caption), ...others.fixed],
        spikes: reach,
        tail: tailOf,
        out: (b) => {
          const f = outside(q, b);
          // leaning out over the frame is fine, a third of it at most
          return (f > 0.34 ? 1e4 : f * 160) + offSheet(b);
        },
      });
      const cost = r.cost + extra;
      if (cost < bubble.cost) bubble = { ...r, cost };
    }
    // nothing the SFX does can make up for a narration box and balloon already dearer than the best page
    if (best && capCost + bubble.cost >= best.cost) continue;
    placed.push(grow(bubble, bubble.w * reach + 4), grow(tailOf(bubble), 2));
    // the SFX, in what is left: its rim and tilt reach a little past its box
    // ...and the motion lines it trails while the page moves (anime.tsx useTrails) keep off faces and text too
    const trailText = placed.map((p) => grow(p, 2));
    const trail = (r: Rect) => {
      const z = grow(r, -r.w * 0.06, r.h * 0.62);
      let c = trailFaces(z) * 0.7;
      for (const p of trailText) c += (overlap(z, p) / area(z)) * 0.8;
      return c;
    };
    const sfx = search(box, gw, gh, fromPos(hint.sfx, gw, gh, box), {
      bound: best ? (best.cost - capCost - bubble.cost) / 0.6 : Infinity,
      faces: (r) => sfxFaces(grow(r, 4)) + trail(r),
      placed: placed.map((p) => grow(p, 6, 6 + DRIFT.sfx - DRIFT.caption)),
      weight: 5000,
      out: (r) => {
        const k = outside(q, r);
        return (k > 0.18 ? 1e4 : k * 140) + offSheet(r);
      },
    });
    const cost = capCost + bubble.cost + sfx.cost * 0.6;
    if (sfx.cost < Infinity && (!best || cost < best.cost)) {
      // the tail points at the speaker, in the balloon's own (stretched) 300 × 180 space
      const sp = faces[show.speaker] ?? faces[0];
      const dx = ((sp.x + sp.w / 2 - (bubble.x + bubble.w / 2)) * BW) / bubble.w;
      const dy = ((sp.y + sp.h / 2 - (bubble.y + bubble.h / 2)) * BH) / bubble.h;
      const tail = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
      best = {
        cost,
        faces,
        cap: { corner: c, rect },
        bubble: { x: bubble.x, y: bubble.y, w: bubble.w, h: bubble.h, tail },
        sfx: { x: sfx.x, y: sfx.y, w: sfx.w, h: sfx.h },
      };
    }
  }
  const { cost: _, ...solved } = best!;
  return solved;
}

/** The SFX's box at `size` px per glyph unit (anime.tsx Sfx: 100 units a glyph, 40 of margin). */
export function sfxBox(show: Pick<Show, "sfx" | "sfxVertical">, size: number) {
  const n = [...show.sfx].length;
  const long = ((n * 100 + 40) / 100) * size;
  const short = 1.4 * size;
  return show.sfxVertical ? { w: short, h: long } : { w: long, h: short };
}

/** the search's grid: this many steps across the panel each way */
const STEPS = 26;
const CELLS = (STEPS + 1) ** 2;
/** A search's per-spot costs that don't depend on what is already placed, kept between searches over the same grid. */
interface Memo {
  out: Float64Array;
  faces: Float64Array;
  tails: (Rect | undefined)[];
}
const memo = (): Memo => ({ out: new Float64Array(CELLS).fill(Number.NaN), faces: new Float64Array(CELLS).fill(Number.NaN), tails: [] });

function search(
  box: PanelBox,
  w: number,
  h: number,
  hint: Rect,
  cost: {
    /** only spots costing less than this count (the search comes back at Infinity if none does) */
    bound?: number;
    faces: (r: Rect, tail?: Rect) => number;
    placed: Rect[];
    hard?: Rect[];
    out: (r: Rect) => number;
    weight?: number;
    spikes?: number;
    /** where a balloon's tail runs for a box at `r`: kept off lettering, though it may point at a face */
    tail?: (r: Rect) => Rect;
    /** `out`, `faces` and `tail` as they came out last time on this grid */
    memo?: Memo;
  },
): Rect & { cost: number } {
  let best = hint;
  // a hair over a cost, so rounding never turns away the spot that has it
  const over = (c: number) => c + Math.abs(c) * 1e-9 + 1e-9;
  let bestCost = cost.bound !== undefined && cost.bound < Infinity ? over(cost.bound) : Infinity;
  let found = false;
  const steps = STEPS;
  const x0 = -0.08 * box.w;
  const x1 = box.w * 1.08 - w;
  const y0 = -0.1 * box.h;
  const y1 = box.h * 1.06 - h;
  const diag = Math.hypot(box.w, box.h);
  const at = (i: number, j: number): Rect => ({ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * j) / steps, w, h });
  // a spot's cost, or Infinity as soon as it can't come in under `limit`: every term is ≥ 0
  const m = cost.memo;
  const price = (r: Rect, cell: number, limit: number) => {
    let out = m ? m.out[cell] : Number.NaN;
    if (Number.isNaN(out)) {
      out = cost.out(r);
      if (m) m.out[cell] = out;
    }
    const dist = (Math.hypot(r.x - hint.x, r.y - hint.y) / diag) * 90;
    if ((out + dist) * (1 - 1e-12) >= limit) return Infinity;
    let t = m?.tails[cell];
    if (!t && cost.tail) {
      t = cost.tail(r);
      if (m) m.tails[cell] = t;
    }
    let f = m ? m.faces[cell] : Number.NaN;
    if (Number.isNaN(f)) {
      f = cost.faces(r, t);
      if (m) m.faces[cell] = f;
    }
    let c = f * 1000 + out;
    if (c >= limit) return Infinity;
    // lettering never sits on lettering
    const g = cost.spikes ? grow(r, r.w * cost.spikes, r.h * cost.spikes) : r;
    for (const p of cost.placed) c += ((overlap(g, p) + (t ? overlap(t, p) : 0)) / area(r)) * (cost.weight ?? 2400);
    if (c >= limit) return Infinity;
    // ...and never on its own narration box or the page's furniture: touching either at all is an error, not a cost
    for (const p of cost.hard ?? []) {
      const o = overlap(g, p) + (t ? overlap(t, p) : 0);
      if (o > 0) c += 3000 + (o / Math.max(1, Math.min(area(g), area(p)))) * 2400;
    }
    return c + dist;
  };
  // the grid spot nearest the hint first: it is usually close to the best, so most others are dropped early
  const nearest = (v: number, a: number, b: number) => (b === a ? 0 : Math.min(steps, Math.max(0, Math.round(((v - a) / (b - a)) * steps))));
  const [si, sj] = [nearest(hint.x, x0, x1), nearest(hint.y, y0, y1)];
  const seed = price(at(si, sj), si * (steps + 1) + sj, bestCost);
  if (seed < bestCost) bestCost = over(seed);
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const r = at(i, j);
      const c = price(r, i * (steps + 1) + j, bestCost);
      if (c < bestCost) {
        bestCost = c;
        best = r;
        found = true;
      }
    }
  }
  return { ...best, cost: found ? bestCost : Infinity };
}

const shift = (r: Rect, dx: number, dy: number): Rect => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h });

/** Every panel of a layout, in reading order, each seeing what the ones before it placed. */
export function solveAll(
  shows: Show[],
  boxes: Record<string, PanelBox>,
  strip: boolean,
  o: Options,
  fixed: Rect[] = [],
): Record<string, Solved> {
  // faces and fixed lettering in page px
  const pageFaces = shows.flatMap((s) =>
    facesIn(s, boxes[s.id], o.overscan, strip ? s.strip : s.page).map((r) => shift(r, boxes[s.id].x, boxes[s.id].y)),
  );
  const text: Rect[] = [...fixed];
  const out: Record<string, Solved> = {};
  for (const s of shows) {
    const b = boxes[s.id];
    const local = (r: Rect) => shift(r, -b.x, -b.y);
    const res = solve(s, b, strip ? s.strip : s.page, o, { faces: pageFaces.map(local), text: text.map(local), fixed: fixed.map(local) });
    out[s.id] = res;
    for (const r of [res.cap.rect, res.bubble, res.sfx]) text.push(shift(grow(r, 4), b.x, b.y));
  }
  return out;
}
