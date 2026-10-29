/**
 * The painted art ships as WebP, plus an AVIF of the same painting where we
 * still have its lossless master (encoded to match or beat the WebP's
 * fidelity to that master, at roughly two thirds of the bytes).
 *
 * A one-pixel AVIF is decoded inline in <head> (ART_BOOT); `art()` hands out
 * the AVIF only once that has succeeded, so any browser without AVIF keeps
 * getting exactly the WebP it always got.
 */

import type { SeamArt } from "@/lib/depth/types";

declare global {
  interface Window {
    __avif?: boolean;
  }
}

/** Paintings that have an .avif sibling in public/. */
const AVIF = new Set([
  "/site/plate-night-sky",
  "/site/plate-day-sky",
  "/site/plate-day-hill",
  "/site/hero-cutout",
  "/site/hero-depth-night",
  "/site/hero-depth-day",
  "/site/sky-night",
  "/site/sky-day",
  "/site/scenes/ship-launch",
  "/site/scenes/ship-launch-day",
  "/site/scenes/sit-cutout",
  "/site/scenes/trophy-cutout",
  "/site/scenes/work-depth-day",
  "/site/scenes/work-depth-night",
  "/site/scenes/work-flowers-day",
  "/site/scenes/work-flowers-day-half",
  "/site/scenes/work-flowers-night",
  "/site/scenes/work-flowers-night-half",
  "/site/scenes/work-girl-day",
  "/site/scenes/work-girl-day-half",
  "/site/scenes/work-girl-night",
  "/site/scenes/work-girl-night-half",
  "/site/scenes/work-sky-day",
  "/site/scenes/work-sky-day-half",
  "/site/scenes/work-sky-night",
  "/site/scenes/work-sky-night-half",
  "/site/scenes/trophy-girl",
  "/site/scenes/trophy-girl-600",
  "/site/scenes/trophy-confetti",
  "/site/scenes/trophy-confetti-600",
  "/site/finale/meadow-night",
  "/site/finale/meadow-night-1200",
  "/site/finale/meadow-day",
  "/site/finale/meadow-day-1200",
  "/site/finale/meadow-depth-night",
  "/site/finale/meadow-depth-day",
  "/site/seams/cloud-rise-night-back",
  "/site/seams/cloud-rise-night-back-1200",
  "/site/seams/cloud-rise-night-front",
  "/site/seams/cloud-rise-night-front-1200",
  "/site/seams/cloud-rise-day-back",
  "/site/seams/cloud-rise-day-back-1200",
  "/site/seams/cloud-rise-day-front",
  "/site/seams/cloud-rise-day-front-1200",
  "/site/seams/cloud-fall-night-back",
  "/site/seams/cloud-fall-night-back-1200",
  "/site/seams/cloud-fall-night-front",
  "/site/seams/cloud-fall-night-front-1200",
  "/site/seams/cloud-fall-day-back",
  "/site/seams/cloud-fall-day-back-1200",
  "/site/seams/cloud-fall-day-front",
  "/site/seams/cloud-fall-day-front-1200",
  "/lobby/val/stage/night-sky",
  "/lobby/val/stage/night-sky-800",
  "/lobby/val/stage/night-far",
  "/lobby/val/stage/night-far-800",
  "/lobby/val/stage/night-near",
  "/lobby/val/stage/night-near-800",
  "/lobby/val/stage/night-depth",
  "/lobby/val/stage/night-depth-800",
  "/lobby/val/stage/day-sky",
  "/lobby/val/stage/day-sky-800",
  "/lobby/val/stage/day-far",
  "/lobby/val/stage/day-far-800",
  "/lobby/val/stage/day-near",
  "/lobby/val/stage/day-near-800",
  "/lobby/val/stage/day-depth",
  "/lobby/val/stage/day-depth-800",
]);

export const avif = () => typeof window !== "undefined" && window.__avif === true;

/** `/site/x` → `/site/x.avif` when it exists and the browser decodes AVIF, else `/site/x.webp`. */
export function art(base: string) {
  return `${base}.${AVIF.has(base) && avif() ? "avif" : "webp"}`;
}

/**
 * A srcset for a lazy image with `sizes="auto"`: the full file plus a half
 * size one, offered only on 1x screens. There Chromium takes the smallest
 * candidate that covers the rendered width, so the half file is used only
 * where its real pixels cover the box (× any hover zoom). On HiDPI screens it
 * can round down to a candidate below the needed density, so they keep the
 * full file, as do browsers without `sizes="auto"` (they read the 100vw
 * fallback and pick the largest).
 */
export function halfSet(full: string, fullW: number, small: string, smallW: number, zoom = 1) {
  if (typeof window === "undefined" || window.devicePixelRatio > 1) return undefined;
  return `${small} ${Math.floor(smallW / zoom)}w, ${full} ${fullW}w`;
}

export const HERO_ART = {
  night: {
    sky: "/site/plate-night-sky",
    hill: "/site/plate-night-hill",
    char: "/site/hero-night-cutout",
  },
  day: {
    sky: "/site/plate-day-sky",
    hill: "/site/plate-day-hill",
    char: "/site/hero-cutout",
  },
} as const;

const AVIF_PROBE =
  "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAHAAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAJG1kYXQSAAoFGAAGBCAyERgACiiihAAAsBNU7TCk6wz8";

const preloadList = (mode: "night" | "day") =>
  Object.values(HERO_ART[mode]).map((b) => [b, AVIF.has(b)] as const);

/**
 * Runs inline in <head>, after MODE_BOOT: detects AVIF and starts fetching the
 * current mode's three hero plates before the app's scripts have even arrived
 * (they used to wait for React to render the <img>s).
 */
export const ART_BOOT = `(function(){try{var w=window,i=new Image();i.onload=function(){w.__avif=i.width>0};i.src=${JSON.stringify(AVIF_PROBE)};var P=${JSON.stringify({ night: preloadList("night"), day: preloadList("day") })}[document.documentElement.dataset.mode==="day"?"day":"night"];for(var k=0;k<P.length;k++){var l=document.createElement("link");l.rel="preload";l.as="image";if(P[k][1]){l.type="image/avif";l.href=P[k][0]+".avif"}else l.href=P[k][0]+".webp";document.head.appendChild(l)}}catch(e){}})()`;

/** Recent work: the extended sky, her cut from the original painting, the near flowers, one depth atlas per mode. */
export const WORK_ART = {
  night: {
    sky: "/site/scenes/work-sky-night",
    girl: "/site/scenes/work-girl-night",
    flowers: "/site/scenes/work-flowers-night",
    depth: "/site/scenes/work-depth-night",
    skyHalf: "/site/scenes/work-sky-night-half",
    girlHalf: "/site/scenes/work-girl-night-half",
    flowersHalf: "/site/scenes/work-flowers-night-half",
  },
  day: {
    sky: "/site/scenes/work-sky-day",
    girl: "/site/scenes/work-girl-day",
    flowers: "/site/scenes/work-flowers-day",
    depth: "/site/scenes/work-depth-day",
    skyHalf: "/site/scenes/work-sky-day-half",
    girlHalf: "/site/scenes/work-girl-day-half",
    flowersHalf: "/site/scenes/work-flowers-day-half",
  },
  size: [1224, 1836],
  original: { size: [1122, 1402], offset: [51, 434] },
  atlas: {
    size: [1173, 921],
    tiles: {
      sky: [0, 0, 612, 918],
      girl: [612, 0, 561, 701],
      flowers: [612, 701, 561, 220],
    },
  },
  layers: {
    sky: { size: [1224, 1836], offset: [0, 0] },
    girl: { size: [1122, 1402], offset: [51, 434] },
    flowers: { size: [1122, 440], offset: [51, 1396] },
  },
} as const;

/** Footer meadow under the hero sky, and where the sitting cutout rests on it. */
export const FINALE_ART = {
  night: {
    sky: "/site/plate-night-sky",
    meadow: "/site/finale/meadow-night",
    meadowHalf: "/site/finale/meadow-night-1200",
    depth: "/site/finale/meadow-depth-night",
    sit: "/site/scenes/sit-cutout",
    ground: "#120A10",
  },
  day: {
    sky: "/site/plate-day-sky",
    meadow: "/site/finale/meadow-day",
    meadowHalf: "/site/finale/meadow-day-1200",
    depth: "/site/finale/meadow-depth-day",
    sit: "/site/scenes/sit-cutout",
    ground: "#FFF1F6",
  },
} as const;

export const FINALE_ART_LAYOUT = {
  meadowSize: [2400, 1100],
  meadowHalfSize: [1200, 550],
  depthSize: [1200, 550],
  depthUv: [0, 0, 1, 1],
  seatPercent: [62, 51.8181818182],
  sit: {
    sourceSize: [1448, 1086],
    x: 44.3333333333,
    y: 15.1818181818,
    w: 36,
    contactAnchor: [710, 675],
  },
} as const;

/** Hackathons: the trophy painting split into her and the free-floating confetti. */
export const TROPHY_ART = {
  girl: "/site/scenes/trophy-girl",
  girlHalf: "/site/scenes/trophy-girl-600",
  confetti: "/site/scenes/trophy-confetti",
  confettiHalf: "/site/scenes/trophy-confetti-600",
} as const;

export const TROPHY_LAYERS = [
  { id: "girl", art: TROPHY_ART.girl, half: TROPHY_ART.girlHalf,
    size: [1122, 1402], halfSize: [600, 750], distance: 12.5 },
  { id: "confetti", art: TROPHY_ART.confetti, half: TROPHY_ART.confettiHalf,
    size: [1122, 1402], halfSize: [600, 750], distance: 7 },
] as const;

/** The painted cloud seams above and below Hackathons (components/seam.tsx). */
export const SEAM_ART = {
  "cloud-rise": {
    night: { back: "/site/seams/cloud-rise-night-back", front: "/site/seams/cloud-rise-night-front" },
    day: { back: "/site/seams/cloud-rise-day-back", front: "/site/seams/cloud-rise-day-front" },
    half: { night: { back: "/site/seams/cloud-rise-night-back-1200", front: "/site/seams/cloud-rise-night-front-1200" }, day: { back: "/site/seams/cloud-rise-day-back-1200", front: "/site/seams/cloud-rise-day-front-1200" } },
    size: [2400, 720],
  },
  "cloud-fall": {
    night: { back: "/site/seams/cloud-fall-night-back", front: "/site/seams/cloud-fall-night-front" },
    day: { back: "/site/seams/cloud-fall-day-back", front: "/site/seams/cloud-fall-day-front" },
    half: { night: { back: "/site/seams/cloud-fall-night-back-1200", front: "/site/seams/cloud-fall-night-front-1200" }, day: { back: "/site/seams/cloud-fall-day-back-1200", front: "/site/seams/cloud-fall-day-front-1200" } },
    size: [2400, 640],
  },
} satisfies Record<"cloud-rise" | "cloud-fall", SeamArt>;

/** Valorant: the painted rooftop vista behind the agent, layered for depth. */
export const VALORANT_STAGE = {
  night: {
    sky: "/lobby/val/stage/night-sky",
    far: "/lobby/val/stage/night-far",
    near: "/lobby/val/stage/night-near",
    depth: "/lobby/val/stage/night-depth",
    skyHalf: "/lobby/val/stage/night-sky-800",
    farHalf: "/lobby/val/stage/night-far-800",
    nearHalf: "/lobby/val/stage/night-near-800",
    depthHalf: "/lobby/val/stage/night-depth-800",
  },
  day: {
    sky: "/lobby/val/stage/day-sky",
    far: "/lobby/val/stage/day-far",
    near: "/lobby/val/stage/day-near",
    depth: "/lobby/val/stage/day-depth",
    skyHalf: "/lobby/val/stage/day-sky-800",
    farHalf: "/lobby/val/stage/day-far-800",
    nearHalf: "/lobby/val/stage/day-near-800",
    depthHalf: "/lobby/val/stage/day-depth-800",
  },
  size: [1600, 1800],
  halfSize: [800, 900],
  offset: [0, 0],
  objectPosition: "42% 50%",
  tint: { color: "#ff4655", night: 0.22, day: 0.18 },
} as const;
