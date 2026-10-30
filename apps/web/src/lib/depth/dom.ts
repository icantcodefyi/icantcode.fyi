import { clamp, DAMP, damp, ease, reducedMotion } from "@/lib/motion";
import { kick, subscribe, type Frame } from "@/lib/scroll-loop";
import { camera, eyeFor, OFFSET_CAP, place, reach, siteLens, viewOffset, type Eye, type Lens } from "./camera";
import type { CameraSpec } from "./types";

/**
 * The DOM backend: elements placed by the site camera. Each layer gets the
 * `translate` and `scale` properties (never `transform`, so a layer's own
 * transforms, hover states and [data-reveal] entrances compose with it),
 * written only when they change, and `will-change` only while its stage is
 * within half a screen. A plate the GL backend draws instead (hidden under
 * the stage's [data-depth], depth-stage.css) isn't written while it is.
 */

interface Layer {
  el: HTMLElement;
  d: number;
  /** the distances a relief plate spans, for the drift cap (GL draws it across them) */
  span?: readonly number[];
  /** transform-origin in document px, cached on measure */
  ox: number;
  oy: number;
  translate: string;
  scale: string;
  /** a plate the GL backend can draw in its place */
  gl: boolean;
  /** its breath on the compositor, while the rig rests */
  drift?: Animation;
}

/** depth-stage.css: what [data-depth] hides once the GL backend draws it. */
const GL_PLATE = '.depth-plate[data-backend="gl"]';

/** The camera of one frame, after the layers are placed: what the GL backend draws from. */
export interface View {
  e: Eye;
  lens: Lens;
  /** viewOffset(): the focus plane's pin, css px */
  pin: number;
  /** scrollY, raw */
  y: number;
  dt: number;
  t: number;
  /** drawn on the rig's own 20 Hz clock while the compositor breathes: no measure of the frame rate */
  paced: boolean;
}

/** Something drawn from the same camera (the GL backend): called in the same frame, after the DOM layers. */
export interface Sink {
  /** true to keep frames coming */
  frame(v: Readonly<View>): boolean;
  /** layout changed (outside frames) */
  measure(): void;
}

export interface Rig {
  /** Place `el` at distance `d`; returns the removal. `span`: the distances a relief drawn for it reaches, so the drift cap holds for them too. */
  add(el: HTMLElement, d: number, span?: readonly number[]): () => void;
  /** Start driving the layers from the scroll loop. `track` sets the camera's scroll offset (default `stage`). */
  attach(stage: HTMLElement, track?: HTMLElement | null): () => void;
  sink(s: Sink | null): void;
  /** Layers were shown or hidden (GL took over the plates or gave them back): write them again. */
  wake(): void;
}

/**
 * Every frame that writes a layer costs a restyle and a re-layerize of the
 * whole page. So once the breath is all that is left to move (scroll
 * settled, pointer at rest long enough that the breath is nearly in), it
 * goes to the compositor: each visible layer gets one animation of
 * `translate` and `scale` sampled from the same breath for the next
 * DRIFT_S, the rest of its fade-in included, and the rig stops writing. A GL
 * sink is drawn at 20 Hz meanwhile, on frames of its own, so the scroll loop
 * sleeps. Not while the sink animates every frame (petals): every main frame
 * restyles each animated layer, which then costs more than writing them.
 * Any change takes the layers back from where the animation had them.
 * Before the hand-over the breath is written, stepped at 20 Hz (it moves at
 * most ~4 px/s, so a step is ≤ 0.2 px); scrolling and the pointer move the
 * layers every frame.
 */
const BREATH_HZ = 20;
const DRIFT_S = 60;
const DRIFT_STEP = 0.5; // s between samples: off the true curve by < 0.02 px
const DRIFT_STEPS = Math.round(DRIFT_S / DRIFT_STEP);
/** how far in the breath must be (Frame.idle) before it goes to the compositor */
const DRIFT_FROM = 0.9;

/** The breath's weight every DRIFT_STEP from `w`, as the loop moves it with the pointer at rest: `idle` rising to 1, the weight after it. */
function weights(w: number, idle: number) {
  const out = [w];
  const dt = 1 / 60;
  for (let i = 0; i < DRIFT_STEPS; i++) {
    for (let j = 0; j < DRIFT_STEP / dt; j++) {
      idle += (1 - idle) * damp(DAMP.breathIn, dt);
      w += (idle - w) * damp(idle > w ? DAMP.breathIn : DAMP.breathOut, dt);
    }
    out.push(w);
  }
  return out;
}

const now = () => (document.timeline.currentTime as number | null) ?? performance.now();

/** A sampled weight at `k` s in (held at the last sample past the end). */
function weightAt(w: number[], k: number) {
  const i = Math.min(w.length - 1, Math.max(0, k / DRIFT_STEP));
  const j = Math.floor(i);
  return j >= w.length - 1 ? w[w.length - 1] : w[j] + (w[j + 1] - w[j]) * (i - j);
}

/** Stages that have played their arrival this visit. */
const arrived = new Set<string>();

function origin(l: Layer) {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = l.el; n; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  const [tx, ty] = getComputedStyle(l.el).transformOrigin.split(" ").map(parseFloat);
  l.ox = x + tx;
  l.oy = y + ty;
}

export function createRig(id: string, spec?: CameraSpec): Rig {
  const cam = camera(spec);
  const layers = new Set<Layer>();
  let attached = false;
  let live = false;
  let lens: Lens = siteLens(1, 1);
  /** the largest |drift| per px of s among the layers, for OFFSET_CAP */
  let maxReach = 0;
  let arriving = !arrived.has(id) && cam.arrival.z !== 0;
  let arriveAt: number | null = null;
  let weight = 0;
  /** the breath's own clock (s), kept while the compositor has it; its tick and the weight then (held between ticks) */
  let bt = 0;
  let beat = -1;
  let held = 0;
  /** the breath on the compositor: from document time `at` (ms) and breath time `bt`, its weight every DRIFT_STEP, for these inputs */
  let drift: { at: number; bt: number; w: number[]; want: number; s: number; cs: number; mx: number; my: number; y: number; vw: number; vh: number } | null = null;
  /** the sink's own frame (or the wait for it) while the compositor has the breath, and whether it asked for frames last time */
  let pumpFrame = 0;
  let pumpTimer = 0;
  let sinkBusy = false;
  /** last frame's inputs, to tell when only the breath is left */
  const prev = { s: Number.NaN, mx: 0, my: 0, y: 0 };
  let out: Sink | null = null;
  let stageEl: HTMLElement | null = null;
  const view: View = { e: { x: 0, y: 0, z: 0 }, lens, pin: 0, y: 0, dt: 0, t: 0, paced: false };

  const remeasureReach = () => {
    maxReach = 0;
    for (const l of layers) for (const d of l.span ?? [l.d]) maxReach = Math.max(maxReach, Math.abs(reach(cam, d)));
  };

  function frame(f: Readonly<Frame>) {
    if (lens.w !== f.vw || lens.h !== f.vh) lens = siteLens(f.vw, f.vh);

    // arrival: held forward until the stage is 15% in, then eased home once
    let z = 0;
    if (arriving) {
      if (arriveAt === null && f.vis >= 0.15) {
        arriveAt = f.t;
        arrived.add(id);
      }
      const k = arriveAt === null ? 0 : (f.t - arriveAt) / (cam.arrival.ms / 1000);
      if (k >= 1) arriving = false;
      else z = cam.arrival.z * (1 - ease.settle(k));
    }
    // the breath fades in while this is the lead scene and the pointer rests
    const want = f.lead && cam.breath > 0 ? f.idle : 0;
    const d = drift;
    if (d && (z !== 0 || f.s !== d.s || f.mx !== d.mx || f.my !== d.my || f.y !== d.y || f.vw !== d.vw || f.vh !== d.vh || want < d.want - 0.01)) land();

    const sMax = maxReach > 0 ? Math.min(f.vh, OFFSET_CAP / maxReach) : f.vh;
    const s = clamp(f.s, -sMax, sMax);
    const cy = f.y + lens.vy;
    if (drift) {
      pump();
      return false;
    }
    weight += (want - weight) * damp(want > weight ? DAMP.breathIn : DAMP.breathOut, f.dt);
    if (weight < 1e-3 && !want) weight = 0;
    bt += f.dt;
    const tick = Math.floor(bt * BREATH_HZ);
    if (tick !== beat) {
      beat = tick;
      held = weight;
    }
    const e = eyeFor(cam, lens, { mx: f.mx, my: f.my, t: tick / BREATH_HZ, idle: held, z, s });
    const pin = viewOffset(cam, s, e);
    // an attribute, not a style: reading it never flushes anything
    const glOn = !!stageEl?.hasAttribute("data-depth");
    for (const l of layers) {
      if (l.gl && glOn) continue;
      const p = place(l.d, e, lens, l.ox - lens.vx, l.oy - cy, pin);
      const translate = `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`;
      const scale = p.s.toFixed(5);
      if (translate !== l.translate) l.el.style.translate = l.translate = translate;
      if (scale !== l.scale) l.el.style.scale = l.scale = scale;
    }
    // nothing left to move but the breath: hand it over
    const still = f.s === prev.s && f.mx === prev.mx && f.my === prev.my && f.y === prev.y;
    if (still && want >= DRIFT_FROM && !arriving && !sinkBusy) {
      drift = { at: now(), bt, w: weights(weight, want), want, s: f.s, cs: s, mx: f.mx, my: f.my, y: f.y, vw: f.vw, vh: f.vh };
      lift(cy);
      pump();
    }
    prev.s = f.s;
    prev.mx = f.mx;
    prev.my = f.my;
    prev.y = f.y;
    let more = false;
    if (out) {
      view.e = e;
      view.lens = lens;
      view.pin = pin;
      view.y = f.y;
      view.dt = f.dt;
      view.t = f.t;
      view.paced = false;
      more = sinkBusy = out.frame(view);
    }
    return (arriving && arriveAt !== null) || (weight > 0 && !drift) || more;
  }

  /**
   * Draw the sink from the breath the compositor is playing, at BREATH_HZ
   * (the GL plates then lag the DOM layers by < 0.2 px), until the layers
   * are taken back, or at once if the sink starts animating on its own.
   */
  function pump() {
    if (pumpFrame || pumpTimer || !out) return;
    let last = now();
    const step = () => {
      pumpFrame = 0;
      const d = drift;
      if (!d || !out) return;
      const t = now();
      const k = (t - d.at) / 1000;
      view.e = eyeFor(cam, lens, { mx: d.mx, my: d.my, t: d.bt + k, idle: weightAt(d.w, k), z: 0, s: d.cs });
      view.pin = viewOffset(cam, d.cs, view.e);
      view.dt = Math.min(0.05, (t - last) / 1000);
      view.t += view.dt;
      view.paced = true;
      last = t;
      if (out.frame(view)) {
        sinkBusy = true;
        land();
        kick();
      } else if (drift === d) {
        pumpTimer = window.setTimeout(() => {
          pumpTimer = 0;
          pumpFrame = requestAnimationFrame(step);
        }, 1000 / BREATH_HZ - 17);
      }
    };
    pumpFrame = requestAnimationFrame(step);
  }

  /** The next DRIFT_S of the breath, from `drift`'s start, as one animation per layer. */
  function lift(cy: number) {
    const d = drift;
    if (!d) return;
    const s = d.cs;
    const eyes = d.w.map((w, i) => eyeFor(cam, lens, { mx: d.mx, my: d.my, t: d.bt + i * DRIFT_STEP, idle: w, z: 0, s }));
    let first: Animation | undefined;
    for (const l of layers) {
      l.drift?.cancel();
      l.drift = undefined;
      // a hidden layer (a plate GL draws) would animate on the main thread, every frame
      if (l.el.checkVisibility?.({ visibilityProperty: true }) === false) continue;
      const frames = eyes.map((e) => {
        const p = place(l.d, e, lens, l.ox - lens.vx, l.oy - cy, viewOffset(cam, s, e));
        return { translate: `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`, scale: p.s.toFixed(5) };
      });
      const a = l.el.animate(frames, { duration: DRIFT_S * 1000, fill: "forwards" });
      a.startTime = d.at;
      l.drift = a;
      first ??= a;
    }
    // a minute on, the next minute from where this one ends (the pump keeps the time if nothing is shown)
    first?.addEventListener("finish", () => {
      if (drift !== d) return;
      const w = d.w[DRIFT_STEPS];
      drift = { ...d, at: d.at + DRIFT_S * 1000, bt: d.bt + DRIFT_S, w: weights(w, 1) };
      lift(cy);
    });
  }

  /** Take the layers back from the compositor, where its breath had got to; they are written again this frame. */
  function land() {
    const d = drift;
    if (!d) return;
    drift = null;
    cancelAnimationFrame(pumpFrame);
    window.clearTimeout(pumpTimer);
    pumpFrame = pumpTimer = 0;
    const k = (now() - d.at) / 1000;
    bt = d.bt + k;
    weight = held = weightAt(d.w, k);
    beat = -1;
    for (const l of layers) {
      l.drift?.cancel();
      l.drift = undefined;
      l.translate = l.scale = "";
    }
  }

  const promote = (on: boolean) => {
    live = on;
    if (!on) land();
    for (const l of layers) l.el.style.willChange = on ? "transform" : "";
  };

  return {
    add(el, d, span) {
      const l: Layer = { el, d, span: span ? [d, ...span] : undefined, ox: 0, oy: 0, translate: "", scale: "", gl: el.matches(GL_PLATE) };
      layers.add(l);
      remeasureReach();
      if (attached) origin(l);
      if (live) el.style.willChange = "transform";
      if (drift) {
        land();
        kick();
      }
      return () => {
        layers.delete(l);
        remeasureReach();
        l.drift?.cancel();
        el.style.translate = el.style.scale = el.style.willChange = "";
      };
    },
    attach(stage, track) {
      if (reducedMotion()) return () => {};
      attached = true;
      stageEl = stage;
      const off = subscribe({
        el: track ?? stage,
        breath: cam.breath > 0,
        onFrame: frame,
        onMeasure: () => {
          land();
          for (const l of layers) origin(l);
          out?.measure();
        },
        onActive: promote,
      });
      return () => {
        attached = false;
        off();
        promote(false);
      };
    },
    sink(s) {
      out = s;
    },
    wake() {
      // the plates GL stopped drawing show again where they are now, written on the next frame
      for (const l of layers) if (l.gl) l.translate = l.scale = "";
      land();
      kick();
    },
  };
}
