import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearMipmapLinearFilter,
  Matrix4,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";
import { paintPetalAtlas } from "./petal-texture";

/**
 * Two transparent canvases share one camera: `back` sits behind the name and
 * the character, `front` sits over the character. Petals are GPU-animated
 * (the vertex shader integrates fall, sway, drift and tumble from per-instance
 * seeds), so a frame costs two draw calls per canvas and no matrix uploads.
 */

export type Mode = "day" | "night";

export interface FieldInput {
  /** pointer, damped by the caller: -1..1 */
  mx: number;
  my: number;
  /** hero exit progress 0..1 */
  scroll: number;
}

export interface PetalField {
  setMode(mode: Mode): void;
  setActive(active: boolean): void;
  resize(): void;
  dispose(): void;
}

const PALETTE = {
  day: { base: new Color("#e7739f"), tip: new Color("#fff7fa"), glow: 0.0, spark: new Color("#ffd3e4") },
  night: { base: new Color("#ff2e88"), tip: new Color("#ffc2db"), glow: 1.0, spark: new Color("#ff5fa3") },
};

const petalVert = /* glsl */ `
  attribute vec3 aPos;
  attribute vec4 aRand;   // x size, y fall speed, z spin speed, w phase
  attribute vec3 aAxis;
  attribute float aVariant;

  uniform float uTime;
  uniform vec3 uBox;      // half extents of the wrap volume (x, y) and z centre unused
  uniform float uFocus;   // camera distance that is in focus

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
    vVariant = aVariant;
    float t = uTime;
    float size = aRand.x;
    float speed = aRand.y;
    float phase = aRand.w;

    // Cup the petal and let it flutter: z bends with x², the tip flaps.
    vec3 p = position;
    float flutter = sin(t * (2.2 + speed) + phase * 6.0) * 0.18;
    p.z += (p.x * p.x) * 0.9 + (p.y + 0.5) * flutter;
    p *= size;

    // Tumble around a per-petal axis, with a slow precessing second spin.
    float ang = t * aRand.z + phase * 6.2831;
    mat3 R = axisAngle(aAxis, ang) * axisAngle(normalize(vec3(0.3, 1.0, 0.2)), sin(t * 0.4 + phase * 3.0) * 1.2);
    vec3 n = R * vec3(0.0, 0.0, 1.0);
    p = R * p;

    // Fall with drift to the right (a breeze), sway, and wrap inside the box.
    vec3 c = aPos;
    c.y -= t * speed * 0.55;
    c.x += t * speed * 0.32 + sin(t * 0.7 * speed + phase * 9.0) * 0.6;
    c.z += cos(t * 0.5 * speed + phase * 5.0) * 0.35;
    c.y = mod(c.y + uBox.y, 2.0 * uBox.y) - uBox.y;
    c.x = mod(c.x + uBox.x, 2.0 * uBox.x) - uBox.x;

    vec4 mv = modelViewMatrix * vec4(c + p, 1.0);
    gl_Position = projectionMatrix * mv;

    float dist = -mv.z;
    // Depth of field: mip bias grows away from the focus distance.
    vBlur = clamp(abs(dist - uFocus) / (uFocus * 0.45), 0.0, 1.0);
    // Fade into the haze far away and vanish just before touching the lens.
    vFade = smoothstep(0.25, 1.6, dist) * (1.0 - smoothstep(uFocus * 2.2, uFocus * 3.4, dist));
    vec3 viewN = normalize(mat3(modelViewMatrix) * n);
    vFacing = viewN.z;
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
    // Back faces read a touch deeper; light passes through the front.
    col *= mix(0.78, 1.0, smoothstep(-0.6, 0.6, vFacing));
    // Night: neon rim where the feathered edge is.
    float rim = (1.0 - smoothstep(0.35, 0.95, tex.a));
    col += uGlow * rim * vec3(1.0, 0.35, 0.65) * 0.9;
    col = mix(col, col * 1.18, uGlow);

    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

const sparkVert = /* glsl */ `
  attribute vec4 aRand; // x size, y twinkle speed, z phase, w drift
  uniform float uTime;
  uniform float uPx;
  uniform vec3 uBox;
  varying float vTw;
  varying float vRot;
  void main() {
    vec3 c = position;
    c.y += sin(uTime * 0.3 * aRand.w + aRand.z * 6.0) * 0.4 - uTime * 0.08 * aRand.w;
    c.x += cos(uTime * 0.25 + aRand.z * 4.0) * 0.3;
    c.y = mod(c.y + uBox.y, 2.0 * uBox.y) - uBox.y;
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = pow(0.5 + 0.5 * sin(uTime * aRand.y + aRand.z * 6.2831), 3.0);
    vTw = tw;
    vRot = aRand.z * 3.14159 + uTime * 0.2;
    gl_PointSize = aRand.x * uPx * (0.35 + 0.65 * tw) / max(-mv.z, 0.5);
  }
`;

const sparkFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vTw;
  varying float vRot;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float s = sin(vRot), c = cos(vRot);
    vec2 q = mat2(c, -s, s, c) * p;
    float r = length(p);
    // Four long rays, four short diagonal rays, a hot core and a soft halo.
    float rays = exp(-abs(q.x) * 28.0) * (1.0 - smoothstep(0.0, 1.0, abs(q.y)))
               + exp(-abs(q.y) * 28.0) * (1.0 - smoothstep(0.0, 1.0, abs(q.x)));
    vec2 d = mat2(0.7071, -0.7071, 0.7071, 0.7071) * q;
    float diag = (exp(-abs(d.x) * 40.0) * (1.0 - smoothstep(0.0, 0.5, abs(d.y)))
               + exp(-abs(d.y) * 40.0) * (1.0 - smoothstep(0.0, 0.5, abs(d.x)))) * 0.5;
    float core = exp(-r * r * 60.0);
    float halo = exp(-r * r * 6.0) * 0.25;
    float v = (rays + diag) * 0.8 + core * 1.4 + halo;
    v *= vTw * uOpacity * (1.0 - smoothstep(0.8, 1.0, r));
    if (v < 0.004) discard;
    vec3 col = mix(uColor, vec3(1.0), clamp(core * 1.2, 0.0, 1.0));
    gl_FragColor = vec4(col, min(v, 1.0));
    #include <colorspace_fragment>
  }
`;

function rand(seed: number) {
  // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Layer {
  renderer: WebGLRenderer;
  scene: Scene;
  petals: InstancedMesh;
  sparks: Points;
}

const BOX = { x: 9, y: 6.5 };
const FOCUS = 14;

export function createPetalField(
  back: HTMLCanvasElement,
  front: HTMLCanvasElement,
  read: () => FieldInput,
  opts: { mode: Mode; reduced: boolean },
): PetalField {
  const r = rand(0x5a4b11);
  const narrow = window.innerWidth < 700;
  const density = narrow ? 0.5 : window.innerWidth < 1100 ? 0.75 : 1;

  const atlas = new CanvasTexture(paintPetalAtlas());
  atlas.minFilter = LinearMipmapLinearFilter;
  atlas.generateMipmaps = true;
  atlas.anisotropy = 4;

  const pal = PALETTE[opts.mode];
  const petalUniforms = {
    uTime: { value: 0 },
    uBox: { value: [BOX.x, BOX.y, 0] },
    uFocus: { value: FOCUS },
    uMap: { value: atlas },
    uBase: { value: pal.base.clone() },
    uTip: { value: pal.tip.clone() },
    uGlow: { value: pal.glow },
    uOpacity: { value: 1 },
  };
  const petalMat = new ShaderMaterial({
    vertexShader: petalVert,
    fragmentShader: petalFrag,
    uniforms: petalUniforms,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });

  const sparkUniforms = {
    uTime: petalUniforms.uTime,
    uBox: petalUniforms.uBox,
    uPx: { value: 1 },
    uColor: { value: pal.spark.clone() },
    uOpacity: { value: opts.mode === "night" ? 1 : 0.55 },
  };
  const sparkMat = new ShaderMaterial({
    vertexShader: sparkVert,
    fragmentShader: sparkFrag,
    uniforms: sparkUniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const petalGeo = new PlaneGeometry(1, 1, 4, 4);

  function makePetals(count: number, zMin: number, zMax: number, sizeMin: number, sizeMax: number) {
    const geo = new BufferGeometry();
    geo.index = petalGeo.index;
    geo.setAttribute("position", petalGeo.getAttribute("position"));
    geo.setAttribute("uv", petalGeo.getAttribute("uv"));
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count * 4);
    const axis = new Float32Array(count * 3);
    const variant = new Float32Array(count);
    const zs: number[] = [];
    for (let i = 0; i < count; i++) zs.push(zMin + (zMax - zMin) * Math.pow(r(), 0.85));
    zs.sort((a, b) => a - b); // back to front for cleaner blending
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (r() * 2 - 1) * BOX.x;
      pos[i * 3 + 1] = (r() * 2 - 1) * BOX.y;
      pos[i * 3 + 2] = zs[i];
      const big = r() < 0.12 ? 1.6 : 1;
      rnd[i * 4] = (sizeMin + (sizeMax - sizeMin) * r()) * big;
      rnd[i * 4 + 1] = 0.35 + r() * 0.75;
      rnd[i * 4 + 2] = (r() < 0.5 ? -1 : 1) * (0.5 + r() * 1.6);
      rnd[i * 4 + 3] = r();
      const ax = r() * 2 - 1, ay = r() * 2 - 1, az = r() * 2 - 1;
      const l = Math.hypot(ax, ay, az) || 1;
      axis[i * 3] = ax / l;
      axis[i * 3 + 1] = ay / l;
      axis[i * 3 + 2] = az / l;
      variant[i] = r() < 0.6 ? 0 : 1;
    }
    geo.setAttribute("aPos", new InstancedBufferAttribute(pos, 3));
    geo.setAttribute("aRand", new InstancedBufferAttribute(rnd, 4));
    geo.setAttribute("aAxis", new InstancedBufferAttribute(axis, 3));
    geo.setAttribute("aVariant", new InstancedBufferAttribute(variant, 1));
    const mesh = new InstancedMesh(geo, petalMat, count);
    const id = new Matrix4();
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, id);
    mesh.frustumCulled = false;
    return mesh;
  }

  function makeSparks(count: number, zMin: number, zMax: number) {
    const geo = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (r() * 2 - 1) * BOX.x;
      pos[i * 3 + 1] = (r() * 2 - 1) * BOX.y;
      pos[i * 3 + 2] = zMin + (zMax - zMin) * r();
      rnd[i * 4] = 14 + r() * 30;
      rnd[i * 4 + 1] = 0.8 + r() * 2.2;
      rnd[i * 4 + 2] = r();
      rnd[i * 4 + 3] = 0.4 + r();
    }
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("aRand", new BufferAttribute(rnd, 4));
    const pts = new Points(geo, sparkMat);
    pts.frustumCulled = false;
    return pts;
  }

  const camera = new PerspectiveCamera(38, 1, 0.1, 80);
  camera.position.set(0, 0, FOCUS);

  function makeLayer(canvas: HTMLCanvasElement, petals: InstancedMesh, sparks: Points): Layer {
    const renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    const scene = new Scene();
    scene.add(petals, sparks);
    return { renderer, scene, petals, sparks };
  }

  // Back: deep field behind the name (z -26..-1). Front: between character and lens.
  const backLayer = makeLayer(
    back,
    makePetals(Math.round(300 * density), -26, -1, 0.16, 0.3),
    makeSparks(Math.round(22 * density), -18, -2),
  );
  const frontLayer = makeLayer(
    front,
    makePetals(Math.round(110 * density), 1.5, 12.5, 0.14, 0.26),
    makeSparks(Math.round(8 * density), 2, 9),
  );
  const layers = [backLayer, frontLayer];

  let w = 0;
  let h = 0;
  function resize() {
    const rect = back.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const l of layers) {
      l.renderer.setPixelRatio(dpr);
      l.renderer.setSize(w, h, false);
    }
    camera.aspect = w / h;
    // Keep the petal volume framed on tall phones: widen the vertical fov.
    camera.fov = w / h < 0.8 ? 52 : 38;
    camera.updateProjectionMatrix();
    sparkUniforms.uPx.value = h * dpr * 0.06;
    if (!running) renderOnce();
  }

  // Smooth colour transitions between modes.
  const target = { base: pal.base.clone(), tip: pal.tip.clone(), glow: pal.glow, spark: pal.spark.clone(), sparkOp: sparkUniforms.uOpacity.value };

  let raf = 0;
  let running = false;
  let active = true;
  let last = performance.now();
  let time = 12.0; // start mid-flight so the field is already populated

  function tick(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!opts.reduced) time += dt;
    step(dt);
    raf = requestAnimationFrame(tick);
  }

  function step(dt: number) {
    const k = 1 - Math.exp(-dt * 3);
    petalUniforms.uBase.value.lerp(target.base, k);
    petalUniforms.uTip.value.lerp(target.tip, k);
    petalUniforms.uGlow.value += (target.glow - petalUniforms.uGlow.value) * k;
    sparkUniforms.uColor.value.lerp(target.spark, k);
    sparkUniforms.uOpacity.value += (target.sparkOp - sparkUniforms.uOpacity.value) * k;
    petalUniforms.uTime.value = time;

    const input = opts.reduced ? { mx: 0, my: 0, scroll: 0 } : read();
    // Scroll flies the camera into the field; the pointer orbits it a little.
    camera.position.set(input.mx * 0.9, -input.my * 0.55 + input.scroll * 0.8, FOCUS - input.scroll * 9);
    camera.lookAt(input.mx * 0.2, input.scroll * 0.4, -20);
    for (const l of layers) l.renderer.render(l.scene, camera);
  }

  function renderOnce() {
    step(1);
  }

  function start() {
    if (running || opts.reduced) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  resize();
  if (opts.reduced) renderOnce();
  else start();

  return {
    setMode(mode) {
      const p = PALETTE[mode];
      target.base.copy(p.base);
      target.tip.copy(p.tip);
      target.glow = p.glow;
      target.spark.copy(p.spark);
      target.sparkOp = mode === "night" ? 1 : 0.55;
      if (opts.reduced) {
        petalUniforms.uBase.value.copy(p.base);
        petalUniforms.uTip.value.copy(p.tip);
        petalUniforms.uGlow.value = p.glow;
        sparkUniforms.uColor.value.copy(p.spark);
        sparkUniforms.uOpacity.value = target.sparkOp;
        renderOnce();
      }
    },
    setActive(next) {
      if (next === active) return;
      active = next;
      if (active) start();
      else stop();
    },
    resize,
    dispose() {
      stop();
      for (const l of layers) {
        l.petals.geometry.dispose();
        l.petals.dispose();
        l.sparks.geometry.dispose();
        l.renderer.dispose();
        l.renderer.forceContextLoss();
      }
      petalGeo.dispose();
      petalMat.dispose();
      sparkMat.dispose();
      atlas.dispose();
    },
  };
}
