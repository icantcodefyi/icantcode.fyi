import { art } from "@/lib/art";
import { firstScroll } from "@/lib/day-art";
import type { Mode } from "@/lib/mode";
import { atRest, kick, resting, scrollPace } from "@/lib/scroll-loop";
import { acquire, allowed, enlist, nudge, release, spend, type Entry } from "./budget";
import { OFFSET_CAP } from "./camera";
import type { Rig, Sink } from "./dom";
import { fitRect, type Rect } from "./fit";
import type { DepthScene, GroupLayout, SceneView, Sources } from "./scene";
import type { AmbientSpec, PlateSpec, StageSpec } from "./types";

/**
 * A stage's GL lifecycle (PLAN §6.4). three.js and the scene load only
 * when a stage first comes near.
 *
 *   idle     the <img>s, on the DOM camera
 *   near     (1 screen away, after the visitor's first scroll, once they
 *            are at rest) contexts from the budget, a canvas per group of
 *            plates, the current mode's plates uploaded in small steps
 *            (each waits while the page scrolls fast). A visitor reading on
 *            without stopping (slower than READING px/s) gets it as before,
 *            the steps at frame pace; a flick past loads nothing mid-flick
 *   swap     on the next frame the plates draw flat, exactly where the
 *            <img>s are, and [data-depth] hides the <img>s in that same
 *            frame; the relief then eases in over --dur-arrive
 *   run      drawn from the rig's camera each frame, only when it changed;
 *            the other mode's plates go up in idle time, for the switch
 *   far      (2.5 screens away, or evicted, or given up) flattened first
 *            if on screen, then the <img>s back, everything disposed
 *   lost     a lost context hands back at once and retries on the next
 *            approach; a second loss keeps the stage on its <img>s
 *
 * The governor is the hero's: 90 slow frames (over 1/40 s) cost a quarter
 * of the resolution; with nothing left to give it hands back and spends
 * the visit, so no later stage starts GL either.
 */

export interface Group {
  z: number;
  plates: PlateSpec[];
  ambient: AmbientSpec[];
}

/**
 * The places a canvas may go: runs of GL plates in paint order (z, then
 * array order), split where the z changes or a DOM plate comes between.
 * Each run gets a slot in the DOM right after its last plate; when the
 * stage comes near, runs with no DOM layer painting between them share one
 * canvas (merge()). Null if GL would bring nothing (no depth atlas).
 */
export function groupsOf(spec: StageSpec): Group[] | null {
  const order = spec.plates.map((p, i) => ({ p, i })).sort((a, b) => a.p.z - b.p.z || a.i - b.i);
  const groups: Group[] = [];
  let run: Group | null = null;
  for (const { p } of order) {
    if (p.backend === "dom") {
      run = null;
      continue;
    }
    if (!run || run.z !== p.z) groups.push((run = { z: p.z, plates: [], ambient: [] }));
    run.plates.push(p);
  }
  if (!groups.some((g) => g.plates.some((p) => p.depth))) return null;
  for (const a of spec.ambient ?? []) (groups.find((g) => g.z === (a.z ?? groups[0].z)) ?? groups[0]).ambient.push(a);
  return groups;
}

/** For each plate id, the canvases that follow it in the DOM: each run's comes right after its last plate. */
export function canvasesAfter(spec: StageSpec, groups: Group[] | null) {
  const after = new Map<string, number[]>();
  groups?.forEach((g, i) => {
    const last = spec.plates.filter((p) => g.plates.includes(p)).at(-1) as PlateSpec;
    after.set(last.id, [...(after.get(last.id) ?? []), i]);
  });
  return after;
}

/**
 * Runs that can share a canvas: consecutive runs with no other child of the
 * stage painting between them (a child whose z-index is at least the lower
 * run's and below the upper one's; children come after the plates in the
 * DOM). Read from the computed styles when the stage comes near. Each
 * canvas goes in its topmost run's slot.
 */
function merge(runs: Group[], stage: HTMLElement) {
  const zs: number[] = [];
  for (const c of stage.children) {
    if (c.classList.contains("depth-gl") || (c.classList.contains("depth-plate") && c.getAttribute("data-backend") !== "dom")) continue;
    const cs = getComputedStyle(c);
    // in-flow children paint under every positioned plate
    if (cs.display === "none" || cs.position === "static") continue;
    zs.push(cs.zIndex === "auto" ? 0 : Number.parseInt(cs.zIndex, 10));
  }
  const out: { slot: number; plates: PlateSpec[]; ambient: AmbientSpec[] }[] = [];
  runs.forEach((r, i) => {
    const prev = runs[i - 1];
    const join = prev && prev.z < r.z && !zs.some((z) => z >= prev.z && z < r.z);
    const g = join ? out[out.length - 1] : (out[out.length] = { slot: i, plates: [], ambient: [] });
    g.slot = i;
    g.plates.push(...r.plates);
    g.ambient.push(...r.ambient);
  });
  return out;
}

export interface GL {
  /** the page's mode changed; `instant` under the view-transition switch (draw it now, before the snapshot) */
  mode(m: Mode, instant: boolean): void;
  /** a plate's day <img> has mounted */
  day(id: string): void;
  dispose(): void;
}

type State = "idle" | "loading" | "ready" | "live" | "leaving" | "off";
type Reason = "far" | "evict" | "spent" | "lost" | "fail" | "dispose";

const FLATTEN_MS = 700;
/** Scrolling slower than this (px/s), the visitor is reading: a stage comes up without waiting for a rest. */
const READING = 600;

function loaded(img: HTMLImageElement) {
  if (img.complete) return Promise.resolve(img.naturalWidth > 0);
  return new Promise<boolean>((r) => {
    img.addEventListener("load", () => r(img.naturalWidth > 0), { once: true });
    img.addEventListener("error", () => r(false), { once: true });
  });
}

export function createGL(stage: HTMLElement, spec: StageSpec, runs: Group[], rig: Rig, mode0: Mode): GL {
  const slots = runs.map((_, i) => stage.querySelector<HTMLElement>(`:scope > [data-depth-gl="${i}"]`) as HTMLElement);
  const plates = runs.flatMap((g) => g.plates);
  const divs = new Map(plates.map((p) => [p.id, stage.querySelector<HTMLElement>(`:scope > [data-plate="${CSS.escape(p.id)}"]`)]));
  const phone = window.matchMedia("(pointer: coarse)").matches;
  const dpr = Math.min(window.devicePixelRatio || 1, phone ? (spec.dpr?.phone ?? 2) : (spec.dpr?.desktop ?? 1.5));

  let state: State = "idle";
  let scene: DepthScene | null = null;
  /** this approach's canvases: their runs' plates, the slot each sits in, the canvas */
  let groups: ReturnType<typeof merge> = [];
  let wraps: HTMLElement[] = [];
  let canvases: HTMLCanvasElement[] = [];
  let mode = mode0;
  /** bumped by every teardown: anything in flight from before gives up */
  let gen = 0;
  let near = false;
  let visible = false;
  let lost = 0;
  let swap = false;
  // geometry, from measure(): the stage's document offset and height, each canvas's box on the stage
  let docX = 0;
  let docY = 0;
  let stageH = 0;
  let boxes: Rect[] = [];
  let layout: GroupLayout[] | null = null;
  const view: SceneView = { e: { x: 0, y: 0, z: 0 }, f: 1, pin: 0, vp: [], dt: 0, live: false };
  // the governor
  let pace = 1 / 60;
  let slow = 0;
  let sinceOn = 0;
  let lastNow = 0;
  // wakes whatever waits on a day <img> or for a teardown
  let poke = () => {};
  const poked = () => new Promise<void>((r) => (poke = r));
  const reading = () => scrollPace() < READING;
  /** What the bring-up waits on between its steps: the visitor at rest, or reading on. */
  const calm = () =>
    resting() || reading()
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          let done = false;
          const go = () => {
            if (done) return;
            done = true;
            resolve();
          };
          void atRest().then(go);
          const look = () => (done ? undefined : reading() ? go() : window.setTimeout(look, 100));
          look();
        });

  function distance() {
    const top = docY - window.scrollY;
    const vh = window.innerHeight;
    return top > vh ? top - vh : top + stageH < 0 ? -(top + stageH) : 0;
  }

  const entry: Entry = {
    id: spec.id,
    state: () => state,
    dpr: () => scene?.dpr ?? 0,
    fps: () => Math.round(1 / pace),
    relief: () => Math.round((scene?.relief ?? 0) * 1000) / 1000,
    distance,
    evict: () => leave("evict"),
    retry: () => void approach(),
  };
  const unlist = enlist(entry);
  const warned = new Set<string>();

  /** Layout reads: on resize and reflow only, never in a frame. */
  function measure() {
    let x = 0;
    let y = 0;
    for (let n: HTMLElement | null = stage; n; n = n.offsetParent as HTMLElement | null) {
      x += n.offsetLeft;
      y += n.offsetTop;
    }
    docX = x;
    docY = y;
    stageH = stage.offsetHeight;
    if (!scene) return;
    // each plate's <img> where it rests: the camera's translate/scale lifted, any ancestor scale divided out
    const held = [...divs.values()].map((d) => [d, d?.style.translate ?? "", d?.style.scale ?? ""] as const);
    for (const [d] of held) if (d) d.style.translate = d.style.scale = "";
    const sr = stage.getBoundingClientRect();
    const k = stage.offsetWidth ? sr.width / stage.offsetWidth : 1;
    const W = sr.width / k;
    const H = sr.height / k;
    const rects = new Map<string, Rect>();
    for (const p of plates) {
      const img = divs.get(p.id)?.querySelector("img");
      if (!img) continue;
      const r = img.getBoundingClientRect();
      const cs = getComputedStyle(img);
      if (import.meta.env.DEV && !warned.has(p.id) && (cs.maskImage !== "none" || cs.filter !== "none" || cs.opacity !== "1") && warned.add(p.id))
        console.warn(`[depth] ${spec.id}/${p.id}: GL can't draw the <img>'s mask, filter or opacity; use PlateSpec.fade or backend: "dom"`);
      const [px, py] = cs.objectPosition.split(" ").map((v) => parseFloat(v) / 100);
      const bw = r.width / k;
      const bh = r.height / k;
      const f = cs.objectFit === "fill" ? { x: 0, y: 0, w: bw, h: bh } : fitRect(bw, bh, p.size[0], p.size[1], cs.objectFit === "contain" ? "contain" : "cover", px, py);
      rects.set(p.id, { x: (r.left - sr.left) / k - stage.clientLeft + f.x, y: (r.top - sr.top) / k - stage.clientTop + f.y, w: f.w, h: f.h });
    }
    for (const [d, t, s] of held) {
      if (!d) continue;
      d.style.translate = t;
      d.style.scale = s;
    }
    const pct = (a: { x: number; y: number; w: number; h: number }, b: Rect): Rect => ({
      x: (a.x / 100) * W - b.x,
      y: (a.y / 100) * H - b.y,
      w: (a.w / 100) * W,
      h: (a.h / 100) * H,
    });
    layout = groups.map((g, i) => {
      // the run's plates and as far as the camera can carry them, cut at the stage's edges
      let l = Infinity;
      let t = Infinity;
      let r = -Infinity;
      let b = -Infinity;
      for (const p of g.plates) {
        const q = rects.get(p.id);
        if (!q) continue;
        l = Math.min(l, q.x);
        t = Math.min(t, q.y);
        r = Math.max(r, q.x + q.w);
        b = Math.max(b, q.y + q.h);
      }
      const x0 = Math.max(0, Math.floor(l - OFFSET_CAP));
      const y0 = Math.max(0, Math.floor(t - OFFSET_CAP));
      const box = { x: x0, y: y0, w: Math.max(1, Math.min(W, Math.ceil(r + OFFSET_CAP)) - x0), h: Math.max(1, Math.min(H, Math.ceil(b + OFFSET_CAP)) - y0) };
      boxes[i] = box;
      const st = wraps[i].style;
      st.left = `${box.x}px`;
      st.top = `${box.y}px`;
      st.width = `${box.w}px`;
      st.height = `${box.h}px`;
      const own: Record<string, Rect> = {};
      for (const p of g.plates) {
        const q = rects.get(p.id);
        if (q) own[p.id] = { x: q.x - box.x, y: q.y - box.y, w: q.w, h: q.h };
      }
      const whole = { x: 0, y: 0, w: 100, h: 100 };
      return { w: box.w, h: box.h, rects: own, ambient: g.ambient.map((a) => ({ area: pct(a.area ?? whole, box), masks: (a.mask ?? []).map((m) => pct(m, box)) })) };
    });
    scene.layout(layout);
  }

  const sink: Sink = {
    frame(v) {
      const s = scene;
      if (!s || !layout) return false;
      if (swap) {
        // the plates' first frame and the <img>s stepping aside land in the same frame
        swap = false;
        s.plates(true);
        stage.setAttribute("data-depth", "");
        rig.wake();
        state = "live";
        sinceOn = 0;
        slow = 0;
        pace = 1 / 60;
        lastNow = 0;
      }
      view.e = v.e;
      view.f = v.lens.f;
      view.pin = v.pin;
      view.dt = v.dt;
      view.live = visible;
      boxes.forEach((b, i) => {
        view.vp[i][0] = v.lens.vx - (docX + b.x);
        view.vp[i][1] = v.lens.vy - (docY + b.y - v.y);
      });
      const busy = s.frame(view);
      if (v.paced) lastNow = 0;
      else if (state === "live") govern();
      return busy;
    },
    measure,
  };
  rig.sink(sink);

  function govern() {
    const now = performance.now();
    const raw = (now - lastNow) / 1000;
    lastNow = now;
    // settling in, or a hitch (tab switch, GC, the loop restarting after a rest)
    if (raw > 0.25) return;
    sinceOn += raw;
    if (sinceOn < 1) return;
    pace += (raw - pace) * 0.05;
    slow = pace > 1 / 40 ? slow + 1 : 0;
    if (slow < 90) return;
    slow = 0;
    pace = 1 / 60;
    if (!scene?.degrade()) {
      spend();
      void leave("spent");
    }
  }

  /** The sources for `m`: each plate's <img> as it loaded (its currentSrc), and its depth atlas. */
  async function sources(m: Mode, g: number): Promise<Sources | null> {
    const out: Sources = {};
    for (const p of plates) {
      const set = p.art.day === p.art.night ? "night" : m;
      let img: HTMLImageElement | null | undefined;
      // a day <img> mounts once useDayArt has confirmed it
      while (!(img = divs.get(p.id)?.querySelector<HTMLImageElement>(`img[data-set="${set}"]`))) {
        await poked();
        if (g !== gen) return null;
      }
      if (!(await loaded(img)) || g !== gen) return null;
      const atlas = p.depth && art(p.depth.atlas[p.depth.atlas.day === p.depth.atlas.night ? "night" : m]);
      out[p.id] = { color: img.currentSrc || img.src, depth: atlas || undefined };
    }
    return out;
  }

  /** Upload `m` (if need be), then swap in on the next frame. */
  async function bring(m: Mode, g: number) {
    const s = scene;
    if (!s) return;
    if (!s.has(m)) {
      const src = await sources(m, g);
      if (g !== gen) return;
      if (!src || !(await s.load(m, src))) {
        if (g === gen) void leave("fail");
        return;
      }
      if (g !== gen) return;
    }
    // switched again while it loaded
    if (m !== mode) return bring(mode, g);
    s.setMode(m, true);
    state = "ready";
    swap = true;
    kick();
    void other(g);
  }

  /**
   * The other mode's plates go up too, at rest once these are in (its
   * <img>s are already there or come with useDayArt), and both stay while
   * the stage is near: a switch is then a crossfade on the reliefs, never a
   * step back to the <img>s.
   */
  async function other(g: number) {
    await atRest();
    const s = scene;
    const m: Mode = mode === "day" ? "night" : "day";
    if (!s || g !== gen || s.has(m)) return;
    const src = await sources(m, g);
    if (src && g === gen) await s.load(m, src);
  }

  async function approach() {
    if (state !== "idle" || !near || !allowed()) return;
    state = "loading";
    const g = ++gen;
    // nothing of this loads while the page itself is still loading, nor on a scroll's frames
    await firstScroll();
    await calm();
    if (g !== gen) return;
    groups = merge(runs, stage);
    wraps = groups.map((gr) => slots[gr.slot]);
    boxes = groups.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
    view.vp = groups.map(() => [0, 0]);
    if (!(await acquire(entry, groups.length))) {
      if (g === gen) state = "idle";
      return;
    }
    if (g !== gen) return release(entry);
    try {
      const { createDepthScene } = await import("./scene");
      if (g !== gen) return release(entry);
      // a fresh canvas each time: a canvas keeps the context it first had, even once lost
      const cvs = (canvases = wraps.map((w) => w.appendChild(document.createElement("canvas"))));
      const s = await createDepthScene(
        groups.map((gr, i) => ({ canvas: cvs[i], plates: gr.plates, ambient: gr.ambient })),
        { id: spec.id, mode, dpr, calm },
      );
      const onLost = () => {
        if (scene !== s) return;
        lost++;
        void leave("lost");
      };
      for (const c of cvs) c.addEventListener("webglcontextlost", onLost);
      if (g !== gen) {
        s.dispose();
        for (const c of cvs) c.remove();
        return release(entry);
      }
      scene = s;
      measure();
      await bring(mode, g);
    } catch {
      // no WebGL here after all: the <img>s stand on their own
      if (g === gen) void leave("fail");
    }
  }

  /** Back to the <img>s and give everything up; flattened first when that would show. */
  function leave(why: Reason): Promise<void> {
    if (state === "leaving" || state === "off" || (state === "idle" && !scene)) {
      if (why === "spent" || why === "dispose") state = "off";
      return Promise.resolve();
    }
    const g = ++gen;
    poke();
    const s = scene;
    const cvs = canvases;
    const finish = () => {
      stage.removeAttribute("data-depth");
      rig.wake();
      swap = false;
      s?.dispose();
      for (const c of cvs) c.remove();
      if (scene === s) {
        scene = null;
        canvases = [];
      }
      release(entry);
      if (g === gen || why === "dispose") state = why === "far" || why === "evict" || (why === "lost" && lost < 2) ? "idle" : "off";
    };
    if (s && state === "live" && visible && (why === "evict" || why === "spent")) {
      state = "leaving";
      s.flatten();
      kick();
      return new Promise((r) =>
        window.setTimeout(() => {
          finish();
          r();
        }, FLATTEN_MS),
      );
    }
    finish();
    return Promise.resolve();
  }

  const nearIO = new IntersectionObserver(
    ([e]) => {
      near = e.isIntersecting;
      if (near) void approach();
    },
    { rootMargin: "100% 0px" },
  );
  const farIO = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) void leave("far");
    },
    { rootMargin: "250% 0px" },
  );
  const seeIO = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) {
      kick();
      void approach();
    } else if (scene) nudge();
  });
  measure();
  nearIO.observe(stage);
  // (its section: a section skipped while far (useSkipAway) reports nothing inside it as intersecting)
  farIO.observe(stage.closest("[data-page] > *") ?? stage);
  seeIO.observe(stage);

  return {
    mode(m, instant) {
      if (m === mode) return;
      mode = m;
      const s = scene;
      if (!s || (state !== "live" && state !== "ready")) return; // a load in flight picks the new mode up
      if (s.setMode(m, instant)) {
        if (instant) s.draw();
        else kick();
        return;
      }
      // not uploaded: the <img>s show the new mode now, and the plates take over again once it's up
      stage.removeAttribute("data-depth");
      rig.wake();
      s.plates(false);
      swap = false;
      state = "loading";
      void bring(m, gen);
    },
    day: () => poke(),
    dispose() {
      nearIO.disconnect();
      farIO.disconnect();
      seeIO.disconnect();
      rig.sink(null);
      void leave("dispose");
      state = "off";
      unlist();
    },
  };
}
