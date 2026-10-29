import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { DepthStage, useDepthLayer } from "@/components/depth-stage";
import { Seam } from "@/components/seam";
import { art, halfSet, SEAM_ART, TROPHY_LAYERS } from "@/lib/art";
import type { StageSpec } from "@/lib/depth/types";
import { CITY_XY, INDIA_PATH, INDIA_VIEW } from "@/lib/india";
import { HOSTED, WINS } from "@/lib/site-data";

const CITIES = Object.keys(CITY_XY);
const HOME = "Indore";

// Hand-placed labels so neighbouring cities never collide: [dx, dy, anchor]
const LABEL: Record<string, [number, number, "start" | "end"]> = {
  Jammu: [-1, -1, "end"],
  Roorkee: [1, -0.6, "start"],
  Delhi: [1, 0.9, "start"],
  Bhopal: [1, -0.4, "start"],
  Indore: [-1, 1.3, "end"],
  Mumbai: [-1, -0.7, "end"],
  Pune: [-1, 1.4, "end"],
  Bengaluru: [-1, 1.1, "end"],
  Chennai: [1, 0.6, "start"],
};

const cityOf = (venue: string) => CITIES.find((c) => venue.includes(c)) ?? "";

/** Pins pop in the order the cities were first won in (WINS runs newest first), then the organised-only ones. */
const POP = [...new Set([...[...WINS].reverse(), ...HOSTED].map((w) => cityOf(w.venue)))];

// Degrees → map units, matching scripts that generated lib/india.ts.
const K = 20;
const COS = Math.cos((22 * Math.PI) / 180);
const lonX = (lon: number) => (lon - 67.5) * COS * K;
const latY = (lat: number) => (37.5 - lat) * K;

function arc([x1, y1]: [number, number], [x2, y2]: [number, number]) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  // bow each route to the left of travel, proportional to its length
  const bow = Math.min(90, len * 0.32);
  return `M${x1} ${y1} Q${mx - (dy / len) * bow} ${my + (dx / len) * bow} ${x2} ${y2}`;
}

type Counts = Record<string, { won: number; hosted: number }>;

interface MapProps {
  active: string;
  counts: Counts;
  onCity: (c: string) => void;
}

function IndiaMap({ active, counts, onCity, drawn }: MapProps & { drawn: boolean }) {
  const { w, h } = INDIA_VIEW;
  const home = CITY_XY[HOME];
  const routes = CITIES.filter((c) => c !== HOME);
  const lons = [70, 75, 80, 85, 90, 95];
  const lats = [10, 15, 20, 25, 30, 35];
  const km500 = (500 / 111) * K; // 1° of latitude ≈ 111 km

  return (
    <svg
      viewBox={`-30 -20 ${w + 60} ${h + 50}`}
      role="img"
      aria-label="Map of India marking the cities where ani won or organised hackathons"
      className={`wins-map ws-map h-auto w-full ${drawn ? "is-drawn" : ""}`}
    >
      <defs>
        <pattern id="wm-dots" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.15" fill="currentColor" />
        </pattern>
        <pattern id="wm-dots-fine" width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.55" fill="currentColor" />
        </pattern>
        <pattern id="ws-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="#ff2e88" strokeWidth="1.4" />
        </pattern>
        <linearGradient id="ws-paper" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fff7fb" />
          <stop offset="0.6" stopColor="#ffe3ef" />
          <stop offset="1" stopColor="#ffd0e3" />
        </linearGradient>
        <radialGradient id="wm-fade" cx={home[0] / w} cy={home[1] / h} r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.15" />
        </radialGradient>
        <radialGradient id="ws-pin-glow">
          <stop offset="0.3" stopColor="#ff2e88" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ff2e88" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ws-heat" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff2e88" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff2e88" stopOpacity="0" />
        </radialGradient>
        <mask id="wm-mask">
          <rect x="-30" y="-20" width={w + 60} height={h + 50} fill="url(#wm-fade)" />
        </mask>
        <clipPath id="wm-clip">
          <path d={INDIA_PATH} />
        </clipPath>
        <filter id="ws-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id="wm-tip" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" fill="var(--pink)" />
        </marker>
      </defs>

      {/* graticule */}
      <g className="wm-grid" fill="currentColor">
        {lons.map((lon) => (
          <g key={lon}>
            <line x1={lonX(lon)} x2={lonX(lon)} y1={-10} y2={h + 10} stroke="currentColor" />
            <text x={lonX(lon)} y={h + 26} textAnchor="middle">
              {lon}°E
            </text>
          </g>
        ))}
        {lats.map((lat) => (
          <g key={lat}>
            <line y1={latY(lat)} y2={latY(lat)} x1={-10} x2={w + 10} stroke="currentColor" />
            <text x={-14} y={latY(lat) + 4} textAnchor="end">
              {lat}°N
            </text>
          </g>
        ))}
        <line className="wm-tropic" y1={latY(23.44)} y2={latY(23.44)} x1={-10} x2={w + 10} stroke="currentColor" />
        <text x={w + 8} y={latY(23.44) - 6} textAnchor="end" className="wm-note">
          Tropic of Cancer
        </text>
      </g>

      <text x={lonX(80.6)} y={latY(5.4)} textAnchor="middle" className="ws-sea">
        Indian Ocean
      </text>

      {/* land: a printed misregistration shadow, paper, then two dot screens */}
      <path d={INDIA_PATH} transform="translate(7 9)" className="ws-shadow" />
      <path d={INDIA_PATH} transform="translate(7 9)" fill="url(#ws-hatch)" className="ws-shadow-hatch" />
      <path d={INDIA_PATH} className="ws-cut" />
      <path d={INDIA_PATH} fill="url(#ws-paper)" />
      <g clipPath="url(#wm-clip)">
        <circle cx={home[0]} cy={home[1]} r="230" fill="url(#ws-heat)" className="ws-heat" />
        <rect x="0" y="0" width={w} height={h} fill="url(#wm-dots-fine)" className="wm-land-fine" />
        <rect x="0" y="0" width={w} height={h} fill="url(#wm-dots)" mask="url(#wm-mask)" className="wm-land" />
      </g>
      <path d={INDIA_PATH} className="wm-coast" fill="none" stroke="currentColor" />
      <text x={w + 8} y={latY(23.44) - 6} textAnchor="end" className="ws-tropic">
        Tropic of Cancer
      </text>

      {/* routes from home */}
      <g fill="none">
        {routes.map((c, i) => {
          const d = arc(home, CITY_XY[c]);
          const on = active === c;
          return (
            <g key={c} style={{ "--i": i } as CSSProperties}>
              <path d={d} className="ws-route-under" />
              <path
                d={d}
                className={`wm-route ${on ? "is-on" : ""}`}
                pathLength={1}
                markerEnd="url(#wm-tip)"
                filter={on ? "url(#ws-glow)" : undefined}
              />
              <circle r="2.6" className="wm-traveller">
                <animateMotion dur={`${3.2 + i * 0.35}s`} repeatCount="indefinite" path={d} begin={`${i * 0.4}s`} />
              </circle>
            </g>
          );
        })}
      </g>

      {/* cities */}
      {CITIES.map((c) => {
        const [x, y] = CITY_XY[c];
        const n = counts[c] ?? { won: 0, hosted: 0 };
        const r = 4 + n.won * 1.6;
        const on = active === c;
        const [lx, ly, anchor] = LABEL[c] ?? [1, 0, "start"];
        return (
          <g
            key={c}
            className={`wm-city ${on ? "is-on" : ""}`}
            transform={`translate(${x} ${y})`}
            style={{ "--pop": `${400 + POP.indexOf(c) * 90}ms` } as CSSProperties}
            onMouseEnter={() => onCity(c)}
            onMouseLeave={() => onCity("")}
            onClick={() => onCity(c)}
          >
            <g className="ws-pop">
              <circle r={r + 12} className="ws-hit" />
              <circle r={r + 13} className="ws-pin-glow" fill="url(#ws-pin-glow)" />
              <circle r={r + 7} className="wm-halo" />
              <circle r={r + 2.2} className="ws-pin-ring" />
              <circle r={r} className="wm-pin" />
              <circle r={r * 0.38} cx={-r * 0.28} cy={-r * 0.3} className="ws-pin-shine" />
              {n.hosted > 0 && <circle r={r + 5} className="wm-hosted" />}
              {c === HOME && (
                <path
                  d="M0 -15 L3.2 -4.4 L14.3 -4.6 L5.2 1.8 L8.8 12.1 L0 5.6 L-8.8 12.1 L-5.2 1.8 L-14.3 -4.6 L-3.2 -4.4 Z"
                  className="wm-home"
                  transform="scale(0.62)"
                />
              )}
            </g>
            <text x={lx * (r + 8)} y={4 + ly * 12} textAnchor={anchor} className="wm-label">
              {c}
              {n.won > 0 && <tspan className="wm-count">{` ${n.won}`}</tspan>}
            </text>
          </g>
        );
      })}

      {/* compass rose */}
      <g transform={`translate(${w - 30} 40)`} className="ws-compass" aria-hidden="true">
        <circle r="22" className="ws-compass-ring" />
        <circle r="17" className="ws-compass-ring ws-compass-ring-in" />
        <path d="M0 -30 L5 -4 L0 0 Z" className="ws-compass-dark" />
        <path d="M0 -30 L-5 -4 L0 0 Z" className="ws-compass-pink" />
        <path d="M0 30 L5 4 L0 0 Z" className="ws-compass-pink" />
        <path d="M0 30 L-5 4 L0 0 Z" className="ws-compass-dark" />
        <path d="M-24 0 L-4 3 L0 0 Z M24 0 L4 -3 L0 0 Z" className="ws-compass-dark" />
        <path d="M-24 0 L-4 -3 L0 0 Z M24 0 L4 3 L0 0 Z" className="ws-compass-pink" />
        <text y="-35" textAnchor="middle">
          N
        </text>
      </g>

      {/* scale bar */}
      <g transform={`translate(${w - km500 - 10} ${h - 24})`} className="wm-scale">
        <rect width={km500 / 2} height="4" fill="currentColor" />
        <rect x={km500 / 2} width={km500 / 2} height="4" fill="none" stroke="currentColor" />
        <text y="-7">0</text>
        <text x={km500} y="-7" textAnchor="end">
          500 km
        </text>
      </g>
    </svg>
  );
}

type Tier = "gold" | "silver" | "bronze" | "track" | "host";
const tierOf = (prize: string, host: boolean): Tier =>
  host
    ? "host"
    : /1st|first/i.test(prize)
      ? "gold"
      : /2nd/i.test(prize)
        ? "silver"
        : /3rd/i.test(prize)
          ? "bronze"
          : "track";

const MEDAL: Record<Tier, [string, string, string]> = {
  // light, mid, dark
  gold: ["#fff0c9", "#f3c98b", "#a86a1c"],
  silver: ["#ffffff", "#d9d2dc", "#7d6f80"],
  bronze: ["#ffd9bf", "#e39a6c", "#8a4321"],
  track: ["#ffd3e6", "#ff6fae", "#a3124f"],
  host: ["#ffd3e6", "#ff6fae", "#a3124f"],
};

/** A small rosette: two cut ribbon tails, a scalloped rosette and a struck disc. */
function Medal({ tier }: { tier: Tier }) {
  const [lt, md, dk] = MEDAL[tier];
  const id = `ws-m-${tier}`;
  const scallop = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return `${(Math.cos(a) * 12.2).toFixed(2)} ${(Math.sin(a) * 12.2).toFixed(2)}`;
  });
  return (
    <svg viewBox="-16 -16 32 44" className="ws-medal" aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={lt} />
          <stop offset="0.55" stopColor={md} />
          <stop offset="1" stopColor={dk} />
        </radialGradient>
      </defs>
      <path d="M-7 6 L-11 26 L-6.5 22.5 L-3.5 27.5 L-1 9 Z" fill="#ff2e88" stroke="#2a0b19" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M7 6 L11 26 L6.5 22.5 L3.5 27.5 L1 9 Z" fill="#d81b6c" stroke="#2a0b19" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M-9 13 L-3 15" stroke="#ffd3e6" strokeWidth="1" strokeLinecap="round" />
      <g>
        {scallop.map((p, i) => (
          <circle key={i} cx={p.split(" ")[0]} cy={p.split(" ")[1]} r="3.4" fill={md} stroke="#2a0b19" strokeWidth="1.1" />
        ))}
        <circle r="12" fill={md} />
        <circle r="9.6" fill={`url(#${id})`} stroke="#2a0b19" strokeWidth="1.1" />
        {tier === "host" ? (
          <path d="M-4 -5 L-4 6 M-4 -5 L5 -3 L-4 1" fill="none" stroke="#2a0b19" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path
            d="M0 -6 L1.8 -1.9 L6.2 -1.8 L2.8 1 L4 5.3 L0 2.8 L-4 5.3 L-2.8 1 L-6.2 -1.8 L-1.8 -1.9 Z"
            fill={lt}
            stroke={dk}
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
        )}
        <path d="M-6.5 -4.5 A 7.6 7.6 0 0 1 -1 -7.4" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
      </g>
    </svg>
  );
}

/** Four-point glints around the trophy, as HTML so each twinkle stays on the compositor. */
const GLINTS = [
  [10, 12, 1.2],
  [85, 6, 0.8],
  [80, 64, 1],
  [5, 60, 0.7],
  [75, 84, 0.9],
] as const;

/**
 * Ambient (PLAN §5.3): ten flakes of confetti and ribbon let go from the
 * trophy and fall past her for 30 to 60 s each. [x %, y % of her box, s, delay s, kind]
 */
const FLUTTER = [
  [70, 6, 41, -3, "pink"],
  [76, 9, 53, -17, "gold"],
  [66, 4, 37, -29, "ribbon"],
  [72, 7, 59, -41, "ink"],
  [79, 5, 46, -8, "pink"],
  [68, 10, 33, -21, "gold"],
  [74, 3, 57, -50, "blush"],
  [64, 8, 44, -34, "ribbon"],
  [77, 11, 39, -12, "gold"],
  [71, 2, 50, -26, "pink"],
] as const;

const STAGE: StageSpec = { id: "wins", plates: [] };
const [GIRL, CONFETTI] = TROPHY_LAYERS;

function Cutout({ layer, className }: { layer: (typeof TROPHY_LAYERS)[number]; className?: string }) {
  const [w, h] = layer.size;
  return (
    <img
      className={className}
      src={art(layer.art)}
      srcSet={halfSet(art(layer.art), w, art(layer.half), layer.halfSize[0])}
      sizes="auto, 100vw"
      width={w}
      height={h}
      alt=""
      loading="lazy"
      decoding="async"
      onError={(e) => e.currentTarget.setAttribute("data-broken", "")}
    />
  );
}

/**
 * The trophy stage on the site camera (PLAN §7 H2): numeral 16, map paper
 * 14, girl 12.5, glints 10, the free confetti 7, and the numeral's outline
 * over her at the numeral's own depth. The
 * girl and her confetti are one painting split in two, so at rest they are
 * exactly the original.
 */
function Trophy(props: MapProps) {
  const numeral = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const girl = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const glints = useRef<HTMLDivElement>(null);
  const confetti = useRef<HTMLDivElement>(null);
  useDepthLayer(numeral, 16);
  useDepthLayer(map, 14);
  useDepthLayer(girl, GIRL.distance);
  // the ghost is the numeral seen through her, so it stays registered with it
  useDepthLayer(ghost, 16);
  useDepthLayer(glints, 10);
  useDepthLayer(confetti, CONFETTI.distance);

  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const el = map.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setDrawn(true), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const on = drawn ? "" : undefined;

  return (
    <>
      <div ref={numeral} className="ws-numeral" data-drawn={on} aria-hidden="true">
        <span>{WINS.length}</span>
      </div>
      <div ref={map} className="ws-map-wrap">
        <IndiaMap {...props} drawn={drawn} />
      </div>
      <div ref={glints} className="ws-glints" aria-hidden="true">
        {GLINTS.map(([x, y, s], i) => (
          <span key={i} style={{ left: `${x}%`, top: `${y}%`, "--s": s, "--i": i } as CSSProperties}>
            <svg viewBox="-16 -16 32 32">
              <path d="M0 -16 C1.6 -5 5 -1.6 16 0 C5 1.6 1.6 5 0 16 C-1.6 5 -5 1.6 -16 0 C-5 -1.6 -1.6 -5 0 -16 Z" />
            </svg>
          </span>
        ))}
      </div>
      <div ref={girl} className="ws-girl">
        <Cutout layer={GIRL} />
      </div>
      <div ref={ghost} className="ws-numeral ws-numeral-ghost" data-drawn={on} aria-hidden="true">
        <span>{WINS.length}</span>
      </div>
      <div ref={confetti} className="ws-girl ws-confetti">
        <Cutout layer={CONFETTI} />
        {FLUTTER.map(([x, y, t, d, kind], i) => (
          <i
            key={i}
            className="ws-flake"
            data-kind={kind}
            style={{ left: `${x}%`, top: `${y}%`, "--t": `${t}s`, "--d": `${d}s`, "--i": i } as CSSProperties}
          >
            <b />
          </i>
        ))}
      </div>
    </>
  );
}

export function Wins() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState("");
  const counts = useMemo(() => {
    const out: Counts = {};
    for (const w of WINS) {
      const c = cityOf(w.venue);
      out[c] = { won: (out[c]?.won ?? 0) + 1, hosted: out[c]?.hosted ?? 0 };
    }
    for (const w of HOSTED) {
      const c = cityOf(w.venue);
      out[c] = { won: out[c]?.won ?? 0, hosted: (out[c]?.hosted ?? 0) + 1 };
    }
    return out;
  }, []);
  const cityCount = Object.keys(counts).length;

  const row = (w: { event: string; built: string; venue: string; prize: string }, host = false) => {
    const city = cityOf(w.venue);
    const tier = tierOf(w.prize, host);
    return (
      <li key={w.event}>
        <button
          type="button"
          onMouseEnter={() => setActive(city)}
          onClick={() => setActive(city)}
          onFocus={() => setActive(city)}
          onMouseLeave={() => setActive("")}
          onBlur={() => setActive("")}
          data-on={active && active === city ? "" : undefined}
          className="wins-row ws-row"
        >
          <Medal tier={tier} />
          <span className="ws-event">{w.event}</span>
          <span className="ws-built">{w.built}</span>
          <span className="ws-venue">
            <svg viewBox="0 0 12 16" aria-hidden="true">
              <path d="M6 15.2 C6 15.2 11 9.6 11 6 A5 5 0 0 0 1 6 C1 9.6 6 15.2 6 15.2 Z" />
              <circle cx="6" cy="6" r="1.9" />
            </svg>
            {w.venue}
          </span>
          <span className={`ws-prize ws-prize-${tier}`}>{w.prize}</span>
        </button>
      </li>
    );
  };

  return (
    <>
      <Seam kind="cloud-rise" from="var(--bg)" to="var(--blush)" art={SEAM_ART["cloud-rise"]} />
      <section id="hackathons" ref={root} className="ws" aria-labelledby="wins-title">
        <div className="ws-bg" aria-hidden="true" />

        <header className="ws-head">
          <h2 id="wins-title" className="t-head ws-title" data-reveal>
            Thirteen hackathon wins
          </h2>
          <div className="ws-intro" data-reveal style={{ "--d": "80ms" } as CSSProperties}>
            <p>
              Nine cities and a lot of train rides. <span className="ws-hover-copy">Hover a win to see where it happened.</span>
              <span className="ws-touch-copy">Tap a win to see where it happened.</span>
            </p>
            <dl className="ws-stats">
              <div>
                <dt>cities</dt>
                <dd>{cityCount}</dd>
              </div>
              <div>
                <dt>organised</dt>
                <dd>{HOSTED.length}</dd>
              </div>
              <div>
                <dt>first flight</dt>
                <dd>1</dd>
              </div>
            </dl>
          </div>
        </header>

        <div className="ws-body">
          <div className="ws-stage-col">
            <DepthStage spec={STAGE} track={root} className="ws-stage" data-reveal style={{ "--d": "120ms" } as CSSProperties}>
              <Trophy active={active} counts={counts} onCity={setActive} />
            </DepthStage>
            <p className="ws-legend">
              <span>Dot size is wins per city; the dashed ring marks a hackathon I organised.</span> Map: Natural Earth.
            </p>
          </div>

          <div className="ws-list">
            <ol data-reveal style={{ "--d": "140ms" } as CSSProperties}>
              {WINS.map((w) => row(w))}
            </ol>
            <h3 className="ws-sub">Organised</h3>
            <ol>{HOSTED.map((w) => row(w, true))}</ol>
          </div>
        </div>
      </section>
      <Seam kind="cloud-fall" from="var(--blush)" to="var(--bg)" art={SEAM_ART["cloud-fall"]} />
    </>
  );
}
