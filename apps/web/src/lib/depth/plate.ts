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

import { EYE } from "./camera";
import type { PlateSpec } from "./types";

/**
 * A painted plate as a relief, copied from components/hero/plates.ts
 * (plateVert, plateFrag, grid(), colorTexture(), depthTexture()); the hero
 * keeps its own copy until follow-up F1.
 *
 * A grid over the image whose every vertex is pushed to the distance its
 * depth map gives, seen through the site camera. At rest each vertex
 * projects back onto the exact pixel the <img> shows; as the eye moves, near
 * parts travel further than far ones. It is a real mesh drawn with a depth
 * test, so where a near part slides over a far one it covers it, and
 * silhouettes stay rigid because the depth maps carry each edge's depth out
 * into the transparent margin.
 */

const vert = /* glsl */ `
  uniform sampler2D uDepth;
  uniform vec4 uRect;      // the image's rest rect on the canvas, css px
  uniform vec2 uVp;        // principal point, canvas css px
  uniform float uF;        // focal length, css px
  uniform vec3 uRange;     // 1/far, 1/near, flat distance
  uniform float uRelief;
  varying vec2 vUv;
  varying vec2 vEdge;

  void main() {
    vec2 uv = position.xy;
    vEdge = uv;
    // past the edges, mirror the painting back on itself
    vec2 m = 1.0 - abs(1.0 - abs(uv));
    vUv = m;
    float d = textureLod(uDepth, m, 0.0).r;
    float dist = mix(uRange.z, 1.0 / mix(uRange.x, uRange.y, d), uRelief);
    // the point on the ray through this pixel (from the resting eye) at that distance
    vec2 s = (uRect.xy + uv * uRect.zw - uVp) * (dist / uF);
    gl_Position = projectionMatrix * viewMatrix * vec4(s.x, -s.y, ${EYE.toFixed(1)} - dist, 1.0);
  }
`;

const frag = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform vec4 uFade;      // top, right, bottom, left
  varying vec2 vUv;
  varying vec2 vEdge;

  void main() {
    // the browser shrinks images more crisply than plain trilinear: hold the
    // sharpest level a little (0.3 octave matches Chrome's <img> best at 1x)
    vec2 px = vUv * vec2(textureSize(uMap, 0));
    float lod = 0.5 * log2(max(dot(dFdx(px), dFdx(px)), dot(dFdy(px), dFdy(px))));
    vec4 c = textureLod(uMap, vUv, max(0.0, lod - 0.3)); // premultiplied
    #ifdef FADE
    // linear ramps to the edges, as the <img>'s mask gradient draws them
    vec4 f = max(uFade, 1e-5);
    vec4 e = vec4(vEdge.y, 1.0 - vEdge.x, 1.0 - vEdge.y, vEdge.x);
    vec4 k = mix(vec4(1.0), clamp(e / f, 0.0, 1.0), step(1e-5, uFade));
    c *= k.x * k.y * k.z * k.w;
    #endif
    #ifdef CUTOUT
    if (c.a < 0.004) discard;      // clear pixels write no depth
    #endif
    gl_FragColor = c * uOpacity;
  }
`;

/** Uniforms a canvas's plates share: its principal point and the lens. */
export function plateShared() {
  return { uVp: { value: new Vector2() }, uF: { value: 1 } };
}
export type PlateShared = ReturnType<typeof plateShared>;

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

/** A depth map for a flat card: one texel (its value is never used, see uRange). */
export function flatDepth() {
  const t = new DataTexture(new Uint8Array([0]), 1, 1, RedFormat);
  t.needsUpdate = true;
  return t;
}

/** Cells for a plate shown `w` css px wide: about one per 4 px, long side ≤ 288, as square as the image. */
export function gridFor(p: PlateSpec, w: number): [number, number] {
  if (p.grid) return p.grid;
  if (!p.depth) return [1, 1];
  const [iw, ih] = p.size;
  const long = Math.min(288, Math.max(24, Math.ceil(Math.max(w, (w * ih) / iw) / 4)));
  return iw >= ih ? [long, Math.max(8, Math.round((long * ih) / iw))] : [Math.max(8, Math.round((long * iw) / ih)), long];
}

/** A grid over the unit square, run past its edges by `pad` [top, right, bottom, left] (image fractions). */
export function grid(cols: number, rows: number, [t, r, b, l]: readonly number[] = [0, 0, 0, 0]) {
  const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
  let i = 0;
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= cols; x++, i += 3) {
      pos[i] = -l + ((1 + l + r) * x) / cols;
      pos[i + 1] = -t + ((1 + t + b) * y) / rows;
    }
  }
  const verts = (cols + 1) * (rows + 1);
  const idx = verts > 65535 ? new Uint32Array(cols * rows * 6) : new Uint16Array(cols * rows * 6);
  i = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const a = y * (cols + 1) + x;
      const c = a + cols + 1;
      idx[i++] = a;
      idx[i++] = c;
      idx[i++] = a + 1;
      idx[i++] = a + 1;
      idx[i++] = c;
      idx[i++] = c + 1;
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  geo.setIndex(new BufferAttribute(idx, 1));
  return geo;
}

export function createPlate(p: PlateSpec, geo: BufferGeometry, map: Texture, depth: Texture, shared: PlateShared, rect: { value: Vector4 }, relief: { value: number }) {
  // a flat card sits at `flat` whatever the relief
  const r = p.depth ? p.range : { far: p.range.flat, near: p.range.flat, flat: p.range.flat };
  const defines: Record<string, string> = {};
  if (p.kind === "cutout") defines.CUTOUT = "";
  if (p.fade?.some((f) => f > 0)) defines.FADE = "";
  const mat = new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    defines,
    uniforms: {
      ...shared,
      uMap: { value: map },
      uDepth: { value: depth },
      uRect: rect,
      uRange: { value: new Vector3(1 / r.far, 1 / r.near, r.flat) },
      uRelief: relief,
      uOpacity: { value: 1 },
      uFade: { value: new Vector4(...(p.fade ?? [0, 0, 0, 0])) },
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
