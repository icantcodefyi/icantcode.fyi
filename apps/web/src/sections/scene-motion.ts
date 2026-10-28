import { useEffect, type RefObject } from "react";

/* ──────────────────────────────────────────────────────────────────────
 * Scene motion for the painted Recent work section (work.tsx).
 *   --mx / --my : pointer, -1..1 (fine pointers only)
 *   --p         : progress of the section through the viewport, 0..1
 * Damped in rAF, idle when off-screen, skipped for reduced motion.
 * ──────────────────────────────────────────────────────────────────── */
export function useSceneMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const goal = { mx: 0, my: 0, p: 0.5 };
    const cur = { mx: 0, my: 0, p: 0.5 };
    let raf = 0;
    let last = 0;
    let inView = false;

    const measure = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      goal.p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
    };
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = 1 - Math.exp(-dt * 5);
      const ks = 1 - Math.exp(-dt * 9);
      cur.mx += (goal.mx - cur.mx) * k;
      cur.my += (goal.my - cur.my) * k;
      cur.p += (goal.p - cur.p) * ks;
      el.style.setProperty("--mx", cur.mx.toFixed(4));
      el.style.setProperty("--my", cur.my.toFixed(4));
      el.style.setProperty("--p", cur.p.toFixed(4));
      const settled =
        Math.abs(goal.mx - cur.mx) < 1e-4 && Math.abs(goal.my - cur.my) < 1e-4 && Math.abs(goal.p - cur.p) < 1e-4;
      raf = settled ? 0 : requestAnimationFrame(loop);
    };
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!inView || (e.pointerType !== "mouse" && e.pointerType !== "pen")) return;
      goal.mx = (e.clientX / window.innerWidth) * 2 - 1;
      goal.my = (e.clientY / window.innerHeight) * 2 - 1;
      kick();
    };
    const onScroll = () => {
      if (!inView) return;
      measure();
      kick();
    };
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) onScroll();
    });
    io.observe(el);
    if (fine) window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    measure();
    kick();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [root]);
}

const LEDE =
  "I learned to code from YouTube in Indore, got hooked on hackathons, and now ship product end to end: the idea, the interface and the code behind it.";

/** One plain line per role, keyed by company. */
