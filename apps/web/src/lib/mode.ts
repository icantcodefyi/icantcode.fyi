import { useSyncExternalStore } from "react";

/**
 * Site-wide day / night mode. The value lives on <html data-mode>, set before
 * first paint by the inline script in root.tsx, so every section (and every
 * world) can theme itself from CSS alone: `html[data-mode="day"] .thing {}`.
 */

export type Mode = "night" | "day";

export const MODE_KEY = "ani-mode";
const THEME_COLOR: Record<Mode, string> = { night: "#0b0a0d", day: "#fff6fa" };

/** Runs inline in <head>: stored choice, else night (the signature look). */
export const MODE_BOOT = `(function(){try{var m=localStorage.getItem("${MODE_KEY}");if(m!=="day")m="night";document.documentElement.dataset.mode=m}catch(e){document.documentElement.dataset.mode="night"}})()`;

const subs = new Set<() => void>();

function read(): Mode {
  return document.documentElement.dataset.mode === "day" ? "day" : "night";
}

function apply(next: Mode) {
  const root = document.documentElement;
  root.dataset.mode = next;
  try {
    localStorage.setItem(MODE_KEY, next);
  } catch {
    // private mode: the choice just won't persist
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[next]);
  subs.forEach((fn) => fn());
}

/**
 * Switch modes. When the browser supports view transitions, the new mode
 * opens as a circle from `origin` (the toggle that was pressed).
 */
export function setMode(next: Mode, origin?: { x: number; y: number }) {
  if (next === read()) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
  };
  if (!doc.startViewTransition || reduced) {
    apply(next);
    return;
  }
  const x = origin?.x ?? window.innerWidth - 60;
  const y = origin?.y ?? 40;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  // The circle reveal already animates the change, so per-element colour and
  // crossfade transitions are switched off while it runs: otherwise every
  // section repaints its own fade at the same moment and the switch stutters.
  const root = document.documentElement;
  root.classList.add("mode-instant");
  const t = doc.startViewTransition(() => apply(next));
  t.finished.finally(() => root.classList.remove("mode-instant"));
  t.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 720, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {});
}

function subscribe(fn: () => void) {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function useMode(): Mode {
  return useSyncExternalStore(subscribe, read, () => "night");
}
