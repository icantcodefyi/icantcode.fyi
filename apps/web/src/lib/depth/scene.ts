import { type BufferGeometry, type Mesh, PerspectiveCamera, Scene, type ShaderMaterial, type Texture, Vector4, WebGLRenderer } from "three";

import { smooth } from "@/lib/motion";
import { EYE, type Eye } from "./camera";
import type { Rect } from "./fit";
import { colorTexture, createPlate, depthTexture, flatDepth, grid, gridFor, plateShared, type PlateShared } from "./plate";
import { createSprites, type Sprites } from "./sprites";
import type { AmbientSpec, Mode, PlateSpec } from "./types";

/**
 * The GL backend of a <DepthStage>: its plates as reliefs on the site
 * camera, one canvas (one WebGL context) per group of plates that no DOM
 * layer comes between (lib/depth/gl.ts). Each canvas draws its plates in
 * order, each over the last and depth-tested only against itself. Ambient
 * sprites go in after the last plate that reaches as far back as they do,
 * depth-tested against it, so the plates nearer than them cover them.
 *
 * Everything comes up in small steps, one per frame and each in a task of
 * its own (the hero's pattern, commit 0d0ba16): each context, each grid,
 * each plate's upload; images decode off the main thread from Blobs, and
 * shaders link in parallel. Nothing renders until the stage swaps it in.
 */

export interface SceneGroup {
  canvas: HTMLCanvasElement;
  plates: PlateSpec[];
  ambient: AmbientSpec[];
}

/** One mode's sources per plate id: the file its <img> shows, and its depth atlas (with the plate's tile). */
export type Sources = Record<string, { color: string; depth?: string }>;

export interface GroupLayout {
  /** the canvas, css px */
  w: number;
  h: number;
  /** each plate's rest rect on the canvas, css px, by plate id */
  rects: Record<string, Rect>;
  /** per ambient spec of the group, its area and masks on the canvas, css px */
  ambient: { area: Rect; masks: Rect[] }[];
}

export interface SceneView {
  e: Eye;
  /** focal length and view offset (camera.ts) */
  f: number;
  pin: number;
  /** per group, the viewport's centre on its canvas, css px */
  vp: [number, number][];
  dt: number;
  /** on screen: the sprites move */
  live: boolean;
}

export interface DepthScene {
  /** upload one mode's plates; false if anything failed */
  load(mode: Mode, src: Sources): Promise<boolean>;
  has(mode: Mode): boolean;
  /** free a mode's plates (textures the other mode shares stay) */
  drop(mode: Mode): void;
  /** show `mode`: a crossfade, or at once when `instant`; false if its plates aren't loaded */
  setMode(mode: Mode, instant: boolean): boolean;
  layout(groups: GroupLayout[]): void;
  /** advance and draw if anything changed; true while something is still moving */
  frame(v: SceneView): boolean;
  /** draw the last view again, now (a mode switch about to be snapshotted) */
  draw(): void;
  /** hand the painting to the plates (they start flat and ease into relief), or take it back */
  plates(on: boolean): void;
  /** ease the relief back to flat, so the <img>s can take over without a jump */
  flatten(): void;
  /** drop to a lower resolution; false once there is nothing left to give */
  degrade(): boolean;
  readonly dpr: number;
  readonly relief: number;
  dispose(): void;
}

const MODES: Mode[] = ["night", "day"];
const RELIEF_IN = 1.4; // s (--dur-arrive)
const FLATTEN = 0.6; // s
const MODE_FADE = 1.1; // s (--dur-scene)

/** Resolves just after the next frame is drawn, in a task of its own, so a step never adds to a frame's own work. */
const frameOnce = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/** `url` as a Blob (decoded on the image decoder's thread, not the main one). The <img>s have already cached it. */
const blob = (url: string) =>
  fetch(url, { cache: "force-cache" }).then((r) => {
    if (!r.ok) throw new Error(url);
    return r.blob();
  });

interface PlateSet {
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  scene: Scene;
  map: Texture;
  depth: Texture;
  /** what the textures were made from, to share them with the other mode */
  mapKey: string;
  depthKey: string;
}

interface Group {
  r: WebGLRenderer;
  camera: PerspectiveCamera;
  shared: PlateShared;
  plates: PlateSpec[];
  ambient: AmbientSpec[];
  /** per ambient spec, the plate it is drawn after (-1: before them all) */
  after: number[];
  sprites: Sprites | null;
  /** the last layout's ambient areas, kept for sprites made after it */
  areas: GroupLayout["ambient"];
  flat: Texture | null;
  w: number;
  h: number;
}

export async function createDepthScene(defs: SceneGroup[], opts: { id: string; mode: Mode; dpr: number }): Promise<DepthScene> {
  let disposed = false;
  const make = (canvas: HTMLCanvasElement) => {
    const r = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false, // plates take their edges from texture alpha
      premultipliedAlpha: true,
      stencil: false,
      powerPreference: "high-performance",
    });
    r.autoClear = false;
    r.setClearColor(0x000000, 0);
    // the shaders are fixed: skip the error checks' round trips to the GPU on each one's first draw
    r.debug.checkShaderErrors = import.meta.env.DEV;
    return r;
  };

  const groups: Group[] = [];
  for (const d of defs) {
    // each context on a frame of its own
    await frameOnce();
    if (disposed) break;
    // the last plate reaching at least as far back as the sprites' near edge
    const after = d.ambient.map((a) => d.plates.reduce((at, p, i) => ((p.depth ? p.range.far : p.range.flat) >= a.depth[0] ? i : at), -1));
    groups.push({ r: make(d.canvas), camera: new PerspectiveCamera(), shared: plateShared(), plates: d.plates, ambient: d.ambient, after, sprites: null, areas: [], flat: null, w: 1, h: 1 });
  }

  const rects = new Map<string, { value: Vector4 }>();
  for (const g of groups) for (const p of g.plates) rects.set(p.id, { value: new Vector4() });
  const relief = { value: 0 };
  const grids = new Map<string, BufferGeometry>();
  const sets: Partial<Record<Mode, Map<string, PlateSet>>> = {};
  const loading: Partial<Record<Mode, Promise<boolean>>> = {};

  let mode = opts.mode;
  /** 0 = night, 1 = day: the day plates are drawn over the night ones at this opacity, as the <img>s stack */
  let dayMix = mode === "day" ? 1 : 0;
  let on = false;
  let rel = 0;
  let flat = false;
  let scale = 1;
  let dpr = opts.dpr;
  let last: SceneView | null = null;
  let dirty = true;
  let seen = "";

  function size() {
    dpr = Math.max(0.5, opts.dpr * scale);
    for (const g of groups) {
      g.r.setPixelRatio(dpr);
      g.r.setSize(g.w, g.h, false);
      g.sprites?.resize(g.w, g.h, dpr);
    }
    dirty = true;
  }

  function shareable(id: string, key: "mapKey" | "depthKey", value: string, m: Mode) {
    const other = sets[m === "day" ? "night" : "day"]?.get(id);
    return other && other[key] === value ? other[key === "mapKey" ? "map" : "depth"] : null;
  }

  async function upload(m: Mode, src: Sources) {
    const all = groups.flatMap((g) => g.plates.map((p) => ({ g, p })));
    const atlases = new Map<string, Promise<Blob>>();
    // decode everything first, off the main thread
    const bitmaps = await Promise.all(
      all.map(async ({ p }) => {
        const s = src[p.id];
        const tile = p.depth?.tile;
        const depthKey = s.depth && tile ? `${s.depth}#${tile.join(",")}` : "flat";
        const color = shareable(p.id, "mapKey", s.color, m) ? null : blob(s.color).then((b) => createImageBitmap(b, { premultiplyAlpha: "premultiply" }));
        let depth: Promise<ImageBitmap> | null = null;
        if (s.depth && tile && !shareable(p.id, "depthKey", depthKey, m)) {
          const url = s.depth;
          if (!atlases.has(url)) atlases.set(url, blob(url));
          depth = (atlases.get(url) as Promise<Blob>).then((b) =>
            createImageBitmap(b, tile[0], tile[1], tile[2], tile[3], { premultiplyAlpha: "none", colorSpaceConversion: "none" }),
          );
        }
        return { color: await color, depth: await depth, mapKey: s.color, depthKey };
      }),
    );
    const out = new Map<string, PlateSet>();
    const fresh: Texture[] = [];
    try {
      for (const [i, { g, p }] of all.entries()) {
        const b = bitmaps[i];
        // the plate's grid on a frame of its own (shared by both modes)
        const [cols, rows] = gridFor(p, rects.get(p.id)?.value.z ?? 0);
        const pad = p.pad ?? (p.kind === "opaque" ? [0.08, 0.08, 0.08, 0.08] : [0, 0, 0, 0]);
        const gk = `${p.id}:${cols}x${rows}:${pad.join(",")}`;
        if (!grids.has(gk)) {
          await frameOnce();
          if (disposed) return false;
          grids.set(gk, grid(cols, rows, pad));
        }
        // then its textures go up and its material is made
        await frameOnce();
        if (disposed) return false;
        let map = shareable(p.id, "mapKey", b.mapKey, m);
        if (!map) fresh.push((map = colorTexture(b.color as ImageBitmap)));
        let depth = shareable(p.id, "depthKey", b.depthKey, m);
        if (!depth && b.depth) fresh.push((depth = depthTexture(b.depth)));
        depth ??= g.flat ??= flatDepth();
        g.r.initTexture(map);
        g.r.initTexture(depth);
        b.color?.close();
        b.depth?.close();
        const mesh = createPlate(p, grids.get(gk) as BufferGeometry, map, depth, g.shared, rects.get(p.id) as { value: Vector4 }, relief);
        out.set(p.id, { mesh, scene: new Scene().add(mesh), map, depth, mapKey: b.mapKey, depthKey: b.depthKey });
      }
      // linked in parallel, off the main thread
      await Promise.all(all.map(({ g, p }) => g.r.compileAsync((out.get(p.id) as PlateSet).scene, g.camera)));
      // the sprites, once per stage: their atlas is painted on a frame of its own
      for (const g of groups) {
        if (!g.ambient.length || g.sprites || disposed) continue;
        await frameOnce();
        g.sprites = createSprites(g.ambient, g.shared, mode, opts.id);
        g.sprites.resize(g.w, g.h, dpr);
        g.sprites.layout(g.areas);
        await g.sprites.compile(g.r, g.camera);
      }
    } catch (e) {
      for (const s of out.values()) s.mesh.material.dispose();
      for (const t of fresh) t.dispose();
      throw e;
    } finally {
      for (const b of bitmaps) {
        b.color?.close();
        b.depth?.close();
      }
    }
    if (disposed) return false;
    sets[m] = out;
    dirty = true;
    return true;
  }

  function lens(g: Group, v: SceneView, i: number) {
    const [px, py] = v.vp[i] ?? [g.w / 2, g.h / 2];
    // an off-centre frustum: the principal point is the viewport's centre, moved by the view offset
    const vx = px;
    const vy = py + v.pin;
    const n = 0.1;
    const c = g.camera;
    c.projectionMatrix.makePerspective((-vx / v.f) * n, ((g.w - vx) / v.f) * n, (vy / v.f) * n, (-(g.h - vy) / v.f) * n, n, 1000);
    c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
    c.position.set(v.e.x, -v.e.y, EYE - v.e.z);
    c.updateMatrixWorld();
    g.shared.uVp.value.set(px, py);
    g.shared.uF.value = v.f;
  }

  function render() {
    const v = last;
    if (!v || disposed) return;
    relief.value = smooth(0, 1, rel);
    groups.forEach((g, i) => {
      g.r.clear();
      if (!on) return;
      lens(g, v, i);
      const sprites = (at: number) => {
        g.after.forEach((a, k) => {
          if (a === at && g.sprites) g.r.render(g.sprites.scenes[k], g.camera);
        });
      };
      sprites(-1);
      let first = true;
      g.plates.forEach((p, pi) => {
        for (const m of MODES) {
          const s = sets[m]?.get(p.id);
          // night stays whole under the day plates while they fade, as the <img>s do
          const op = m === "day" ? dayMix : dayMix < 0.999 || !sets.day ? 1 : 0;
          if (!s || op < 0.001) continue;
          s.mesh.material.uniforms.uOpacity.value = op;
          if (!first) g.r.clearDepth();
          g.r.render(s.scene, g.camera);
          first = false;
        }
        sprites(pi);
      });
    });
  }

  function key(v: SceneView) {
    let k = `${v.e.x.toFixed(5)},${v.e.y.toFixed(5)},${v.e.z.toFixed(5)},${v.pin.toFixed(2)},${v.f.toFixed(2)}`;
    for (const [x, y] of v.vp) k += `|${x.toFixed(2)},${y.toFixed(2)}`;
    return k;
  }

  return {
    load(m, src) {
      return (loading[m] ??= upload(m, src).catch(() => false).then((ok) => {
        if (!ok) delete loading[m];
        return ok;
      }));
    },
    has: (m) => !!sets[m],
    drop(m) {
      const s = sets[m];
      if (!s || m === mode) return;
      const other = sets[m === "day" ? "night" : "day"];
      for (const [id, ps] of s) {
        ps.mesh.material.dispose();
        const o = other?.get(id);
        if (ps.map !== o?.map) ps.map.dispose();
        if (ps.depth !== o?.depth && ps.depth.image instanceof ImageBitmap) ps.depth.dispose();
      }
      delete sets[m];
      delete loading[m];
      dirty = true;
    },
    setMode(next, instant) {
      if (!sets[next]) return false;
      mode = next;
      for (const g of groups) g.sprites?.setMode(next, instant);
      if (instant) dayMix = next === "day" ? 1 : 0;
      dirty = true;
      return true;
    },
    layout(ls) {
      groups.forEach((g, i) => {
        const l = ls[i];
        if (!l) return;
        g.w = Math.max(1, l.w);
        g.h = Math.max(1, l.h);
        g.areas = l.ambient;
        for (const p of g.plates) {
          const r = l.rects[p.id];
          if (r) rects.get(p.id)?.value.set(r.x, r.y, r.w, r.h);
        }
      });
      size();
      for (const g of groups) g.sprites?.layout(g.areas);
      render();
    },
    frame(v) {
      if (disposed) return false;
      const dt = v.dt;
      let busy = false;
      if (on) {
        const goal = flat ? 0 : 1;
        if (rel !== goal) {
          rel = flat ? Math.max(0, rel - dt / FLATTEN) : Math.min(1, rel + dt / RELIEF_IN);
          busy = true;
          dirty = true;
        }
      }
      const goal = mode === "day" ? 1 : 0;
      if (dayMix !== goal) {
        dayMix = goal > dayMix ? Math.min(1, dayMix + dt / MODE_FADE) : Math.max(0, dayMix - dt / MODE_FADE);
        busy = true;
        dirty = true;
      }
      const moving = on && v.live && groups.some((g) => g.sprites);
      if (moving) {
        for (const g of groups) g.sprites?.tick(dt);
        busy = true;
        dirty = true;
      }
      const k = key(v);
      last = v;
      if (dirty || k !== seen) {
        seen = k;
        dirty = false;
        render();
      }
      return busy;
    },
    draw() {
      dirty = false;
      render();
    },
    plates(next) {
      if (next === on) return;
      on = next;
      rel = 0;
      flat = false;
      dirty = true;
      if (!on) for (const g of groups) g.r.clear();
    },
    flatten() {
      flat = true;
    },
    degrade() {
      if (dpr <= 1) return false;
      scale *= 0.75;
      size();
      return true;
    },
    get dpr() {
      return dpr;
    },
    get relief() {
      return rel;
    },
    dispose() {
      disposed = true;
      for (const m of MODES) {
        for (const s of sets[m]?.values() ?? []) {
          s.mesh.material.dispose();
          s.map.dispose();
          s.depth.dispose();
        }
      }
      for (const g of grids.values()) g.dispose();
      for (const g of groups) {
        g.sprites?.dispose();
        g.flat?.dispose();
        g.r.dispose();
        // free it now, not at garbage collection (a lost one is already gone)
        if (!g.r.getContext().isContextLost()) g.r.forceContextLoss();
      }
    },
  };
}
