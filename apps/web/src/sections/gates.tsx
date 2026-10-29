import { useRef, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { DepthStage, useDepthLayer } from "@/components/depth-stage";
import type { StageSpec } from "@/lib/depth/types";
import { delay } from "@/lib/motion";
import { portal } from "@/lib/portal";
import "./gates.css";

/**
 * Off the clock: four doorways, each a small title card in its world's own
 * idiom (static SVG and CSS, nothing from the world chunks). The frame is
 * rigid; inside it the ground, motif, title and character sit on the site
 * camera, so each card reads as a window into the room behind it. A click
 * runs the portal (lib/portal.ts) into the world.
 */

const STAGE: StageSpec = { id: "gates", plates: [] };

/** Layer distances inside a card (PLAN §7 G2). */
const D = { ground: 16, motif: 13, title: 12, char: 10.5 };
/** Each card hangs at its own depth: its layers drift this many times the first card's. */
const HANG = [1, 0.85, 1.1, 0.95];
/** The distance that drifts `r` times as far as `d` does (drift ∝ 1 − 13/d). */
const hung = (d: number, r: number) => 13 / (1 - r * (1 - 13 / d));

const WORLDS = [
  { id: "teyvat", kind: "Genshin Impact", name: "Teyvat", label: "Teyvat, my Genshin Impact team" },
  { id: "valorant", kind: "Valorant", name: "Agent pool", label: "My Valorant agent pool" },
  { id: "anime", kind: "Anime", name: "視聴リスト", label: "My anime watch list" },
  { id: "bts", kind: "BTS", name: "Borahae", label: "Borahae, the BTS room" },
] as const;
type World = (typeof WORLDS)[number]["id"];

function Layer({ d, className, children }: { d: number; className: string; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, d);
  return (
    <div ref={ref} className={className} aria-hidden="true">
      {children}
    </div>
  );
}

/* ── Teyvat: the astrolabe ring, two circles, 72 ticks and four glyph dots ── */
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const a = (i / 72) * Math.PI * 2;
  const r0 = i % 6 ? 40.6 : 39.2;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return `M${(c * r0).toFixed(2)} ${(s * r0).toFixed(2)}L${(c * 43).toFixed(2)} ${(s * 43).toFixed(2)}`;
}).join("");

function Astrolabe() {
  return (
    <svg className="gate-astro" viewBox="-50 -50 100 100">
      <circle r="46" />
      <circle r="43" />
      <circle r="27" className="gate-astro-in" />
      <path d={TICKS} />
      {/* turned so no glyph lands on the card's text at any width */}
      {[75, 165, 255, 345].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return (
          <g key={deg} transform={`translate(${(Math.cos(a) * 46).toFixed(2)} ${(Math.sin(a) * 46).toFixed(2)})`}>
            <circle r="3.4" className="gate-astro-ring" />
            <circle r="1.5" className="gate-astro-dot" />
          </g>
        );
      })}
    </svg>
  );
}

/* ── Anime: 18 focus lines toward the poster ── */
const SPEED = Array.from({ length: 18 }, (_, i) => {
  const a = ((i * 20 + (i % 3) * 6 - 4) * Math.PI) / 180;
  const w = 0.016 + (i % 4) * 0.006;
  const [r0, r1] = [30 + (i % 5) * 5, 140];
  const pt = (r: number, da: number) => `${(Math.cos(a + da) * r).toFixed(2)} ${(Math.sin(a + da) * r).toFixed(2)}`;
  return `M${pt(r0, 0)}L${pt(r1, w)}L${pt(r1, -w)}Z`;
}).join("");

function Sfx({ text }: { text: string }) {
  return (
    <svg className="gate-sfx" viewBox="0 0 230 120">
      {(["out", "rim", "ink"] as const).map((k) => (
        <text key={k} x="12" y="98" className={`gate-sfx-${k}`}>
          {text}
        </text>
      ))}
    </svg>
  );
}

/** What each card holds on its four planes. */
const PLANES: Record<World, { ground: ReactNode; motif: ReactNode; char: ReactNode }> = {
  teyvat: {
    ground: <i className="gate-stripe" />,
    motif: (
      <>
        <Astrolabe />
        {[0, 1, 2].map((i) => (
          <i key={i} className="gate-leaf" data-l={i} />
        ))}
      </>
    ),
    char: <img src="/lobby/gi/furina-portrait.webp" alt="" width={909} height={1100} loading="lazy" decoding="async" />,
  },
  valorant: {
    ground: (
      <>
        <i className="gate-panel" />
        <i className="gate-slash" />
      </>
    ),
    motif: (
      <>
        <i className="gate-brk" data-c="tl" />
        <i className="gate-brk" data-c="tr" />
        <i className="gate-brk" data-c="bl" />
        <i className="gate-brk" data-c="br" />
        <i className="gate-ladder" />
        <i className="gate-scan" />
      </>
    ),
    char: <img src="/lobby/val/sova.webp" alt="" width={2048} height={1860} loading="lazy" decoding="async" />,
  },
  anime: {
    ground: <i className="gate-tone" />,
    motif: (
      <svg className="gate-speed" viewBox="-100 -100 200 200">
        <path d={SPEED} />
      </svg>
    ),
    char: (
      <>
        <img src="/lobby/anime/frieren.webp" alt="" width={460} height={649} loading="lazy" decoding="async" />
        <Sfx text="ドン" />
      </>
    ),
  },
  bts: {
    ground: <i className="gate-floor" />,
    motif: (
      <>
        <i className="gate-truss" />
        {[0, 1, 2].map((i) => (
          <i key={i} className="gate-beam" data-b={i} />
        ))}
        <i className="gate-haze" />
      </>
    ),
    // seven members, seven points of light: no photos
    char: (
      <span className="gate-lights">
        {Array.from({ length: 7 }, (_, i) => (
          <i key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </span>
    ),
  },
};

export function Gates() {
  const navigate = useNavigate();
  return (
    <section id="off-the-clock" className="gates">
      <div className="grid gap-10 lg:grid-cols-12">
        <h2 className="t-head lg:col-span-6" data-reveal>
          Off the clock
        </h2>
        <p className="max-w-[38ch] lg:col-span-4 lg:col-start-8 lg:self-end" data-reveal style={{ "--d": "80ms" } as CSSProperties}>
          Four worlds I'd rather be in when I'm not shipping. Each one gets its own room, its own colours and its
          own rules.
        </p>
      </div>
      <DepthStage spec={STAGE} className="gates-stage">
        <ul className="gates-list">
          {WORLDS.map((w, i) => {
            const r = HANG[i];
            const p = PLANES[w.id];
            return (
              <li key={w.id} data-reveal style={{ "--d": delay(i) } as CSSProperties}>
                <a href={`#${w.id}`} data-portal data-gate={w.id} onClick={(e) => portal(e, navigate)} className="gate">
                  <span className="gate-frame">
                    <Layer d={hung(D.ground, r)} className="gate-ground">
                      {p.ground}
                    </Layer>
                    <Layer d={D.motif} className="gate-motif">
                      {p.motif}
                    </Layer>
                    <Layer d={hung(D.title, r)} className="gate-title">
                      <span className="gate-kind">{w.kind}</span>
                      <span className="gate-name">{w.name}</span>
                    </Layer>
                    <Layer d={hung(D.char, r)} className="gate-char">
                      {p.char}
                    </Layer>
                  </span>
                  <span className="sr-only">{w.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </DepthStage>
    </section>
  );
}
