import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { DepthStage, useDepthLayer } from "@/components/depth-stage";
import { Seam } from "@/components/seam";
import { art, halfSet, SEAM_ART, TROPHY_LAYERS } from "@/lib/art";
import type { StageSpec } from "@/lib/depth/types";
import { CITY_XY, INDIA_PATH, INDIA_VIEW } from "@/lib/india";
import { HOSTED, WINS, type Win } from "@/lib/site-data";

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

/** Pins pop in the order the cities were first won in (WINS runs newest first), then any undated, then the organised-only ones. */
const POP = [...new Set([...WINS.filter((w) => w.year).reverse(), ...WINS, ...HOSTED].map((w) => cityOf(w.venue)))];

/** A row's identity, and the city each row lights on the map. */
const keyOf = (w: Win) => `${w.event}|${w.venue}`;
const CITY_OF = new Map([...WINS, ...HOSTED].map((w) => [keyOf(w), cityOf(w.venue)]));

// Degrees → map units, matching scripts that generated lib/india.ts.
const K = 20;
const COS = Math.cos((22 * Math.PI) / 180);
const lonX = (lon: number) => (lon - 67.5) * COS * K;
const latY = (lat: number) => (37.5 - lat) * K;

/**
 * The count's digits as outlines: Unbounded ExtraBold (the face .ws-numeral used), instanced from the variable
 * font with its overlaps removed. A stroke on the variable font's own text traces every overlapping contour
 * (a stray triangle in the 1's flag); these trace only the silhouette. [advance, path], 1000 units, y down.
 */
const DIGITS: Record<string, [number, string]> = {
  "0": [935, "M468 17Q338 17 242 -32Q145 -81 92 -169Q39 -257 39 -375Q39 -493 92 -581Q145 -669 242 -718Q338 -767 468 -767Q597 -767 694 -718Q790 -669 843 -581Q897 -493 897 -375Q897 -257 843 -169Q790 -81 694 -32Q597 17 468 17ZM468 -171Q562 -171 613 -225Q665 -278 665 -375Q665 -473 613 -526Q562 -579 468 -579Q375 -579 322 -526Q270 -473 270 -375Q270 -278 322 -224Q375 -171 468 -171Z"],
  "1": [536, "M467 -750V0H237V-552L15 -513V-691L297 -750Z"],
  "2": [850, "M31 -476Q38 -566 92 -632Q145 -697 234 -732Q323 -767 434 -767Q540 -767 620 -735Q699 -703 743 -646Q787 -590 787 -515Q787 -456 754 -406Q722 -356 654 -308Q586 -261 477 -212L412 -182H807V0H50V-160L373 -337Q446 -377 485 -404Q524 -430 540 -452Q556 -475 556 -501Q556 -528 541 -548Q526 -568 496 -579Q467 -590 425 -590Q370 -590 336 -574Q301 -559 284 -533Q266 -507 262 -476Z"],
  "3": [850, "M44 -504Q49 -576 95 -636Q141 -695 228 -731Q315 -767 441 -767Q548 -767 627 -740Q706 -714 750 -666Q793 -619 793 -555Q793 -505 762 -463Q732 -421 666 -397Q651 -391 635 -387Q649 -385 662 -381Q733 -364 772 -324Q810 -283 810 -219Q810 -151 765 -98Q720 -44 634 -14Q548 17 425 17Q305 17 216 -16Q127 -48 78 -108Q28 -169 25 -250H256Q263 -207 303 -184Q343 -160 425 -160Q496 -160 534 -180Q573 -200 573 -237Q573 -259 561 -274Q549 -288 518 -295Q486 -302 430 -302H303V-455H430Q504 -455 532 -473Q560 -491 560 -521Q560 -555 526 -572Q493 -590 428 -590Q357 -590 320 -568Q283 -545 276 -504Z"],
  "4": [880, "M732 -750V-303H845V-134H732V0H502V-134H25V-297L438 -750ZM502 -303V-574L256 -303Z"],
  "5": [817, "M123 -750H724V-581H276L253 -438Q289 -465 338 -481Q394 -500 469 -500Q565 -500 635 -469Q705 -438 744 -383Q782 -328 782 -255Q782 -175 738 -114Q694 -53 610 -18Q527 17 410 17Q297 17 212 -16Q128 -49 80 -106Q33 -162 28 -231H258Q266 -200 306 -180Q345 -160 410 -160Q454 -160 486 -172Q517 -183 534 -204Q551 -226 551 -256Q551 -284 535 -306Q519 -328 488 -340Q457 -352 413 -352Q376 -352 346 -344Q316 -337 294 -324Q273 -312 257 -298H55Z"],
  "6": [867, "M454 -767Q554 -767 632 -736Q709 -706 756 -654Q804 -603 814 -538H601Q588 -565 554 -583Q520 -601 460 -601Q392 -601 346 -576Q301 -551 278 -503Q256 -455 256 -385V-383L260 -387Q308 -435 374 -462Q441 -490 526 -490Q621 -490 688 -459Q756 -428 792 -373Q829 -318 829 -246Q829 -170 786 -110Q743 -51 661 -17Q579 17 459 17Q318 17 225 -33Q132 -83 86 -172Q41 -260 41 -374Q41 -488 87 -577Q133 -666 225 -716Q317 -767 454 -767ZM282 -251Q306 -201 351 -176Q397 -150 463 -150Q506 -150 536 -162Q566 -174 581 -194Q596 -214 596 -238Q596 -265 582 -284Q567 -304 538 -314Q509 -324 467 -324Q410 -324 357 -301Q318 -283 282 -251Z"],
  "7": [769, "M117 0 487 -568H15V-750H742V-565L386 0Z"],
  "8": [905, "M453 -767Q644 -767 744 -710Q844 -652 844 -549Q844 -459 758 -414Q728 -398 690 -389Q738 -380 774 -361Q865 -313 865 -209Q865 -99 760 -41Q655 17 453 17Q251 17 146 -41Q40 -99 40 -209Q40 -313 132 -361Q167 -380 215 -389Q177 -398 147 -414Q61 -459 61 -549Q61 -652 162 -710Q262 -767 453 -767ZM453 -158Q540 -158 585 -176Q630 -195 630 -231Q630 -266 585 -284Q540 -302 453 -302Q366 -302 321 -284Q276 -266 276 -231Q276 -195 321 -176Q366 -158 453 -158ZM453 -458Q505 -458 540 -466Q576 -473 594 -488Q613 -503 613 -525Q613 -557 572 -574Q531 -592 453 -592Q374 -592 333 -574Q292 -557 292 -525Q292 -503 310 -488Q329 -473 364 -466Q400 -458 453 -458Z"],
  "9": [867, "M413 17Q313 17 236 -14Q158 -44 111 -96Q64 -148 54 -212H266Q280 -185 314 -167Q348 -149 407 -149Q477 -149 522 -174Q566 -199 588 -248Q611 -296 611 -365V-367Q610 -365 608 -363Q560 -315 494 -288Q427 -260 341 -260Q247 -260 179 -291Q111 -322 75 -377Q39 -432 38 -504Q39 -580 82 -640Q124 -699 206 -733Q289 -767 409 -767Q550 -767 642 -717Q735 -667 782 -578Q828 -490 827 -376Q828 -262 782 -173Q735 -84 643 -34Q551 17 413 17ZM586 -499Q561 -549 516 -574Q470 -600 405 -600Q361 -600 332 -588Q302 -576 286 -556Q271 -537 271 -512Q271 -485 286 -466Q301 -447 330 -436Q359 -426 401 -426Q458 -426 511 -449Q550 -467 586 -499Z"],
};
// Unbounded's metrics: 995 ascent and 245 descent in a 0.8em line box put the baseline at 775 of 800.
const TRACK = 70; // letter-spacing -0.07em
const BASE = 775;

/** The count drawn as a numeral: hot-pink fill over an offset ink shadow, or (ghost) just its outline. */
function Numeral({ n, ghost = false }: { n: number; ghost?: boolean }) {
  let x = 0;
  const glyphs = [...String(n)].map((c) => {
    const [adv, d] = DIGITS[c];
    const at = x;
    x += adv - TRACK;
    return <path key={at} d={d} transform={`translate(${at} ${BASE})`} />;
  });
  return (
    <svg viewBox={`0 0 ${x} 800`} style={{ width: `${x / 1000}em` }}>
      {ghost ? (
        <g className="ws-numeral-line">{glyphs}</g>
      ) : (
        <>
          <g className="ws-numeral-shadow">{glyphs}</g>
          <g className="ws-numeral-fill">{glyphs}</g>
        </>
      )}
    </svg>
  );
}

type Pt = [number, number];

/** The control point that bows a route to the left of travel, in proportion to its length. */
function bend([x1, y1]: Pt, [x2, y2]: Pt): Pt {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const bow = Math.min(90, len * 0.32);
  return [(x1 + x2) / 2 - (dy / len) * bow, (y1 + y2) / 2 + (dx / len) * bow];
}

const arc = (a: Pt, b: Pt) => `M${a[0]} ${a[1]} Q${bend(a, b).join(" ")} ${b[0]} ${b[1]}`;

/** `n + 1` points evenly spaced by length along the route: a traveller keeps one speed, as SMIL's paced motion did. */
function paced(a: Pt, b: Pt, n = 24): Pt[] {
  const c = bend(a, b);
  const at = (t: number): Pt => [0, 1].map((k) => (1 - t) ** 2 * a[k] + 2 * t * (1 - t) * c[k] + t * t * b[k]) as Pt;
  const M = 256;
  const pts = Array.from({ length: M + 1 }, (_, i) => at(i / M));
  const len = [0];
  for (let i = 1; i <= M; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const out: Pt[] = [];
  for (let j = 0, i = 0; j <= n; j++) {
    const s = (len[M] * j) / n;
    while (i < M - 1 && len[i + 1] < s) i++;
    const f = (s - len[i]) / (len[i + 1] - len[i]);
    out.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]);
  }
  return out;
}

type Counts = Record<string, { won: number; hosted: number }>;

// The map's viewBox; .wm-fx (the HTML layers over it) places things in its units as cqw of the map's width.
const VIEW = { x: -30, y: -20, w: INDIA_VIEW.w + 60, h: INDIA_VIEW.h + 50 };
const VIEWBOX = `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`;
const cq = (v: number) => `${((v * 100) / VIEW.w).toFixed(3)}cqw`;

const ROUTES = CITIES.filter((c) => c !== HOME);
/** Each traveller's flight as keyframes: the route, sampled evenly along its length. */
const FLIGHTS = ROUTES.map((c, i) => {
  const pts = paced(CITY_XY[HOME], CITY_XY[c]);
  const frames = pts.map(([x, y], j) => `${((j * 100) / (pts.length - 1)).toFixed(3)}%{translate:${cq(x)} ${cq(y)}}`);
  return `@keyframes wm-flight-${i}{${frames.join("")}}`;
}).join("");

/** Where a city's pin sits and how big it is (dot size is wins), shared by the map's layers. */
function pinOf(c: string, counts: Counts) {
  const [x, y] = CITY_XY[c];
  const n = counts[c] ?? { won: 0, hosted: 0 };
  return { x, y, n, r: 4 + n.won * 1.6, pop: { "--pop": `${400 + POP.indexOf(c) * 90}ms` } as CSSProperties };
}

interface MapProps {
  active: string;
  counts: Counts;
  onCity: (c: string) => void;
}

function IndiaMap({ active, counts, onCity, drawn }: MapProps & { drawn: boolean }) {
  const { w, h } = INDIA_VIEW;
  const home = CITY_XY[HOME];
  const lons = [70, 75, 80, 85, 90, 95];
  const lats = [10, 15, 20, 25, 30, 35];
  const km500 = (500 / 111) * K; // 1° of latitude ≈ 111 km
  const is = drawn ? " is-drawn" : "";

  // Five layers, in the map's old paint order: land and routes; travellers; pin glows; pulses; pins, labels,
  // compass and scale. What moves is an HTML box: an animated SVG child repaints the whole map on the main
  // thread every frame, a box animating translate, scale or opacity runs on the compositor.
  return (
    <>
      <svg
        viewBox={VIEWBOX}
        role="img"
        aria-label="Map of India marking the cities where ani won or organised hackathons"
        className={`wins-map ws-map h-auto w-full${is}`}
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
          <linearGradient id="ws-grid-fade-g" gradientUnits="userSpaceOnUse" x1="40" x2="130" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
          <mask id="ws-grid-fade" maskUnits="userSpaceOnUse" x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h}>
            <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill="url(#ws-grid-fade-g)" />
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

        {/* graticule: the lines fade out on the west, where the numeral and the girl stand (.ws-grid-lines);
            the parallels are labelled on the east edge, clear of both */}
        <g className="wm-grid" fill="currentColor">
          <g className="ws-grid-lines" stroke="currentColor" mask="url(#ws-grid-fade)">
            {lons.map((lon) => (
              <line key={lon} x1={lonX(lon)} x2={lonX(lon)} y1={-10} y2={h + 10} />
            ))}
            {lats.map((lat) => (
              <line key={lat} y1={latY(lat)} y2={latY(lat)} x1={-10} x2={w + 10} />
            ))}
            <line className="wm-tropic" y1={latY(23.44)} y2={latY(23.44)} x1={-10} x2={w + 10} />
          </g>
          {lons.map((lon) => (
            <text key={lon} x={lonX(lon)} y={h + 26} textAnchor="middle" className={lon === lons[0] ? "ws-grid-west" : undefined}>
              {lon}°E
            </text>
          ))}
          {lats.map((lat) => (
            <text key={lat} x={w + 8} y={latY(lat) - 5} textAnchor="end" className="ws-lat">
              {lat}°N
            </text>
          ))}
          <text x={w + 8} y={latY(23.44) - 6} textAnchor="end" className="wm-note">
            Tropic of Cancer
          </text>
        </g>

        <text x={lonX(82.5)} y={latY(6.4)} textAnchor="middle" className="ws-sea">
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
          {ROUTES.map((c, i) => {
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
              </g>
            );
          })}
        </g>
      </svg>

      <div className={`ws-map wm-fx${is}`} aria-hidden="true">
        <style>{FLIGHTS}</style>
        {ROUTES.map((c, i) => (
          <i
            key={c}
            className="wm-traveller"
            style={{
              left: cq(-VIEW.x - 3.2),
              top: cq(-VIEW.y - 3.2),
              width: cq(6.4),
              animation: `wm-flight-${i} ${3.2 + i * 0.35}s linear ${i * 0.4}s infinite backwards`,
            }}
          >
            <svg viewBox="-3.2 -3.2 6.4 6.4">
              <circle r="2.6" />
            </svg>
          </i>
        ))}
      </div>

      <svg viewBox={VIEWBOX} className={`wins-map ws-map wm-over wm-glows${is}`} aria-hidden="true">
        {CITIES.map((c) => {
          const p = pinOf(c, counts);
          return (
            <g key={c} transform={`translate(${p.x} ${p.y})`} style={p.pop}>
              <g className="ws-pop">
                <circle r={p.r + 13} className="ws-pin-glow" fill="url(#ws-pin-glow)" />
              </g>
            </g>
          );
        })}
      </svg>

      <div className={`ws-map wm-fx${is}`} aria-hidden="true">
        {CITIES.map((c) => {
          const p = pinOf(c, counts);
          const R = p.r + 7;
          return (
            <span key={c} className="ws-pop" style={{ ...p.pop, left: cq(p.x - VIEW.x - R), top: cq(p.y - VIEW.y - R), width: cq(2 * R) }}>
              <span className={`wm-halo ${active === c ? "is-on" : ""}`}>
                <svg viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`}>
                  <circle r={R} />
                </svg>
              </span>
            </span>
          );
        })}
      </div>

      <svg viewBox={VIEWBOX} className={`wins-map ws-map wm-over${is}`} aria-hidden="true">
        {/* cities */}
        {CITIES.map((c) => {
          const { x, y, n, r, pop } = pinOf(c, counts);
          const on = active === c;
          const [lx, ly, anchor] = LABEL[c] ?? [1, 0, "start"];
          return (
            <g
              key={c}
              className={`wm-city ${on ? "is-on" : ""}`}
              transform={`translate(${x} ${y})`}
              style={pop}
              onPointerEnter={(e) => e.pointerType === "mouse" && onCity(c)}
              onPointerLeave={(e) => e.pointerType === "mouse" && onCity("")}
              onClick={() => onCity(c)}
            >
              <g className="ws-pop">
                <circle r={r + 12} className="ws-hit" />
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

        {/* compass rose, out in the Bay of Bengal */}
        <g transform="translate(392 418)" className="ws-compass" aria-hidden="true">
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

        {/* scale bar, east of the Andaman and Nicobar Islands */}
        <g transform={`translate(${w - km500 + 28} ${h - 24})`} className="wm-scale">
          <rect width={km500 / 2} height="4" fill="currentColor" />
          <rect x={km500 / 2} width={km500 / 2} height="4" fill="none" stroke="currentColor" />
          <text y="-7">0</text>
          <text x={km500} y="-7" textAnchor="end">
            500 km
          </text>
        </g>
      </svg>
    </>
  );
}

type Tier = "gold" | "silver" | "bronze" | "track" | "host";
const tierOf = (prize: string, host: boolean): Tier =>
  host
    ? "host"
    : /1st/i.test(prize)
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
        <span>
          <Numeral n={WINS.length} />
        </span>
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
        <span>
          <Numeral n={WINS.length} ghost />
        </span>
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

/** The wins by year, newest first (WINS runs newest first within a year), then any not yet dated. */
const YEARS = [...new Set(WINS.map((w) => w.year ?? 0))]
  .sort((a, b) => b - a)
  .map((year) => ({ year: year || null, wins: WINS.filter((w) => (w.year ?? 0) === year) }));

export function Wins() {
  const root = useRef<HTMLElement>(null);
  // One win is active at a time: the one under the mouse, else the one with keyboard focus, else the one
  // tapped on a touch screen (a tap elsewhere lets it go). Its city lights on the map. A city pointed at
  // on the map lights only the map.
  const [hovered, setHovered] = useState("");
  const [focused, setFocused] = useState("");
  const [picked, setPicked] = useState("");
  const [pin, setPin] = useState("");
  const tapped = useRef(false);
  const activeKey = hovered || focused || picked;
  const active = activeKey ? (CITY_OF.get(activeKey) ?? "") : pin;

  useEffect(() => {
    if (!picked && !pin) return;
    const away = (e: PointerEvent) => {
      if ((e.target as Element).closest?.(".ws-row, .wm-city")) return;
      setPicked("");
      setPin("");
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [picked, pin]);

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

  const row = (w: Win, host = false) => {
    const key = keyOf(w);
    const tier = tierOf(w.prize, host);
    // a win sits under its year, so it gives its month; an organised one carries its year
    const date = host ? [w.month, w.year].filter(Boolean).join(" ") : w.month;
    const when = [date, w.online && "online"].filter(Boolean).join(" · ");
    const drop = (set: typeof setHovered) => set((k) => (k === key ? "" : k));
    return (
      <li key={key}>
        <button
          type="button"
          onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(key)}
          onPointerLeave={(e) => e.pointerType === "mouse" && drop(setHovered)}
          onPointerDown={(e) => (tapped.current = e.pointerType !== "mouse")}
          onClick={() => {
            if (tapped.current) setPicked((k) => (k === key ? "" : key));
            tapped.current = false;
          }}
          onFocus={(e) => e.currentTarget.matches(":focus-visible") && setFocused(key)}
          onBlur={() => drop(setFocused)}
          data-on={activeKey === key ? "" : undefined}
          className="ws-row"
        >
          <Medal tier={tier} />
          <span className="ws-event">{w.event}</span>
          <span className="ws-built">{w.built}</span>
          <span className="ws-venue">
            <svg viewBox="0 0 12 16" aria-hidden="true">
              <path d="M6 15.2 C6 15.2 11 9.6 11 6 A5 5 0 0 0 1 6 C1 9.6 6 15.2 6 15.2 Z" />
              <circle cx="6" cy="6" r="1.9" />
            </svg>
            <span>{w.venue}</span>
            {when && <span className="ws-when">{when}</span>}
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
              Nine cities and a lot of train rides, newest first.{" "}
              <span className="ws-hover-copy">Hover a win to see where it happened.</span>
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
              <Trophy active={active} counts={counts} onCity={setPin} />
            </DepthStage>
            <p className="ws-legend">
              <span>Dot size is wins per city; the dashed ring marks a hackathon I organised.</span> Map: Natural Earth.
            </p>
          </div>

          <div className="ws-list" data-reveal style={{ "--d": "140ms" } as CSSProperties}>
            {YEARS.map(({ year, wins }) => (
              <section key={year ?? "undated"} className="ws-year" data-undated={year ? undefined : ""} aria-labelledby={`ws-y-${year ?? "undated"}`}>
                <h3 id={`ws-y-${year ?? "undated"}`} className="ws-year-head">
                  <span className="ws-year-n">{year ?? "Undated"}</span>
                  <span className="ws-year-count">
                    {wins.length} {wins.length === 1 ? "win" : "wins"}
                  </span>
                </h3>
                <ol>{wins.map((w) => row(w))}</ol>
              </section>
            ))}
            <h3 className="ws-sub">Organised</h3>
            <ol>{HOSTED.map((w) => row(w, true))}</ol>
          </div>
        </div>
      </section>
      <Seam kind="cloud-fall" from="var(--blush)" to="var(--bg)" art={SEAM_ART["cloud-fall"]} />
    </>
  );
}
