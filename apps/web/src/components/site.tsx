import { useEffect } from "react";

import { watchScroll } from "@/lib/scroll-loop";

/* ── Entrances: every [data-reveal] rises in once as it enters ── */

// One observer for the page; deferred sections hand theirs in as they mount.
let pending: Set<HTMLElement> | null = null;
let io: IntersectionObserver | null = null;

function show(el: HTMLElement) {
  el.classList.add("in");
  pending?.delete(el);
  io?.unobserve(el);
}

/** Start watching every not-yet-shown [data-reveal] inside `root`. */
export function revealWithin(root: ParentNode) {
  if (!pending || !io) return;
  for (const el of root.querySelectorAll<HTMLElement>("[data-reveal]")) {
    if (el.classList.contains("in") || pending.has(el)) continue;
    pending.add(el);
    io.observe(el);
  }
}

export function useReveal() {
  useEffect(() => {
    pending = new Set();
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) show(e.target as HTMLElement);
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    revealWithin(document);
    // Jumps (anchor links, fast flings) can skip the observer: anything
    // already above the fold's bottom edge is shown regardless. Reads every
    // rect first, then writes, and only looks at what hasn't been shown yet.
    // It runs from the scroll loop's watchers, at the start of the frame and
    // before the camera writes, so its reads never force an extra style pass.
    const sweep = () => {
      if (!pending?.size) return;
      const vh = window.innerHeight;
      const hit = [...pending].filter((el) => el.getBoundingClientRect().top < vh);
      for (const el of hit) show(el);
    };
    const unwatch = watchScroll(sweep);
    window.addEventListener("resize", sweep);
    return () => {
      io?.disconnect();
      io = null;
      pending = null;
      unwatch();
      window.removeEventListener("resize", sweep);
    };
  }, []);
}

/* ── Off-screen sections hold still ──
 * Every top-level section gets [data-off] while it is outside the viewport
 * (by more than 15% of a screen): its infinite CSS animations and SMIL
 * timelines pause, and resume from the same frame just before it scrolls
 * back in. Finite animations (entrances) are left alone so they always
 * finish exactly as before.
 * An animation far off screen has nothing painted to run on the compositor
 * with, so a single one left running ticks the main thread every frame: the
 * ones that start while their section is off (a box that appears late, like
 * the hero's switch) are held as they start.
 * Cheap at the crossings, which land mid-scroll: one look at the page's
 * animations per crossing, whether each is a loop is asked once per
 * animation, and every play state is read before anything is paused or
 * played (each change dirties style, and the next read would flush it).
 * [data-off] is for scripts (and audits) only: no stylesheet may select on
 * it. A rule like `[data-off] *` makes every crossing restyle the whole
 * section, mid-scroll; a world that wants its own hold uses its own hook. */

const targetOf = (a: Animation) => (a.effect as KeyframeEffect | null)?.target ?? null;

export function useOffscreenPause(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const held = new Set<Animation>();
    const loops = new WeakMap<Animation, boolean>();
    const isLoop = (a: Animation) => {
      let v = loops.get(a);
      if (v === undefined) {
        const t = targetOf(a);
        v = a instanceof CSSAnimation && !!t && a.effect?.getTiming().iterations === Infinity;
        loops.set(a, v);
      }
      return v;
    };
    const sectionOf = (t: Element | null) => {
      let n = t;
      while (n && n.parentElement !== host) n = n.parentElement;
      return n;
    };
    const hold = (list: Animation[]) => {
      const states = list.map((a) => a.playState);
      list.forEach((a, i) => {
        if (states[i] !== "running") return;
        a.pause();
        held.add(a);
      });
    };
    const io = new IntersectionObserver(
      (entries) => {
        const going = new Set<Element>();
        const coming = new Set<Element>();
        for (const e of entries) {
          const off = !e.isIntersecting;
          if (off !== e.target.hasAttribute("data-off")) (off ? going : coming).add(e.target);
        }
        if (!going.size && !coming.size) return;
        if (going.size) hold(document.getAnimations().filter((a) => isLoop(a) && going.has(sectionOf(targetOf(a)) as Element)));
        if (coming.size) {
          const back = [...held].filter((a) => coming.has(sectionOf(targetOf(a)) as Element));
          const states = back.map((a) => a.playState);
          back.forEach((a, i) => {
            held.delete(a);
            // still ours to play (not cancelled, or restarted as a new animation, meanwhile)
            if (states[i] === "paused") a.play();
          });
        }
        for (const el of [...going, ...coming]) {
          const off = going.has(el);
          el.toggleAttribute("data-off", off);
          for (const svg of el.querySelectorAll("svg")) {
            if (off) svg.pauseAnimations();
            else svg.unpauseAnimations();
          }
        }
      },
      // a little ahead, so a section is moving again a few frames before it shows; any more and the
      // next section's loops tick the main thread while you are still scrolling this one
      { rootMargin: "15% 0px" },
    );
    // Loops that start while their section is off (a section mounting) are held in idle time, a burst at a
    // time, with one look at the page's animations. Starts arrive at the top of a frame, before its style
    // pass, so looking then would force that pass early, mid-scroll; while the page scrolls the frames are
    // drawn anyway, and once it rests the burst is held within an idle moment.
    let queued = false;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 250));
    const flushStarts = () => {
      queued = false;
      hold(document.getAnimations().filter((a) => !held.has(a) && isLoop(a) && !!targetOf(a)?.closest("[data-off]")));
    };
    const started = (ev: AnimationEvent) => {
      if (queued || !(ev.target as Element).closest?.("[data-off]")) return;
      queued = true;
      idle(flushStarts, { timeout: 1000 });
    };
    host.addEventListener("animationstart", started, true);
    const watch = () => {
      for (const el of host.children) io.observe(el);
    };
    watch();
    // deferred sections swap their placeholder for the real element
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.removedNodes) if (n instanceof Element) io.unobserve(n);
        for (const n of r.addedNodes) if (n instanceof Element) io.observe(n);
      }
      for (const a of held) if (!targetOf(a)?.isConnected) held.delete(a);
    });
    mo.observe(host, { childList: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      host.removeEventListener("animationstart", started, true);
    };
  }, [root]);
}

/* ── A photograph that arrives as a two-tone Bayer dither and resolves ── */

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
