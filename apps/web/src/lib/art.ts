/**
 * The painted art ships as WebP, plus an AVIF of the same painting where we
 * still have its lossless master (encoded to match or beat the WebP's
 * fidelity to that master, at roughly two thirds of the bytes).
 *
 * A one-pixel AVIF is decoded inline in <head> (ART_BOOT); `art()` hands out
 * the AVIF only once that has succeeded, so any browser without AVIF keeps
 * getting exactly the WebP it always got.
 */

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
  "/site/scenes/ship-launch",
  "/site/scenes/ship-launch-day",
  "/site/scenes/sit-cutout",
  "/site/scenes/trophy-cutout",
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
