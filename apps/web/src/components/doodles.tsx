import { useEffect, useRef, useState } from "react";

import { unlock } from "@/lib/achievements";

const INK = "oklch(0.30 0.015 60)";

/** Hand-drawn desk that follows ani's real day: night sky after dark (IST), rain from WeatherTint, notes while Spotify plays. */
export function DeskScene({ className = "" }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const set = () => {
      const h = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
      ref.current?.toggleAttribute("data-night", h >= 19 || h < 6);
    };
    set();
    const id = setInterval(set, 60_000);
    return () => clearInterval(id);
  }, []);
  const lines = [
    { x: 60, w: 34, c: "var(--pastel-lavender)" },
    { x: 68, w: 46, c: "var(--pastel-sage)" },
    { x: 68, w: 28, c: "var(--pastel-blush)" },
    { x: 60, w: 52, c: "var(--pastel-sky)" },
    { x: 68, w: 22, c: "var(--pastel-butter)" },
  ];
  return (
    <svg
      viewBox="0 0 240 180"
      ref={ref}
      className={`desk ${className}`}
      fill="none"
      stroke={INK}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* sun */}
      <g className="desk-sun">
        <circle cx="200" cy="34" r="12" fill="var(--pastel-butter)" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1="200" y1="15" x2="200" y2="10" transform={`rotate(${a} 200 34)`} />
        ))}
      </g>
      {/* moon + stars */}
      <g className="desk-night">
        <path d="M206 22 a13 13 0 1 0 8 22 a10 10 0 1 1 -8 -22 z" fill="var(--pastel-butter)" />
        {[[150, 20], [176, 44], [120, 50], [232, 58], [96, 22]].map(([x, y], i) => (
          <circle key={i} className="twinkle" cx={x} cy={y} r="1.6" fill={INK} stroke="none" style={{ animationDelay: `${i * 0.5}s` }} />
        ))}
      </g>
      {/* rain */}
      <g className="desk-rain" stroke="oklch(0.62 0.08 235)" strokeWidth="1.5">
        {[20, 34, 48, 62, 26, 40, 54].map((x, i) => (
          <line key={i} x1={x} y1="50" x2={x - 3} y2="58" style={{ animationDelay: `${i * 0.13}s` }} />
        ))}
      </g>
      {/* cloud */}
      <path
        className="desk-cloud"
        d="M18 46 q0 -10 10 -10 q4 -10 16 -6 q10 -4 12 8 q8 0 8 8 z"
        fill="var(--card)"
      />

      {/* table */}
      <path d="M8 160 H232" />
      <path d="M22 160 L18 176 M218 160 L222 176" />

      {/* laptop */}
      <path className="desk-screen" d="M52 146 L58 72 H164 L170 146 Z" fill="var(--card)" />
      <path d="M40 146 H182 L176 156 H46 Z" fill="var(--pastel-lavender)" />
      {lines.map((l, i) => (
        <rect
          key={i}
          className="desk-code"
          x={l.x}
          y={84 + i * 11}
          width={l.w}
          height="5"
          rx="2.5"
          fill={l.c}
          stroke="none"
          style={{ animationDelay: `${i * 0.45}s` }}
        />
      ))}
      <rect className="desk-caret" x="0" y="0" width="2" height="7" fill={INK} stroke="none" />

      {/* music notes while spotify plays */}
      <g className="desk-music" fill={INK} stroke="none">
        {[
          ["M0 0 v-10 l6 -2 v10", 150, 70],
          ["M0 0 v-10", 132, 66],
          ["M0 0 v-10 l6 -2 v10", 170, 64],
        ].map(([d, x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <g className="desk-note" style={{ animationDelay: `${i * 0.8}s` }}>
              <path d={d as string} stroke={INK} strokeWidth="1.4" fill="none" />
              <ellipse cx="-2" cy="0" rx="2.6" ry="2" />
              {i !== 1 && <ellipse cx="4" cy="-2" rx="2.6" ry="2" />}
            </g>
          </g>
        ))}
      </g>

      {/* mug + steam */}
      <path d="M186 128 H210 V152 q0 6 -6 6 H192 q-6 0 -6 -6 Z" fill="var(--pastel-blush)" />
      <path d="M210 134 q9 0 9 8 q0 8 -9 8" />
      {[192, 198, 204].map((x, i) => (
        <path
          key={x}
          className="desk-steam"
          d={`M${x} 122 q-4 -6 0 -12 q4 -6 0 -12`}
          style={{ animationDelay: `${i * 0.6}s` }}
        />
      ))}

      {/* plant */}
      <path d="M14 160 L18 138 H38 L42 160" fill="var(--pastel-butter)" />
      <g className="desk-plant">
        <path d="M28 138 V112" />
        <path d="M28 124 q-14 -2 -16 -14 q12 0 16 14" fill="var(--pastel-sage)" />
        <path d="M28 118 q12 -4 14 -16 q-12 2 -14 16" fill="var(--pastel-sage)" />
        <path d="M28 112 q-2 -10 4 -16 q4 8 -4 16" fill="var(--pastel-sage)" />
      </g>

      {/* twinkles */}
      {[
        [124, 30, 0],
        [152, 52, 0.8],
        [88, 44, 1.6],
      ].map(([x, y, d]) => (
        <path
          key={`${x}`}
          className="twinkle"
          d={`M${x} ${y - 7} Q${x} ${y} ${x + 7} ${y} Q${x} ${y} ${x} ${y + 7} Q${x} ${y} ${x - 7} ${y} Q${x} ${y} ${x} ${y - 7}Z`}
          fill="var(--pastel-butter)"
          strokeWidth="1.5"
          style={{ animationDelay: `${d}s` }}
        />
      ))}
    </svg>
  );
}

/** Profile photo with slowly rotating circular text. */
export function PfpBadge({ src }: { src: string }) {
  const text = "self-taught ✦ hackathon goblin ✦ anime enjoyer ✦ ships things ✦ ";
  return (
    <div className="relative h-[112px] w-[112px] shrink-0">
      <svg viewBox="0 0 112 112" className="badge-spin absolute inset-0" aria-hidden="true">
        <defs>
          <path id="badge-circle" d="M56 56 m-48 0 a48 48 0 1 1 96 0 a48 48 0 1 1 -96 0" />
        </defs>
        <text fontSize="8.4" letterSpacing="1.2" fill="var(--muted-foreground)" className="font-mono uppercase">
          <textPath href="#badge-circle">{text}</textPath>
        </text>
      </svg>
      <img
        src={src}
        alt="ani"
        width={72}
        height={72}
        className="absolute left-5 top-5 h-[72px] w-[72px] rounded-full object-cover ring-2 ring-border transition-transform duration-500 ease-out hover:rotate-[-8deg] hover:scale-110"
      />
      <span className="wave absolute -right-1 bottom-1 text-2xl" aria-hidden="true">
        👋
      </span>
    </div>
  );
}

/** Wavy line that draws itself once. */
export function Squiggle({ className = "", color = "var(--pastel-blush)" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 200 16" preserveAspectRatio="none" className={className} fill="none" aria-hidden="true">
      <path
        className="draw"
        pathLength={1}
        d="M2 10 C 20 2, 30 14, 50 8 S 80 2, 100 8 S 130 14, 150 8 S 180 2, 198 8"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Section title with a scroll-drawn squiggle + a tiny animated glyph. */
export function Heading({ children, glyph }: { children: React.ReactNode; glyph: keyof typeof GLYPHS }) {
  const G = GLYPHS[glyph];
  return (
    <h2 className="relative inline-flex items-center gap-2 font-display text-2xl font-medium tracking-tight text-foreground">
      <span className="relative">
        {children}
        <Squiggle className="heading-squiggle absolute -bottom-2 left-0 h-3 w-full" color={G.color} />
      </span>
      <G.Icon />
    </h2>
  );
}

const glyphProps = {
  width: 26,
  height: 26,
  viewBox: "0 0 26 26",
  fill: "none",
  stroke: INK,
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const GLYPHS = {
  plane: {
    color: "var(--pastel-sky)",
    Icon: () => (
      <svg {...glyphProps} className="glyph-plane">
        <path d="M3 12 L23 4 L16 22 L12 14 Z" fill="var(--pastel-sky)" />
        <path d="M12 14 L23 4" />
      </svg>
    ),
  },
  flower: {
    color: "var(--pastel-lavender)",
    Icon: () => (
      <svg {...glyphProps} className="glyph-spin">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="13" cy="7" rx="3.6" ry="5" transform={`rotate(${a} 13 13)`} fill="var(--pastel-lavender)" />
        ))}
        <circle cx="13" cy="13" r="3" fill="var(--pastel-butter)" />
      </svg>
    ),
  },
  trophy: {
    color: "var(--pastel-butter)",
    Icon: () => (
      <svg {...glyphProps} className="glyph-bob">
        <path d="M8 4 H18 V10 A5 5 0 0 1 8 10 Z" fill="var(--pastel-butter)" />
        <path d="M8 6 H4 q0 6 5 6 M18 6 H22 q0 6 -5 6 M13 15 V19 M9 22 H17 V19 H9 Z" />
        <path className="twinkle" d="M22 1 L23 3 L25 4 L23 5 L22 7 L21 5 L19 4 L21 3 Z" fill={INK} stroke="none" />
      </svg>
    ),
  },
  camera: {
    color: "var(--pastel-sage)",
    Icon: () => (
      <svg {...glyphProps}>
        <rect x="3" y="8" width="20" height="14" rx="3" fill="var(--pastel-sage)" />
        <path d="M9 8 L11 5 H15 L17 8" />
        <circle cx="13" cy="15" r="4" fill="var(--card)" />
        <circle className="glyph-flash" cx="20" cy="4" r="3" fill="var(--pastel-butter)" stroke="none" />
      </svg>
    ),
  },
};

/** Taped marquee strip. */
export function Marquee({ items, tilt = -1.5, tone = "var(--pastel-butter)" }: { items: string[]; tilt?: number; tone?: string }) {
  const row = items.flatMap((t) => [t, "✦"]);
  return (
    <div
      className="marquee relative -mx-5 overflow-hidden border-y border-foreground/10 py-2.5 sm:-mx-16"
      style={{ transform: `rotate(${tilt}deg)`, background: `color-mix(in oklch, ${tone} 60%, transparent)` }}
      aria-hidden="true"
    >
      <div className="marquee-track flex w-max gap-6 font-display text-lg italic text-foreground/80">
        {[...row, ...row].map((t, i) => (
          <span key={i} className={t === "✦" ? "not-italic text-foreground/40" : ""}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Cursive "ani" that writes itself when scrolled into view. */
export function Signature({ className = "" }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        el.classList.add("is-on");
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <svg ref={ref} viewBox="0 0 120 60" className={`signature ${className}`} fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="ani">
      <path
        pathLength={1}
        d="M32 30 C26 22 12 24 11 36 C10 46 24 48 31 36 C31 42 32 47 37 47 C41 47 43 40 45 32 C45 38 45 43 45 47 C47 36 52 29 58 30 C63 31 62 40 62 46 C64 48 68 47 71 40 L73 32 C72 40 71 46 76 47 C84 48 96 40 110 32"
      />
      <path pathLength={1} className="sig-dot" d="M74 20 l0.5 0.5" strokeWidth="3.4" />
      <path pathLength={1} className="sig-heart" d="M104 16 c-2 -4 -8 -2 -6 3 l6 6 l6 -6 c2 -5 -4 -7 -6 -3 z" fill="var(--pastel-blush)" />
    </svg>
  );
}

/** Paper grain over everything — makes the flat pastels feel printed. */
export function Grain() {
  return <div className="grain" aria-hidden="true" />;
}

/** Sakura petals: three depth layers, each petal falls, sways and flutters in 3D. */
export function Sakura({ count = 18 }: { count?: number }) {
  const caught = useRef(0);
  const catchPetal = (e: React.MouseEvent) => {
    const petal = (e.target as Element).closest<HTMLElement>(".petal-fall");
    if (!petal) return;
    petal.style.visibility = "hidden";
    petal.addEventListener("animationiteration", () => (petal.style.visibility = ""), { once: true });
    caught.current++;
    if (caught.current === 10) unlock("petals");
    const burst = document.createElement("div");
    burst.className = "petal-burst";
    burst.style.left = `${e.pageX}px`;
    burst.style.top = `${e.pageY}px`;
    burst.innerHTML = `${"<i></i>".repeat(8)}<b>${caught.current >= 10 ? "✿ hanami unlocked" : `✿ ${caught.current}/10`}</b>`;
    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 900);
  };
  return (
    <div onClick={catchPetal} className="pointer-events-none absolute inset-x-0 top-0 h-[140vh] overflow-hidden" aria-hidden="true">
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="petal-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="oklch(0.95 0.03 355)" />
            <stop offset="0.6" stopColor="oklch(0.88 0.07 355)" />
            <stop offset="1" stopColor="oklch(0.78 0.11 355)" />
          </linearGradient>
        </defs>
      </svg>
      {Array.from({ length: count }, (_, i) => {
        // ponytail: deterministic pseudo-random so SSR and client markup match
        const r = (n: number) => (Math.sin(i * 97.3 + n * 13.1) + 1) / 2;
        const depth = i % 3; // 0 far, 1 mid, 2 near
        const size = [10, 16, 24][depth] + r(4) * 6;
        return (
          <div
            key={i}
            className="petal-fall absolute top-0"
            style={{
              left: `${r(1) * 100}%`,
              animationDuration: `${[22, 16, 11][depth] + r(2) * 6}s`,
              animationDelay: `${-r(3) * 24}s`,
              opacity: [0.45, 0.75, 0.9][depth],
              filter: depth === 2 ? "blur(1px)" : undefined,
            }}
          >
            <div className="petal-sway" style={{ animationDuration: `${3 + r(5) * 3}s` }}>
              <svg
                className="petal-flutter pointer-events-auto cursor-pointer"
                width={size}
                height={size}
                viewBox="0 0 20 20"
                style={{ animationDuration: `${2.5 + r(6) * 3}s`, ["--ax" as string]: `${r(7).toFixed(2)}, 1, ${r(8).toFixed(2)}` }}
              >
                <path d="M10 19 C 3 15, 1 8, 5 3 C 7 1, 9 2, 10 4.5 C 11 2, 13 1, 15 3 C 19 8, 17 15, 10 19 Z" fill="url(#petal-grad)" />
                <path d="M10 18 C 10 13, 10 9, 10 6" stroke="oklch(0.80 0.09 355)" strokeWidth="0.6" strokeLinecap="round" fill="none" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Each letter jiggles on hover. */
export function JellyText({ text }: { text: string }) {
  return (
    <>
      {[...text].map((c, i) => (
        <span key={i} className="jelly">
          {c}
        </span>
      ))}
    </>
  );
}

/** Die-cut stickers slapped on the page. */
export function Stickers() {
  const items = [
    { big: "13", small: "hackathon wins", bg: "var(--pastel-butter)", tilt: -8, quip: "yes, really 13" },
    { big: "8+", small: "things shipped", bg: "var(--pastel-sky)", tilt: 6, quip: "and 40 unfinished ones" },
    { big: "∞", small: "anime watched", bg: "var(--pastel-blush)", tilt: -3, quip: "rewatching Frieren rn" },
  ];
  return (
    <div className="mt-7 flex flex-wrap gap-4">
      {items.map((s) => (
        <div
          key={s.small}
          className="sticker group relative flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full text-center"
          style={{ background: s.bg, rotate: `${s.tilt}deg` }}
        >
          <span className="font-display text-3xl font-semibold leading-none text-foreground">{s.big}</span>
          <span className="mt-1 max-w-[70px] font-mono text-[9px] uppercase leading-tight tracking-[0.1em] text-foreground/70">
            {s.small}
          </span>
          <span className="bubble pointer-events-none absolute -top-12 left-1/2 whitespace-nowrap rounded-2xl border-2 border-foreground/80 bg-card px-3 py-1.5 font-hand text-lg leading-none text-foreground">
            {s.quip}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Paper plane looping along a dashed trail. */
export function PlaneTrail() {
  const d = "M10 50 C 120 -10, 200 90, 320 40 S 520 -10, 600 50 S 640 90, 660 40";
  return (
    <svg viewBox="0 0 672 90" className="my-6 h-16 w-full" fill="none" aria-hidden="true">
      <path id="plane-trail" d={d} stroke="var(--muted-foreground)" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="4 7" strokeLinecap="round" />
      <g>
        <path d="M-10 -7 L12 0 L-10 7 L-5 0 Z" fill="var(--pastel-sky)" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M-5 0 L12 0" stroke={INK} strokeWidth="1" />
        <animateMotion dur="7s" repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.55 1">
          <mpath href="#plane-trail" />
        </animateMotion>
      </g>
    </svg>
  );
}

const PREVIEW_BG = ["var(--pastel-lavender)", "var(--pastel-sage)", "var(--pastel-blush)", "var(--pastel-sky)", "var(--pastel-butter)"];

/** Mini browser window that trails the cursor over project rows. */
export function ProjectPreview({ items }: { items: ReadonlyArray<{ name: string; desc: string }> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const list = el?.parentElement;
    if (!el || !list) return;
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0;
    const loop = () => {
      x += (tx - x) * 0.15;
      y += (ty - y) * 0.15;
      el.style.transform = `translate(${x + 24}px, ${y - 70}px) rotate(${(tx - x) * 0.05}deg)`;
      raf = requestAnimationFrame(loop);
    };
    const move = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      const row = (e.target as HTMLElement).closest<HTMLElement>("[data-preview]");
      el.dataset.show = row ? "1" : "";
      if (row) el.style.setProperty("--i", row.dataset.preview!);
      for (const card of el.children) (card as HTMLElement).hidden = (card as HTMLElement).dataset.i !== row?.dataset.preview;
    };
    const leave = () => (el.dataset.show = "");
    list.addEventListener("pointermove", move);
    list.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      list.removeEventListener("pointermove", move);
      list.removeEventListener("pointerleave", leave);
    };
  }, []);
  return (
    <div ref={ref} className="project-preview pointer-events-none fixed left-0 top-0 z-50 hidden lg:block" aria-hidden="true">
      {items.map((p, i) => (
        <div key={p.name} data-i={i} hidden className="w-[220px] overflow-hidden rounded-xl border border-foreground/15 bg-card shadow-[0_24px_40px_-20px_oklch(0.2_0.02_60/0.35)]">
          <div className="flex items-center gap-1 border-b border-foreground/10 px-2.5 py-2">
            {["oklch(0.8 0.12 25)", "oklch(0.88 0.12 90)", "oklch(0.8 0.12 150)"].map((c) => (
              <span key={c} className="h-2 w-2 rounded-full" style={{ background: c }} />
            ))}
          </div>
          <div className="relative flex h-[120px] flex-col justify-end overflow-hidden p-3" style={{ background: PREVIEW_BG[i % PREVIEW_BG.length] }}>
            <svg className="absolute -right-6 -top-6 h-28 w-28 opacity-60 glyph-spin" viewBox="0 0 56 56" aria-hidden="true">
              <path d="M28 4 Q28 28 52 28 Q28 28 28 52 Q28 28 4 28 Q28 28 28 4Z" fill="var(--card)" />
            </svg>
            <span className="relative font-display text-2xl font-semibold leading-none text-foreground">{p.name}</span>
            <span className="relative mt-1 text-[11px] leading-snug text-foreground/70">{p.desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Handwritten note in the page margin with a curly arrow pointing back at the content. Hidden below lg. */
export function MarginNote({ children, side = "right", className = "" }: { children: React.ReactNode; side?: "left" | "right"; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (el.classList.add("is-on"), io.disconnect()), { threshold: 1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const right = side === "right";
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`margin-note pointer-events-none absolute top-0 hidden w-36 lg:block ${right ? "left-full ml-4" : "right-full mr-4 text-right"} ${className}`}
    >
      <svg viewBox="0 0 60 40" className={`h-8 w-12 ${right ? "" : "ml-auto -scale-x-100"}`} fill="none" stroke="oklch(0.55 0.1 350)" strokeWidth="1.8" strokeLinecap="round">
        <path pathLength={1} d="M56 34 C 40 36, 30 26, 36 18 C 42 10, 50 22, 38 26 C 24 30, 12 22, 6 10 M6 10 L4 18 M6 10 L13 13" />
      </svg>
      <p className="-mt-1 font-hand text-xl leading-tight text-[oklch(0.5_0.1_350)]" style={{ rotate: right ? "-4deg" : "3deg" }}>
        {children}
      </p>
    </div>
  );
}

/** Night sky card for the footer: twinkling stars, occasional shooting stars, a moon you can drag. */
export function NightSky() {
  const skyRef = useRef<HTMLDivElement>(null);
  const [moon, setMoon] = useState({ x: 78, y: 30 });
  const drag = (e: React.PointerEvent) => {
    const sky = skyRef.current;
    if (!sky) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = sky.getBoundingClientRect();
      setMoon({
        x: Math.min(94, Math.max(6, ((ev.clientX - r.left) / r.width) * 100)),
        y: Math.min(80, Math.max(12, ((ev.clientY - r.top) / r.height) * 100)),
      });
    };
    const up = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
  };
  const stars = Array.from({ length: 40 }, (_, i) => {
    const r = (n: number) => { const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
    return { x: r(1) * 100, y: r(2) * 100, s: 1 + r(3) * 2, d: r(4) * 4 };
  });
  return (
    <div
      ref={skyRef}
      className="night-sky relative h-44 overflow-hidden rounded-2xl"
      style={{ background: "linear-gradient(to bottom, oklch(0.25 0.06 275), oklch(0.36 0.07 300))" }}
    >
      {stars.map((st, i) => (
        <span key={i} className="twinkle absolute rounded-full bg-white" style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, animationDelay: `${st.d}s` }} />
      ))}
      {[0, 1, 2].map((i) => (
        <span key={i} className="shooting-star" style={{ top: `${10 + i * 18}%`, left: `${20 + i * 25}%`, animationDelay: `${i * 3.3}s` }} />
      ))}
      <button
        type="button"
        aria-label="Drag the moon"
        onPointerDown={drag}
        className="absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full active:cursor-grabbing"
        style={{ left: `${moon.x}%`, top: `${moon.y}%`, background: "oklch(0.95 0.05 90)", boxShadow: "0 0 30px 6px oklch(0.95 0.08 90 / 0.45), inset -8px -4px 0 oklch(0.88 0.05 90)" }}
      >
        <span className="absolute left-3 top-3 h-2 w-2 rounded-full bg-[oklch(0.88_0.05_90)]" />
        <span className="absolute bottom-3 right-4 h-1.5 w-1.5 rounded-full bg-[oklch(0.88_0.05_90)]" />
      </button>
      <svg className="absolute inset-x-0 bottom-0 h-12 w-full" viewBox="0 0 600 50" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 30 Q 80 5 160 28 T 320 24 T 480 30 T 600 20 V50 H0 Z" fill="oklch(0.22 0.05 280)" />
        <path d="M0 42 Q 100 25 220 40 T 440 38 T 600 36 V50 H0 Z" fill="oklch(0.18 0.04 280)" />
      </svg>
      <p className="absolute bottom-3 left-4 font-hand text-xl text-white/85">thanks for scrolling this far ✦</p>
      <p className="absolute right-4 top-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">drag the moon</p>
    </div>
  );
}
