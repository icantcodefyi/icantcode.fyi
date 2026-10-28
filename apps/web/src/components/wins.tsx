import { useEffect, useMemo, useRef, useState } from "react";
import { CITY_XY, INDIA_PATH, INDIA_VIEW } from "@/lib/india";
import { art, avif, halfSet } from "@/lib/art";
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

function IndiaMap({ active, counts, onCity }: { active: string; counts: Counts; onCity: (c: string) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setDrawn(true), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { w, h } = INDIA_VIEW;
  const home = CITY_XY[HOME];
  const routes = CITIES.filter((c) => c !== HOME);
  const lons = [70, 75, 80, 85, 90, 95];
  const lats = [10, 15, 20, 25, 30, 35];
  const km500 = (500 / 111) * K; // 1° of latitude ≈ 111 km

  return (
    <svg
      ref={ref}
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
            <g key={c} style={{ "--i": i } as React.CSSProperties}>
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
            onMouseEnter={() => onCity(c)}
            onMouseLeave={() => onCity("")}
          >
            <circle r={r + 12} className="ws-hit" />
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

/** Confetti and four-point glints floating around the trophy. */
function Glints() {
  return (
    <svg className="ws-glints" viewBox="0 0 400 500" aria-hidden="true" preserveAspectRatio="none">
      {[
        [40, 60, 1.2],
        [340, 30, 0.8],
        [370, 210, 1],
        [20, 300, 0.7],
        [300, 420, 0.9],
      ].map(([x, y, s], i) => (
        <path
          key={i}
          className="ws-glint"
          style={{ "--i": i } as React.CSSProperties}
          transform={`translate(${x} ${y}) scale(${s})`}
          d="M0 -16 C1.6 -5 5 -1.6 16 0 C5 1.6 1.6 5 0 16 C-1.6 5 -5 1.6 -16 0 C-5 -1.6 -1.6 -5 0 -16 Z"
        />
      ))}
      {[
        [80, 140, 20, "#ff2e88"],
        [310, 120, -30, "#f3c98b"],
        [360, 330, 50, "#2a0b19"],
        [60, 420, -15, "#f3c98b"],
        [200, 30, 70, "#ff2e88"],
      ].map(([x, y, r, c], i) => (
        <rect key={i} x={x as number} y={y as number} width="9" height="5" rx="1" fill={c as string} transform={`rotate(${r} ${x} ${y})`} />
      ))}
    </svg>
  );
}

export function Wins() {
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
    <section id="hackathons" className="ws" aria-labelledby="wins-title">
      <div className="ws-bg" aria-hidden="true" />

      <header className="ws-head">
        <h2 id="wins-title" className="t-head ws-title" data-reveal>
          Thirteen hackathon wins
        </h2>
        <div className="ws-intro" data-reveal style={{ "--d": "80ms" } as React.CSSProperties}>
          <p>Nine cities and a lot of train rides. Hover a win to see where it happened.</p>
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
          <div className="ws-stage" data-reveal style={{ "--d": "120ms" } as React.CSSProperties}>
            <span className="ws-numeral" aria-hidden="true">
              {WINS.length}
            </span>
            <div className="ws-map-wrap">
              <IndiaMap active={active} counts={counts} onCity={setActive} />
            </div>
            <Glints />
            <img
              className="ws-girl"
              src={art("/site/scenes/trophy-cutout")}
              srcSet={
                avif()
                  ? halfSet("/site/scenes/trophy-cutout.avif", 1122, "/site/scenes/trophy-cutout-600.avif", 600)
                  : undefined
              }
              sizes={avif() ? "auto, 100vw" : undefined}
              width={1122}
              height={1402}
              alt=""
              loading="lazy"
              decoding="async"
              onError={(e) => e.currentTarget.setAttribute("data-broken", "")}
            />
            <span className="ws-numeral ws-numeral-ghost" aria-hidden="true">
              {WINS.length}
            </span>
          </div>
          <p className="ws-legend">
            <span>Dot size is wins per city; the dashed ring marks a hackathon I organised.</span> Map: Natural Earth.
          </p>
        </div>

        <div className="ws-list">
          <ol data-reveal style={{ "--d": "140ms" } as React.CSSProperties}>
            {WINS.map((w) => row(w))}
          </ol>
          <h3 className="ws-sub">Organised</h3>
          <ol>{HOSTED.map((w) => row(w, true))}</ol>
        </div>
      </div>
    </section>
  );
}
