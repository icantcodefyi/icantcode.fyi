import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

import { DepthStage, useDepthLayer } from "@/components/depth-stage";
import { art, halfSet, TEYVAT_VISTA } from "@/lib/art";
import { useDayArt } from "@/lib/day-art";
import { STRENGTH } from "@/lib/depth/camera";
import type { StageSpec } from "@/lib/depth/types";
import { useMode, type Mode } from "@/lib/mode";

type Element = "anemo" | "geo" | "hydro" | "pyro";
type Home = typeof TEYVAT_VISTA.characterRegion;
type Region = Home[keyof Home];

type Character = {
  id: string;
  name: string;
  short: string;
  element: Element;
  elementName: string;
  region: string;
  line: string;
  weapon: string;
  constellation: string;
  role: string;
  stars: [number, number][];
};

const CAST: Character[] = [
  {
    id: "kazuha",
    name: "Kaedehara Kazuha",
    short: "Kazuha",
    element: "anemo",
    elementName: "Anemo",
    region: "Inazuma",
    line: "He pulls every enemy into one tidy pile so the rest of the team looks good, then writes a haiku about it. I have never once benched him.",
    weapon: "Sword",
    constellation: "Acer Palmatum",
    role: "Grouping, buffs, and quiet ronin energy",
    stars: [[214, 228], [262, 196], [318, 214], [356, 262], [338, 326], [282, 356], [246, 404]],
  },
  {
    id: "zhongli",
    name: "Zhongli",
    short: "Zhongli",
    element: "geo",
    elementName: "Geo",
    region: "Liyue",
    line: "A shield so thick I stopped dodging entirely. A retired god of contracts who keeps forgetting his wallet. Extremely relatable.",
    weapon: "Polearm",
    constellation: "Lapis Dei",
    role: "The shield. I play worse with him and still win",
    stars: [[300, 168], [372, 236], [372, 330], [300, 398], [228, 330], [228, 236], [300, 282]],
  },
  {
    id: "furina",
    name: "Furina",
    short: "Furina",
    element: "hydro",
    elementName: "Hydro",
    region: "Fontaine",
    line: "Pure theatre. She spends the whole team's HP to make everyone hit harder, then gives a five-minute speech about it. Worth it.",
    weapon: "Sword",
    constellation: "Animula Choragi",
    role: "Damage buff and main character energy",
    stars: [[232, 200], [300, 172], [366, 206], [338, 268], [270, 300], [300, 362], [362, 392]],
  },
  {
    id: "hu-tao",
    name: "Hu Tao",
    short: "Hu Tao",
    element: "pyro",
    elementName: "Pyro",
    region: "Liyue",
    line: "Runs a funeral parlour with two-for-one coffin deals. Low HP, huge numbers, zero fear. I let her cook, mostly literally.",
    weapon: "Polearm",
    constellation: "Papilio Charontis",
    role: "Main damage, and the reason my heart rate is high",
    stars: [[248, 206], [300, 246], [352, 206], [376, 284], [300, 330], [224, 284], [300, 404]],
  },
];

const ELEMENTS: Element[] = ["anemo", "geo", "hydro", "pyro"];

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [round(300 + r * Math.cos(a)), round(300 + r * Math.sin(a))];
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const SKY = (() => {
  const rnd = seeded(7);
  return Array.from({ length: 70 }, (_, i) => ({
    x: round(rnd() * 100),
    y: round(rnd() * 100),
    r: round(0.4 + rnd() * 1.1),
    twinkle: i % 7 === 0,
    d: round(rnd() * 6),
  }));
})();

const GLYPHS: Record<Element, string[]> = {
  anemo: [
    "M11.5 31.5 C7.2 23.4 10.6 12.8 19.6 9.4 C28.3 6.1 37.6 10.7 39.4 19.2 C40.9 26.2 36.2 32.6 29.6 33.2 C24.4 33.7 20.6 29.8 21.4 25.4 C22 22.2 25.4 20.6 27.9 22.2 C29.7 23.4 29.6 25.9 28 26.8",
    "M5.5 37.2 C13.8 41.6 25.2 42.2 34.4 37.6",
    "M12.4 42.6 C17.2 44.2 22.6 44.3 27.2 43.1",
    "M38.6 4.6 L39.7 7.7 L42.8 8.8 L39.7 9.9 L38.6 13 L37.5 9.9 L34.4 8.8 L37.5 7.7 Z",
    "M6.6 16.4 C8.2 13.6 10.4 11.2 13 9.4",
  ],
  geo: [
    "M24 3.5 L40.5 13.5 V34.5 L24 44.5 L7.5 34.5 V13.5 Z",
    "M24 11.5 L33.5 17.2 V30.8 L24 36.5 L14.5 30.8 V17.2 Z",
    "M24 3.5 V11.5 M40.5 13.5 L33.5 17.2 M40.5 34.5 L33.5 30.8 M24 44.5 V36.5 M7.5 34.5 L14.5 30.8 M7.5 13.5 L14.5 17.2",
    "M24 19 L29 24 L24 29 L19 24 Z",
    "M24 19 V29 M19 24 H29",
  ],
  hydro: [
    "M24 3.8 C27.5 9.6 38.6 18.4 38.6 29.4 A14.6 14.6 0 0 1 9.4 29.4 C9.4 18.4 20.5 9.6 24 3.8 Z",
    "M14.6 30.2 C17.7 27.6 20.9 27.6 24 30.2 C27.1 32.8 30.3 32.8 33.4 30.2",
    "M18 36.4 C20 35 22 35 24 36.4 C26 37.8 28 37.8 30 36.4",
    "M17.2 22.6 C18.2 19.2 20.2 16.2 22.6 13.6",
    "M40.5 8.5 A2.2 2.2 0 1 1 40.49 8.5",
  ],
  pyro: [
    "M24 44.5 C15.4 44.5 9.6 38.6 9.6 31.2 C9.6 23 17.2 19.6 18.2 10.6 C23.4 13.6 26.8 18.8 26.2 25 C28.8 23.4 30.4 20.2 30.2 15.6 C36.4 20.8 38.4 27.2 38.4 32 C38.4 39 32.6 44.5 24 44.5 Z",
    "M24 40.4 C20.4 40.4 18.4 37.8 18.4 35 C18.4 31.4 22 29.8 23 26 C26.6 29.2 29.6 31.8 29.6 35.4 C29.6 38.2 27.4 40.4 24 40.4 Z",
    "M36.2 6.2 A1.8 1.8 0 1 1 36.19 6.2",
    "M12.2 4.6 C11 7 11.6 9.4 13.4 10.8",
  ],
};

function Glyph({ element, className }: { element: Element; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPHS[element].map((d, i) => (
        <path key={d} d={d} pathLength={1} className="tv-glyph-path" style={{ "--i": i } as CSSProperties} />
      ))}
    </svg>
  );
}

const GOLD = "currentColor";
const QUADRANTS = [315, 45, 135, 225];

const CHART = (() => {
  const rnd = seeded(113);
  return Array.from({ length: 90 }, () => {
    const r = 132 + rnd() * 92;
    const a = rnd() * 360;
    const [x, y] = polar(r, a);
    const m = rnd();
    return { x, y, size: m > 0.93 ? 2.4 : m > 0.75 ? 1.5 : round(0.5 + rnd() * 0.6), bright: m > 0.93 };
  });
})();

const FIGURES = CAST.map((c, i) => {
  const cx = c.stars.reduce((s, p) => s + p[0], 0) / c.stars.length;
  const cy = c.stars.reduce((s, p) => s + p[1], 0) / c.stars.length;
  const [ox, oy] = polar(166, QUADRANTS[i]);
  return c.stars.map(([x, y]) => [round(ox + (x - cx) * 0.36), round(oy + (y - cy) * 0.36)] as const);
});

function arc(r: number, mid: number, span: number) {
  const flip = mid > 90 && mid < 270;
  const [x1, y1] = polar(r, flip ? mid + span : mid - span);
  const [x2, y2] = polar(r, flip ? mid - span : mid + span);
  return `M${x1} ${y1} A${r} ${r} 0 0 ${flip ? 0 : 1} ${x2} ${y2}`;
}

function spark(x: number, y: number, r: number) {
  const k = r * 0.22;
  return `M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`;
}

function Ring({ r, w = 1, deep = false }: { r: number; w?: number; deep?: boolean }) {
  return <circle cx="300" cy="300" r={r} stroke={GOLD} className={deep ? "tv-sd" : undefined} strokeWidth={w} />;
}

function Astrolabe({ active }: { active: number }) {
  const ticks = Array.from({ length: 360 }, (_, i) => {
    const major = i % 30 === 0;
    const mid = !major && i % 5 === 0;
    const [x1, y1] = polar(major ? 268 : mid ? 276 : 281, i);
    const [x2, y2] = polar(287, i);
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={GOLD}
        className={major || mid ? undefined : "tv-sd"}
        strokeWidth={major ? 1.4 : mid ? 0.9 : 0.5}
      />
    );
  });

  const petals = Array.from({ length: 36 }, (_, i) => {
    const a = i * 10;
    const [x1, y1] = polar(262, a - 5);
    const [cx, cy] = polar(240, a);
    const [x2, y2] = polar(262, a + 5);
    const [ix, iy] = polar(254, a);
    const [bx, by] = polar(259, a + 5);
    return (
      <g key={i}>
        <path d={`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`} stroke={GOLD} strokeWidth="0.9" />
        <path d={`M${x1} ${y1} Q${ix} ${iy} ${x2} ${y2}`} stroke={GOLD} className="tv-sd" strokeWidth="0.5" />
        <circle cx={bx} cy={by} r="1.1" fill={GOLD} />
      </g>
    );
  });

  const inner = Array.from({ length: 72 }, (_, i) => {
    const [x1, y1] = polar(i % 6 === 0 ? 112 : 116, i * 5);
    const [x2, y2] = polar(120, i * 5);
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={GOLD} className={i % 6 === 0 ? undefined : "tv-sd"} strokeWidth={i % 6 === 0 ? 1 : 0.5} />;
  });

  const beads = Array.from({ length: 48 }, (_, i) => {
    const [x, y] = polar(104, i * 7.5);
    return <circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 1.6 : 0.8} fill={GOLD} className={i % 4 === 0 ? undefined : "tv-fd"} />;
  });

  return (
    <div className="tv-astro" aria-hidden="true">
      <svg viewBox="0 0 600 600" className="tv-astro-outer" fill="none">
        <Ring r={297} w={1.5} />
        <Ring r={293.5} w={0.5} deep />
        <Ring r={287} w={0.75} />
        {ticks}
        <Ring r={265.5} w={1} />
        <Ring r={262.5} w={0.5} deep />
        {petals}
        <Ring r={236} w={0.75} deep />
        <Ring r={232} w={1.25} />
        {[0, 90, 180, 270].map((a) => {
          const [x, y] = polar(297, a);
          return (
            <g key={a}>
              <circle cx={x} cy={y} r="7" className="tv-fbase" stroke={GOLD} strokeWidth="1.25" />
              <circle cx={x} cy={y} r="3.5" stroke={GOLD} className="tv-sd" strokeWidth="0.75" />
              <circle cx={x} cy={y} r="1.4" fill={GOLD} />
            </g>
          );
        })}
        {[45, 135, 225, 315].map((a) => {
          const [x, y] = polar(276, a);
          return <path key={a} d={spark(x, y, 7)} fill={GOLD} className="tv-twinkle" style={{ "--d": `${a / 60}s` } as CSSProperties} />;
        })}
      </svg>

      <svg viewBox="0 0 600 600" className="tv-astro-chart" fill="none">
        <defs>
          {CAST.map((c, i) => (
            <path key={c.id} id={`tv-arc-${c.id}`} d={arc(QUADRANTS[i] > 90 && QUADRANTS[i] < 270 ? 221 : 211, QUADRANTS[i], 34)} />
          ))}
        </defs>
        <circle cx="300" cy="300" r="226" stroke={GOLD} className="tv-sd" strokeWidth="0.5" strokeDasharray="0.5 5" strokeLinecap="round" />
        {CHART.map((s, i) =>
          s.bright ? (
            <path key={i} d={spark(s.x, s.y, 4.5)} fill={GOLD} className="tv-twinkle" style={{ "--d": `${(i % 9) * 0.6}s` } as CSSProperties} />
          ) : (
            <circle key={i} cx={s.x} cy={s.y} r={s.size} fill={GOLD} className={s.size > 1 ? undefined : "tv-fd"} />
          ),
        )}
        {CAST.map((c, ci) => (
          <g key={c.id} className="tv-figure" data-on={ci === active || undefined}>
            <polyline points={FIGURES[ci].map((p) => p.join(",")).join(" ")} stroke={GOLD} strokeWidth="0.75" strokeOpacity="0.7" />
            {FIGURES[ci].map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r={i % 3 === 0 ? 5 : 3.6} stroke={GOLD} className="tv-sd" strokeWidth="0.5" />
                <circle cx={x} cy={y} r={i % 3 === 0 ? 2.2 : 1.4} fill={GOLD} />
              </g>
            ))}
            <text className="tv-figure-name" fill={GOLD}>
              <textPath href={`#tv-arc-${c.id}`} startOffset="50%" textAnchor="middle">
                {c.constellation}
              </textPath>
            </text>
          </g>
        ))}
        <Ring r={124} w={1.25} />
        <Ring r={120} w={0.5} deep />
        {inner}
        <Ring r={110} w={0.5} deep />
        {beads}
        <Ring r={98} w={0.75} />
      </svg>

      <div className="tv-sigils">
        {CAST.map((c, i) => (
          <span
            key={c.id}
            className="tv-sigil"
            data-on={i === active || undefined}
            style={{ "--src": `url(/lobby/gi/${c.id}-constellation.webp)` } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}

function Particle({ element, alt }: { element: Element; alt: boolean }) {
  if (element === "anemo")
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        {alt ? (
          <path d="M10 1.5 L11.6 6.2 L16.4 4.4 L14 8.6 L18.5 10.4 L13.4 11.6 L14.6 16.6 L10 13.8 L5.4 16.6 L6.6 11.6 L1.5 10.4 L6 8.6 L3.6 4.4 L8.4 6.2 Z M10 13.8 V19" fill="currentColor" fillOpacity="0.85" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
        ) : (
          <path d="M3 17 C3 9 8 3 17 3 C17 12 11 17 3 17 Z M3 17 L12 8" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.2" />
        )}
      </svg>
    );
  if (element === "geo")
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        {alt ? <path d="M10 3 L16 10 L10 17 L4 10 Z" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1" /> : <path d="M10 1 L12.4 10 L10 19 L7.6 10 Z" fill="currentColor" />}
      </svg>
    );
  if (element === "hydro")
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="currentColor" fillOpacity={alt ? 0.3 : 0.14} stroke="currentColor" strokeWidth="1.2" />
        <path d="M6 8 a5 5 0 0 1 3 -3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    );
  if (alt)
    return (
      <svg viewBox="0 0 24 20" aria-hidden="true">
        <path d="M12 10 C9 3 3 1 1.5 3.5 C0.4 5.6 4 9.6 12 10 Z M12 10 C15 3 21 1 22.5 3.5 C23.6 5.6 20 9.6 12 10 Z M12 10 C8 11 5 15.5 6.8 17.4 C8.4 19 11 15 12 10 Z M12 10 C16 11 19 15.5 17.2 17.4 C15.6 19 13 15 12 10 Z" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="3.4" fill="currentColor" />
      <circle cx="10" cy="10" r="7.5" fill="currentColor" fillOpacity="0.22" />
    </svg>
  );
}

const motes = (seed: number, n: number, scale: number, slow: number) => {
  const rnd = seeded(seed);
  return Array.from({ length: n }, () => ({
    x: round(6 + rnd() * 88),
    y: round(8 + rnd() * 84),
    s: round((0.6 + rnd() * 0.9) * scale),
    dur: round((7 + rnd() * 7) * slow),
    delay: round(-rnd() * 14 * slow),
  }));
};
/** The selected element in the air at two depths: near motes round the character, smaller and slower ones out by the astrolabe. */
const MOTES = { near: motes(31, 12, 1, 1), far: motes(47, 8, 0.6, 1.6) };

function Particles({ element, far = false }: { element: Element; far?: boolean }) {
  return (
    <div className={`tv-particles tv-p-${element}${far ? " tv-particles-far" : ""}`} aria-hidden="true">
      {MOTES[far ? "far" : "near"].map((m, i) => (
        <span
          key={i}
          className={`tv-mote ${i % 2 ? "tv-mote-alt" : ""}`}
          style={
            {
              "--x": `${m.x}%`,
              "--y": `${m.y}%`,
              "--s": m.s,
              "--dur": `${m.dur}s`,
              "--delay": `${m.delay}s`,
            } as CSSProperties
          }
        >
          <Particle element={element} alt={i % 2 === 1} />
        </span>
      ))}
    </div>
  );
}

function Divider() {
  return (
    <svg viewBox="0 0 240 12" className="tv-divider" aria-hidden="true" fill="none" stroke="currentColor">
      <path d="M0 6 H104 M136 6 H240" strokeOpacity="0.6" />
      <path d="M120 0 L126 6 L120 12 L114 6 Z" fill="currentColor" stroke="none" />
      <path d="M108 6 L111 3 L114 6 L111 9 Z M126 6 L129 3 L132 6 L129 9 Z" strokeOpacity="0.8" />
    </svg>
  );
}

/**
 * The world on the site camera (worlds strength), driven by the stage's
 * scroll position: the region vista at 30 / 22 / 18, the astrolabe and its
 * glow at 17, the ghost name at 15, the motes at 12.5 and the character
 * forward at 11.5. Every layer moves against the pointer by 1/d.
 */
const STAGE: StageSpec = { id: "teyvat", plates: [], camera: { strength: STRENGTH.world } };
const D = { astro: 17, ghost: 15, motes: 12.5, char: 11.5 } as const;

function Layer({ d, className, children }: { d: number; className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, d);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * The selected character's home region, painted behind everything in three
 * plates on the same camera: the sky far off at 30 (its clouds and sea drift
 * slowly), the land at 22 and the shore at 18, just behind the astrolabe.
 * The planes sit close so their relative travel stays within the few px the
 * painting's hidden underpaint allows.
 * Desktop: the whole section, the quiet right of the painting under the
 * info. Phones: the stage band. Only the shown region is in the page; the
 * next one joins on a pick, fades in once decoded, and the old one leaves.
 */
const VISTA_PLATES = [
  ["sky", 30],
  ["far", 22],
  ["near", 18],
] as const;
type VistaPlateName = (typeof VISTA_PLATES)[number][0];
const homeOf = (id: string) => TEYVAT_VISTA.characterRegion[id as keyof Home];

/** Where each painting stands: the region and the place in it, for the plate on the top rule. */
const PLACES: Record<Region, { name: string; place: string }> = {
  inazuma: { name: "Inazuma", place: "Narukami Island" },
  liyue: { name: "Liyue", place: "Liyue Harbor" },
  fontaine: { name: "Fontaine", place: "Court of Fontaine" },
};

/** A waypoint rose: the mark beside the region's name. */
function Waypoint() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor">
      <path d="M10 1.5 L12 8 L18.5 10 L12 12 L10 18.5 L8 12 L1.5 10 L8 8 Z" fill="currentColor" fillOpacity="0.25" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="6.5" strokeOpacity="0.55" strokeWidth="0.8" />
    </svg>
  );
}

/**
 * The swap: a one-shot burst of the incoming element behind the character,
 * each in its own motion. Anemo blows through as a gust, geo shards lift,
 * hydro splashes outward from the astrolabe's heart, pyro embers climb.
 */
const GUST = (() => {
  const rnd = seeded(71);
  return Array.from({ length: 14 }, () => ({ x: rnd(), y: rnd(), a: rnd(), b: rnd(), s: round(0.9 + rnd() * 0.8), delay: Math.round(rnd() * 240) }));
})();

function gustPath(element: Element, g: (typeof GUST)[number]) {
  const x = 12 + g.x * 76;
  const y = 18 + g.y * 64;
  if (element === "anemo") return { x: x - 24, y, dx: 150 + g.a * 90, dy: -30 - g.b * 60, rot: 200 + g.a * 160 };
  if (element === "geo") return { x, y: 40 + g.y * 50, dx: -12 + g.a * 24, dy: -70 - g.b * 60, rot: -40 + g.a * 80 };
  if (element === "pyro") return { x, y: 36 + g.y * 54, dx: -26 + g.a * 52, dy: -110 - g.b * 70, rot: -30 + g.a * 60 };
  // hydro: out from the centre, a ring of droplets
  const t = g.x * Math.PI * 2;
  const r = 90 + g.a * 70;
  return { x: 50 + Math.cos(t) * 6, y: 46 + Math.sin(t) * 6, dx: Math.cos(t) * r, dy: Math.sin(t) * r, rot: 0 };
}

function Gust({ element }: { element: Element }) {
  return (
    <div className={`tv-gust tv-p-${element}`} aria-hidden="true">
      {GUST.map((g, i) => {
        const m = gustPath(element, g);
        return (
          <span
            key={i}
            className={`tv-gust-bit ${i % 2 ? "tv-mote-alt" : ""}`}
            style={
              {
                "--x": `${round(m.x)}%`,
                "--y": `${round(m.y)}%`,
                "--dx": `${Math.round(m.dx)}px`,
                "--dy": `${Math.round(m.dy)}px`,
                "--rot": `${Math.round(m.rot)}deg`,
                "--s": g.s,
                "--delay": `${g.delay}ms`,
              } as CSSProperties
            }
          >
            <Particle element={element} alt={i % 2 === 1} />
          </span>
        );
      })}
    </div>
  );
}

const STAR = "M6 0.6 L7.5 4.2 L11.4 4.5 L8.4 7 L9.4 10.8 L6 8.7 L2.6 10.8 L3.6 7 L0.6 4.5 L4.5 4.2 Z";

function VistaPlate({ region, plate, d, day }: { region: Region; plate: VistaPlateName; d: number; day: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, d);
  const [w, h] = TEYVAT_VISTA.size;
  const img = (m: Mode) => {
    const set = TEYVAT_VISTA[region][m];
    const full = art(set[plate]);
    return (
      <img
        src={full}
        srcSet={halfSet(full, w, art(set[`${plate}Half`]), TEYVAT_VISTA.halfSize[0])}
        sizes="auto, 100vw"
        data-set={m}
        alt=""
        width={w}
        height={h}
        loading="lazy"
        decoding="async"
      />
    );
  };
  return (
    <div ref={ref} className={`tv-plate tv-plate-${plate}`}>
      {img("night")}
      {day ? img("day") : null}
    </div>
  );
}

type Shown = (n: number, show: boolean, ready: boolean) => void;

function Vista({ region, n, onShow }: { region: Region; n: number; onShow: Shown }) {
  const fresh = n > 0;
  const ref = useRef<HTMLDivElement>(null);
  const mode = useMode();
  const sky = useDayArt(art(TEYVAT_VISTA[region].day.sky), ref);
  const far = useDayArt(art(TEYVAT_VISTA[region].day.far), ref);
  const near = useDayArt(art(TEYVAT_VISTA[region].day.near), ref);
  const day = sky && far && near;
  const show = mode === "night" || day;
  const [ready, setReady] = useState(!fresh);

  // a picked region waits for its plates in the current mode before it fades in
  useEffect(() => {
    if (ready || !show) return;
    let alive = true;
    const imgs = [...(ref.current?.querySelectorAll<HTMLImageElement>(`img[data-set="${mode}"]`) ?? [])];
    void Promise.all(imgs.map((i) => i.decode().catch(() => {}))).then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [ready, show, mode]);

  useEffect(() => onShow(n, show, ready), [onShow, n, show, ready]);

  return (
    <div ref={ref} className="tv-region" data-region={region} data-show={show || undefined} data-fresh={fresh || undefined} data-ready={ready || undefined} aria-hidden="true">
      {VISTA_PLATES.map(([plate, d]) => (
        <VistaPlate key={plate} region={region} plate={plate} d={d} day={day} />
      ))}
    </div>
  );
}

export function Teyvat() {
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [moved, setMoved] = useState(false);
  const [gust, setGust] = useState(0);
  const [entered, setEntered] = useState(false);
  const [staged, setStaged] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const c = CAST[active];
  const home = homeOf(c.id);

  // the region on show, plus (during a crossfade) the ones under it; n counts picks so a
  // region that comes back mounts fresh and fades in again
  const [vistas, setVistas] = useState<{ r: Region; n: number }[]>([{ r: homeOf(CAST[0].id), n: 0 }]);
  const [shown, setShown] = useState<Record<number, boolean>>({});
  const [ready, setReady] = useState(0);
  useEffect(() => {
    setVistas((v) => {
      const top = v[v.length - 1];
      return top.r === home ? v : [...v.slice(-2), { r: home, n: top.n + 1 }];
    });
  }, [home]);
  const onShow = useCallback<Shown>((n, show, isReady) => {
    setShown((s) => (s[n] === show ? s : { ...s, [n]: show }));
    if (isReady) setReady((x) => Math.max(x, n));
  }, []);
  useEffect(() => {
    const top = vistas[vistas.length - 1];
    if (vistas.length < 2 || ready < top.n) return;
    // the fade is --dur-scene (1100ms): drop the regions underneath once it has run
    const t = window.setTimeout(() => setVistas([top]), 1200);
    return () => window.clearTimeout(t);
  }, [vistas, ready]);
  const vista = vistas.some((v) => shown[v.n]);

  const pick = useCallback(
    (i: number) => {
      if (i === active) return;
      setPrev(active);
      setActive(i);
      setMoved(true);
      setGust((n) => n + 1);
    },
    [active],
  );

  // the burst runs about 1.5s; then it leaves the page
  useEffect(() => {
    if (!gust) return;
    const t = window.setTimeout(() => setGust(0), 1700);
    return () => window.clearTimeout(t);
  }, [gust]);

  useEffect(() => {
    for (const ch of CAST) {
      const img = new Image();
      img.src = `/lobby/gi/${ch.id}-portrait.webp`;
      img.decode?.().catch(() => {});
    }
  }, []);

  // first view: the divider and title play once the section's top is a fifth of the way up
  // the screen, the stage once it is 15% in (on phones it sits below the title)
  useEffect(() => {
    const el = sectionRef.current;
    const stage = el?.querySelector(".tv-stage");
    if (!el || !stage) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setEntered(true);
        io.disconnect();
      },
      { rootMargin: "0px 0px -20% 0px" },
    );
    const io2 = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setStaged(true);
        io2.disconnect();
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    io2.observe(stage);
    return () => {
      io.disconnect();
      io2.disconnect();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (active + step + CAST.length) % CAST.length;
    pick(next);
    tabsRef.current[next]?.focus();
  };

  return (
    <section
      id="teyvat"
      ref={sectionRef}
      aria-labelledby="teyvat-title"
      data-world="teyvat"
      data-element={c.element}
      data-in={entered || undefined}
      data-staged={staged || undefined}
      data-vista={vista || undefined}
      className={`tv-world relative isolate overflow-hidden ${moved ? "tv-anim" : ""}`}
    >
      {ELEMENTS.map((el) => (
        <div key={el} className={`tv-scene tv-scene-${el}`} data-on={el === c.element || undefined} aria-hidden="true">
          <span className="tv-field" />
          <span className="tv-shade" />
          <span className="tv-stripe" />
          <span className="tv-hair" />
        </div>
      ))}
      <svg className="tv-sky" aria-hidden="true" preserveAspectRatio="none">
        {SKY.map((s, i) => (
          <circle
            key={i}
            cx={`${s.x}%`}
            cy={`${s.y}%`}
            r={s.r}
            className={s.twinkle ? "tv-twinkle" : undefined}
            style={{ "--d": `${s.d}s` } as CSSProperties}
          />
        ))}
      </svg>
      <div className="tv-edge tv-edge-top" aria-hidden="true">
        <span key={home} className="tv-locale">
          <Waypoint />
          <span className="tv-locale-name">{PLACES[home].name}</span>
          <span className="tv-locale-place">{PLACES[home].place}</span>
        </span>
        <Divider />
      </div>

      <DepthStage spec={STAGE} track={stageRef} className="tv-layout mx-auto grid w-full max-w-[1440px] px-[var(--margin)]">
        <div className="tv-vista [grid-area:stage]" aria-hidden="true">
          {vistas.map((v) => (
            <Vista key={v.n} region={v.r} n={v.n} onShow={onShow} />
          ))}
          {/* mist on the horizon, between the land and the shore */}
          <Layer d={20} className="tv-mist">
            <span />
            <span />
          </Layer>
        </div>

        <header className="tv-head [grid-area:head]">
          <h2 id="teyvat-title" className="tv-display tv-title">
            Teyvat
          </h2>
          <p className="tv-intro">
            The four I'd take into the Spiral Abyss. Also, coincidentally, the four who ate all my primogems.
          </p>
        </header>

        <div ref={stageRef} className="tv-stage [grid-area:stage]">
          {ELEMENTS.map((el) => (
            <div key={el} className={`tv-scene tv-scene-stage tv-scene-${el}`} data-on={el === c.element || undefined} aria-hidden="true">
              <span className="tv-field" />
              <span className="tv-stripe" />
              <span className="tv-hair" />
            </div>
          ))}
          <Layer d={D.astro} className="tv-par tv-par-back">
            {ELEMENTS.map((el) => (
              <div key={el} className={`tv-glow tv-glow-${el}`} data-on={el === c.element || undefined} aria-hidden="true" />
            ))}
            <Astrolabe active={active} />
            <Particles key={c.element} element={c.element} far />
          </Layer>
          <Layer d={D.ghost} className="tv-ghosts">
            {CAST.map((ch, i) => (
              <span key={ch.id} className="tv-ghost tv-display" data-on={i === active || undefined} aria-hidden="true">
                {ch.short}
              </span>
            ))}
          </Layer>
          <Layer d={D.motes} className="tv-par">
            <Particles key={c.element} element={c.element} />
            {gust ? <Gust key={gust} element={c.element} /> : null}
          </Layer>
          <Layer d={D.char} className="tv-par tv-par-front">
            <div className="tv-float">
              {CAST.map((ch, i) => (
                <img
                  key={ch.id}
                  src={`/lobby/gi/${ch.id}-portrait.webp`}
                  alt={i === active ? `${ch.name}, full-body character art` : ""}
                  aria-hidden={i === active ? undefined : true}
                  decoding="async"
                  className="tv-char"
                  data-state={i === active ? "on" : i === prev ? "out" : undefined}
                />
              ))}
            </div>
          </Layer>
        </div>

        <div key={c.id} className="tv-info [grid-area:info]" aria-live="polite">
          <div className="tv-rise tv-element" style={{ "--r": 0 } as CSSProperties}>
            <span className="tv-glyph-frame">
              <Glyph element={c.element} className="tv-glyph" />
            </span>
            <span>
              <span className="tv-element-name">{c.elementName}</span>
              <span className="tv-dot" aria-hidden="true" />
              {c.region}
            </span>
          </div>
          <h3 className="tv-rise tv-display tv-name" style={{ "--r": 1 } as CSSProperties}>
            {c.name}
          </h3>
          {/* rarity on the gold rule: five stars, then the ornament */}
          <div className="tv-rise tv-rank" style={{ "--r": 2 } as CSSProperties}>
            <span className="tv-stars" role="img" aria-label="Five-star character">
              {[0, 1, 2, 3, 4].map((i) => (
                <svg key={i} viewBox="0 0 12 12" aria-hidden="true" style={{ "--s": i } as CSSProperties}>
                  <path d={STAR} />
                </svg>
              ))}
            </span>
            <Divider />
          </div>
          <p className="tv-rise tv-line" style={{ "--r": 3 } as CSSProperties}>
            {c.line}
          </p>
          <dl className="tv-rise tv-details" style={{ "--r": 4 } as CSSProperties}>
            <div>
              <dt>Weapon</dt>
              <dd>{c.weapon}</dd>
            </div>
            <div>
              <dt>Constellation</dt>
              <dd>{c.constellation}</dd>
            </div>
            <div>
              <dt>In my team</dt>
              <dd>{c.role}</dd>
            </div>
          </dl>
        </div>

        <div className="tv-switch [grid-area:switch]" role="group" aria-label="Choose a character" onKeyDown={onKeyDown}>
          {CAST.map((ch, i) => (
            <button
              key={ch.id}
              ref={(el) => {
                tabsRef.current[i] = el;
              }}
              type="button"
              aria-pressed={i === active}
              onClick={() => pick(i)}
              className={`tv-thumb tv-thumb-${ch.element}`}
              style={{ "--i": i } as CSSProperties}
            >
              <span className="tv-thumb-ring">
                <img src={`/lobby/gi/${ch.id}-icon.webp`} alt="" width={256} height={256} loading="lazy" decoding="async" />
                <Glyph element={ch.element} className="tv-thumb-glyph" />
              </span>
              <span className="tv-thumb-name">{ch.short}</span>
            </button>
          ))}
        </div>
      </DepthStage>

      <div className="tv-edge tv-edge-bottom" aria-hidden="true">
        <Divider />
      </div>
    </section>
  );
}
