import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { art } from "@/lib/art";
import { useDayArt } from "@/lib/day-art";
import { EXPERIENCE } from "@/lib/site-data";
import "./experience-work.css";

/* ──────────────────────────────────────────────────────────────────────
 * Scene motion shared by both painted sections.
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

const DESK = "/site/scenes/work-desk";
const DESK_DAY = "/site/scenes/work-desk-day";

/* ── Painting geometry (work-desk.png is 1659 × 948) ── */
const ART_W = 1659;
const ART_H = 948;
const SCREEN = 220; // the monitor's content box, before it is warped onto the glass

/** matrix3d that maps a SCREEN×SCREEN box onto the quad TL, TR, BR, BL. */
function quad(pts: [number, number][]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = pts;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const h = (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
  const s = SCREEN;
  const m = [a / s, d / s, 0, g / s, b / s, e / s, 0, h / s, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((n) => +n.toFixed(6)).join(",")})`;
}

/* The left monitor's glass, traced from the painting. */
const MONITOR = quad([
  [1171, 223],
  [1379, 210],
  [1380, 436],
  [1171, 419],
]);

/* Timeline stops across the stage; the last one sits under the monitor's left edge. */
const STOPS = ["var(--margin)", "36cqw", "71cqw"];

const LEDE =
  "I learned to code from YouTube in Indore, got hooked on hackathons, and now ship product end to end: the idea, the interface and the code behind it.";

export function Experience() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useSceneMotion(root);
  const dayArt = useDayArt(art(DESK_DAY), root);

  // The monitor overlay lives in painting pixels; scale it to the stage.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      el.style.setProperty("--k", String(entry.contentRect.width / ART_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Oldest first, so the line ends under the monitor that shows the current role.
  const roles = [...EXPERIENCE].reverse();
  const now = EXPERIENCE[0];

  return (
    <section id="experience" ref={root} className="xp" aria-labelledby="xp-title">
      <div className="xp-stage" ref={stage}>
        <div className="xp-art" aria-hidden="true">
          <img
            className="xp-img"
            src={art(DESK)}
            alt=""
            width={ART_W}
            height={ART_H}
            loading="lazy"
            decoding="async"
          />
          {/* the day painting is pixel-aligned with the night one, so the monitor overlay still fits */}
          {dayArt ? (
            <img className="xp-img xp-img-day" src={art(DESK_DAY)} alt="" width={ART_W} height={ART_H} decoding="async" />
          ) : null}
          <div className="xp-plane">
            <div className="xp-bloom" />
            <div className="xp-screen" style={{ transform: MONITOR, width: SCREEN, height: SCREEN }}>
              <span className="xp-screen-top">
                <span className="xp-live" />
                Now at
              </span>
              <span className="xp-screen-name">
                Supernova
                <br />
                AI
              </span>
              <span className="xp-screen-foot">
                {now.where}
                <span className="xp-caret" />
              </span>
            </div>
          </div>
        </div>
        <div className="xp-scrim" aria-hidden="true" />

        <div className="xp-copy">
          <h2 id="xp-title" className="xp-title" data-reveal>
            Where <br />I work
          </h2>
          <p className="xp-lede" data-reveal style={{ "--d": "90ms" } as CSSProperties}>
            {LEDE}
          </p>
        </div>

        <ol className="xp-line" data-reveal style={{ "--d": "160ms" } as CSSProperties}>
          {roles.map((r, i) => {
            const current = r.company === now.company;
            return (
              <li
                key={r.company}
                className="xp-stop"
                data-now={current ? "" : undefined}
                style={{ "--at": STOPS[i] } as CSSProperties}
              >
                <span className="xp-node" aria-hidden="true" />
                <span className="xp-when">
                  {r.when}
                  {current ? <span className="sr-only"> (current role)</span> : null}
                </span>
                <span className="xp-co">{r.company}</span>
                <span className="xp-role">
                  {r.role} · {r.where}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
