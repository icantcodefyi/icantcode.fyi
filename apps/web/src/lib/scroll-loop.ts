import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

import { clamp, clamp01, DAMP, damp, finePointer, reducedMotion } from "@/lib/motion";

/**
 * One rAF and one passive scroll listener for every scroll- or pointer-driven
 * section on the page (the hero keeps its own).
 *
 * A subscriber hands in its element and an `onFrame`. Only subscribers within
 * half a screen of the viewport get frames, and frames never read layout:
 * each element's document offset and height are cached by ResizeObserver
 * (on the element, and on <body> for the reflows deferred sections cause
 * when they mount), so the scroll position alone gives every value below.
 * The loop stops once everything has settled and no subscriber asks for more.
 */

export interface Frame {
  /**
   * The element's centre relative to the viewport's centre, css px: negative
   * while it is below, positive once it has risen past. Damped (DAMP.scroll),
   * clamped to ±1 viewport. The site camera's parallax input.
   */
  s: number;
  /** 0 as the element's top enters at the bottom → 1 as its bottom leaves at the top. Damped. */
  p: number;
  /** how much of the element shows: visible height / min(height, viewport height), 0..1 */
  vis: number;
  /** this subscriber is the one breathing scene: it asked to breathe and is the most in view (≥ 30%) */
  lead: boolean;
  /** window.scrollY (not damped), the element's cached document top and height, the viewport size */
  y: number;
  top: number;
  h: number;
  vw: number;
  vh: number;
  /** seconds since the last frame (≤ 0.05) and the loop's clock */
  dt: number;
  t: number;
  /** pointer, -1..1 across the viewport, damped (DAMP.pointer); always 0 on touch and for reduced motion */
  mx: number;
  my: number;
  /** 0..1: rises once the pointer has rested (always 1 on touch), the weight of any idle breath; 0 for reduced motion */
  idle: number;
  reduced: boolean;
}

export interface Subscriber {
  el: HTMLElement;
  /** Write only: no layout reads in here. Return true to keep frames coming (an arrival, a breath). */
  onFrame(f: Readonly<Frame>): boolean | void;
  /** Layout changed: re-read whatever onFrame needs (called outside frames, reads are fine). */
  onMeasure?(): void;
  /** Entered (true) or left (false) the band half a screen around the viewport. */
  onActive?(on: boolean): void;
  /** Compete to be the scene that breathes (see Frame.lead). */
  breath?: boolean;
}

interface Entry {
  sub: Subscriber;
  frame: Frame;
  top: number;
  h: number;
  active: boolean;
  /** snap to the goal on the next frame instead of easing in from a stale value */
  fresh: boolean;
}

const entries = new Set<Entry>();
const byEl = new Map<Element, Set<Entry>>();
const watchers = new Set<(y: number, dy: number) => void>();
const ptr = { gx: 0, gy: 0, x: 0, y: 0, moved: -1e9 };
let io: IntersectionObserver | null = null;
let ro: ResizeObserver | null = null;
let raf = 0;
let last = 0;
let clock = 0;
let scrollY = 0;
/** window.scrollY as of the last scroll event: reading it in a frame, after other callbacks have written styles, forces a style and layout pass */
let liveY = 0;
let vw = 0;
let vh = 0;
let idle = 0;
let fine = false;
let reduced = false;
let active = 0;

/** Document offset of an element's layout box (transforms are ignored, as they should be). */
function docTop(el: HTMLElement) {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
  return y;
}

function measure(e: Entry) {
  e.top = docTop(e.sub.el);
  e.h = e.sub.el.offsetHeight;
  e.sub.onMeasure?.();
}

function measureAll() {
  vw = window.innerWidth;
  vh = window.innerHeight;
  liveY = window.scrollY;
  for (const e of entries) measure(e);
  kick();
}

function start() {
  if (io) return;
  reduced = reducedMotion();
  fine = finePointer() && !reduced;
  vw = window.innerWidth;
  vh = window.innerHeight;
  scrollY = liveY = window.scrollY;
  idle = reduced ? 0 : fine ? 0 : 1;
  // scroll events run before the frame's callbacks, while the page is still clean
  window.addEventListener(
    "scroll",
    () => {
      liveY = window.scrollY;
      kick();
    },
    { passive: true },
  );
  window.addEventListener("resize", measureAll);
  document.addEventListener("visibilitychange", kick);
  if (fine) {
    window.addEventListener(
      "pointermove",
      (ev) => {
        if (ev.pointerType !== "mouse" && ev.pointerType !== "pen") return;
        ptr.gx = (ev.clientX / window.innerWidth) * 2 - 1;
        ptr.gy = (ev.clientY / window.innerHeight) * 2 - 1;
        ptr.moved = performance.now();
        kick();
      },
      { passive: true },
    );
    document.documentElement.addEventListener("pointerleave", () => {
      ptr.gx = 0;
      ptr.gy = 0;
      kick();
    });
  }
  io = new IntersectionObserver(
    (records) => {
      for (const r of records) {
        for (const e of byEl.get(r.target) ?? []) {
          if (e.active === r.isIntersecting) continue;
          e.active = r.isIntersecting;
          active += e.active ? 1 : -1;
          e.fresh = e.active;
          e.sub.onActive?.(e.active);
        }
      }
      kick();
    },
    { rootMargin: "50% 0px" },
  );
  ro = new ResizeObserver(measureAll);
  ro.observe(document.body);
}

/** Ask for frames (after a scroll, a pointer move, or a state change a subscriber must animate). */
export function kick() {
  if (raf || document.hidden || (!active && !watchers.size)) return;
  last = performance.now();
  raf = requestAnimationFrame(tick);
}

function tick(now: number) {
  raf = 0;
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  clock += dt;

  const y = liveY;
  if (y !== scrollY) {
    const dy = y - scrollY;
    scrollY = y;
    for (const w of watchers) w(y, dy);
  }
  if (!active) return;

  let busy = false;
  if (fine) {
    const k = damp(DAMP.pointer, dt);
    ptr.x += (ptr.gx - ptr.x) * k;
    ptr.y += (ptr.gy - ptr.y) * k;
    if (Math.abs(ptr.gx - ptr.x) < 1e-4 && Math.abs(ptr.gy - ptr.y) < 1e-4) {
      ptr.x = ptr.gx;
      ptr.y = ptr.gy;
    } else busy = true;
    const still = now - ptr.moved > 1600;
    idle += ((still ? 1 : 0) - idle) * damp(still ? DAMP.breathIn : DAMP.breathOut, dt);
  }

  // goals first (all from cached geometry), then the one breathing scene
  let lead: Entry | null = null;
  let best = 0.3;
  for (const e of entries) {
    if (!e.active) continue;
    const f = e.frame;
    const overlap = Math.min(e.top + e.h, y + vh) - Math.max(e.top, y);
    f.vis = e.h > 0 ? clamp01(overlap / Math.min(e.h, vh)) : 0;
    if (e.sub.breath && f.vis >= best) {
      best = f.vis;
      lead = e;
    }
  }

  const ks = reduced ? 1 : damp(DAMP.scroll, dt);
  for (const e of entries) {
    if (!e.active) continue;
    const f = e.frame;
    const gs = clamp(y + vh / 2 - (e.top + e.h / 2), -vh, vh);
    const gp = clamp01((y + vh - e.top) / (vh + e.h));
    if (e.fresh) {
      f.s = gs;
      f.p = gp;
      e.fresh = false;
    } else {
      f.s += (gs - f.s) * ks;
      f.p += (gp - f.p) * ks;
      if (Math.abs(gs - f.s) < 0.01 && Math.abs(gp - f.p) < 1e-4) {
        f.s = gs;
        f.p = gp;
      } else busy = true;
    }
    f.lead = e === lead;
    f.y = y;
    f.top = e.top;
    f.h = e.h;
    f.vw = vw;
    f.vh = vh;
    f.dt = dt;
    f.t = clock;
    f.mx = ptr.x;
    f.my = ptr.y;
    f.idle = idle;
    if (e.sub.onFrame(f) === true) busy = true;
  }
  if (busy) raf = requestAnimationFrame(tick);
}

/** Register a subscriber; returns the unsubscribe. Call from an effect (it measures right away). */
export function subscribe(sub: Subscriber): () => void {
  start();
  const e: Entry = {
    sub,
    frame: { s: 0, p: 0, vis: 0, lead: false, y: 0, top: 0, h: 0, vw, vh, dt: 0, t: 0, mx: 0, my: 0, idle: 0, reduced },
    top: 0,
    h: 0,
    active: false,
    fresh: true,
  };
  entries.add(e);
  let set = byEl.get(sub.el);
  if (!set) {
    byEl.set(sub.el, (set = new Set()));
    io?.observe(sub.el);
    ro?.observe(sub.el);
  }
  set.add(e);
  measure(e);
  return () => {
    entries.delete(e);
    if (e.active) active--;
    set.delete(e);
    if (!set.size) {
      byEl.delete(sub.el);
      io?.unobserve(sub.el);
      ro?.unobserve(sub.el);
    }
  };
}

/** Called once per frame with the scroll position and how far it moved, whenever it has moved. */
export function watchScroll(fn: (y: number, dy: number) => void): () => void {
  start();
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

/**
 * subscribe() as a hook. The callbacks may change every render; the
 * subscription stays put for the life of the element.
 */
export function useScrollFrame(
  ref: RefObject<HTMLElement | null>,
  onFrame: Subscriber["onFrame"],
  opts: Pick<Subscriber, "onMeasure" | "onActive" | "breath"> = {},
) {
  const cb = useRef({ onFrame, ...opts });
  useLayoutEffect(() => {
    cb.current = { onFrame, ...opts };
  });
  const breath = opts.breath;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return subscribe({
      el,
      breath,
      onFrame: (f) => cb.current.onFrame(f),
      onMeasure: () => cb.current.onMeasure?.(),
      onActive: (on) => cb.current.onActive?.(on),
    });
  }, [ref, breath]);
}
