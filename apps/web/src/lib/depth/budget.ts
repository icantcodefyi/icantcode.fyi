import { reducedMotion } from "@/lib/motion";

/**
 * Who may run WebGL, and how many contexts the sections may hold.
 *
 * The hero keeps its own three contexts; the sections share at most MAX
 * more, so the page never comes near the browsers' 16-context eviction.
 * A stage takes one per canvas when it comes near and gives them back when
 * it is far; when there aren't enough, the live stage farthest from the
 * viewport (if farther than the one asking) is evicted. Once a stage's
 * governor gives up, the visit is "spent" and no later stage starts GL.
 *
 * `window.__depth()` reports all of it for verification scripts.
 */

export const MAX = 2;
const SPENT = "depth-spent";

export interface Entry {
  id: string;
  state(): string;
  dpr(): number;
  fps(): number;
  relief(): number;
  /** css px between the stage and the viewport (0 while on screen) */
  distance(): number;
  /** give the contexts back; resolves once they are released */
  evict(): Promise<void>;
  /** contexts were released after this one was refused: try again */
  retry(): void;
}

const entries = new Set<Entry>();
const holders = new Map<Entry, number>();
/** refused while near, waiting for contexts to come free */
const waiting = new Set<Entry>();
let used = 0;

declare global {
  interface Window {
    __depth?: () => {
      contexts: number;
      max: number;
      spent: boolean;
      live: { id: string; state: string; dpr: number; fps: number; relief: number }[];
    };
  }
}

export function spent() {
  try {
    return sessionStorage.getItem(SPENT) === "1";
  } catch {
    return false;
  }
}

export function spend() {
  try {
    sessionStorage.setItem(SPENT, "1");
  } catch {
    // private mode: only this page load gives up
  }
}

type Net = Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };

/**
 * The hero's gate: not for reduced motion, data saver, the smallest devices,
 * browsers without WebGL2, or a spent visit. `?depth=0` forces GL off,
 * `?depth=1` on (reduced motion still wins).
 */
export function allowed() {
  if (typeof window === "undefined" || reducedMotion() || typeof WebGL2RenderingContext === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("depth");
  if (q === "0") return false;
  if (q === "1") return true;
  const n = navigator as Net;
  return !n.connection?.saveData && (n.deviceMemory ?? 8) > 2 && !spent();
}

if (typeof window !== "undefined") {
  window.__depth = () => ({
    contexts: used,
    max: MAX,
    spent: spent(),
    live: [...entries].map((x) => ({ id: x.id, state: x.state(), dpr: x.dpr(), fps: x.fps(), relief: x.relief() })),
  });
}

export function enlist(e: Entry) {
  entries.add(e);
  return () => {
    release(e);
    entries.delete(e);
    waiting.delete(e);
  };
}

/** `n` contexts for `e`, evicting farther stages if need be; false if they can't be had. */
export async function acquire(e: Entry, n: number) {
  if (n > MAX) return false;
  while (used + n > MAX) {
    let far: Entry | null = null;
    for (const h of holders.keys()) if (h !== e && (!far || h.distance() > far.distance())) far = h;
    if (!far || far.distance() <= e.distance()) {
      waiting.add(e);
      return false;
    }
    await far.evict();
    release(far);
  }
  if (!entries.has(e)) return false;
  waiting.delete(e);
  used += n;
  holders.set(e, n);
  return true;
}

export function release(e: Entry) {
  const n = holders.get(e);
  if (!n) return;
  used -= n;
  holders.delete(e);
  nudge();
}

/** A holder left the screen (it may now be evicted) or contexts came free: the refused try again. */
export function nudge() {
  for (const w of waiting) w.retry();
}
