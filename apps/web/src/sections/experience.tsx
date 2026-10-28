import { useEffect, type CSSProperties, type RefObject } from "react";
import { EXPERIENCE } from "@/lib/site-data";
import "./experience-work.css";

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
const DID: Record<(typeof EXPERIENCE)[number]["company"], string> = {
  "Supernova AI": "Building the product end to end: shaping features, designing the interface and writing the code that ships it.",
  "Merlin AI": "Worked on the Merlin Chrome extension, an AI assistant you can call up on any page you're reading.",
  DevKit: "Worked on developer tooling, the small utilities that take the busywork out of a developer's day.",
};

export function Experience() {
  const current = EXPERIENCE[0].company;

  return (
    <section id="experience" className="xp" aria-labelledby="xp-title">
      <div className="xp-glow" aria-hidden="true" />
      <header className="xp-head">
        <h2 id="xp-title" className="xp-title" data-reveal>
          Where I&nbsp;work
        </h2>
        <p className="xp-lede" data-reveal style={{ "--d": "90ms" } as CSSProperties}>
          {LEDE}
        </p>
      </header>

      <ol className="xp-list">
        {EXPERIENCE.map((r, i) => {
          const now = r.company === current;
          const [from, to] = r.when.split(" – ");
          return (
            <li
              key={r.company}
              className="xp-row"
              data-now={now ? "" : undefined}
              data-reveal
              style={{ "--d": `${140 + i * 90}ms` } as CSSProperties}
            >
              <p className="xp-when">
                <span>
                  {from}
                  {to ? <> – {now ? <span className="xp-now">{to}</span> : to}</> : null}
                </span>
                {now ? <span className="xp-dot" aria-hidden="true" /> : null}
                {now ? <span className="sr-only"> (current role)</span> : null}
              </p>
              <h3 className="xp-co">{r.company}</h3>
              <div className="xp-detail">
                <p className="xp-role">
                  {r.role} <span aria-hidden="true">·</span> {r.where}
                </p>
                <p className="xp-did">{DID[r.company]}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
