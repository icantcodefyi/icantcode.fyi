import { memo, type CSSProperties } from "react";

/**
 * The stage's HUD: frame brackets, the radar, the range ladder, the hazard
 * plate and the map callout. Everything that loops is an HTML box moved by
 * transform or opacity (compositor only); the SVGs are static line work,
 * memoised so a pick or a cast never re-renders them.
 */

// no top-right bracket: that corner is the mode dock's, with the radar under it
const BRACKETS = ["tl", "br", "bl"] as const;

export const Brackets = memo(function Brackets() {
  return (
    <div className="vl-brackets">
      {BRACKETS.map((c) => (
        <svg key={c} className={`vl-bracket vl-bracket-${c}`} width="96" height="96" viewBox="0 0 96 96" shapeRendering="crispEdges">
          <path d="M1 56V13L13 1h43" fill="none" stroke="currentColor" strokeWidth="2" shapeRendering="geometricPrecision" />
          <g className="vl-bracket-in">
            <path d="M8 40V16L16 8h24" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" shapeRendering="geometricPrecision" />
            <rect x="20" y="20" width="4" height="4" fill="#ff4655" />
            <path d="M30 26h7M33.5 22.5v7" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1" />
          </g>
          {[64, 70, 76, 82, 88].map((x, i) => (
            <rect key={x} x={x} y="0" width="1" height={i === 0 ? 6 : 3} fill="currentColor" fillOpacity={i === 0 ? 0.9 : 0.5} />
          ))}
          {[64, 70, 76, 82, 88].map((y, i) => (
            <rect key={y} x="0" y={y} width={i === 0 ? 6 : 3} height="1" fill="currentColor" fillOpacity={i === 0 ? 0.9 : 0.5} />
          ))}
        </svg>
      ))}
    </div>
  );
});

export const Divider = memo(function Divider() {
  return (
    <svg className="vl-divider" width="100%" height="14" aria-hidden="true" shapeRendering="crispEdges">
      <rect x="0" y="6" width="100%" height="1" fill="currentColor" fillOpacity="0.18" />
      <rect x="0" y="4" width="56" height="5" fill="#ff4655" />
      <rect x="62" y="4" width="5" height="5" fill="currentColor" />
      <svg x="100%" width="1" height="14" overflow="visible">
        {[0, 8, 16, 24, 32].map((x) => (
          <rect key={x} x={-x - 1} y={x === 0 ? 0 : 3} width="1" height={x === 0 ? 14 : 8} fill="currentColor" fillOpacity={x === 0 ? 0.7 : 0.35} />
        ))}
      </svg>
    </svg>
  );
});

export const Ladder = memo(function Ladder() {
  const ticks = Array.from({ length: 41 }, (_, i) => i);
  return (
    <svg className="vl-ladder" width="24" height="324" viewBox="0 0 24 324" aria-hidden="true" shapeRendering="crispEdges">
      <rect x="23" y="2" width="1" height="320" fill="currentColor" fillOpacity="0.35" />
      {ticks.map((i) => (
        <rect
          key={i}
          x={i % 10 === 0 ? 10 : i % 5 === 0 ? 15 : 19}
          y={2 + i * 8}
          width={i % 10 === 0 ? 13 : i % 5 === 0 ? 8 : 4}
          height="1"
          fill={i === 20 ? "#ff4655" : "currentColor"}
          fillOpacity={i % 10 === 0 ? 0.85 : 0.4}
        />
      ))}
      <path d="M2 162l6-4v8z" fill="#ff4655" shapeRendering="geometricPrecision" />
    </svg>
  );
});

/** The hazard plate, bottom left: stripes running inside a slanted plate, and who's locked in above it. */
export const HazardPlate = memo(function HazardPlate({ name }: { name: string }) {
  return (
    <div className="vl-plate">
      <p className="vl-plate-text" key={name}>
        <span className="vl-plate-dot" />
        Locked in
        <b>{name}</b>
      </p>
      <div className="vl-plate-bar">
        <span className="vl-plate-ko" />
        <span className="vl-plate-run" />
        <svg className="vl-plate-line" viewBox="0 0 232 36" aria-hidden="true">
          <path d="M10 4h178l-10 28H0z" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d="M196 4h8l-10 28h-8zM210 4h4l-10 28h-4z" className="vl-plate-chip" />
          <path d="M222 4v6M222 26v6M219 4h6M219 32h6" stroke="currentColor" strokeOpacity="0.6" shapeRendering="crispEdges" />
        </svg>
      </div>
    </div>
  );
});

/** The map callout, top left: Ascent, with the scrambled coordinates the game prints for it, character for character. */
export const MapTag = memo(function MapTag() {
  return (
    <div className="vl-map">
      <span className="vl-map-bar" />
      <p className="vl-map-name">Ascent</p>
      <p className="vl-map-coords">
        <span>45°26&apos;BF&apos;N,</span>
        <span>12°20&apos;Q&apos;E</span>
      </p>
    </div>
  );
});

const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)].map((n) => +n.toFixed(2));
};

/** Where the sweep finds someone (deg, radius of 200): re-seeded per agent, so the picture changes with the pick. */
const BLIPS = [
  [
    { deg: 52, r: 56 },
    { deg: 148, r: 34 },
    { deg: 236, r: 64 },
  ],
  [
    { deg: 18, r: 44 },
    { deg: 112, r: 66 },
    { deg: 300, r: 30 },
  ],
  [
    { deg: 80, r: 28 },
    { deg: 196, r: 58 },
    { deg: 262, r: 46 },
  ],
  [
    { deg: 34, r: 66 },
    { deg: 170, r: 52 },
    { deg: 318, r: 58 },
  ],
];
const SWEEP_S = 4;

export const Radar = memo(function Radar({ seed }: { seed: number }) {
  const blips = BLIPS[seed % BLIPS.length];
  return (
    <div className="vl-radar" aria-hidden="true">
      <svg viewBox="0 0 200 200">
        <path d="M12 0h176l12 12v176l-12 12H12L0 188V12z" fill="#0b0b0d" className="vl-ko" fillOpacity="0.88" />
        <path d="M12.5 .5h175l12 12v175l-12 12h-175l-12-12v-175z" fill="none" stroke="currentColor" strokeOpacity="0.4" />
        <path d="M4 26V12l8-8h14M196 174v14l-8 8h-14" fill="none" stroke="#ff4655" strokeWidth="2" />
        <g fill="none" stroke="currentColor">
          <circle cx="100" cy="100" r="86" strokeOpacity="0.5" />
          <circle cx="100" cy="100" r="78" strokeOpacity="0.2" />
          <circle cx="100" cy="100" r="52" strokeOpacity="0.2" strokeDasharray="2 4" />
          <circle cx="100" cy="100" r="26" strokeOpacity="0.2" />
          <path d="M100 22v156M22 100h156" strokeOpacity="0.12" shapeRendering="crispEdges" />
        </g>
        <g stroke="currentColor">
          {Array.from({ length: 72 }, (_, i) => {
            const major = i % 6 === 0;
            const [x1, y1] = polar(86, i * 5);
            const [x2, y2] = polar(major ? 79 : 83, i * 5);
            return <path key={i} d={`M${x1} ${y1}L${x2} ${y2}`} strokeOpacity={major ? 0.8 : 0.35} strokeWidth={major ? 1.5 : 1} />;
          })}
        </g>
        <path d="M96 6h8l-4 7z" fill="#ff4655" />
      </svg>
      <span className="vl-sweep" />
      {blips.map((b) => {
        const [x, y] = polar(b.r, b.deg);
        return (
          <span
            key={`${seed}-${b.deg}`}
            className="vl-blip"
            style={{ left: `${x / 2}%`, top: `${y / 2}%`, "--vl-delay": `${(b.deg / 360) * SWEEP_S}s` } as CSSProperties}
          />
        );
      })}
      <span className="vl-spike-ring" />
      <svg className="vl-spike" viewBox="0 0 200 200">
        <path d="M100 89l7 11-7 11-7-11z" fill="currentColor" />
        <path d="M100 94l3.5 6-3.5 6-3.5-6z" fill="#ff4655" />
      </svg>
    </div>
  );
});
