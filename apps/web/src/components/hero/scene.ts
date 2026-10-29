import { type BufferGeometry, type Mesh, PerspectiveCamera, Scene, type ShaderMaterial, type Texture, WebGLRenderer } from "three";
import { createPetals, type Mode } from "./petal-field";
import {
  colorTexture,
  createLight,
  createPlate,
  createScrim,
  createShadow,
  depthTexture,
  disposeGrids,
  plateRect,
  plateShared,
  shadowSource,
  TILE,
} from "./plates";
import { EYE, type Eye, type Lens, type PlateName } from "./rig";
import { createSkyLife } from "./sky-life";
import type { Rect, Scrim, Shadow } from "./stage";

/**
 * The hero's WebGL side: three canvases in the DOM's own stacking slots, all
 * drawn from one camera (rig.ts), so petals and plates live in one space.
 *
 *   back   sky plate, the sky's life, then the far petals     (under the name)
 *   char   the character plate                                (between name and ghost name)
 *   front  hill plate, fireflies, scrim, then the near petals (over everything painted)
 *
 * The petals run from the start. The plates load later and take over from
 * the <img>s only once they are uploaded and compiled; until then (and
 * whenever they can't) the canvases carry petals alone over the images.
 */

export type PlateImages = Record<PlateName, HTMLImageElement>;

export interface Layout {
  lens: Lens;
  /** each image's rest rect on the stage, css px */
  rects: Record<PlateName, Rect>;
  scrim: Scrim;
  /** her drop shadow, from the stylesheet */
  shadow: Shadow;
}

export interface HeroScene {
  /** draw a frame; `p` is the dive progress 0..1 */
  frame(e: Eye, dt: number, p: number): void;
  layout(l: Layout): void;
  /** switch modes; `instant` draws the new one right away (a view transition is about to snapshot it) */
  setMode(mode: Mode, instant: boolean): void;
  /** fetch and upload one mode's plates (then its sky sprites); resolves false if a plate fails */
  load(mode: Mode, images: PlateImages, art: { depth: string; sky: string }): Promise<boolean>;
  has(mode: Mode): boolean;
  /** hand the painting to the plates (they start flat and ease into relief) or back to the <img>s */
  plates(on: boolean): void;
  /** drop to a lower resolution; false once there is nothing left to give */
  degrade(): boolean;
  /** ease the relief back to flat, so the <img>s can take over without a jump */
  flatten(): void;
  dispose(): void;
}

const PLATES: PlateName[] = ["sky", "char", "hill"];
const RELIEF_IN = 1.4; // s
const MODE_FADE = 1.1; // s, as the <img> crossfade

/**
 * The scene comes up and loads in small steps, one per frame (each WebGL
 * context, each plate's geometry, her shadow, each upload), and its images
 * decode off the main thread, so no step holds up the hero's entrance or
 * the page on a slow phone.
 */
/** Resolves just after the next frame is drawn, in a task of its own, so a step never adds to a frame's own work. */
const frameOnce = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/** `url` as a Blob: a Blob decodes on the image decoder's thread, an <img> on the main one. Already cached by the <img>s. */
const blob = (url: string) =>
  fetch(url, { cache: "force-cache" }).then((r) => {
    if (!r.ok) throw new Error(url);
    return r.blob();
  });

/** Each plate's own tile of the mode's depth atlas: raw data, so no colour or alpha handling. */
async function depthTiles(url: string) {
  const b = await blob(url);
  return Promise.all(
    PLATES.map((n) => {
      const t = TILE[n];
      return createImageBitmap(b, t.x, t.y, t.w, t.h, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
    }),
  );
}

export async function createHeroScene(
  canvases: { back: HTMLCanvasElement; char: HTMLCanvasElement; front: HTMLCanvasElement },
  opts: { mode: Mode; depth: boolean },
): Promise<HeroScene> {
  const make = (canvas: HTMLCanvasElement) => {
    const r = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false, // petals and plates take their edges from texture alpha
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
  // not in the same task as the module's evaluation
  await frameOnce();
  const back = make(canvases.back);
  await frameOnce();
  const front = make(canvases.front);
  await frameOnce();
  // the character canvas only exists for the plates
  let char: WebGLRenderer | null = null;
  const renderers = () => (char ? [back, char, front] : [back, front]);

  const camera = new PerspectiveCamera();
  const petals = createPetals(opts.mode);
  const backPetals = new Scene().add(...petals.back);
  const frontPetals = new Scene().add(...petals.front);
  // linked in parallel, off the main thread, then drawn once per canvas while the
  // canvases are still clear (they fade in with data-ready), so their buffers and
  // textures go up now rather than in the first frame that shows
  await Promise.all([back.compileAsync(backPetals, camera), front.compileAsync(frontPetals, camera)]);
  back.render(backPetals, camera);
  await frameOnce();
  front.render(frontPetals, camera);
  await frameOnce();
  const scrim = createScrim();
  const scrimScene = new Scene().add(scrim.mesh);

  const shared = plateShared();
  const rects = { sky: plateRect(), char: plateRect(), hill: plateRect() };
  const life = createSkyLife(shared, rects);
  type Set = {
    scenes: Record<PlateName, Scene>;
    meshes: Mesh<BufferGeometry, ShaderMaterial>[];
    textures: Texture[];
    shadow: ReturnType<typeof createShadow>;
  };
  const sets: Partial<Record<Mode, Set>> = {};
  const loading: Partial<Record<Mode, Promise<boolean>>> = {};

  let mode = opts.mode;
  // per mode, how much of its plates is showing (crossfades like the <img>s)
  const shown: Record<Mode, number> = { night: mode === "night" ? 1 : 0, day: mode === "day" ? 1 : 0 };
  let on = false;
  let relief = 0;
  let flat = false;
  let w = 1;
  let h = 1;
  let scale = 1;
  let dpr = 1;
  let disposed = false;
  let last: Layout | null = null;

  function size() {
    // phones keep their full density (the paintings are sharper than 2x there);
    // large screens cap at 2x as the petals always did
    const native = window.devicePixelRatio || 1;
    dpr = Math.min(native, w * h < 600_000 ? 3 : 2) * scale;
    for (const r of renderers()) {
      r.setPixelRatio(dpr);
      r.setSize(w, h, false);
    }
    petals.resize(h * dpr);
  }

  function lensTo(l: Lens) {
    w = l.w;
    h = l.h;
    // an off-centre frustum, so the principal point (where the dive heads) is l.vx/l.vy
    const n = 0.1;
    camera.near = n;
    camera.far = 600;
    camera.projectionMatrix.makePerspective(
      (-l.vx / l.f) * n,
      ((l.w - l.vx) / l.f) * n,
      (l.vy / l.f) * n,
      (-(l.h - l.vy) / l.f) * n,
      n,
      600,
    );
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    shared.uVp.value.set(l.vx, l.vy);
    shared.uF.value = l.f;
    scrim.uniforms.uSize.value.set(l.w, l.h);
  }

  function draw(r: WebGLRenderer, passes: (Scene | null)[]) {
    r.clear();
    let plate = false;
    for (const s of passes) {
      if (!s) continue;
      if (plate) r.clearDepth();
      r.render(s, camera);
      plate = true;
    }
  }

  /** this canvas's plate passes, night under day as the <img>s stack, skipping hidden ones */
  function platePasses(name: PlateName) {
    if (!on) return [];
    return (["night", "day"] as const).map((m) => (shown[m] > 0.001 && sets[m] ? sets[m].scenes[name] : null));
  }

  let lastP = 0;
  function render(p: number) {
    lastP = p;
    // the sky deepens as the eye dives; the scrim leaves with the copy it was there for
    shared.uDeep.value = smooth(0.15, 1, p);
    scrim.uniforms.uFade.value = 1 - smooth(0, 0.5, p);
    shared.uRelief.value = smooth(0, 1, relief);
    for (const m of ["night", "day"] as const) {
      const s = sets[m];
      if (!s) continue;
      for (const mesh of s.meshes) mesh.material.uniforms.uOpacity.value = shown[m];
      s.shadow.mesh.material.uniforms.uOpacity.value = shown[m];
    }
    life.show(shown);

    // sky and far petals share a canvas; petals stay in front of the sky, so the
    // depth buffer only orders the sky against itself
    draw(back, platePasses("sky"));
    if (on) back.render(life.sky, camera);
    back.render(backPetals, camera);
    if (char && on) draw(char, platePasses("char"));
    draw(front, platePasses("hill"));
    if (on) {
      // fireflies are depth-tested against the hill's flowers, and dimmed with it by the scrim
      front.render(life.meadow, camera);
      front.render(scrimScene, camera);
    }
    // near petals are depth-tested against the hill: they drift behind its flowers
    front.render(frontPetals, camera);
  }

  function frame(e: Eye, dt: number, p: number) {
    if (disposed) return;
    petals.tick(dt);
    shared.uTime.value += dt;
    life.tick(dt, shown);
    if (on) relief = flat ? Math.max(0, relief - dt / 0.6) : Math.min(1, relief + dt / RELIEF_IN);
    const other: Mode = mode === "day" ? "night" : "day";
    if (shown[mode] < 1) shown[mode] = Math.min(1, shown[mode] + dt / MODE_FADE);
    if (shown[other] > 0) shown[other] = Math.max(0, shown[other] - dt / MODE_FADE);
    camera.position.set(e.x, -e.y, EYE - e.z);
    camera.updateMatrixWorld();
    render(p);
  }

  async function upload(m: Mode, images: PlateImages, depthUrl: string) {
    const [colors, depths] = await Promise.all([
      Promise.all(
        PLATES.map((n) =>
          blob(images[n].currentSrc || images[n].src).then((b) => createImageBitmap(b, { premultiplyAlpha: "premultiply" })),
        ),
      ),
      depthTiles(depthUrl),
    ]);
    if (!char) {
      await frameOnce();
      if (disposed) return false;
      char = make(canvases.char);
      size();
    }
    await frameOnce();
    if (disposed) return false;
    const maps = colors.map(colorTexture);
    const depth = depths.map(depthTexture);
    const scenes = {} as Record<PlateName, Scene>;
    const meshes: Set["meshes"] = [];
    PLATES.forEach((n, i) => {
      const mesh = createPlate(n, m, maps[i], depth[i], shared, rects[n]);
      meshes.push(mesh);
      scenes[n] = new Scene().add(mesh);
    });
    // the sun moves over the day meadow
    if (m === "day") {
      const light = createLight(maps[2], depth[2], shared, rects.hill);
      meshes.push(light);
      scenes.hill.add(light);
    }
    // her shadow goes down first, under her plate: its source, then its blur, a frame each
    await frameOnce();
    if (disposed) return false;
    const shadow = createShadow(shadowSource(colors[1]), depth[1], shared, rects.char);
    shadow.mesh.renderOrder = -1;
    scenes.char.add(shadow.mesh);
    await frameOnce();
    if (disposed) return false;
    if (last) shadow.set(last.shadow, last.rects.char.h);
    const target = { sky: back, char, hill: front };
    // one plate's upload per frame, so no single frame carries all of them
    for (const [i, n] of PLATES.entries()) {
      await frameOnce();
      if (disposed) return false;
      target[n].initTexture(maps[i]);
      target[n].initTexture(depth[i]);
      colors[i].close();
      depths[i].close();
    }
    const textures = [...maps, ...depth];
    await Promise.all([
      ...PLATES.map((n) => target[n].compileAsync(scenes[n], camera)),
      front.compileAsync(scrimScene, camera),
      life.compile(back, front, camera),
    ]);
    if (disposed) return false;
    life.attach(m, { sky: maps[0], skyDepth: depth[0], hillDepth: depth[2] });
    sets[m] = { scenes, meshes, textures, shadow };
    return true;
  }

  /** The mode's sky sprites, after its plates: the clouds and birds fade in once they're up. */
  async function sprites(m: Mode, url: string) {
    const bmp = await createImageBitmap(await blob(url), { premultiplyAlpha: "premultiply" });
    if (disposed) return bmp.close();
    const t = colorTexture(bmp);
    await frameOnce();
    back.initTexture(t);
    bmp.close();
    if (disposed) return t.dispose();
    life.sprites(m, t);
  }

  return {
    frame,
    layout(l) {
      lensTo(l.lens);
      life.layout(l);
      for (const n of PLATES) rects[n].value.set(l.rects[n].x, l.rects[n].y, l.rects[n].w, l.rects[n].h);
      scrim.set(l.scrim);
      for (const s of Object.values(sets)) s.shadow.set(l.shadow, l.rects.char.h);
      last = l;
      size();
      render(lastP);
    },
    setMode(next, instant) {
      mode = next;
      petals.setMode(next, instant);
      if (instant) {
        shown[next] = 1;
        shown[next === "day" ? "night" : "day"] = 0;
        render(lastP);
      }
    },
    load(m, images, art) {
      if (!opts.depth) return Promise.resolve(false);
      return (loading[m] ??= upload(m, images, art.depth)
        .then((ok) => {
          // the sky can live without them
          if (ok) sprites(m, art.sky).catch(() => {});
          return ok;
        })
        .catch(() => false));
    },
    has: (m) => !!sets[m],
    plates(next) {
      if (next === on) return;
      on = next;
      relief = 0;
      flat = false;
      if (!on) char?.clear();
      render(lastP);
    },
    flatten() {
      flat = true;
    },
    degrade() {
      if (dpr <= 1) return false;
      scale *= 0.75;
      size();
      render(lastP);
      return true;
    },
    dispose() {
      disposed = true;
      for (const s of Object.values(sets)) {
        for (const mesh of s.meshes) mesh.material.dispose();
        for (const t of s.textures) t.dispose();
        s.shadow.dispose();
      }
      disposeGrids();
      life.dispose();
      scrim.dispose();
      petals.dispose();
      for (const r of renderers()) {
        r.dispose();
        r.forceContextLoss();
      }
    },
  };
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
