import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Mode } from "./hero/petal-field";
import type { HeroScene, PlateImages } from "./hero/scene";
import { SkyToggle } from "./hero/sky-toggle";
import { driveStage, type Stage } from "./hero/stage";
import { art, HERO_ART } from "@/lib/art";
import { setMode, useMode } from "@/lib/mode";
import { atRest } from "@/lib/scroll-loop";
import "./hero.css";

const TWITTER = "https://twitter.com/icantcodefyi";

const NAV = [
  { href: "#work", label: "Work" },
  { href: "#hackathons", label: "Hackathons" },
  { href: "#off-the-clock", label: "Off the clock" },
  { href: "#contact", label: "Contact" },
];

const ART = HERO_ART;

/** Natural sizes, so each plate reserves its box before it decodes. */
const DIMS = { sky: [1672, 941], hill: [1672, 941], char: [1024, 1536] } as const;

const LINES = ["Aniruddh", "Dubge"];

function Letters({ offset = 0 }: { offset?: number }) {
  let i = offset;
  return (
    <>
      {LINES.map((line, li) => (
        <Fragment key={line}>
          {li > 0 ? " " : null}
          <span className={`hero-line hero-line-${li + 1}`}>
            {Array.from(line).map((ch, ci) => (
              <span key={ci} className="hero-ch" style={{ "--i": i++ } as CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </>
  );
}

/** Whether a painting is there, without fetching it (a HEAD request). */
function exists(src: string) {
  return fetch(src, { method: "HEAD" }).then(
    (r) => r.ok,
    () => false,
  );
}

/** Hide an <img> that failed, including failures that happened before hydration. */
function useBrokenGuard(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mark = (img: HTMLImageElement) => img.setAttribute("data-broken", "");
    el.querySelectorAll("img").forEach((img) => {
      if (img.complete && img.naturalWidth === 0) mark(img);
    });
    const onError = (e: Event) => {
      if (e.target instanceof HTMLImageElement) mark(e.target);
    };
    el.addEventListener("error", onError, true);
    return () => el.removeEventListener("error", onError, true);
  }, [root]);
}

function layer(mode: Mode, set: keyof typeof ART) {
  return { a: ART[set], set, eager: set === "night", on: mode === set };
}

/** What the WebGL stage loads per mode after first paint: the plates' depth, then the sky's sprites. */
const STAGE_ART = {
  night: { depth: "/site/hero-depth-night", sky: "/site/sky-night" },
  day: { depth: "/site/hero-depth-day", sky: "/site/sky-day" },
} as const;
const stageArt = (m: Mode) => ({ depth: art(STAGE_ART[m].depth), sky: art(STAGE_ART[m].sky) });

const frame = () => new Promise((r) => requestAnimationFrame(r));

/** Resolves once the hero's entrances and the canvases' fade-in (it starts with data-ready) have played out. */
async function settled(el: HTMLElement) {
  while (!el.hasAttribute("data-ready")) await frame();
  const nodes = [...el.querySelectorAll(".hero-in, .hero-canvas")];
  await Promise.all(nodes.flatMap((n) => n.getAnimations()).map((a) => a.finished.catch(() => {})));
}

/** Runs `fn` in idle time once `ms` have passed: for work nothing is waiting on. */
function later(ms: number, fn: () => void) {
  const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
  window.setTimeout(() => idle(fn), ms);
}

/** After the takeover has settled in, so the two never share a frame. */
const DAY_AFTER = 2500; // ms

function plateImages(el: HTMLElement, set: Mode): PlateImages | null {
  const pick = (plate: string) => el.querySelector<HTMLImageElement>(`.hero-img[data-plate="${plate}"][data-set="${set}"]`);
  const sky = pick("sky");
  const char = pick("char");
  const hill = pick("hill");
  return sky && char && hill && !sky.hasAttribute("data-broken") && !char.hasAttribute("data-broken") && !hill.hasAttribute("data-broken")
    ? { sky, char, hill }
    : null;
}

/** Render the day plates (`show`) if they aren't yet; resolves once they can paint, false if one can't. */
async function dayPainted(el: HTMLElement | null, show: () => void) {
  show();
  let imgs = el && plateImages(el, "day");
  for (let i = 0; el && !imgs && i < 30; i++) {
    await frame();
    imgs = plateImages(el, "day");
  }
  if (!imgs) return false;
  return Promise.all(Object.values(imgs).map((img) => img.decode())).then(
    () => true,
    () => false,
  );
}

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const back = useRef<HTMLCanvasElement>(null);
  const charCanvas = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const scene = useRef<HeroScene | null>(null);
  const stage = useRef<Stage | null>(null);
  const upgrade = useRef<(mode: Mode) => void>(() => {});
  const preloadDay = useRef(() => {});
  const mode = useMode();
  const [dayOk, setDayOk] = useState(false);
  // the day <img>s render (and load) in night mode only after the first scroll, or for a switch
  const [dayImgs, setDayImgs] = useState(false);
  const [ready, setReady] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const dayOkRef = useRef(dayOk);
  dayOkRef.current = dayOk;

  useBrokenGuard(root);

  // The day art is checked for after first paint; the toggle appears only once it exists.
  useEffect(() => {
    let alive = true;
    const go = () =>
      Promise.all([exists(art(ART.day.sky)), exists(art(ART.day.char))]).then(([s, c]) => {
        if (alive && s && c) setDayOk(true);
      });
    const t = window.setTimeout(go, 600);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, []);

  // In night mode the day plates only make a first switch seamless, so nothing
  // of them loads before the visitor's first scroll (and then once they rest).
  useEffect(() => {
    if (!dayOk || dayImgs) return;
    let alive = true;
    const go = () => void atRest().then(() => alive && setDayImgs(true));
    if (window.scrollY > 0) go();
    else window.addEventListener("scroll", go, { once: true, passive: true });
    return () => {
      alive = false;
      window.removeEventListener("scroll", go);
    };
  }, [dayOk, dayImgs]);

  // The camera rig drives the DOM layers from the start; the WebGL scene (petals,
  // then the depth plates) joins after first paint and is paused off-screen.
  useEffect(() => {
    const el = root.current;
    const b = back.current;
    const c = charCanvas.current;
    const f = front.current;
    if (!el || !b || !c || !f) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) el.setAttribute("data-reduced", "");
    const st = driveStage(el, { reduced, dims: DIMS });
    stage.current = st;
    let disposed = false;

    const net = (navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number });
    // the plates are an upgrade: not for reduced motion, data saver or the smallest devices
    const depth = !reduced && !net.connection?.saveData && (net.deviceMemory ?? 8) > 2;

    upgrade.current = async (m) => {
      const s = scene.current;
      const images = plateImages(el, m);
      if (!s || !images || st.spent) return;
      // none of the plates' loading lands inside the entrance
      await settled(el);
      const ok = await s.load(m, images, stageArt(m));
      if (!ok || disposed || modeRef.current !== m || scene.current !== s) return;
      st.relayout();
      st.swap();
      if (m === "night") later(DAY_AFTER, preloadDay.current);
    };

    const start = async () => {
      try {
        const { createHeroScene } = await import("./hero/scene");
        if (disposed) return;
        const m0 = modeRef.current;
        const s = await createHeroScene({ back: b, char: c, front: f }, { mode: m0, depth });
        if (disposed) {
          s.dispose();
          return;
        }
        scene.current = s;
        st.attach(s);
        // switched while it came up
        if (modeRef.current !== m0) s.setMode(modeRef.current, true);
        setReady(true);
        const lost = () => {
          st.unswap();
          scene.current = null;
        };
        for (const cv of [b, c, f]) cv.addEventListener("webglcontextlost", lost, { once: true });
        if (depth) upgrade.current(modeRef.current);
      } catch {
        // No WebGL: the painted layers stand on their own.
      }
    };
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 120));
    const handle = idle(() => void start());

    return () => {
      disposed = true;
      if (window.cancelIdleCallback && typeof handle === "number") window.cancelIdleCallback(handle);
      st.dispose();
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  // The new mode has to be on the canvases before a view transition snapshots
  // the page, so this runs in the commit, not after paint.
  useLayoutEffect(() => {
    const s = scene.current;
    if (!s) return;
    // instant under a view transition (it animates the change) and for reduced motion (nothing ticks)
    s.setMode(mode, document.documentElement.classList.contains("mode-instant") || !!root.current?.hasAttribute("data-reduced"));
    stage.current?.relayout();
    if (!s.has(mode)) {
      stage.current?.unswap();
      upgrade.current(mode);
    }
  }, [mode]);

  // decode the day plates ahead of the first switch, once the current mode's are up
  preloadDay.current = () => {
    const s = scene.current;
    const el = root.current;
    if (!dayOkRef.current || !s || !el || !s.has(modeRef.current)) return;
    const day = plateImages(el, "day");
    if (day) void s.load("day", day, stageArt("day"));
  };
  useEffect(() => {
    if (dayImgs && scene.current?.has(modeRef.current)) later(DAY_AFTER, preloadDay.current);
  }, [dayImgs]);

  const toggle = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      // before a scroll the day plates aren't fetched yet: switch once they can paint, never to an empty frame
      if (mode === "night" && !(await dayPainted(root.current, () => setDayImgs(true)))) return;
      setMode(mode === "night" ? "day" : "night", { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    },
    [mode],
  );

  const sets = (["night", "day"] as const).map((set) => layer(mode, set));
  // the set showing on first paint is the LCP: it alone gets high priority
  const [first] = useState(() => ART[mode]);
  const showDay = dayImgs || mode === "day";

  const plate = (name: keyof typeof DIMS, className: string) =>
    sets.map(({ a, set, eager, on }) =>
      eager || showDay ? (
        <img
          key={a[name]}
          className={`hero-img ${className}`}
          data-plate={name}
          data-set={set}
          data-on={on ? "" : undefined}
          src={art(a[name])}
          alt=""
          width={DIMS[name][0]}
          height={DIMS[name][1]}
          decoding="async"
          fetchPriority={first === a ? "high" : "low"}
        />
      ) : null,
    );

  return (
    <section
      id="top"
      ref={root}
      className="hero"
      data-mode={mode}
      data-ready={ready ? "" : undefined}
      aria-labelledby="hero-title"
    >
      {/* the stage holds still (sticky) while the next section rises over it */}
      <div className="hero-track">
        <div className="hero-stage">
          {/* back: sky plates, then the far petals (and, once loaded, the sky in depth) */}
          <div className="hero-layer hero-l-sky" aria-hidden="true">
            <div className="hero-in">{plate("sky", "hero-sky")}</div>
          </div>
          <canvas ref={back} className="hero-canvas hero-canvas-back" aria-hidden="true" />

          {/* mid: the name, partly behind the character */}
          <div className="hero-layer hero-l-name">
            <h1 id="hero-title" className="hero-name" aria-label="Aniruddh Dubge">
              <span className="hero-name-art">
                <Letters />
              </span>
            </h1>
          </div>

          {/* front: the character */}
          <div className="hero-layer hero-l-char" aria-hidden="true">
            <div className="hero-in">
              <div className="hero-char">{plate("char", "hero-char-img")}</div>
            </div>
          </div>
          <canvas ref={charCanvas} className="hero-canvas hero-canvas-char" aria-hidden="true" />

          {/* the name again, as a hairline, so letters behind her still read */}
          <div className="hero-layer hero-l-name hero-l-ghost" aria-hidden="true">
            <div className="hero-name hero-name-ghost">
              <span className="hero-name-art">
                <Letters />
              </span>
            </div>
          </div>

          {/* very front: hill and flowers */}
          <div className="hero-layer hero-l-hill" aria-hidden="true">
            <div className="hero-in">{plate("hill", "hero-hill")}</div>
          </div>

          <div className="hero-scrim" aria-hidden="true" />
          <canvas ref={front} className="hero-canvas hero-canvas-front" aria-hidden="true" />
        </div>
      </div>

      {/* rides the hero's bottom edge, so the painting dissolves into the next section */}
      <div className="hero-fade" aria-hidden="true" />

      <header className="hero-top">
        <nav className="hero-nav" aria-label="Primary">
          <ul>
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href}>{n.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <SkyToggle night={mode === "night"} onToggle={toggle} hidden={!dayOk} />
      </header>

      <div className="hero-copy">
        <p className="hero-lede">
          Self-taught product engineer from Indore, building at Supernova&nbsp;AI in Bengaluru. Thirteen hackathon
          wins and a lot of anime.
        </p>
        <div className="hero-actions">
          <a className="hero-btn" href={TWITTER} target="_blank" rel="noopener noreferrer">
            Talk to me <span className="hero-arr" aria-hidden="true">→</span>
          </a>
          <a className="hero-link" href="#work">
            See the work
          </a>
        </div>
      </div>
    </section>
  );
}
