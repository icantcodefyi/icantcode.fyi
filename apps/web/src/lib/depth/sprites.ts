import {
  CanvasTexture,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearMipmapLinearFilter,
  Mesh,
  PlaneGeometry,
  Points,
  BufferAttribute,
  BufferGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector4,
  type PerspectiveCamera,
  type WebGLRenderer,
} from "three";

import type { Rect } from "./fit";
import { EYE, FOCUS } from "./camera";
import type { PlateShared } from "./plate";
import type { AmbientSpec, Mode } from "./types";

/**
 * Ambient life inside a painting, on the site camera. Petals are the hero's
 * (components/hero/petal-field.ts, petal-texture.ts: the shader's cupping,
 * flutter, tumble and depth of field, and the atlas painter, copied), calmed
 * for a section; motes are soft points of light that wander and twinkle.
 *
 * Everything is animated on the GPU from per-instance seeds, so a kind costs
 * one draw call and no uploads per frame. Each sprite lives at its own depth
 * inside the frustum slice its area makes there, so it scrolls with the
 * painting and parallaxes by its depth like the plates do.
 */

/** Sway and wander periods (s), PLAN §5.3. */
const PERIODS = [5.9, 7.3, 10.3, 13.7, 17.9, 23.1];
const MAX_MASKS = 8;

const PALETTE = {
  petals: {
    night: { base: "#ff2e88", tip: "#ffc2db", glow: 0.6 },
    day: { base: "#e7739f", tip: "#fff7fa", glow: 0 },
  },
  motes: {
    night: { base: "#ffe2a6", tip: "#ffffff", glow: 1 },
    // sunlit dust: warm enough to read on the pale day page
    day: { base: "#d98f3c", tip: "#f3bd6e", glow: 0.85 },
  },
} as const;

/** Where a sprite sits: its area's slice of the frustum at its depth, wrapped, faded at the edges and in the masks. */
const place = /* glsl */ `
  uniform float uTime;
  uniform vec4 uArea;      // where they live, canvas css px
  uniform vec2 uDepth;     // near, far
  uniform vec2 uVp;
  uniform float uF;
  uniform vec2 uSize;      // canvas css px
  #if MASKS > 0
  uniform vec4 uMask[MASKS];
  #endif

  // the area at this sprite's depth, in world units (y down): its corner and size
  vec2 areaLo(float d) { return (uArea.xy - uVp) * (d / uF); }
  vec2 areaSpan(float d) { return uArea.zw * (d / uF); }

  // q wrapped into the area, and how far it is from the area's edges (0 at an edge, 0.5 in the middle)
  vec2 wrapIn(vec2 q, vec2 span, out float edge) {
    q = mod(q, span);
    vec2 e = min(q, span - q) / span;
    edge = smoothstep(0.0, 0.07, min(e.x, e.y));
    return q;
  }

  // 0 inside a mask (feathered over 40 css px), 1 clear of them all
  float clearOf(vec3 c) {
    float keep = 1.0;
    #if MASKS > 0
    vec4 cc = projectionMatrix * modelViewMatrix * vec4(c, 1.0);
    vec2 sp = (cc.xy / cc.w * 0.5 + 0.5) * uSize;
    sp.y = uSize.y - sp.y;
    for (int i = 0; i < MASKS; i++) {
      vec4 m = uMask[i];
      vec2 o = max(m.xy - sp, sp - m.xy - m.zw);
      keep *= smoothstep(0.0, 40.0, max(o.x, o.y));
    }
    #endif
    return keep;
  }
`;

const petalVert = /* glsl */ `
  attribute vec4 aSeed;    // x, y across the area, depth across the range, phase
  attribute vec4 aRand;    // size, fall speed, spin speed, variant
  attribute vec3 aAxis;
  attribute float aSway;   // sway period, s
  ${place}
  varying vec2 vUv;
  varying float vBlur;
  varying float vFade;
  varying float vFacing;
  varying float vVariant;

  mat3 axisAngle(vec3 a, float ang) {
    float s = sin(ang), c = cos(ang), oc = 1.0 - c;
    return mat3(
      oc*a.x*a.x + c,     oc*a.x*a.y + a.z*s, oc*a.z*a.x - a.y*s,
      oc*a.x*a.y - a.z*s, oc*a.y*a.y + c,     oc*a.y*a.z + a.x*s,
      oc*a.z*a.x + a.y*s, oc*a.y*a.z - a.x*s, oc*a.z*a.z + c
    );
  }

  void main() {
    vUv = uv;
    vVariant = aRand.w;
    float t = uTime;
    float ph = aSeed.w * 6.2831;
    float d = mix(uDepth.x, uDepth.y, aSeed.z);

    // cup the petal and let it flutter: z bends with x², the tip flaps
    vec3 p = position;
    float flutter = sin(t * (1.6 + aRand.y * 2.0) + ph) * 0.18;
    p.z += (p.x * p.x) * 0.9 + (p.y + 0.5) * flutter;
    p *= aRand.x;
    // tumble around its own axis, with a slow precessing second spin
    mat3 R = axisAngle(aAxis, t * aRand.z + ph) * axisAngle(normalize(vec3(0.3, 1.0, 0.2)), sin(t * 0.4 + ph * 0.5) * 1.2);
    vec3 n = R * vec3(0.0, 0.0, 1.0);
    p = R * p;

    // fall, drift right on a breeze and sway, inside the area at this depth
    vec2 span = areaSpan(d);
    vec2 q = aSeed.xy * span + vec2(t * aRand.y * 0.42 + sin(t * 6.2831 / aSway + ph) * 0.25, t * aRand.y);
    float edge;
    q = wrapIn(q, span, edge);
    vec2 w = areaLo(d) + q;
    vec3 c = vec3(w.x, -w.y, ${EYE.toFixed(1)} - d);

    vec4 mv = modelViewMatrix * vec4(c + p, 1.0);
    gl_Position = projectionMatrix * mv;
    // depth of field about the focus plane
    vBlur = clamp(abs(-mv.z - ${FOCUS.toFixed(1)}) / (${FOCUS.toFixed(1)} * 0.45), 0.0, 1.0);
    vFade = edge * clearOf(c);
    vFacing = normalize(mat3(modelViewMatrix) * n).z;
  }
`;

const petalFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uBase;
  uniform vec3 uTip;
  uniform float uGlow;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vBlur;
  varying float vFade;
  varying float vFacing;
  varying float vVariant;

  void main() {
    vec2 uv = vec2((vUv.x + vVariant) * 0.5, vUv.y);
    vec4 tex = texture2D(uMap, uv, vBlur * 1.4);
    float a = tex.a * vFade * uOpacity * (1.0 - vBlur * 0.35);
    if (a < 0.01) discard;
    vec3 col = mix(uBase, uTip, smoothstep(0.0, 1.0, tex.r));
    col *= 1.0 - tex.g * 0.34;                 // veins
    col += tex.b * 0.18;                       // soft ridge highlight
    // back faces read a touch deeper; light passes through the front
    col *= mix(0.78, 1.0, smoothstep(-0.6, 0.6, vFacing));
    // night: a soft neon rim where the feathered edge is
    float rim = 1.0 - smoothstep(0.35, 0.95, tex.a);
    col += uGlow * rim * vec3(1.0, 0.35, 0.65) * 0.9;
    col = mix(col, col * 1.12, uGlow);
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

const moteVert = /* glsl */ `
  attribute vec4 aSeed;    // x, y across the area, depth across the range, phase
  attribute vec4 aRand;    // size, twinkle period, wander period, rise speed
  uniform float uPx;       // device px per css px
  ${place}
  varying float vA;

  void main() {
    float t = uTime;
    float ph = aSeed.w * 6.2831;
    float d = mix(uDepth.x, uDepth.y, aSeed.z);
    vec2 span = areaSpan(d);
    // a slow uneven loop around its seed, and a slow rise
    float wp = aRand.z;
    vec2 q = aSeed.xy * span
      + vec2(sin(t * 6.2831 / wp + ph), sin(t * 6.2831 / (wp * 1.37) + ph * 1.7)) * 0.3
      - vec2(0.0, t * aRand.w);
    float edge;
    q = wrapIn(q, span, edge);
    vec2 w = areaLo(d) + q;
    vec3 c = vec3(w.x, -w.y, ${EYE.toFixed(1)} - d);
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.5 + 0.5 * sin(t * 6.2831 / aRand.y + ph);
    tw = tw * tw * (3.0 - 2.0 * tw);
    vA = edge * clearOf(c) * mix(0.2, 1.0, tw);
    gl_PointSize = aRand.x * uF / max(-mv.z, 0.5) * uPx * (0.85 + 0.15 * tw);
  }
`;

const moteFrag = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uTip;
  uniform float uGlow;
  uniform float uOpacity;
  varying float vA;

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    float core = exp(-r2 * 18.0);
    float halo = exp(-r2 * 4.0) * 0.45;
    float v = (core + halo) * (1.0 - smoothstep(0.6, 1.0, r2)) * vA * uOpacity * uGlow;
    if (v < 0.004) discard;
    gl_FragColor = vec4(mix(uBase, uTip, core * 0.5), 1.0);
    #include <colorspace_fragment>
    // premultiplied with real alpha: light with no alpha added onto a clear
    // part of the canvas (a cutout's sky) never reaches the page
    gl_FragColor = vec4(gl_FragColor.rgb * v, v);
  }
`;

/* ── the petal atlas (copied from components/hero/petal-texture.ts) ──────
   A data map the shader recolours: R base→tip, G veins, B ridge highlight,
   A the silhouette with a feathered edge. Two variants side by side. */

const SIZE = 256;

function petalPath(ctx: CanvasRenderingContext2D, cx: number, w: number, h: number, top: number) {
  const base = top + h;
  const notch = top + h * 0.1;
  const lobeY = top + h * 0.015;
  ctx.beginPath();
  ctx.moveTo(cx, base);
  ctx.bezierCurveTo(cx + w * 0.16, base - h * 0.06, cx + w * 0.5, base - h * 0.38, cx + w * 0.48, top + h * 0.3);
  ctx.bezierCurveTo(cx + w * 0.47, top + h * 0.14, cx + w * 0.34, lobeY, cx + w * 0.2, lobeY);
  ctx.bezierCurveTo(cx + w * 0.11, lobeY, cx + w * 0.05, notch - h * 0.03, cx, notch);
  ctx.bezierCurveTo(cx - w * 0.05, notch - h * 0.03, cx - w * 0.11, lobeY, cx - w * 0.2, lobeY);
  ctx.bezierCurveTo(cx - w * 0.34, lobeY, cx - w * 0.47, top + h * 0.14, cx - w * 0.48, top + h * 0.3);
  ctx.bezierCurveTo(cx - w * 0.5, base - h * 0.38, cx - w * 0.16, base - h * 0.06, cx, base);
  ctx.closePath();
}

function paintVariant(ctx: CanvasRenderingContext2D, ox: number, w: number, h: number, seed: number) {
  const cx = ox + SIZE / 2;
  const top = (SIZE - h) / 2;
  const base = top + h;
  ctx.save();
  if ("filter" in ctx) ctx.filter = "blur(1.2px)";
  petalPath(ctx, cx, w, h, top);
  const g = ctx.createLinearGradient(cx, base, cx, top);
  g.addColorStop(0, "rgb(0,0,0)");
  g.addColorStop(0.35, "rgb(120,0,0)");
  g.addColorStop(1, "rgb(255,0,0)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  ctx.save();
  petalPath(ctx, cx, w * 0.985, h * 0.985, top + h * 0.008);
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";
  const ridge = ctx.createRadialGradient(cx - w * 0.08, top + h * 0.45, 2, cx - w * 0.08, top + h * 0.45, w * 0.46);
  ridge.addColorStop(0, "rgba(0,0,200,1)");
  ridge.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = ridge;
  ctx.fillRect(ox, 0, SIZE, SIZE);
  if ("filter" in ctx) ctx.filter = "blur(0.6px)";
  ctx.lineCap = "round";
  const veins = 7;
  for (let i = 0; i < veins; i++) {
    const t = i / (veins - 1) - 0.5;
    const jitter = Math.sin(seed * 13.1 + i * 2.3) * 0.03;
    const endX = cx + (t + jitter) * w * 0.82;
    const endY = top + h * (0.12 + Math.abs(t) * 0.32);
    const strength = 1 - Math.abs(t) * 1.1;
    ctx.strokeStyle = `rgba(0,${Math.round(90 + 110 * strength)},0,1)`;
    ctx.lineWidth = 1.1 + strength * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx, base - h * 0.04);
    ctx.bezierCurveTo(cx + t * w * 0.12, base - h * 0.35, endX - t * w * 0.18, top + h * 0.42, endX, endY);
    ctx.stroke();
    if (Math.abs(t) > 0.2) {
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = "rgba(0,70,0,1)";
      ctx.beginPath();
      const bx = cx + t * w * 0.5;
      const by = top + h * 0.5;
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + t * w * 0.2, by - h * 0.12, bx + t * w * 0.34, by - h * 0.2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function paintPetalAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE * 2;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  paintVariant(ctx, 0, SIZE * 0.86, SIZE * 0.9, 1);
  paintVariant(ctx, SIZE, SIZE * 0.66, SIZE * 0.94, 2);
  return canvas;
}

/* ── the sprites ─────────────────────────────────────────────────────── */

/** mulberry32, seeded per stage so a section's sprites are the same every visit */
function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface Kind {
  spec: AmbientSpec;
  object: Mesh | Points;
  mat: ShaderMaterial;
  geo: BufferGeometry;
  target: { base: Color; tip: Color; glow: number };
}

export interface Sprites {
  /** one scene per spec, in order: each is drawn at its own place among the plates */
  scenes: Scene[];
  compile(r: WebGLRenderer, camera: PerspectiveCamera): Promise<unknown>;
  tick(dt: number): void;
  setMode(mode: Mode, instant: boolean): void;
  /** per spec, its area and masks on the canvas, css px */
  layout(areas: { area: Rect; masks: Rect[] }[]): void;
  /** the canvas's css size and device px per css px */
  resize(w: number, h: number, dpr: number): void;
  dispose(): void;
}

function palette(spec: AmbientSpec, mode: Mode) {
  const p = PALETTE[spec.kind][mode];
  const base = new Color(spec.color?.[mode] ?? p.base);
  const tip = spec.color ? base.clone().lerp(new Color("#ffffff"), 0.7) : new Color(p.tip);
  return { base, tip, glow: p.glow };
}

export function createSprites(specs: AmbientSpec[], shared: PlateShared, mode: Mode, seed: string): Sprites {
  const r = rand(hash(seed));
  const time = { value: 40 + r() * 60 }; // mid-flight: the field is already populated
  const px = { value: 1 };
  const size = { value: new Vector2(1, 1) };
  let atlas: CanvasTexture | null = null;
  let petalGeo: PlaneGeometry | null = null;

  const kinds: Kind[] = specs.map((spec) => {
    const n = Math.min(40, Math.max(0, Math.round(spec.count)));
    const masks = Math.min(MAX_MASKS, spec.mask?.length ?? 0);
    const pal = palette(spec, mode);
    const uniforms = {
      ...shared,
      uTime: time,
      uSize: size,
      uArea: { value: new Vector4() },
      uDepth: { value: new Vector2(spec.depth[0], spec.depth[1]) },
      uMask: { value: Array.from({ length: Math.max(1, masks) }, () => new Vector4()) },
      uBase: { value: pal.base.clone() },
      uTip: { value: pal.tip.clone() },
      uGlow: { value: pal.glow },
      uOpacity: { value: Math.min(0.8, spec.opacity ?? 0.8) },
      uMap: { value: null as CanvasTexture | null },
      uPx: px,
    };
    const seeds = new Float32Array(n * 4);
    const rnd = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      seeds.set([r(), r(), r(), r()], i * 4);
    }
    if (spec.kind === "petals") {
      atlas ??= new CanvasTexture(paintPetalAtlas());
      atlas.minFilter = LinearMipmapLinearFilter;
      atlas.generateMipmaps = true;
      uniforms.uMap.value = atlas;
      petalGeo ??= new PlaneGeometry(1, 1, 4, 4);
      const geo = new InstancedBufferGeometry();
      geo.index = petalGeo.index;
      geo.setAttribute("position", petalGeo.getAttribute("position"));
      geo.setAttribute("uv", petalGeo.getAttribute("uv"));
      const axis = new Float32Array(n * 3);
      const sway = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const big = r() < 0.12 ? 1.5 : 1;
        rnd.set([(0.1 + r() * 0.08) * big, 0.12 + r() * 0.2, (r() < 0.5 ? -1 : 1) * (0.4 + r() * 1.2), r() < 0.6 ? 0 : 1], i * 4);
        const ax = r() * 2 - 1;
        const ay = r() * 2 - 1;
        const az = r() * 2 - 1;
        const l = Math.hypot(ax, ay, az) || 1;
        axis.set([ax / l, ay / l, az / l], i * 3);
        sway[i] = PERIODS[Math.floor(r() * PERIODS.length)];
      }
      geo.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 4));
      geo.setAttribute("aRand", new InstancedBufferAttribute(rnd, 4));
      geo.setAttribute("aAxis", new InstancedBufferAttribute(axis, 3));
      geo.setAttribute("aSway", new InstancedBufferAttribute(sway, 1));
      geo.instanceCount = n;
      const mat = new ShaderMaterial({
        vertexShader: petalVert,
        fragmentShader: petalFrag,
        defines: { MASKS: masks },
        uniforms,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      });
      const mesh = new Mesh(geo, mat);
      mesh.frustumCulled = false;
      return { spec, object: mesh, mat, geo, target: pal };
    }
    for (let i = 0; i < n; i++) {
      rnd.set([0.07 + r() * 0.06, 2.4 + r() * 2.1, PERIODS[Math.floor(r() * PERIODS.length)], 0.004 + r() * 0.01], i * 4);
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute("aSeed", new BufferAttribute(seeds, 4));
    geo.setAttribute("aRand", new BufferAttribute(rnd, 4));
    const mat = new ShaderMaterial({
      vertexShader: moteVert,
      fragmentShader: moteFrag,
      defines: { MASKS: masks },
      uniforms,
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: true,
    });
    const pts = new Points(geo, mat);
    pts.frustumCulled = false;
    return { spec, object: pts, mat, geo, target: pal };
  });
  const scenes = kinds.map((k) => new Scene().add(k.object));

  function ease(k: number) {
    for (const s of kinds) {
      const u = s.mat.uniforms;
      u.uBase.value.lerp(s.target.base, k);
      u.uTip.value.lerp(s.target.tip, k);
      u.uGlow.value += (s.target.glow - u.uGlow.value) * k;
    }
  }

  return {
    scenes,
    compile: (rd, camera) => Promise.all(scenes.map((s) => rd.compileAsync(s, camera))),
    tick(dt) {
      time.value += dt;
      ease(1 - Math.exp(-dt * 3));
    },
    setMode(next, instant) {
      for (const s of kinds) s.target = palette(s.spec, next);
      if (instant) ease(1);
    },
    resize(w, h, dpr) {
      size.value.set(w, h);
      px.value = dpr;
    },
    layout(areas) {
      kinds.forEach((s, i) => {
        const a = areas[i];
        if (!a) return;
        s.mat.uniforms.uArea.value.set(a.area.x, a.area.y, a.area.w, a.area.h);
        const m = s.mat.uniforms.uMask.value as Vector4[];
        m.forEach((v, j) => {
          const r = a.masks[j];
          if (r) v.set(r.x, r.y, r.w, r.h);
        });
      });
    },
    dispose() {
      for (const s of kinds) {
        s.geo.dispose();
        s.mat.dispose();
      }
      petalGeo?.dispose();
      atlas?.dispose();
    },
  };
}
