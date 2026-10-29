import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  RedFormat,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
  Vector4,
} from "three";
import { EYE, PLATE, type PlateName } from "./rig";
import type { Scrim, Shadow } from "./stage";

/**
 * A painted plate as a relief: a grid over the image whose every vertex is
 * pushed to the distance its depth map gives, then seen through the hero's
 * camera. At rest each vertex projects back onto the exact pixel the <img>
 * shows; as the eye moves, near parts travel further than far ones. It is a
 * real mesh drawn with a depth test, so where a near part slides over a far
 * one it covers it instead of smearing across it, and silhouettes stay
 * rigid because the depth maps carry each edge's own depth outward into the
 * transparent margin (see public/site/hero-depth-*).
 */

/** Where each plate's map sits in the mode's depth atlas (public/site/hero-depth-*), px. */
export const TILE: Record<PlateName, { x: number; y: number; w: number; h: number }> = {
  sky: { x: 0, y: 0, w: 836, h: 471 },
  hill: { x: 0, y: 471, w: 836, h: 471 },
  char: { x: 836, y: 0, w: 512, h: 768 },
};

/**
 * Grid density (cells) and how far the mesh runs past the image's edges,
 * in image fractions [left, top, right, bottom]. Opaque edges are extended
 * by mirroring the painting, so a moving eye never sees past them; the
 * cutout's edges are its own transparency.
 */
const GRID: Record<PlateName, { cols: number; rows: number; pad: [number, number, number, number] }> = {
  sky: { cols: 288, rows: 168, pad: [0.08, 0.08, 0.08, 0.08] },
  hill: { cols: 288, rows: 150, pad: [0.1, 0, 0.1, 0.1] },
  char: { cols: 128, rows: 192, pad: [0, 0, 0, 0] },
};

const plateVert = /* glsl */ `
  uniform sampler2D uDepth;
  uniform vec4 uRect;      // the image's rest rect on the stage, css px
  uniform vec2 uVp;        // principal point, css px
  uniform float uF;        // focal length, css px
  uniform vec3 uRange;     // 1/far, 1/near, flat distance
  uniform float uRelief;
  varying vec2 vUv;
  #ifdef SHADOW
  uniform vec2 uOffset;    // the shadow's offset, css px
  #endif

  void main() {
    vec2 uv = position.xy;
    #ifdef SHADOW
    vec2 m = clamp(uv, 0.0, 1.0);
    vUv = uv;
    vec2 at = uRect.xy + uOffset;
    #else
    // past the edges, mirror the painting back on itself
    vec2 m = 1.0 - abs(1.0 - abs(uv));
    vUv = m;
    vec2 at = uRect.xy;
    #endif
    float d = textureLod(uDepth, m, 0.0).r;
    float dist = mix(uRange.z, 1.0 / mix(uRange.x, uRange.y, d), uRelief);
    // the point on the ray through this pixel (from the resting eye) at that distance
    vec2 s = (at + uv * uRect.zw - uVp) * (dist / uF);
    gl_Position = projectionMatrix * viewMatrix * vec4(s.x, -s.y, ${EYE.toFixed(1)} - dist, 1.0);
  }
`;

const plateFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying vec2 vUv;
  #ifdef DEEPEN
  uniform float uDeep;
  uniform vec3 uTint;
  #endif

  void main() {
    // the browser shrinks images more crisply than plain trilinear: hold the
    // sharpest level for the first half octave of minification
    vec2 px = vUv * vec2(textureSize(uMap, 0));
    float lod = 0.5 * log2(max(dot(dFdx(px), dFdx(px)), dot(dFdy(px), dFdy(px))));
    vec4 c = textureLod(uMap, vUv, max(0.0, lod - LOD_HOLD)); // premultiplied
    #ifdef CUTOUT
    if (c.a < 0.004) discard;      // clear pixels write no depth
    #endif
    #ifdef DEEPEN
    c.rgb *= mix(vec3(1.0), uTint, uDeep);
    #endif
    gl_FragColor = c * uOpacity;
  }
`;

function grid(cols: number, rows: number, [l, t, r, b]: readonly number[]) {
  const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
  let i = 0;
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= cols; x++, i += 3) {
      pos[i] = -l + ((1 + l + r) * x) / cols;
      pos[i + 1] = -t + ((1 + t + b) * y) / rows;
    }
  }
  const idx = new Uint32Array(cols * rows * 6);
  i = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const a = y * (cols + 1) + x;
      const c = a + cols + 1;
      idx.set([a, c, a + 1, a + 1, c, c + 1], i);
      i += 6;
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  geo.setIndex(new BufferAttribute(idx, 1));
  return geo;
}

/** Uniforms every plate shares: the lens and how much relief is showing. */
export function plateShared() {
  return {
    uVp: { value: new Vector2() },
    uF: { value: 1 },
    uRelief: { value: 0 },
    uDeep: { value: 0 },
  };
}
export type PlateShared = ReturnType<typeof plateShared>;

/** Per-plate uniforms both modes share (the img boxes are the same for both). */
export function plateRect() {
  return { value: new Vector4() };
}

const TINT = { night: new Vector3(0.46, 0.4, 0.6), day: new Vector3(0.74, 0.84, 1.0) };

export function colorTexture(img: ImageBitmap) {
  const t = new Texture(img);
  t.flipY = false;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export function depthTexture(img: ImageBitmap) {
  const t = new Texture(img);
  t.flipY = false;
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

const geos = new Map<PlateName, BufferGeometry>();

export function createPlate(
  name: PlateName,
  mode: "night" | "day",
  map: Texture,
  depth: Texture,
  shared: PlateShared,
  rect: { value: Vector4 },
) {
  const r = PLATE[name];
  let geo = geos.get(name);
  if (!geo) geos.set(name, (geo = grid(GRID[name].cols, GRID[name].rows, GRID[name].pad)));
  const mat = new ShaderMaterial({
    vertexShader: plateVert,
    fragmentShader: plateFrag,
    defines: { ...(name === "sky" ? { DEEPEN: "" } : { CUTOUT: "" }), LOD_HOLD: "0.5" },
    uniforms: {
      ...shared,
      uMap: { value: map },
      uDepth: { value: depth },
      uRect: rect,
      uRange: { value: new Vector3(1 / r.far, 1 / r.near, r.flat) },
      uOpacity: { value: 1 },
      uTint: { value: TINT[mode] },
    },
    transparent: true,
    premultipliedAlpha: true,
    depthTest: true,
    depthWrite: true,
  });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

export function disposeGrids() {
  for (const g of geos.values()) g.dispose();
  geos.clear();
  shadowGrid?.dispose();
  shadowGrid = null;
}

/* ── her drop shadow ─────────────────────────────────────────────────── */

/**
 * The cutout's `filter: drop-shadow` (hero.css), drawn under the character
 * plate and displaced by the same relief, so it stays under her as she
 * moves. Its source is her alpha at an eighth of the size; the blur is
 * redone whenever her on-screen size changes, since it is set in css px.
 */
const SHADOW = { w: 128, h: 192, pad: 0.5 };
const SW = Math.round(SHADOW.w * (1 + 2 * SHADOW.pad));
const SH = Math.round(SHADOW.h * (1 + 2 * SHADOW.pad));
let shadowGrid: BufferGeometry | null = null;

/** Her alpha, small, centred in the shadow's padded frame. */
export function shadowSource(img: ImageBitmap) {
  const c = document.createElement("canvas");
  c.width = SW;
  c.height = SH;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return new Uint8Array(SW * SH);
  g.imageSmoothingQuality = "high";
  g.drawImage(img, (SW - SHADOW.w) / 2, (SH - SHADOW.h) / 2, SHADOW.w, SHADOW.h);
  const px = g.getImageData(0, 0, SW, SH).data;
  const a = new Uint8Array(SW * SH);
  for (let i = 0; i < a.length; i++) a[i] = px[i * 4 + 3];
  return a;
}

/** Three box passes each way: a Gaussian of `sigma` px, as browsers blur. */
function blur(src: Uint8Array, sigma: number) {
  const r = Math.max(0, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
  let a = Float32Array.from(src);
  let b = new Float32Array(a.length);
  const pass = (w: number, h: number, step: number, line: number) => {
    for (let l = 0; l < h; l++) {
      const o = l * line;
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += a[o + Math.min(w - 1, Math.max(0, i)) * step];
      for (let i = 0; i < w; i++) {
        b[o + i * step] = acc / (2 * r + 1);
        acc += a[o + Math.min(w - 1, i + r + 1) * step] - a[o + Math.max(0, i - r) * step];
      }
    }
    [a, b] = [b, a];
  };
  for (let k = 0; k < 3; k++) {
    pass(SW, SH, 1, SW);
    pass(SH, SW, SW, 1);
  }
  return Uint8Array.from(a, (v) => Math.round(v));
}

const shadowFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec4 uColor;     // premultiplied
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 t = (vUv + ${SHADOW.pad.toFixed(2)}) / ${(1 + 2 * SHADOW.pad).toFixed(2)};
    gl_FragColor = uColor * texture2D(uMap, t).r * uOpacity;
  }
`;

export function createShadow(source: Uint8Array, depth: Texture, shared: PlateShared, rect: { value: Vector4 }) {
  const r = PLATE.char;
  shadowGrid ??= grid(48, 72, [SHADOW.pad, SHADOW.pad, SHADOW.pad, SHADOW.pad]);
  const map = new DataTexture(new Uint8Array(SW * SH), SW, SH, RedFormat);
  map.unpackAlignment = 1; // one byte per texel: rows aren't 4-byte aligned
  map.minFilter = LinearFilter;
  map.magFilter = LinearFilter;
  const offset = new Vector2();
  const mat = new ShaderMaterial({
    // the plate's own vertex shader, so the shadow takes her relief
    vertexShader: plateVert,
    fragmentShader: shadowFrag,
    defines: { SHADOW: "" },
    uniforms: {
      ...shared,
      uMap: { value: map },
      uDepth: { value: depth },
      uRect: rect,
      uOffset: { value: offset },
      uRange: { value: new Vector3(1 / r.far, 1 / r.near, r.flat) },
      uColor: { value: new Vector4() },
      uOpacity: { value: 1 },
    },
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new Mesh(shadowGrid, mat);
  mesh.frustumCulled = false;
  let sigma = -1;
  return {
    mesh,
    /** match the stylesheet's shadow at her current on-screen height (css px) */
    set(s: Shadow, height: number) {
      offset.set(s.x, s.y);
      mat.uniforms.uColor.value.set(s.color[0] * s.color[3], s.color[1] * s.color[3], s.color[2] * s.color[3], s.color[3]);
      // drop-shadow()'s length is the Gaussian's standard deviation (box-shadow's is twice it)
      const next = Math.round(s.blur * (SHADOW.h / height) * 10) / 10;
      if (next === sigma) return;
      sigma = next;
      map.image.data = blur(source, sigma);
      map.needsUpdate = true;
    },
    dispose() {
      map.dispose();
      mat.dispose();
    },
  };
}

/* ── scrim ───────────────────────────────────────────────────────────── */

/**
 * The scrim (.hero-scrim) sits between the hill and the front petals, the
 * one place the plates and petals can't share a canvas with the DOM. So in
 * that canvas it's drawn here instead, from the stylesheet's own gradients
 * (read by stage.ts): every stop shares one colour, so each gradient is an
 * alpha ramp along an ellipse.
 */
const scrimVert = /* glsl */ `
  uniform vec2 uSize;
  varying vec2 vPx;
  void main() {
    vec2 c = position.xy;          // one triangle over the whole canvas
    vPx = (c * 0.5 + 0.5) * uSize;
    vPx.y = uSize.y - vPx.y;
    gl_Position = vec4(c, 0.0, 1.0);
  }
`;

const scrimFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec4 uGeo[3];
  uniform vec3 uA[3];
  uniform vec3 uP[3];
  uniform float uFade;
  varying vec2 vPx;

  float ramp(float t, vec3 a, vec3 p) {
    if (t <= p.y) return mix(a.x, a.y, clamp((t - p.x) / max(p.y - p.x, 1e-5), 0.0, 1.0));
    return mix(a.y, a.z, clamp((t - p.y) / max(p.z - p.y, 1e-5), 0.0, 1.0));
  }

  void main() {
    float keep = 1.0;
    for (int i = 0; i < 3; i++) {
      float t = length((vPx - uGeo[i].xy) * uGeo[i].zw);
      keep *= 1.0 - ramp(t, uA[i], uP[i]);
    }
    // the browser dithers its gradients; so do we, or the dark ramps band
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    float a = clamp((1.0 - keep) * uFade + n / 255.0, 0.0, 1.0);
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export function createScrim() {
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const uniforms = {
    uSize: { value: new Vector2(1, 1) },
    uColor: { value: new Vector3() },
    uGeo: { value: [new Vector4(), new Vector4(), new Vector4()] },
    uA: { value: [new Vector3(), new Vector3(), new Vector3()] },
    uP: { value: [new Vector3(), new Vector3(), new Vector3()] },
    uFade: { value: 1 },
  };
  const mat = new ShaderMaterial({
    vertexShader: scrimVert,
    fragmentShader: scrimFrag,
    uniforms,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  return {
    mesh,
    uniforms,
    set(s: Scrim) {
      uniforms.uColor.value.set(...s.color);
      for (let i = 0; i < 3; i++) {
        const g = s.ramps[i];
        uniforms.uGeo.value[i].set(...(g?.geo ?? [0, 0, 0, 0]));
        uniforms.uA.value[i].set(...(g?.alpha ?? [0, 0, 0]));
        uniforms.uP.value[i].set(...(g?.stop ?? [0, 0.5, 1]));
      }
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
