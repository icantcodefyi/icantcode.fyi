import { clamp, DAMP, damp, ease, reducedMotion } from "@/lib/motion";
import { subscribe, type Frame } from "@/lib/scroll-loop";
import { camera, eyeFor, OFFSET_CAP, place, reach, siteLens, viewOffset, type Lens } from "./camera";
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
  /** transform-origin in document px, cached on measure */
  ox: number;
  oy: number;
  translate: string;
  scale: string;
}

export interface Rig {
  /** Place `el` at distance `d`; returns the removal. */
  add(el: HTMLElement, d: number): () => void;
  /** Start driving the layers from the scroll loop. `track` sets the camera's scroll offset (default `stage`). */
  attach(stage: HTMLElement, track?: HTMLElement | null): () => void;
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

  const remeasureReach = () => {
    maxReach = 0;
    for (const l of layers) maxReach = Math.max(maxReach, Math.abs(reach(cam, l.d)));
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
    const e = eyeFor(cam, lens, { mx: f.mx, my: f.my, t: f.t, idle: weight, z, s });
    const pin = viewOffset(cam, s, e);
    const cy = f.y + lens.vy;
    for (const l of layers) {
      const p = place(l.d, e, lens, l.ox - lens.vx, l.oy - cy, pin);
      const translate = `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`;
      const scale = p.s.toFixed(5);
      if (translate !== l.translate) l.el.style.translate = l.translate = translate;
      if (scale !== l.scale) l.el.style.scale = l.scale = scale;
    }
    return (arriving && arriveAt !== null) || weight > 0;
  }

  const promote = (on: boolean) => {
    live = on;
    for (const l of layers) l.el.style.willChange = on ? "transform" : "";
  };

  return {
    add(el, d) {
      const l: Layer = { el, d, ox: 0, oy: 0, translate: "", scale: "" };
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
        },
        onActive: promote,
      });
      return () => {
        attached = false;
        off();
        promote(false);
      };
    },
  };
}
