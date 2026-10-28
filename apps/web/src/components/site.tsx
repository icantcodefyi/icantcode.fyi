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
 * (entrances) are left alone so they always finish exactly as before. */

export function useOffscreenPause(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const held = new Set<Animation>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          const off = !e.isIntersecting;
          if (off === el.hasAttribute("data-off")) continue;
          el.toggleAttribute("data-off", off);
          for (const a of el.getAnimations({ subtree: true })) {
            if (!(a instanceof CSSAnimation) || a.effect?.getTiming().iterations !== Infinity) continue;
            if (off && a.playState === "running") {
              a.pause();
              held.add(a);
            } else if (!off && held.delete(a)) a.play();
          }
          for (const svg of el.querySelectorAll("svg")) {
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
        for (const n of r.removedNodes) if (n instanceof Element) io.unobserve(n);
        for (const n of r.addedNodes) if (n instanceof Element) io.observe(n);
      }
    });
    mo.observe(host, { childList: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [root]);
}

/* ── A photograph that arrives as a two-tone Bayer dither and resolves ── */

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
