import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
const TWITTER = "https://twitter.com/icantcodefyi";
import type { Mode, PetalField } from "./hero/petal-field";
import { SkyToggle } from "./hero/sky-toggle";
import { art, HERO_ART } from "@/lib/art";
import { setMode, useMode } from "@/lib/mode";
import "./hero.css";

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

function probe(src: string) {
  return new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = src;
  });
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
  return { a: ART[set], eager: set === "night", on: mode === set };
}

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const field = useRef<PetalField | null>(null);
  const mode = useMode();
  const [dayOk, setDayOk] = useState(false);
  const [ready, setReady] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useBrokenGuard(root);

  // Day art is fetched after first paint; the toggle appears only once it exists.
  useEffect(() => {
    let alive = true;
    const go = () =>
      Promise.all([probe(art(ART.day.sky)), probe(art(ART.day.char))]).then(([s, c]) => {
        if (alive && s && c) setDayOk(true);
      });
    const t = window.setTimeout(go, 600);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, []);

  // Pointer parallax + scroll exit, damped, written as CSS custom properties.
  const input = useRef({ mx: 0, my: 0, scroll: 0 });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      el.setAttribute("data-reduced", "");
      return;
    }
    const fine = window.matchMedia("(pointer: fine)").matches;
    const goal = { mx: 0, my: 0, scroll: 0 };
    const cur = input.current;
    let raf = 0;
    let last = performance.now();

    const write = () => {
      el.style.setProperty("--mx", cur.mx.toFixed(4));
      el.style.setProperty("--my", cur.my.toFixed(4));
      el.style.setProperty("--p", cur.scroll.toFixed(4));
    };
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const kp = 1 - Math.exp(-dt * 4.5);
      const ks = 1 - Math.exp(-dt * 10);
      cur.mx += (goal.mx - cur.mx) * kp;
      cur.my += (goal.my - cur.my) * kp;
      cur.scroll += (goal.scroll - cur.scroll) * ks;
      write();
      const settled =
        Math.abs(goal.mx - cur.mx) < 1e-4 && Math.abs(goal.my - cur.my) < 1e-4 && Math.abs(goal.scroll - cur.scroll) < 1e-4;
      raf = settled ? 0 : requestAnimationFrame(loop);
    };
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      goal.mx = (e.clientX / window.innerWidth) * 2 - 1;
      goal.my = (e.clientY / window.innerHeight) * 2 - 1;
      kick();
    };
    const onLeave = () => {
      goal.mx = 0;
      goal.my = 0;
      kick();
    };
    // the hero's height, kept by a ResizeObserver so scrolling never reads layout
    let heroH = el.offsetHeight;
    const ro = new ResizeObserver(([e]) => {
      heroH = e.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight;
    });
    ro.observe(el);
    const onScroll = () => {
      const h = heroH || window.innerHeight;
      goal.scroll = Math.min(1, Math.max(0, window.scrollY / h));
      kick();
    };
    if (fine) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Three.js petal field: loaded after first paint, paused off-screen / hidden tab.
  useEffect(() => {
    const el = root.current;
    const b = back.current;
    const f = front.current;
    if (!el || !b || !f) return;
    let disposed = false;
    let visible = true;
    let io: IntersectionObserver | undefined;
    let ro: ResizeObserver | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const sync = () => field.current?.setActive(visible && !document.hidden);
    const start = async () => {
      try {
        const { createPetalField } = await import("./hero/petal-field");
        if (disposed) return;
        field.current = createPetalField(b, f, () => input.current, { mode: modeRef.current, reduced });
        setReady(true);
        io = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          sync();
        });
        io.observe(el);
        ro = new ResizeObserver(() => field.current?.resize());
        ro.observe(el);
        document.addEventListener("visibilitychange", sync);
      } catch {
        // No WebGL: the painted layers stand on their own.
      }
    };
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 120));
    const handle = idle(() => void start());

    return () => {
      disposed = true;
      if (window.cancelIdleCallback && typeof handle === "number") window.cancelIdleCallback(handle);
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      field.current?.dispose();
      field.current = null;
    };
  }, []);

  useEffect(() => {
    field.current?.setMode(mode);
  }, [mode]);

  const toggle = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setMode(mode === "night" ? "day" : "night", { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    },
    [mode],
  );

  const sets = (["night", "day"] as const).map((set) => layer(mode, set));
  // the set showing on first paint is the LCP: it alone gets high priority
  const [first] = useState(() => ART[mode]);
  const showDay = dayOk || mode === "day";

  return (
    <section
      id="top"
      ref={root}
      className="hero"
      data-mode={mode}
      data-ready={ready ? "" : undefined}
      aria-labelledby="hero-title"
    >
      {/* back: sky plates */}
      <div className="hero-layer hero-l-sky" aria-hidden="true">
        <div className="hero-in">
          {sets.map(({ a, eager, on }) =>
            eager || showDay ? (
              <img
                key={a.sky}
                className="hero-img hero-sky"
                data-on={on ? "" : undefined}
                src={art(a.sky)}
                alt=""
                width={DIMS.sky[0]}
                height={DIMS.sky[1]}
                decoding="async"
                fetchPriority={first === a ? "high" : "low"}
              />
            ) : null,
          )}
        </div>
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
          <div className="hero-char">
            {sets.map(({ a, eager, on }) =>
              eager || showDay ? (
                <img
                  key={a.char}
                  className="hero-img hero-char-img"
                  data-on={on ? "" : undefined}
                  src={art(a.char)}
                  alt=""
                  width={DIMS.char[0]}
                  height={DIMS.char[1]}
                  decoding="async"
                  fetchPriority={first === a ? "high" : "low"}
                />
              ) : null,
            )}
          </div>
        </div>
      </div>

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
        <div className="hero-in">
          {sets.map(({ a, eager, on }) =>
            eager || showDay ? (
              <img
                key={a.hill}
                className="hero-img hero-hill"
                data-on={on ? "" : undefined}
                src={art(a.hill)}
                alt=""
                width={DIMS.hill[0]}
                height={DIMS.hill[1]}
                decoding="async"
                fetchPriority={first === a ? "high" : "low"}
              />
            ) : null,
          )}
        </div>
      </div>

      <div className="hero-scrim" aria-hidden="true" />
      <canvas ref={front} className="hero-canvas hero-canvas-front" aria-hidden="true" />

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
