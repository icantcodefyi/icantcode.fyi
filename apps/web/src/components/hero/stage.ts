import type { HeroScene, Layout } from "./scene";
import { eye, lens, NAME_DEPTH, PLATE, place, type Eye, type Lens, type PlateName } from "./rig";

/**
 * Drives the hero's stage. One damped loop turns the pointer, the scroll and
 * an idle breath into the camera (rig.ts), places every DOM layer by its
 * depth and hands the same camera to the WebGL scene in the same frame, so
 * the name never slips against the painting.
 *
 * Scrolling the hero's first screen dives the camera into the scene; the
 * stage itself is sticky (hero.css), so the browser holds it still while the
 * next section rises over it, and the scroll stays native.
 *
 * Every frame that writes a layer's transform re-layerizes the whole page
 * (hero.css's will-change doesn't spare it), and the longer the page, the
 * more that costs. So once the breath is all that moves (pointer and dive
 * settled, the breath nearly in), it goes to the compositor, as the
 * sections' does (lib/depth/dom.ts): each visible layer gets one animation
 * sampled from the same breath for the next DRIFT_S, and the loop draws the
 * scene from that same breath at the frame's time, so the name and the
 * painting stay together. Any change takes the layers back from where the
 * breath had got to, in the same frame.
 */

export interface Stage {
  attach(scene: HeroScene): void;
  /** re-measure everything and hand the layout to the scene */
  relayout(): void;
  /** on the next frame, hand the painting from the <img>s to the scene's plates */
  swap(): void;
  /** back to the <img>s, at once */
  unswap(): void;
  /** the plates were too slow here and have been given up for this visit */
  readonly spent: boolean;
  dispose(): void;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The scrim's gradients as alpha ramps (every stop shares one colour). */
export interface Scrim {
  color: [number, number, number];
  ramps: {
    /** ellipse centre x/y and 1/radius x/y, stage px (a linear ramp has an infinite x radius) */
    geo: [number, number, number, number];
    alpha: [number, number, number];
    stop: [number, number, number];
  }[];
}

/** A `drop-shadow()` filter: rgba 0..1, offsets and blur in css px. */
export interface Shadow {
  color: [number, number, number, number];
  x: number;
  y: number;
  blur: number;
}

const REST: Eye = { x: 0, y: 0, z: 0 };
const PLATES: PlateName[] = ["sky", "char", "hill"];

const DRIFT_S = 60;
const DRIFT_STEP = 0.5; // s between samples: off the true curve by < 0.02 px
const DRIFT_STEPS = Math.round(DRIFT_S / DRIFT_STEP);
/** how far in the breath must be before it goes to the compositor */
const DRIFT_FROM = 0.9;
/** the breath's fade-in rate while the pointer rests (the loop's `idle`) */
const BREATH_IN = 0.7;

interface DepthLayer {
  el: HTMLElement;
  d: number;
  /** the stylesheet's resting scale, and its transform-origin less the principal point */
  base: number;
  ox: number;
  oy: number;
  css: string;
  /** its breath on the compositor, while the loop rests */
  drift?: Animation;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Where an object-fit image lands inside its box. */
function fit(box: DOMRect, origin: DOMRect, img: HTMLImageElement, w: number, h: number): Rect {
  const cs = getComputedStyle(img);
  const s = cs.objectFit === "contain" ? Math.min(box.width / w, box.height / h) : Math.max(box.width / w, box.height / h);
  const [px, py] = cs.objectPosition.split(" ").map((v) => parseFloat(v) / 100);
  const iw = w * s;
  const ih = h * s;
  return { x: box.left - origin.left + (box.width - iw) * px, y: box.top - origin.top + (box.height - ih) * py, w: iw, h: ih };
}

/** Split on commas that aren't inside parentheses. */
function split(s: string) {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    else if (s[i] === "," && depth === 0) {
      out.push(s.slice(from, i).trim());
      from = i + 1;
    }
  }
  out.push(s.slice(from).trim());
  return out;
}

/**
 * The scrim element's computed gradients, for the front canvas to draw (the
 * forms hero.css uses: explicit-size ellipses and `to top` / `to bottom`
 * ramps, up to three stops each) on a stage of `w` × `h` css px.
 */
function readScrim(el: Element, w: number, h: number): Scrim {
  const s: Scrim = { color: [0, 0, 0], ramps: [] };
  for (const g of split(getComputedStyle(el).backgroundImage)) {
    const m = /^(radial|linear)-gradient\((.*)\)$/.exec(g);
    if (!m || s.ramps.length === 3) continue;
    const parts = split(m[2]);
    const head = /^(rgb|#|transparent)/.test(parts[0]) ? "" : (parts.shift() ?? "");
    const stops = parts.slice(0, 3).map((p) => {
      const n = (/rgba?\(([^)]*)\)/.exec(p)?.[1] ?? "0 0 0 / 0").split(/[\s,/]+/).filter(Boolean).map(Number);
      const at = /\)\s+([\d.]+)%/.exec(p);
      return { rgb: n.slice(0, 3), a: n[3] ?? 1, at: at ? Number(at[1]) / 100 : NaN };
    });
    // browsers drop positions that equal the implicit ones: ends at 0 and 1,
    // anything between spread evenly between its positioned neighbours
    stops[0].at = Number.isNaN(stops[0].at) ? 0 : stops[0].at;
    const end = stops[stops.length - 1];
    end.at = Number.isNaN(end.at) ? 1 : end.at;
    for (let i = 1; i < stops.length - 1; i++) {
      if (!Number.isNaN(stops[i].at)) continue;
      let j = i + 1;
      while (Number.isNaN(stops[j].at)) j++;
      stops[i].at = stops[i - 1].at + (stops[j].at - stops[i - 1].at) / (j - i + 1);
    }
    while (stops.length < 3) stops.push({ ...end, at: 1 });
    s.color = [stops[0].rgb[0] / 255, stops[0].rgb[1] / 255, stops[0].rgb[2] / 255];
    let geo: Scrim["ramps"][number]["geo"];
    if (m[1] === "radial") {
      const [rx, ry, , cx, cy] = head.split(/\s+/).map(parseFloat);
      geo = [(cx / 100) * w, (cy / 100) * h, 100 / (rx * w), 100 / (ry * h)];
    } else {
      geo = [0, head.includes("top") ? h : 0, 0, 1 / h];
    }
    s.ramps.push({ geo, alpha: [stops[0].a, stops[1].a, stops[2].a], stop: [stops[0].at, stops[1].at, stops[2].at] });
  }
  return s;
}

function readShadow(el: Element): Shadow {
  const m = /drop-shadow\(rgba?\(([^)]*)\)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/.exec(getComputedStyle(el).filter);
  if (!m) return { color: [0, 0, 0, 0], x: 0, y: 0, blur: 0 };
  const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { color: [r / 255, g / 255, b / 255, a], x: +m[2], y: +m[3], blur: +m[4] };
}

export function driveStage(root: HTMLElement, opts: { reduced: boolean; dims: Record<PlateName, readonly [number, number]> }): Stage {
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s) as T;
  const stage = q(".hero-stage");
  const names = [q(".hero-l-name:not(.hero-l-ghost)"), q(".hero-l-ghost")];
  const top = q(".hero-top");
  const copy = q(".hero-copy");
  const fade = q(".hero-fade");
  const scrimEl = q(".hero-scrim");
  const layers: Record<PlateName | "name" | "ghost", DepthLayer> = {
    sky: { el: q(".hero-l-sky"), d: PLATE.sky.flat, base: 1, ox: 0, oy: 0, css: "" },
    name: { el: names[0], d: NAME_DEPTH, base: 1, ox: 0, oy: 0, css: "" },
    char: { el: q(".hero-l-char"), d: PLATE.char.flat, base: 1, ox: 0, oy: 0, css: "" },
    ghost: { el: names[1], d: NAME_DEPTH, base: 1, ox: 0, oy: 0, css: "" },
    hill: { el: q(".hero-l-hill"), d: PLATE.hill.flat, base: 1, ox: 0, oy: 0, css: "" },
  };
  const all = Object.values(layers);

  let scene: HeroScene | null = null;
  let L: Lens = lens(1, 1);
  let e: Eye = REST;
  const goal = { mx: 0, my: 0, p: 0 };
  const cur = { mx: 0, my: 0, p: 0, idle: 0 };
  const fine = window.matchMedia("(pointer: fine)").matches;
  let heroH = root.offsetHeight;

  /** Lens, plus each layer's resting scale and origin (inline transforms lifted to read the stylesheet's). */
  function measure() {
    land();
    const sr = stage.getBoundingClientRect();
    L = lens(sr.width, sr.height);
    for (const l of all) l.el.style.transform = "";
    for (const l of all) {
      const cs = getComputedStyle(l.el);
      l.base = cs.transform === "none" ? 1 : new DOMMatrixReadOnly(cs.transform).a;
      const [ox, oy] = cs.transformOrigin.split(" ").map(parseFloat);
      l.ox = l.el.offsetLeft + ox - L.vx;
      l.oy = l.el.offsetTop + oy - L.vy;
    }
    // each image's rect at rest, which is where the scene's plates must land
    const rects = {} as Record<PlateName, Rect>;
    for (const n of PLATES) {
      const img = layers[n].el.querySelector("img") as HTMLImageElement;
      rects[n] = fit(img.getBoundingClientRect(), sr, img, opts.dims[n][0], opts.dims[n][1]);
    }
    for (const l of all) l.el.style.transform = l.css;
    const shadow = readShadow(layers.char.el.querySelector("img") as Element);
    return { lens: L, rects, scrim: readScrim(scrimEl, L.w, L.h), shadow } satisfies Layout;
  }

  function write(p: number) {
    if (!drift) {
      for (const l of all) {
        const css = place(l.d, e, L, l.ox, l.oy, l.base);
        if (css !== l.css) l.el.style.transform = l.css = css;
      }
    }
    const o = (el: HTMLElement, v: number) => {
      const s = clamp01(v).toFixed(3);
      if (el.style.opacity !== s) el.style.opacity = s;
    };
    // the words leave first, so nothing reads against the dive
    for (const n of names) o(n, 1 - p * 2.6);
    o(top, 1 - p * 7);
    o(copy, 1 - p * 6);
    o(scrimEl, 1 - smooth(0, 0.5, p));
    o(fade, smooth(0, 0.14, p));
    // the dissolve shortens with the strip of stage still showing, so she stays vivid as she passes
    const fs = `scaleY(${(1 - p * 0.7).toFixed(3)})`;
    if (fade.style.transform !== fs) fade.style.transform = fs;
  }

  // ── the loop ──
  let raf = 0;
  let last = 0;
  let t = 0;
  /** the breath's clock (s) */
  let bt = 0;
  /** the breath on the compositor: from document time `at` (ms) and breath time `bt`, for the pointer and dive it froze */
  let drift: { at: number; bt: number; idle: number; mx: number; my: number; p: number } | null = null;
  let lastMove = -1e9;
  let visible = true;
  let pendingSwap = false;
  let depthOn = false;
  let spent = false;
  let handBack = 0;
  // frame pacing while the plates show: a long slow stretch costs resolution, then the plates
  let pace = 1 / 60;
  let slowFrames = 0;
  let sinceOn = 0;

  function tick(now: number) {
    const raw = (now - last) / 1000;
    last = now;
    const dt = Math.min(0.05, raw);
    t += dt;
    // the breath fades in once the pointer has rested, and out as soon as it moves
    const still = !fine || now - lastMove > 1600;
    // (and before the plates take over: the painted layers they hide must not stay animated)
    if (drift && (pendingSwap || !still || goal.mx !== drift.mx || goal.my !== drift.my || goal.p !== drift.p)) land(now);
    if (drift) {
      // the compositor has the layers: the scene follows the same breath, at this frame's time
      const k = (now - drift.at) / 1000;
      e = eye(cur.mx, cur.my, cur.p, idleAt(drift.idle, k), drift.bt + k);
    } else {
      const kp = 1 - Math.exp(-dt * 4.5);
      const ks = 1 - Math.exp(-dt * 10);
      cur.mx += (goal.mx - cur.mx) * kp;
      cur.my += (goal.my - cur.my) * kp;
      cur.p += (goal.p - cur.p) * ks;
      cur.idle += ((still ? 1 : 0) - cur.idle) * (1 - Math.exp(-dt * (still ? BREATH_IN : 3)));
      bt += dt;
      e = eye(cur.mx, cur.my, cur.p, cur.idle, bt);
    }
    write(cur.p);
    // nothing left to move but the breath: hand it over
    if (!drift && still && cur.idle >= DRIFT_FROM && !pendingSwap && !handBack && settled()) lift(now);
    if (scene && pendingSwap) {
      pendingSwap = false;
      depthOn = true;
      sinceOn = 0;
      scene.plates(true);
      root.setAttribute("data-depth", "");
    }
    scene?.frame(e, dt, cur.p);
    if (handBack && t >= handBack) unswap();
    else if (depthOn && !spent) govern(raw);
    raf = requestAnimationFrame(tick);
  }

  function govern(raw: number) {
    sinceOn += raw;
    if (sinceOn < 1 || raw > 0.25) return; // settling in, or a hitch (tab switch, GC)
    pace += (raw - pace) * 0.05;
    slowFrames = pace > 1 / 40 ? slowFrames + 1 : 0;
    if (slowFrames < 90) return;
    slowFrames = 0;
    pace = 1 / 60;
    if (!scene?.degrade()) {
      // give the plates up for this visit: flatten them, then hand back to the <img>s
      spent = true;
      scene?.flatten();
      handBack = t + 0.7;
    }
  }

  /** The pointer and the dive have come to rest (snapped onto their goals once they are within a hair of them). */
  function settled() {
    if (Math.abs(goal.mx - cur.mx) > 1e-4 || Math.abs(goal.my - cur.my) > 1e-4 || Math.abs(goal.p - cur.p) > 1e-5) return false;
    cur.mx = goal.mx;
    cur.my = goal.my;
    cur.p = goal.p;
    return true;
  }

  /** The breath's weight `k` s after it was `w`, the pointer at rest: what the loop's `idle` does. */
  const idleAt = (w: number, k: number) => 1 - (1 - w) * Math.exp(-BREATH_IN * k);

  /** The next DRIFT_S of the breath, from document time `at`, as one animation per visible layer. */
  function lift(at: number) {
    drift = { at, bt, idle: cur.idle, mx: cur.mx, my: cur.my, p: cur.p };
    animate(drift);
  }

  function animate(d: NonNullable<typeof drift>) {
    const eyes = Array.from({ length: DRIFT_STEPS + 1 }, (_, i) => eye(d.mx, d.my, d.p, idleAt(d.idle, i * DRIFT_STEP), d.bt + i * DRIFT_STEP));
    let first: Animation | undefined;
    for (const l of all) {
      l.drift?.cancel();
      l.drift = undefined;
      // a hidden layer (a plate the scene draws) would animate on the main thread, every frame
      if (l.el.checkVisibility?.({ visibilityProperty: true }) === false) continue;
      const a = l.el.animate(
        eyes.map((x) => ({ transform: place(l.d, x, L, l.ox, l.oy, l.base) })),
        { duration: DRIFT_S * 1000, fill: "forwards" },
      );
      a.startTime = d.at;
      l.drift = a;
      first ??= a;
    }
    // a minute on, the next minute from where this one ends
    first?.addEventListener("finish", () => {
      if (drift !== d) return;
      drift = { ...d, at: d.at + DRIFT_S * 1000, bt: d.bt + DRIFT_S, idle: idleAt(d.idle, DRIFT_S) };
      animate(drift);
    });
  }

  /** Take the layers back from the compositor, where its breath had got to; the loop writes them again from there. */
  function land(now = (document.timeline.currentTime as number | null) ?? performance.now()) {
    const d = drift;
    if (!d) return;
    drift = null;
    const k = Math.max(0, (now - d.at) / 1000);
    bt = d.bt + k;
    cur.idle = idleAt(d.idle, k);
    for (const l of all) {
      l.drift?.cancel();
      l.drift = undefined;
      l.css = "";
    }
    // written now, from the breath at this moment, so no frame shows the stylesheet's pose
    e = eye(cur.mx, cur.my, cur.p, cur.idle, bt);
    write(cur.p);
  }

  const run = () => {
    const go = visible && !document.hidden && !opts.reduced;
    if (go && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!go && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      // off screen, an animation has nothing to run on the compositor with
      land();
    }
  };

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerType !== "mouse" && ev.pointerType !== "pen") return;
    goal.mx = (ev.clientX / window.innerWidth) * 2 - 1;
    goal.my = (ev.clientY / window.innerHeight) * 2 - 1;
    lastMove = performance.now();
  };
  const onLeave = () => {
    goal.mx = 0;
    goal.my = 0;
  };
  const onScroll = () => {
    goal.p = clamp01(window.scrollY / (heroH || window.innerHeight));
  };

  // A hero that isn't laid out (display: none, a zero-height frame) has nothing to measure: a 0 x 0 lens
  // would leave the camera and the scene in a state they don't come back from. The observer fires again
  // when it gets its size back; by then the plates' entrances (.hero-in) have started over, and the scene
  // is placed on where the images are, so it is placed again once they have played out.
  const laidOut = () => stage.offsetWidth > 0 && stage.offsetHeight > 0;
  let gone = false;
  async function back() {
    const entrances = [...root.querySelectorAll(".hero-in")].flatMap((n) => n.getAnimations());
    await Promise.all(entrances.map((a) => a.finished.catch(() => {})));
    if (laidOut()) scene?.layout(measure());
  }

  // the stage's box and the hero's height, kept by observers so frames never read layout
  const ro = new ResizeObserver(() => {
    if (!laidOut()) {
      gone = true;
      return;
    }
    heroH = root.offsetHeight;
    const l = measure();
    scene?.layout(l);
    onScroll();
    if (gone) {
      gone = false;
      void back();
    }
  });
  ro.observe(stage);
  ro.observe(root);
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    run();
  });
  io.observe(root);

  measure();
  onScroll();
  cur.p = goal.p; // a restored scroll position starts where it is, not with a dive
  if (!opts.reduced) {
    if (fine) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", run);
    e = eye(0, 0, cur.p, 0, 0);
    write(cur.p);
    run();
  }

  function unswap() {
    pendingSwap = false;
    handBack = 0;
    if (!depthOn) return;
    depthOn = false;
    root.removeAttribute("data-depth");
    // the painted layers show again: they take the breath back from the loop
    land();
    scene?.plates(false);
  }

  return {
    attach(s) {
      scene = s;
      if (!laidOut()) return;
      s.layout(measure());
      s.frame(e, 0, cur.p);
    },
    relayout() {
      if (laidOut()) scene?.layout(measure());
    },
    swap() {
      if (spent || opts.reduced) return;
      pendingSwap = true;
      run();
    },
    unswap,
    get spent() {
      return spent;
    },
    dispose() {
      cancelAnimationFrame(raf);
      for (const l of all) l.drift?.cancel();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", run);
    },
  };
}
