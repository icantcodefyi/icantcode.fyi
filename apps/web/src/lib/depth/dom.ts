import { clamp, DAMP, damp, ease, reducedMotion } from "@/lib/motion";
import { subscribe, type Frame } from "@/lib/scroll-loop";
import { camera, eyeFor, OFFSET_CAP, place, reach, siteLens, viewOffset, type Eye, type Lens } from "./camera";
import type { CameraSpec } from "./types";

/**
 * The DOM backend: elements placed by the site camera. Each layer gets the
 * `translate` and `scale` properties (never `transform`, so a layer's own
 * transforms, hover states and [data-reveal] entrances compose with it),
 * written only when they change, and `will-change` only while its stage is
 * within half a screen.
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
}

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
}

/**
 * Every frame that writes a layer costs a restyle and a re-layerize of the
 * whole page, so at rest the breath steps at 20 Hz instead of every frame:
 * it moves at most ~4 px/s (a foreground layer), so a step is ≤ 0.2 px.
 * Scrolling and the pointer still move the layers every frame.
 */
const BREATH_HZ = 20;

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
  /** the breath's clock tick and its weight then (held between ticks) */
  let beat = -1;
  let held = 0;
  let out: Sink | null = null;
  const view: View = { e: { x: 0, y: 0, z: 0 }, lens, pin: 0, y: 0, dt: 0, t: 0 };

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
    weight += (want - weight) * damp(want > weight ? DAMP.breathIn : DAMP.breathOut, f.dt);
    if (weight < 1e-3 && !want) weight = 0;

    const sMax = maxReach > 0 ? Math.min(f.vh, OFFSET_CAP / maxReach) : f.vh;
    const s = clamp(f.s, -sMax, sMax);
    const tick = Math.floor(f.t * BREATH_HZ);
    if (tick !== beat) {
      beat = tick;
      held = weight;
    }
    const e = eyeFor(cam, lens, { mx: f.mx, my: f.my, t: tick / BREATH_HZ, idle: held, z, s });
    const pin = viewOffset(cam, s, e);
    const cy = f.y + lens.vy;
    for (const l of layers) {
      const p = place(l.d, e, lens, l.ox - lens.vx, l.oy - cy, pin);
      const translate = `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`;
      const scale = p.s.toFixed(5);
      if (translate !== l.translate) l.el.style.translate = l.translate = translate;
      if (scale !== l.scale) l.el.style.scale = l.scale = scale;
    }
    let more = false;
    if (out) {
      view.e = e;
      view.lens = lens;
      view.pin = pin;
      view.y = f.y;
      view.dt = f.dt;
      view.t = f.t;
      more = out.frame(view);
    }
    return (arriving && arriveAt !== null) || weight > 0 || more;
  }

  const promote = (on: boolean) => {
    live = on;
    for (const l of layers) l.el.style.willChange = on ? "transform" : "";
  };

  return {
    add(el, d, span) {
      const l: Layer = { el, d, span: span ? [d, ...span] : undefined, ox: 0, oy: 0, translate: "", scale: "" };
      layers.add(l);
      remeasureReach();
      if (attached) origin(l);
      if (live) el.style.willChange = "transform";
      return () => {
        layers.delete(l);
        remeasureReach();
        el.style.translate = el.style.scale = el.style.willChange = "";
      };
    },
    attach(stage, track) {
      if (reducedMotion()) return () => {};
      attached = true;
      const off = subscribe({
        el: track ?? stage,
        breath: cam.breath > 0,
        onFrame: frame,
        onMeasure: () => {
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
  };
}
