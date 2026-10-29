import {
  AdditiveBlending,
  BufferAttribute,
  type Camera,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  Scene,
  ShaderMaterial,
  type Texture,
  Vector2,
  Vector3,
  Vector4,
  type WebGLRenderer,
} from "three";
import { type Mode, rand } from "./petal-field";
import { type PlateShared, TINT } from "./plates";
import { EYE, PLATE, type PlateName } from "./rig";
import type { Layout } from "./scene";

/**
 * The living sky: what stirs in the painting once its plates are in depth.
 * Night: stars twinkling, now and then a shooting star, the moon's halo
 * breathing, moonlit wisps drifting, fireflies over the hill. Day: clouds
 * drifting and the odd flock of birds (the sun on the meadow is the hill
 * plate's own, see plates.ts).
 *
 * Everything is placed the way the plates place their pixels: a point of
 * the sky (or hill) painting plus a distance, through the same projection
 * (plates.ts), so it rests on the painting, takes its relief and moves with
 * it under parallax, breathing and the dive. The motion lives in the
 * shaders; a frame sets a few uniforms.
 */

export interface SkyLife {
  /** drawn on the back canvas, right over the sky plate */
  sky: Scene;
  /** drawn on the front canvas over the hill plate, depth-tested against its flowers */
  meadow: Scene;
  /** a mode's plates are up: its sky and hill textures */
  attach(mode: Mode, t: { sky: Texture; skyDepth: Texture; hillDepth: Texture }): void;
  /** a mode's sprite atlas (public/site/sky-*) is up */
  sprites(mode: Mode, atlas: Texture): void;
  compile(back: WebGLRenderer, front: WebGLRenderer, camera: Camera): Promise<unknown>;
  layout(l: Layout): void;
  /** advance the clocks; `live` is how much of each mode's life is showing */
  tick(dt: number, live: Record<Mode, number>): void;
  /** set what draws this frame */
  show(live: Record<Mode, number>): void;
  dispose(): void;
}

/** Painting px of the sky and hill plates (both 1672 × 941). */
const W = 1672;
const H = 941;
/** The painted moon: centre and radius, painting px. */
const MOON = { x: 1435, y: 150.5, r: 76 };
/** The night plate's brightest painted stars, painting px: twinkles sit on them. */
const PAINTED = [
  [322, 77], [983, 56], [303, 29], [893, 23], [552, 81], [516, 42], [470, 69],
  [821, 95], [1012, 200], [864, 48], [616, 486], [286, 256], [424, 299], [1101, 216],
];
/** The night hill's crest, as v at u = 0, 0.1 … 1: fireflies hover along it. */
const CREST = [0.505, 0.569, 0.658, 0.74, 0.726, 0.834, 0.814, 0.891, 0.889, 0.859, 0.836];
/** Sprite boxes in each atlas, px (x, y, w, h). */
const ATLAS = {
  night: { size: [1800, 129], clouds: [[46, 12, 358, 94], [509, 35, 331, 90], [940, 4, 369, 85], [1403, 25, 346, 94]] },
  day: {
    size: [1800, 234],
    clouds: [[47, 19, 357, 120], [513, 43, 326, 116], [943, 2, 363, 131], [1405, 34, 342, 118]],
    birds: [0, 170, 384, 64],
  },
} as const;
/**
 * Cloud lanes: u at t = 0, v, width (painting px), drift (u per second),
 * sprite, opacity. Kept above the mountains; they wrap well off-stage.
 */
const LANES: Record<Mode, number[][]> = {
  night: [
    [0.18, 0.1, 380, 0.0016, 2, 0.5],
    [0.74, 0.36, 340, 0.0012, 0, 0.42],
    [1.18, 0.48, 400, 0.0014, 3, 0.38],
  ],
  day: [
    [0.3, 0.13, 330, 0.0024, 1, 0.9],
    [0.86, 0.31, 290, 0.002, 3, 0.82],
    [1.2, 0.2, 380, 0.0027, 2, 0.88],
  ],
};
/**
 * The open sky the rare things cross, as bands of the sky painting's v,
 * clear of the name and of the bright cloud banks (a flock is lost against
 * them): a shooting star starts above the name and slants down, a flock
 * crosses above it. On phones, the sky beside her head.
 */
const OPEN = {
  meteor: { wide: [0.06, 0.12], narrow: [0.27, 0.3] },
  flock: { wide: [0.08, 0.16], narrow: [0.26, 0.33] },
};
/** A flock: offset from the leader (painting px, trailing), wing phase, size. */
const FLOCK = [0, 0, 0, 1, -40, 13, 0.37, 0.9, -74, -7, 0.71, 0.84, -28, 32, 0.19, 0.94];

/** Where the drifting things sit, as sky depth-map values (0 farthest): a shooting star beyond everything, birds under the clouds. */
const FAR = 0;
const CLOUD_DEPTH = 0.05;
const BIRD_DEPTH = 0.1;

const vertCommon = /* glsl */ `
  uniform vec4 uRect;      // the painting's rest rect on the stage, css px
  uniform vec2 uVp;
  uniform float uF;
  uniform vec3 uRange;     // its plate's 1/far, 1/near, flat distance
  uniform float uRelief;
  uniform float uTime;

  // the distance the plate puts depth value d at (plates.ts)
  float plateDist(float d) {
    return mix(uRange.z, 1.0 / mix(uRange.x, uRange.y, d), uRelief);
  }
  // the point px (css px) off the painting's pixel uv, at that distance
  vec3 platePoint(vec2 uv, float dist, vec2 px) {
    vec2 s = (uRect.xy + uv * uRect.zw + px - uVp) * (dist / uF);
    return vec3(s.x, -s.y, ${EYE.toFixed(1)} - dist);
  }
  vec4 project(vec3 p) {
    return projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
  // css px per painting px
  float platePx() {
    return uRect.z / ${W.toFixed(1)};
  }
  float luma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }
  // beyond the far plane: nothing to draw
  const vec4 NOWHERE = vec4(0.0, 0.0, 2.0, 1.0);
`;

/* ── stars ── */

const starVert = /* glsl */ `
  attribute vec4 aStar;    // uv, half size (painting px), seed
  uniform sampler2D uMap;
  uniform sampler2D uDepth;
  uniform vec3 uMoon;      // uv, radius (painting px)
  uniform float uOpacity;
  uniform float uDeep;
  uniform vec3 uTint;
  varying vec2 vQ;
  varying vec3 vCol;
  varying float vGlint;

  void main() {
    vec2 uv = aStar.xy;
    float seed = aStar.w;
    // open sky only: dark under a coarse look at the painting, clear of the moon's glow
    float open = 1.0 - smoothstep(0.07, 0.12, luma(textureLod(uMap, uv, 4.0).rgb));
    open *= smoothstep(2.6, 3.6, length((uv - uMoon.xy) * vec2(${W.toFixed(1)}, ${H.toFixed(1)})) / uMoon.z);
    // a slow, uneven twinkle, and now and then a brief flare
    float t = uTime;
    float w = 0.5 + 0.3 * sin(t * (0.45 + 0.6 * seed) + seed * 40.0) + 0.2 * sin(t * (1.2 + 1.3 * fract(seed * 7.31)) + seed * 13.0);
    float flare = pow(max(0.0, sin(t * (0.17 + 0.16 * fract(seed * 3.7)) + seed * 29.0)), 30.0);
    float b = (0.15 + 0.85 * w * w + flare) * open * uOpacity * uRelief;
    vGlint = step(5.0, aStar.z);
    vCol = mix(vec3(1.0, 0.9, 0.95), vec3(1.0, 0.68, 0.85), fract(seed * 5.3)) * b * mix(vec3(1.0), uTint, uDeep);
    vQ = position.xy;
    float size = aStar.z * platePx() * (0.85 + 0.25 * w + 0.5 * flare);
    gl_Position = b < 0.002 ? NOWHERE : project(platePoint(uv, plateDist(textureLod(uDepth, uv, 0.0).r), position.xy * size));
  }
`;

const starFrag = /* glsl */ `
  varying vec2 vQ;
  varying vec3 vCol;
  varying float vGlint;

  void main() {
    float r = length(vQ);
    // a glint is a small hot core and four fine rays, about a device pixel wide
    float px = fwidth(vQ.x) * 0.9;
    float rays = (exp(-abs(vQ.x) / px) + exp(-abs(vQ.y) / px)) * pow(max(0.0, 1.0 - r), 2.0);
    float v = mix(exp(-r * r * 7.0), exp(-r * r * 60.0) + rays * 0.55, vGlint);
    gl_FragColor = vec4(vCol * v * (1.0 - smoothstep(0.85, 1.0, r)), 0.0);
  }
`;

/* ── the moon's halo ── */

const HALO = 3.2; // radii

const haloVert = /* glsl */ `
  uniform sampler2D uDepth;
  uniform vec3 uMoon;
  varying vec2 vQ;

  void main() {
    vQ = position.xy;
    float dist = plateDist(textureLod(uDepth, uMoon.xy, 0.0).r);
    gl_Position = project(platePoint(uMoon.xy, dist, position.xy * uMoon.z * platePx() * ${HALO.toFixed(1)}));
  }
`;

const haloFrag = /* glsl */ `
  uniform float uOpacity;
  uniform float uRelief;
  uniform float uTime;
  uniform float uDeep;
  uniform vec3 uTint;
  varying vec2 vQ;

  void main() {
    float r = length(vQ) * ${HALO.toFixed(1)};
    float out_ = max(r - 1.0, 0.0);
    // a soft bloom from the limb outward; the face stays as painted
    float glow = (exp(-out_ * 3.0) * 0.5 + exp(-out_ * 1.0) * 0.3) * smoothstep(0.9, 1.04, r);
    glow *= 1.0 - smoothstep(${(HALO * 0.75).toFixed(2)}, ${HALO.toFixed(1)}, r);
    // a slow breath that never quite repeats
    float t = uTime;
    float breath = 0.5 + 0.32 * sin(t * 0.45) + 0.18 * sin(t * 0.29 + 1.7);
    vec3 c = vec3(1.0, 0.56, 0.74) * glow * (0.35 + 0.65 * breath) * 0.18 * uOpacity * uRelief;
    gl_FragColor = vec4(c * mix(vec3(1.0), uTint, uDeep), 0.0);
  }
`;

/* ── a shooting star ── */

const meteorVert = /* glsl */ `
  uniform vec2 uA;         // start and end of the head's path, uv
  uniform vec2 uB;
  uniform float uP;        // how far along, 0..1
  uniform float uLen;      // full tail, painting px
  varying vec3 vS;         // painting px behind the head, across, tail length
  varying vec2 vUv;

  void main() {
    float pp = platePx();
    vec2 a = uA * uRect.zw;
    vec2 b = uB * uRect.zw;
    vec2 dir = normalize(b - a);
    vec2 head = mix(a, b, uP);
    // the tail grows as it catches, never back past where it began
    float tail = min(uLen * pp * smoothstep(0.0, 0.4, uP), length(head - a)) + 0.01;
    float along = mix(tail, -12.0 * pp, position.x * 0.5 + 0.5);
    float across = position.y * 12.0 * pp;
    vec2 at = head - dir * along + vec2(-dir.y, dir.x) * across;
    vS = vec3(along, across, tail) / pp;
    vUv = at / uRect.zw;
    gl_Position = project(platePoint(vUv, plateDist(${FAR.toFixed(1)}), vec2(0.0)));
  }
`;

const meteorFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uP;
  uniform float uOpacity;
  uniform float uRelief;
  uniform float uDeep;
  uniform vec3 uTint;
  varying vec3 vS;
  varying vec2 vUv;

  void main() {
    float s = clamp(vS.x / vS.z, 0.0, 1.0);
    float hw = mix(0.85, 0.3, s);
    float trail = step(0.0, vS.x) * pow(1.0 - s, 1.8) * exp(-vS.y * vS.y / (hw * hw));
    float r2 = vS.x * vS.x + vS.y * vS.y;
    float head = exp(-r2 / 4.0) + exp(-r2 / 36.0) * 0.18;
    float env = smoothstep(0.0, 0.1, uP) * (1.0 - smoothstep(0.5, 1.0, uP));
    // it burns beyond the clouds: hidden where the painting is bright
    float clear = 1.0 - smoothstep(0.1, 0.3, dot(textureLod(uMap, vUv, 3.0).rgb, vec3(0.2126, 0.7152, 0.0722)));
    vec3 c = mix(vec3(1.0, 0.6, 0.8), vec3(1.0, 0.97, 0.98), max(head, 1.0 - s));
    c *= (trail * 0.95 + head * 1.4) * env * clear * uOpacity * uRelief;
    gl_FragColor = vec4(c * mix(vec3(1.0), uTint, uDeep), 0.0);
  }
`;

/* ── drifting clouds ── */

const cloudVert = /* glsl */ `
  attribute vec4 aLane;    // u at t = 0, v, width (painting px), drift (u/s)
  attribute vec2 aLook;    // sprite, opacity
  uniform vec4 uBox[4];    // sprite boxes, atlas px
  uniform vec2 uAtlas;
  varying vec2 vT;
  varying vec2 vUv;
  varying float vA;

  void main() {
    vec4 box = uBox[int(aLook.x)];
    vec2 uv = vec2(mod(aLane.x + uTime * aLane.w + 0.35, 1.7) - 0.35, aLane.y);
    vec2 half_ = vec2(aLane.z, aLane.z * box.w / box.z) * 0.5 * platePx();
    vec2 q = position.xy;
    vT = (box.xy + (q * 0.5 + 0.5) * box.zw) / uAtlas;
    vUv = uv + q * half_ / uRect.zw;
    vA = aLook.y;
    gl_Position = project(platePoint(uv, plateDist(${CLOUD_DEPTH.toFixed(2)}), q * half_));
  }
`;

const cloudFrag = /* glsl */ `
  uniform sampler2D uSprites;
  uniform sampler2D uMap;
  uniform sampler2D uDepth;
  uniform float uOpacity;
  uniform float uRelief;
  uniform float uDeep;
  uniform vec3 uTint;
  uniform float uHaze;
  uniform float uCover;    // how much of what's behind it the cloud hides; the rest of its light adds
  varying vec2 vT;
  varying vec2 vUv;
  varying float vA;

  void main() {
    vec4 c = texture2D(uSprites, vT); // premultiplied
    // behind the mountains, should one ever drift that low
    c *= 1.0 - smoothstep(0.12, 0.25, texture2D(uDepth, vUv).r);
    // some of the sky's own light, so it sits in the same air
    c.rgb = mix(c.rgb, textureLod(uMap, vUv, 5.0).rgb * c.a, uHaze);
    c.rgb *= mix(vec3(1.0), uTint, uDeep);
    gl_FragColor = vec4(c.rgb, c.a * uCover) * vA * uOpacity * uRelief;
  }
`;

/* ── birds ── */

const birdVert = /* glsl */ `
  attribute vec4 aBird;    // offset from the leader (painting px), wing phase, size
  uniform sampler2D uMap;
  uniform vec4 uPath;      // from, to (uv)
  uniform vec3 uFlight;    // progress 0..1, seconds aloft, arc height (v)
  uniform float uDir;      // 1 flying right, -1 left
  uniform float uSize;     // cell size, painting px
  uniform vec4 uCells;     // the six frames' row, atlas px
  uniform vec2 uAtlas;
  varying vec2 vT;
  varying vec3 vSky;
  varying float vFar;

  void main() {
    float p = uFlight.x;
    float t = uFlight.y;
    vec2 uv = mix(uPath.xy, uPath.zw, p);
    uv.y -= uFlight.z * 4.0 * p * (1.0 - p);
    // flying away: smaller and hazier as they go
    float recede = mix(1.0, 0.7, p);
    float pp = platePx();
    vec2 off = vec2(aBird.x * uDir, aBird.y) * recede + vec2(0.0, sin(t * 1.9 + aBird.z * 6.283) * 2.5);
    // wingbeats, broken by glides
    float glide = step(0.64, fract(t * 0.17 + aBird.z));
    float f = mix(floor(mod(t * 9.0 + aBird.z * 6.0, 6.0)), 2.0, glide);
    vec2 q = position.xy;
    vT = (uCells.xy + vec2((f + q.x * 0.5 + 0.5) / 6.0, q.y * 0.5 + 0.5) * uCells.zw) / uAtlas;
    vSky = textureLod(uMap, uv, 5.0).rgb;
    vFar = p;
    float size = uSize * aBird.w * recede * pp * 0.5;
    gl_Position = project(platePoint(uv, plateDist(${BIRD_DEPTH.toFixed(2)}), off * pp + q * size));
  }
`;

const birdFrag = /* glsl */ `
  uniform sampler2D uSprites;
  uniform float uOpacity;
  uniform float uRelief;
  uniform float uDeep;
  uniform vec3 uTint;
  varying vec2 vT;
  varying vec3 vSky;
  varying float vFar;

  void main() {
    vec4 c = texture2D(uSprites, vT); // premultiplied
    c.rgb = mix(c.rgb, vSky * c.a, mix(0.22, 0.5, vFar));
    c.rgb *= mix(vec3(1.0), uTint, uDeep);
    gl_FragColor = c * mix(1.0, 0.75, vFar) * uOpacity * uRelief;
  }
`;

/* ── fireflies ── */

const flyVert = /* glsl */ `
  attribute vec4 aFly;     // hill uv, distance past the flowers there, seed
  attribute vec4 aLook;    // size (css px), pink..gold, blinks per second, wander
  uniform sampler2D uDepth;
  uniform float uOpacity;
  uniform float uScale;
  uniform float uLift;     // v to raise them by (phones: out of the copy, into the air by her legs)
  varying vec2 vQ;
  varying vec3 vCol;

  void main() {
    float t = uTime;
    float s = aFly.w;
    vec2 uv = aFly.xy - vec2(0.0, uLift) + aLook.w * vec2(
      sin(t * 0.23 + s * 17.0) * 0.02 + sin(t * 0.57 + s * 5.0) * 0.006,
      sin(t * 0.19 + s * 11.0) * 0.014 + sin(t * 0.71 + s * 3.0) * 0.005);
    // at the depth of the flowers it drifts among (the map carries the crest's depth up past it)
    float dist = plateDist(textureLod(uDepth, clamp(uv, 0.0, 1.0), 0.0).r) + aFly.z;
    vec3 p = platePoint(uv, dist, vec2(0.0));
    // a slow swell and fade, then dark for a while
    float ph = fract(t * aLook.z + s * 7.0);
    float glow = smoothstep(0.0, 0.25, ph) * (1.0 - smoothstep(0.5, 0.85, ph));
    // and gone before it would touch the lens
    float k = glow * smoothstep(0.8, 2.6, -(viewMatrix * vec4(p, 1.0)).z) * uOpacity * uRelief;
    vCol = mix(vec3(1.0, 0.45, 0.72), vec3(1.0, 0.8, 0.46), aLook.y) * k;
    vQ = position.xy;
    float size = aLook.x * uScale * (${PLATE.hill.flat.toFixed(1)} / dist) * (0.75 + 0.25 * glow);
    gl_Position = k < 0.002 ? NOWHERE : project(platePoint(uv, dist, position.xy * size));
  }
`;

const flyFrag = /* glsl */ `
  varying vec2 vQ;
  varying vec3 vCol;

  void main() {
    float r2 = dot(vQ, vQ);
    // a hot little core in a soft glow
    float v = (exp(-r2 * 200.0) * 1.2 + exp(-r2 * 26.0) + exp(-r2 * 6.0) * 0.5) * (1.0 - smoothstep(0.55, 1.0, r2));
    vec3 c = vCol * v + exp(-r2 * 500.0) * 0.8 * vCol.r * vec3(1.0, 0.95, 0.88);
    // light: alpha to its brightest channel, so over the page it screens rather than piles up
    gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
  }
`;

/* ── assembly ── */

const quad = () => {
  const g = new InstancedBufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
};

const between = (a: number, b: number) => a + Math.random() * (b - a);

type U<T> = { value: T };

export function createSkyLife(shared: PlateShared, rects: Record<PlateName, U<Vector4>>): SkyLife {
  const r = rand(0x2b17a3);
  const range = (n: PlateName) => ({ value: new Vector3(1 / PLATE[n].far, 1 / PLATE[n].near, PLATE[n].flat) });
  const per = <T>(make: (m: Mode) => T): Record<Mode, T> => ({ night: make("night"), day: make("day") });

  // per mode: how much of its life shows, its textures, and the sky's tint in the dive
  const op = per(() => ({ value: 0 }));
  const opSprites = per(() => ({ value: 0 }));
  const map = per((): U<Texture | null> => ({ value: null }));
  const depth = per((): U<Texture | null> => ({ value: null }));
  const atlas = per((): U<Texture | null> => ({ value: null }));
  const tint = per((m) => ({ value: TINT[m] }));
  const hillDepth: U<Texture | null> = { value: null };
  const sky = { ...shared, uRect: rects.sky, uRange: range("sky") };
  const moon = { value: new Vector3(MOON.x / W, MOON.y / H, MOON.r) };

  const materials: ShaderMaterial[] = [];
  const geometries: InstancedBufferGeometry[] = [];
  function mesh(
    vert: string,
    frag: string,
    uniforms: Record<string, U<unknown>>,
    instances: Record<string, [Float32Array, number]>,
    order: number,
    o: { additive?: boolean; depthTest?: boolean } = {},
  ) {
    const g = quad();
    let count = 1;
    for (const [name, [data, size]] of Object.entries(instances)) {
      g.setAttribute(name, new InstancedBufferAttribute(data, size));
      count = data.length / size;
    }
    g.instanceCount = count;
    const mat = new ShaderMaterial({
      vertexShader: vertCommon + vert,
      fragmentShader: frag,
      uniforms,
      transparent: true,
      premultipliedAlpha: true,
      blending: o.additive ? AdditiveBlending : NormalBlending,
      depthTest: !!o.depthTest,
      depthWrite: false,
      // offsets are in css px, y down, which flips the winding: draw both faces, in one pass
      side: DoubleSide,
      forceSinglePass: true,
    });
    const m = new Mesh(g, mat);
    m.frustumCulled = false;
    m.renderOrder = order; // draw order is the layering: stars, halo, meteor, clouds, birds
    materials.push(mat);
    geometries.push(g);
    return m;
  }

  // ── night ──
  const stars: number[] = [];
  for (const [x, y] of PAINTED) stars.push((x + 0.5) / W, (y + 0.5) / H, 6 + r() * 3, r());
  for (let i = 0; i < 90; i++) stars.push(r(), r() * 0.62, r() < 0.12 ? 5.5 + r() * 2.5 : 1.6 + r() * 1.4, r());
  const base = per((m) => ({ ...sky, uMap: map[m], uDepth: depth[m], uOpacity: op[m], uTint: tint[m] }));
  const starMesh = mesh(starVert, starFrag, { ...base.night, uMoon: moon }, { aStar: [new Float32Array(stars), 4] }, 0, { additive: true });
  const halo = mesh(haloVert, haloFrag, { ...base.night, uMoon: moon }, {}, 1, { additive: true });
  const meteorU = { uA: { value: new Vector2() }, uB: { value: new Vector2() }, uP: { value: 0 }, uLen: { value: 120 } };
  const meteor = mesh(meteorVert, meteorFrag, { ...base.night, ...meteorU }, {}, 2, { additive: true });

  function clouds(m: Mode) {
    const lanes = LANES[m];
    const a = ATLAS[m];
    return mesh(
      cloudVert,
      cloudFrag,
      {
        ...base[m],
        uOpacity: opSprites[m],
        uSprites: atlas[m],
        uBox: { value: a.clouds.map((b) => new Vector4(...b)) },
        uAtlas: { value: new Vector2(...a.size) },
        uHaze: { value: 0.15 },
        // night wisps are moonlit vapour: thin, and their lit edges glow
        uCover: { value: m === "night" ? 0.55 : 1 },
      },
      {
        aLane: [new Float32Array(lanes.flatMap((l) => l.slice(0, 4))), 4],
        aLook: [new Float32Array(lanes.flatMap((l) => l.slice(4))), 2],
      },
      3,
    );
  }

  // fireflies strung along the crest, some above it, some down among the flowers
  const fly: number[] = [];
  const look: number[] = [];
  const N = 13;
  for (let i = 0; i < N; i++) {
    const u = 0.04 + (0.92 * (i + r())) / N;
    const x = Math.min(9.999, u * 10);
    const crest = CREST[Math.floor(x)] + (CREST[Math.floor(x) + 1] - CREST[Math.floor(x)]) * (x % 1);
    const among = r() < 0.45;
    fly.push(u, crest + (among ? r() * 0.07 : -0.01 - r() * 0.07), among ? 0.3 + r() * 0.6 : -0.5 + r() * 0.8, r());
    look.push(44 + r() * 14, r() < 0.6 ? 0.7 + r() * 0.3 : r() * 0.3, 1 / (4.5 + r() * 3.5), 0.6 + r() * 0.8);
  }
  const flyScale = { value: 1 };
  const flyLift = { value: 0 };
  const flies = mesh(
    flyVert,
    flyFrag,
    { ...shared, uRect: rects.hill, uRange: range("hill"), uDepth: hillDepth, uOpacity: op.night, uScale: flyScale, uLift: flyLift },
    { aFly: [new Float32Array(fly), 4], aLook: [new Float32Array(look), 4] },
    0,
    { additive: true, depthTest: true },
  );

  // ── day ──
  const birdU = {
    uPath: { value: new Vector4() },
    uFlight: { value: new Vector3() },
    uDir: { value: 1 },
    uSize: { value: 38 },
    uCells: { value: new Vector4(...ATLAS.day.birds) },
    uAtlas: { value: new Vector2(...ATLAS.day.size) },
  };
  const birds = mesh(
    birdVert,
    birdFrag,
    { ...base.day, uOpacity: opSprites.day, uSprites: atlas.day, ...birdU },
    { aBird: [new Float32Array(FLOCK), 4] },
    4,
  );

  const wisps = clouds("night");
  const groups = {
    night: new Group().add(starMesh, halo, meteor, wisps),
    day: new Group().add(clouds("day"), birds),
  };
  const skyScene = new Scene().add(groups.night, groups.day);
  const meadow = new Scene().add(flies);

  const ready = { night: false, day: false };
  const spriteIn = { night: 0, day: 0 };
  let compiled: Promise<unknown> | null = null;

  // ── the rare things: a shooting star, a flock ──
  let view = { u0: 0, u1: 1, w: 1, h: 1, narrow: false };
  const meteorRun = { left: between(5, 14), t: -1, dur: 1 };
  const flight = { left: between(9, 20), t: -1, dur: 1 };

  function launchMeteor() {
    const { u0, u1, w, h, narrow } = view;
    const rw = rects.sky.value.z;
    const rh = rects.sky.value.w;
    const span = narrow ? w * 0.34 : Math.min(340, w * 0.42, h * 0.5);
    const ang = ((narrow ? between(18, 32) : between(8, 22)) * Math.PI) / 180;
    const du = (Math.cos(ang) * span) / rw;
    let x: number;
    let dir: number;
    if (narrow) {
      // phones: from beside her head out into the open sky on the left
      x = u0 + (u1 - u0) * between(0.3, 0.4);
      dir = -1;
    } else {
      // a stretch of open sky that is on stage and clear of the moon
      const lo = Math.max(u0, 0.1) + 0.04;
      const hi = Math.max(lo, Math.min(u1, 0.7) - 0.04);
      x = between(lo, hi);
      dir = Math.random() < 0.5 ? 1 : -1;
      if (x + dir * du > hi + 0.04 || x + dir * du < lo - 0.04) dir = -dir;
    }
    const band = OPEN.meteor[narrow ? "narrow" : "wide"];
    const a = meteorU.uA.value.set(x, between(band[0], band[1]));
    meteorU.uB.value.set(a.x + dir * du, a.y + (Math.sin(ang) * span) / rh);
    meteorU.uLen.value = span * between(0.32, 0.45);
    meteorRun.dur = between(0.8, 1.2);
    meteorRun.t = 0;
  }

  function launchFlock() {
    const { u0, u1, narrow } = view;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const band = OPEN.flock[narrow ? "narrow" : "wide"];
    // rising a little as they go
    const vs = between(band[0], band[1]);
    const vEnd = vs - between(0.01, 0.03);
    const [from, to] = dir > 0 ? [u0 - 0.04, u1 + 0.04] : [u1 + 0.04, u0 - 0.04];
    birdU.uPath.value.set(from, vs, to, vEnd);
    birdU.uFlight.value.set(0, 0, between(0.008, 0.02));
    birdU.uDir.value = dir;
    birdU.uSize.value = narrow ? 30 : 38;
    birds.geometry.instanceCount = 2 + Math.floor(Math.random() * (narrow ? 2 : 3));
    const px = Math.abs(to - from) * rects.sky.value.z;
    flight.dur = px / (narrow ? between(48, 58) : between(92, 112));
    flight.t = 0;
  }

  /** Count down to the next one while its mode is fully showing; run it; rest a while. */
  function rare(run: { left: number; t: number; dur: number }, on: boolean, dt: number, launch: () => void, rest: [number, number]) {
    if (run.t >= 0) {
      run.t += dt;
      if (run.t >= run.dur) {
        run.t = -1;
        run.left = between(...rest);
      }
    } else if (on) {
      run.left -= dt;
      if (run.left <= 0) launch();
    }
  }

  return {
    sky: skyScene,
    meadow,
    attach(m, t) {
      map[m].value = t.sky;
      depth[m].value = t.skyDepth;
      if (m === "night") hillDepth.value = t.hillDepth;
      ready[m] = true;
    },
    sprites(m, t) {
      atlas[m].value = t;
    },
    compile(back, front, camera) {
      // compiling only sees what is visible; the next show() sets it straight
      skyScene.traverse((o) => {
        o.visible = true;
      });
      flies.visible = true;
      compiled ??= Promise.all([back.compileAsync(skyScene, camera), front.compileAsync(meadow, camera)]);
      return compiled;
    },
    layout(l) {
      const s = l.rects.sky;
      view = {
        u0: -s.x / s.w,
        u1: (l.lens.w - s.x) / s.w,
        w: l.lens.w,
        h: l.lens.h,
        narrow: l.lens.w < 700,
      };
      flyScale.value = view.narrow ? 0.8 : 1;
      flyLift.value = view.narrow ? 0.22 : 0;
    },
    tick(dt, live) {
      for (const m of ["night", "day"] as const) if (atlas[m].value) spriteIn[m] = Math.min(1, spriteIn[m] + dt / 2.5);
      const settled = shared.uRelief.value > 0.99;
      rare(meteorRun, ready.night && live.night > 0.99 && settled, dt, launchMeteor, [12, 25]);
      rare(flight, ready.day && !!atlas.day.value && live.day > 0.99 && settled, dt, launchFlock, [15, 30]);
      if (meteorRun.t >= 0) meteorU.uP.value = meteorRun.t / meteorRun.dur;
      if (flight.t >= 0) birdU.uFlight.value.set(flight.t / flight.dur, flight.t, birdU.uFlight.value.z);
    },
    show(live) {
      for (const m of ["night", "day"] as const) {
        op[m].value = live[m];
        opSprites[m].value = live[m] * spriteIn[m] * spriteIn[m];
        groups[m].visible = ready[m] && live[m] > 0.001;
      }
      // the clouds and birds wait for their sprites
      wisps.visible = !!atlas.night.value;
      groups.day.visible &&= !!atlas.day.value;
      meteor.visible = meteorRun.t >= 0;
      birds.visible = flight.t >= 0;
      flies.visible = groups.night.visible;
    },
    dispose() {
      for (const m of materials) m.dispose();
      for (const g of geometries) g.dispose();
      atlas.night.value?.dispose();
      atlas.day.value?.dispose();
    },
  };
}
