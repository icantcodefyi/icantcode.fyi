import { useEffect } from "react";

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
    let raf = 0;
    const sweep = () => {
      raf = 0;
      if (!pending?.size) return;
      const vh = window.innerHeight;
      const hit = [...pending].filter((el) => el.getBoundingClientRect().top < vh);
      for (const el of hit) show(el);
    };
    const onScroll = () => {
      if (!raf && pending?.size) raf = requestAnimationFrame(sweep);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io?.disconnect();
      io = null;
      pending = null;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
}

/* ── Off-screen sections hold still ──
 * Every top-level section gets [data-off] while it is well outside the
 * viewport: its infinite CSS animations and SMIL timelines pause, and resume
 * from the same frame well before it scrolls back in. Finite animations
 * (entrances) are left alone so they always finish exactly as before.
 * An animation far off screen has nothing painted to run on the compositor
 * with, so a single one left running ticks the main thread every frame: the
 * ones that start while their section is off (a box that appears late, like
 * the hero's switch) are held as they start.
 * Each section's infinite animations are kept in a list as they start, so a
 * section going off or coming back touches only its own (asking the page
 * for its animations at each crossing cost a long frame while scrolling).
 * A subtree marked [data-own-pause] pauses itself (the hackathon map, by
 * its own visibility) and is left to it. */

const ownPause = (n: Element | null | undefined) => !!n?.closest("[data-own-pause]");

export function useOffscreenPause(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const loops = new Map<Element, Set<Animation>>();
    const held = new Set<Animation>();
    const sectionOf = (t: Element) => {
      let n: Element | null = t;
      while (n && n.parentElement !== host) n = n.parentElement;
      return n;
    };
    const track = (a: Animation) => {
      if (!(a instanceof CSSAnimation)) return;
      const t = (a.effect as KeyframeEffect | null)?.target;
      if (!t || a.effect?.getTiming().iterations !== Infinity || ownPause(t)) return;
      const sec = sectionOf(t);
      if (!sec) return;
      let set = loops.get(sec);
      if (!set) loops.set(sec, (set = new Set()));
      set.add(a);
      if (sec.hasAttribute("data-off") && a.playState === "running") {
        a.pause();
        held.add(a);
      }
    };
    for (const a of document.getAnimations()) track(a);
    const started = (ev: AnimationEvent) => {
      const t = ev.target as Element;
      for (const a of ev.pseudoElement ? t.getAnimations({ subtree: true }) : t.getAnimations()) {
        const fx = a.effect as KeyframeEffect | null;
        if (a instanceof CSSAnimation && a.animationName === ev.animationName && fx?.target === t && (fx.pseudoElement ?? "") === ev.pseudoElement) track(a);
      }
    };
    host.addEventListener("animationstart", started, true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          const off = !e.isIntersecting;
          if (off === el.hasAttribute("data-off")) continue;
          el.toggleAttribute("data-off", off);
          for (const a of loops.get(el) ?? []) {
            // gone (its element left, or restarted as a new animation)
            if (a.playState === "idle") {
              loops.get(el)?.delete(a);
              held.delete(a);
            } else if (off && a.playState === "running") {
              a.pause();
              held.add(a);
            } else if (!off && held.delete(a)) a.play();
          }
          for (const svg of el.querySelectorAll("svg")) {
            if (ownPause(svg)) continue;
            if (off) svg.pauseAnimations();
            else svg.unpauseAnimations();
          }
        }
      },
      { rootMargin: "50% 0px" },
    );
    const watch = () => {
      for (const el of host.children) io.observe(el);
    };
    watch();
    // deferred sections swap their placeholder for the real element
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.removedNodes) {
          if (!(n instanceof Element)) continue;
          io.unobserve(n);
          for (const a of loops.get(n) ?? []) held.delete(a);
          loops.delete(n);
        }
        for (const n of r.addedNodes) if (n instanceof Element) io.observe(n);
      }
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
