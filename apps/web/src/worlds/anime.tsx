import { useEffect, useRef, useState, type CSSProperties } from "react";

import { DepthStage, useDepthLayer } from "@/components/depth-stage";
import { STRENGTH } from "@/lib/depth/camera";
import type { StageSpec } from "@/lib/depth/types";

type Corner = "tl" | "tr" | "bl" | "br";
type Pt = [number, number];

type Show = {
  id: string;
  title: string;
  native: string;
  year: number;
  eps: number;
  score: number;
  img: string;
  line: string;
  sfx: string;
  sfxVertical?: boolean;
  /** Riso: black ink, or the one spot ink (Riso Blue) */
  sfxFill: "ink" | "spot";
  variant: "tall" | "wide" | "narrow";
  side: "left" | "right";
  bubble: "round" | "burst";
  tail: number;
  tone: Corner;
  shape: Pt[];
  tilt: number;
  tiltSm: number;
};

const SQUARE: Pt[] = [[0, 0], [100, 0], [100, 100], [0, 100]];

const SHOWS: Show[] = [
  {
    id: "sg",
    title: "Steins;Gate",
    native: "シュタインズ・ゲート",
    year: 2011,
    eps: 24,
    score: 89,
    img: "steins-gate",
    line: "I debug time itself, one world line at a time.",
    sfx: "ゴゴゴ",
    sfxVertical: true,
    sfxFill: "ink",
    variant: "tall",
    side: "left",
    bubble: "round",
    tail: 150,
    tone: "br",
    shape: SQUARE,
    tilt: 0,
    tiltSm: -0.8,
  },
  {
    id: "hxh",
    title: "Hunter × Hunter",
    native: "ハンター×ハンター",
    year: 2011,
    eps: 148,
    score: 89,
    img: "hxh",
    line: "Nen is just TypeScript generics with better marketing.",
    sfx: "ガッ",
    sfxFill: "spot",
    variant: "narrow",
    side: "left",
    bubble: "burst",
    tail: 160,
    tone: "tr",
    shape: SQUARE,
    tilt: 0,
    tiltSm: 0.9,
  },
  {
    id: "mob",
    title: "Mob Psycho 100",
    native: "モブサイコ100",
    year: 2016,
    eps: 12,
    score: 84,
    img: "mob",
    line: "Stays humble while being the strongest in the room. Relatable.",
    sfx: "ドドド",
    sfxFill: "ink",
    variant: "narrow",
    side: "right",
    bubble: "round",
    tail: 30,
    tone: "bl",
    shape: SQUARE,
    tilt: 1.4,
    tiltSm: -0.9,
  },
  {
    id: "bebop",
    title: "Cowboy Bebop",
    native: "カウボーイビバップ",
    year: 1998,
    eps: 26,
    score: 86,
    img: "bebop",
    line: "The soundtrack ships my code faster. See you, space cowboy.",
    sfx: "バン！",
    sfxFill: "spot",
    variant: "wide",
    side: "left",
    bubble: "round",
    tail: 165,
    tone: "br",
    shape: SQUARE,
    tilt: -0.6,
    tiltSm: 0.8,
  },
  {
    id: "frieren",
    title: "Frieren",
    native: "葬送のフリーレン",
    year: 2023,
    eps: 28,
    score: 91,
    img: "frieren",
    line: "Collects useless spells the way I collect side projects. No regrets.",
    sfx: "シーン",
    sfxVertical: true,
    sfxFill: "ink",
    variant: "narrow",
    side: "left",
    bubble: "round",
    tail: 155,
    tone: "tr",
    shape: [[0, 0], [100, 0], [93, 100], [0, 100]],
    tilt: 0,
    tiltSm: -0.7,
  },
  {
    id: "jjk",
    title: "Jujutsu Kaisen",
    native: "呪術廻戦",
    year: 2020,
    eps: 24,
    score: 84,
    img: "jjk",
    line: "Domain expansion: my localhost, where every test passes.",
    sfx: "ズン",
    sfxFill: "spot",
    variant: "narrow",
    side: "right",
    bubble: "burst",
    tail: 20,
    tone: "bl",
    shape: [[7, 0], [100, 0], [100, 100], [0, 100]],
    tilt: 0,
    tiltSm: 0.8,
  },
];

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => Math.round(n * 10) / 10;

function smoothPath(pts: Pt[], corners: Set<number>) {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = corners.has(i) ? p1 : [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = corners.has((i + 1) % n) ? p2 : [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

const BW = 300;
const BH = 180;
const BC: Pt = [150, 90];

function offsetOutline(pts: Pt[], widths: number[]): Pt[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    let nx = b[1] - a[1];
    let ny = -(b[0] - a[0]);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    if (nx * (p[0] - BC[0]) + ny * (p[1] - BC[1]) < 0) {
      nx = -nx;
      ny = -ny;
    }
    return [p[0] + nx * widths[i], p[1] + ny * widths[i]];
  });
}

function bubbleGeometry(seed: number, kind: "round" | "burst", tailDeg: number) {
  const r = rng(seed);
  const ta = (tailDeg * Math.PI) / 180;
  const rx = 142;
  const ry = 84;
  const ink = (a: number) => 2.2 + 3.4 * (0.5 + 0.5 * Math.cos(a - Math.PI / 4)) + r() * 0.6;
  const pts: Pt[] = [];
  const widths: number[] = [];
  const corners = new Set<number>();

  if (kind === "round") {
    const s1 = r() * 6;
    const s2 = r() * 6;
    const wob = (a: number) => 1 + 0.02 * Math.sin(3 * a + s1) + 0.012 * Math.sin(5 * a + s2);
    const at = (a: number): Pt => [BC[0] + rx * wob(a) * Math.cos(a), BC[1] + ry * wob(a) * Math.sin(a)];
    const a0 = ta - 0.24;
    const a1 = ta + 0.13;
    const steps = 44;
    for (let i = 0; i < steps; i++) {
      const a = a1 + ((2 * Math.PI - (a1 - a0)) * i) / steps;
      pts.push(at(a));
      widths.push(ink(a));
    }
    const b0 = at(a0);
    const b1 = at(a1);
    const tip: Pt = [BC[0] + rx * 1.42 * Math.cos(ta + 0.1), BC[1] + ry * 1.78 * Math.sin(ta + 0.1)];
    const bend = (p: Pt, q: Pt, k: number): Pt => {
      const mx = (p[0] + q[0]) / 2;
      const my = (p[1] + q[1]) / 2;
      return [mx - (q[1] - p[1]) * k, my + (q[0] - p[0]) * k];
    };
    pts.push(b0, bend(b0, tip, 0.12));
    widths.push(ink(a0), 2.4);
    corners.add(pts.length);
    pts.push(tip, bend(tip, b1, 0.1));
    widths.push(0.7, 1.8);
  } else {
    const spikes = 17;
    let longest = 0;
    let best = Infinity;
    for (let i = 0; i < spikes; i++) {
      const a = (2 * Math.PI * i) / spikes;
      const diff = Math.abs(Math.atan2(Math.sin(a - ta), Math.cos(a - ta)));
      if (diff < best) {
        best = diff;
        longest = i;
      }
    }
    for (let i = 0; i < spikes; i++) {
      const a = (2 * Math.PI * i) / spikes + (r() - 0.5) * 0.12;
      const reach = i === longest ? 1.4 : 1.02 + r() * 0.12;
      corners.add(pts.length);
      pts.push([BC[0] + rx * reach * Math.cos(a), BC[1] + ry * reach * Math.sin(a)]);
      widths.push(ink(a) * 0.8);
      const m = a + Math.PI / spikes + (r() - 0.5) * 0.08;
      const dip = 0.8 + r() * 0.05;
      corners.add(pts.length);
      pts.push([BC[0] + rx * dip * Math.cos(m), BC[1] + ry * dip * Math.sin(m)]);
      widths.push(ink(m));
    }
  }

  const outer = offsetOutline(pts, widths);
  const inner = smoothPath(pts, corners);
  return { inner, ring: `${smoothPath(outer, corners)}${inner}` };
}

function focusLines(seed: number) {
  const r = rng(seed);
  const cx = 200;
  const cy = 150;
  const R = 540;
  let wedges = "";
  const count = 150;
  for (let i = 0; i < count; i++) {
    const a = (2 * Math.PI * i) / count + (r() - 0.5) * 0.045;
    const w = 0.004 + r() * r() * 0.034;
    const rin = r() < 0.2 ? 48 + r() * 30 : 82 + r() * 96;
    wedges += `M${f(cx + rin * Math.cos(a))} ${f(cy + rin * Math.sin(a))}L${f(cx + R * Math.cos(a - w))} ${f(cy + R * Math.sin(a - w))}L${f(cx + R * Math.cos(a + w))} ${f(cy + R * Math.sin(a + w))}Z`;
  }
  const rush: { x1: number; y1: number; x2: number; y2: number; d: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const a = r() * Math.PI * 2;
    const rin = 120 + r() * 80;
    rush.push({
      x1: f(cx + 470 * Math.cos(a)),
      y1: f(cy + 470 * Math.sin(a)),
      x2: f(cx + rin * Math.cos(a)),
      y2: f(cy + rin * Math.sin(a)),
      d: f(r() * -0.6),
    });
  }
  return { wedges, rush };
}

const TONE_STEPS = 12;
const toneRadius = (i: number) => 0.32 + i * 0.32;

const BUBBLES = Object.fromEntries(SHOWS.map((s, i) => [s.id, bubbleGeometry(41 + i * 13, s.bubble, s.tail)]));
const LINES = Object.fromEntries(SHOWS.map((s, i) => [s.id, focusLines(7 + i * 31)]));
const TITLE_LINES = focusLines(99);

function Defs() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <defs>
        {(["ink", "spot"] as const).flatMap((c) =>
          Array.from({ length: TONE_STEPS }, (_, i) => {
            const rad = toneRadius(i);
            return (
              <pattern key={`${c}${i}`} id={`an-${c}-${i}`} width="7" height="7" patternUnits="userSpaceOnUse">
                <g className={c === "ink" ? "an-fill-ink" : "an-fill-spot"}>
                  <circle cx="0" cy="0" r={rad} />
                  <circle cx="7" cy="0" r={rad} />
                  <circle cx="0" cy="7" r={rad} />
                  <circle cx="7" cy="7" r={rad} />
                  <circle cx="3.5" cy="3.5" r={rad} />
                </g>
              </pattern>
            );
          }),
        )}
        <filter id="an-grain-f">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.1  0 0 0 0 0.08  0 0 0 0 0.05  0 0 0 0.55 0" />
        </filter>
      </defs>
    </svg>
  );
}

function Tone({ corner, color, size, max = TONE_STEPS }: { corner: Corner; color: "ink" | "spot"; size: number; max?: number }) {
  const span = size * 1.42;
  const bw = span / TONE_STEPS;
  return (
    <svg aria-hidden="true" className={`an-tone an-tone-${corner}`} width={size} height={size}>
      <g transform={`translate(${size} ${size}) rotate(225)`}>
        {Array.from({ length: TONE_STEPS }, (_, i) => (
          <rect
            key={i}
            x={f(i * bw)}
            y={-size}
            width={f(bw + 0.6)}
            height={size * 2}
            fill={`url(#an-${color}-${Math.max(0, max - 1 - i)})`}
          />
        ))}
      </g>
    </svg>
  );
}

function FocusLines({ id, className = "" }: { id: string; className?: string }) {
  const { wedges, rush } = id === "title" ? TITLE_LINES : LINES[id];
  return (
    <svg aria-hidden="true" className={`an-lines ${className}`} viewBox="0 0 400 300" preserveAspectRatio="none">
      <path className="an-wedges" d={wedges} />
      <g className="an-rush">
        {rush.map(({ d, ...l }, i) => (
          <line key={i} {...l} pathLength={1} style={{ animationDelay: `${d}s` }} />
        ))}
      </g>
    </svg>
  );
}

function Sfx({ text, vertical, fill }: { text: string; vertical?: boolean; fill: "ink" | "spot" }) {
  const chars = [...text];
  const r = rng(text.length * 97 + text.charCodeAt(0));
  const w = vertical ? 140 : chars.length * 100 + 40;
  const h = vertical ? chars.length * 100 + 40 : 140;
  const glyphs = chars.map((c, i) => {
    const x = vertical ? 70 : 70 + i * 100;
    const y = vertical ? 70 + i * 100 : 70;
    const rot = (r() - 0.5) * 16 + (vertical && c === "ー" ? 90 : 0);
    const s = 0.9 + r() * 0.24;
    return { c, t: `translate(${x} ${y}) rotate(${f(rot)}) scale(${f(s * 100) / 100})` };
  });
  const layer = (cls: string) =>
    glyphs.map((g, i) => (
      <text key={i} transform={g.t} className={cls} x="0" y="36" textAnchor="middle">
        {g.c}
      </text>
    ));
  return (
    <svg
      aria-hidden="true"
      className="an-sfx"
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: `${w / 100}em`, height: `${h / 100}em` }}
    >
      {layer("an-sfx-out")}
      {layer("an-sfx-rim")}
      {layer(fill === "spot" ? "an-sfx-spot" : "an-sfx-ink")}
    </svg>
  );
}

function Border({ shape, seed }: { shape: Pt[]; seed: number }) {
  const r = rng(seed);
  return (
    <svg aria-hidden="true" className="an-border">
      {shape.map((p, e) => {
        const q = shape[(e + 1) % shape.length];
        return (
          <line
            key={e}
            className="an-edge"
            x1={`${p[0]}%`}
            y1={`${p[1]}%`}
            x2={`${q[0]}%`}
            y2={`${q[1]}%`}
            pathLength={1}
            strokeWidth={f((e % 2 ? 3.6 : 4.6) + r() * 0.8)}
            style={{ "--e": e } as CSSProperties}
          />
        );
      })}
    </svg>
  );
}

const clip = (shape: Pt[]) => `polygon(${shape.map(([x, y]) => `${x}% ${y}%`).join(", ")})`;

/**
 * Each panel is its own camera on the worlds strength: the frame stays rigid
 * and the art inside it pans ±10 px with scroll, at a distance per panel so
 * neighbours drift against each other. Scroll only: no pointer, breath or
 * arrival, so the page itself never floats.
 */
const PAN_DEPTH = [12, 14.5, 11.5, 15, 11, 14];
const PANEL_STAGES: StageSpec[] = SHOWS.map((s) => ({
  id: `anime-${s.id}`,
  plates: [],
  camera: { strength: STRENGTH.world, pointer: 0, breath: 0, arrival: { z: 0, ms: 0 } },
}));

function Poster({ show, d }: { show: Show; d: number }) {
  const ref = useRef<HTMLElement>(null);
  useDepthLayer(ref, d);
  return (
    <figure ref={ref} className="an-poster">
      <img src={`/lobby/anime/${show.img}.webp`} alt={`${show.title} cover art`} width={460} height={650} loading="lazy" decoding="async" />
    </figure>
  );
}

function Panel({ show, index, active, onTap }: { show: Show; index: number; active: boolean; onTap: () => void }) {
  const bubble = BUBBLES[show.id];
  const polygon = clip(show.shape);
  return (
    <article
      tabIndex={0}
      data-panel={show.id}
      data-active={active || undefined}
      onPointerUp={(e) => e.pointerType !== "mouse" && onTap()}
      className={`an-panel an-v-${show.variant} an-side-${show.side}`}
      style={
        {
          gridArea: show.id,
          "--i": index + 1,
          "--tilt": `${show.tilt}deg`,
          "--tilt-sm": `${show.tiltSm}deg`,
        } as CSSProperties
      }
    >
      <div aria-hidden="true" className="an-spot" style={{ clipPath: polygon }} />
      <DepthStage spec={PANEL_STAGES[index]} className="an-cell" style={{ clipPath: polygon }}>
        <Tone corner={show.tone} color="ink" size={340} />
        <Tone corner={(show.tone[0] === "t" ? "b" : "t") + (show.tone[1] === "l" ? "r" : "l") as Corner} color="spot" size={210} max={8} />
        <FocusLines id={show.id} />
        <Poster show={show} d={PAN_DEPTH[index]} />
        <div className="an-caption">
          <h3 className="an-caption-title">{show.title}</h3>
          <p lang="ja" className="an-caption-ja">
            {show.native}
          </p>
          <p className="an-caption-meta">
            {show.year} · {show.eps} episodes · {show.score}%
          </p>
        </div>
      </DepthStage>
      <Border shape={show.shape} seed={index * 11 + 3} />
      <div className={`an-bubble-wrap an-bubble-${show.bubble}`}>
        <div className="an-bubble">
          <svg aria-hidden="true" viewBox={`0 0 ${BW} ${BH}`} preserveAspectRatio="none">
            <path className="an-bubble-paper" d={bubble.inner} />
            <path className="an-bubble-ink" d={bubble.ring} fillRule="evenodd" />
          </svg>
          <p>{show.line}</p>
        </div>
      </div>
      <div className="an-sfx-wrap">
        <div className="an-sfx-hit">
          <Sfx text={show.sfx} vertical={show.sfxVertical} fill={show.sfxFill} />
        </div>
      </div>
    </article>
  );
}

const TITLE_SHAPE: Pt[] = [[0, 0], [100, 0], [100, 100], [0, 100]];

function TitlePanel() {
  return (
    <div className="an-panel an-title" style={{ gridArea: "t", "--i": 0 } as CSSProperties}>
      <div className="an-cell">
        <FocusLines id="title" className="an-lines-static" />
        <Tone corner="tr" color="spot" size={240} max={10} />
        <div className="relative z-[1] flex h-full flex-col justify-between gap-5 p-6 pr-14 sm:p-8 sm:pr-16">
          <div>
            <p className="an-kicker">Currently rewatching, again</p>
            <h2 id="anime-title" className="an-display">
              Watch
              <br />
              list
            </h2>
          </div>
          <p className="an-lede">
            Shows I rewatch instead of sleeping. Each one taught me something about shipping software, or
            that&rsquo;s my excuse.
          </p>
        </div>
        <p lang="ja" className="an-vertical">
          視聴リスト
        </p>
      </div>
      <Border shape={TITLE_SHAPE} seed={1} />
      <div className="an-sfx-wrap an-title-sfx">
        <div className="an-sfx-hit">
          <Sfx text="ドン！" fill="spot" />
        </div>
      </div>
    </div>
  );
}

function EdgeTone({ side }: { side: "top" | "bottom" }) {
  return (
    <svg aria-hidden="true" className={`an-edge-tone an-edge-${side}`} width="100%" height={TONE_STEPS * 7}>
      {Array.from({ length: TONE_STEPS }, (_, i) => (
        <rect key={i} x="0" y={i * 7} width="100%" height="7.4" fill={`url(#an-ink-${TONE_STEPS - 1 - i})`} />
      ))}
    </svg>
  );
}

/** The last panel's speed-line burst ends at about 2 s (anime.css): then the page is at rest. */
const ENTRANCE_MS = 2400;

export function AnimeWorld() {
  const ref = useRef<HTMLElement>(null);
  // armed: hidden, waiting; in: the page prints itself; done: at rest (the entrance's masks and fills are dropped)
  const [phase, setPhase] = useState<"static" | "armed" | "in" | "done">("static");
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    setPhase("armed");
    let done = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase("in");
          done = window.setTimeout(() => setPhase("done"), ENTRANCE_MS);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(done);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: none)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive((entry.target as HTMLElement).dataset.panel ?? null);
        }
      },
      { rootMargin: "-42% 0px -42% 0px" },
    );
    el.querySelectorAll("[data-panel]").forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, []);

  return (
    <section id="anime" ref={ref} data-world="anime" data-phase={phase} aria-labelledby="anime-title" className="an-world">
      <Defs />
      <EdgeTone side="top" />
      <svg aria-hidden="true" className="an-grain">
        <rect width="100%" height="100%" filter="url(#an-grain-f)" />
      </svg>
      <div className="relative mx-auto max-w-[1320px] px-5 py-28 sm:px-8 sm:py-32">
        <div className="an-grid">
          <TitlePanel />
          {SHOWS.map((show, i) => (
            <Panel
              key={show.id}
              show={show}
              index={i}
              active={active === show.id}
              onTap={() => setActive(show.id)}
            />
          ))}
        </div>
      </div>
      <EdgeTone side="bottom" />
    </section>
  );
}
