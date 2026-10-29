import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { DepthStage, useDepthLayer } from "@/components/depth-stage";
import { STRENGTH } from "@/lib/depth/camera";
import type { StageSpec } from "@/lib/depth/types";
import { kick } from "@/lib/scroll-loop";

type Agent = {
  id: string;
  name: string;
  role: "Duelist" | "Initiator" | "Sentinel";
  line: string;
  colors: [string, string];
  abilities: { slot: string; name: string }[];
};

const AGENTS: Agent[] = [
  {
    id: "jett",
    name: "Jett",
    role: "Duelist",
    line: "Dash in, ship the thing, gone before the design review.",
    colors: ["#25607a", "#0b0b0d"],
    abilities: [
      { slot: "grenade", name: "Cloudburst" },
      { slot: "ability1", name: "Updraft" },
      { slot: "ability2", name: "Tailwind" },
      { slot: "ultimate", name: "Blade Storm" },
    ],
  },
  {
    id: "sova",
    name: "Sova",
    role: "Initiator",
    line: "Recon dart first. Reading the docs, basically.",
    colors: ["#355285", "#101c47"],
    abilities: [
      { slot: "grenade", name: "Owl Drone" },
      { slot: "ability1", name: "Shock Bolt" },
      { slot: "ability2", name: "Recon Bolt" },
      { slot: "ultimate", name: "Hunter's Fury" },
    ],
  },
  {
    id: "killjoy",
    name: "Killjoy",
    role: "Sentinel",
    line: "Why hold the site yourself when the turret can? Automate everything.",
    colors: ["#522162", "#2a1f38"],
    abilities: [
      { slot: "grenade", name: "Nanoswarm" },
      { slot: "ability1", name: "Alarmbot" },
      { slot: "ability2", name: "Turret" },
      { slot: "ultimate", name: "Lockdown" },
    ],
  },
  {
    id: "cypher",
    name: "Cypher",
    role: "Sentinel",
    line: "Knows where every edge case hides. Tripwire on all of them.",
    colors: ["#2f5078", "#24244a"],
    abilities: [
      { slot: "grenade", name: "Trapwire" },
      { slot: "ability1", name: "Cyber Cage" },
      { slot: "ability2", name: "Spycam" },
      { slot: "ultimate", name: "Neural Theft" },
    ],
  },
];

const src = (file: string) => `/lobby/val/${file}.webp`;

/**
 * The stage on the site camera (worlds strength): the outline name hangs
 * behind at 16, the HUD sits on the glass at 12.5 and the agent stands
 * forward at 11.5, all shifting against the pointer by 1/d.
 */
const STAGE: StageSpec = { id: "valorant", plates: [], camera: { strength: STRENGTH.world } };
const D = { name: 16, hud: 12.5, agent: 11.5 } as const;

function Layer({ d, className, style, children }: { d: number; className: string; style?: CSSProperties; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, d);
  return (
    <div ref={ref} className={className} style={style} aria-hidden="true">
      {children}
    </div>
  );
}

function StageLayer({ agent, wipe }: { agent: Agent; wipe?: boolean }) {
  const portrait = useRef<HTMLImageElement>(null);
  useDepthLayer(portrait, D.agent);
  const style = { "--vl-a": agent.colors[0], "--vl-b": agent.colors[1] } as CSSProperties;
  const word = agent.name.toUpperCase();
  return (
    <div className={`vl-layer ${wipe ? "vl-wipe" : ""}`} style={style} aria-hidden={wipe ? undefined : true}>
      <div className="vl-field" />
      <div className="vl-seam" />
      <img className="vl-texture" src={src(`${agent.id}-bg`)} alt="" width={700} height={1024} decoding="async" />
      <Layer d={D.name} className="vl-bigname" style={{ "--vl-len": word.length } as CSSProperties}>
        <span>{word}</span>
      </Layer>
      <img
        ref={portrait}
        className="vl-portrait"
        src={src(agent.id)}
        alt={wipe ? `${agent.name}, full portrait` : ""}
        width={2048}
        height={1860}
        decoding="async"
      />
    </div>
  );
}

const BRACKETS = ["tl", "tr", "br", "bl"] as const;

function Brackets() {
  return (
    <div className="vl-brackets">
      {BRACKETS.map((c) => (
        <svg key={c} className={`vl-bracket vl-bracket-${c}`} width="96" height="96" viewBox="0 0 96 96" shapeRendering="crispEdges">
          <path d="M1 56V13L13 1h43" fill="none" stroke="currentColor" strokeWidth="2" shapeRendering="geometricPrecision" />
          <path d="M8 40V16L16 8h24" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" shapeRendering="geometricPrecision" />
          {[64, 70, 76, 82, 88].map((x, i) => (
            <rect key={x} x={x} y="0" width="1" height={i === 0 ? 6 : 3} fill="currentColor" fillOpacity={i === 0 ? 0.9 : 0.5} />
          ))}
          {[64, 70, 76, 82, 88].map((y, i) => (
            <rect key={y} x="0" y={y} width={i === 0 ? 6 : 3} height="1" fill="currentColor" fillOpacity={i === 0 ? 0.9 : 0.5} />
          ))}
          <rect x="20" y="20" width="4" height="4" fill="#ff4655" />
          <path d="M30 26h7M33.5 22.5v7" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1" />
        </svg>
      ))}
    </div>
  );
}

function Divider() {
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
}

function Ladder() {
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
}

function HazardPlate() {
  return (
    <svg className="vl-plate" width="232" height="36" viewBox="0 0 232 36" aria-hidden="true">
      <defs>
        <clipPath id="vl-plate-clip">
          <path d="M10 4h178l-10 28H0z" />
        </clipPath>
      </defs>
      <path d="M10 4h178l-10 28H0z" fill="#0b0b0d" className="vl-ko" fillOpacity="0.9" />
      <g clipPath="url(#vl-plate-clip)">
        <g className="vl-plate-stripes">
          {Array.from({ length: 22 }, (_, i) => (
            <path key={i} d={`M${i * 16 - 32} 36l14-32h7l-14 32z`} fill="#ff4655" />
          ))}
        </g>
      </g>
      <path d="M10 4h178l-10 28H0z" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M196 4h8l-10 28h-8zM210 4h4l-10 28h-4z" fill="#0b0b0d" className="vl-ko vl-plate-chip" />
      <path d="M222 4v6M222 26v6M219 4h6M219 32h6" stroke="currentColor" strokeOpacity="0.6" shapeRendering="crispEdges" />
    </svg>
  );
}

const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)].map((n) => +n.toFixed(2));
};
const wedge = (from: number, to: number, r = 78) => {
  const [x1, y1] = polar(r, from);
  const [x2, y2] = polar(r, to);
  return `M100 100L${x1} ${y1}A${r} ${r} 0 0 1 ${x2} ${y2}Z`;
};
const BLIPS = [
  { deg: 52, r: 56 },
  { deg: 148, r: 34 },
  { deg: 236, r: 64 },
];

function Radar() {
  const [lx, ly] = polar(78, 0);
  return (
    <svg className="vl-radar" viewBox="0 0 200 200" aria-hidden="true">
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
      <g className="vl-sweep">
        {[0.06, 0.1, 0.15, 0.22].map((o, i) => (
          <path key={o} d={wedge(-56 + i * 12, -44 + i * 12)} fill="#ff4655" fillOpacity={o} />
        ))}
        <path d={wedge(-8, 0)} fill="#ff4655" fillOpacity="0.32" />
        <path d={`M100 100L${lx} ${ly}`} stroke="#ff4655" strokeWidth="2" />
      </g>
      {BLIPS.map((b) => {
        const [x, y] = polar(b.r, b.deg);
        return (
          <g key={b.deg} className="vl-blip" style={{ "--vl-delay": `${(b.deg / 360) * 4}s` } as CSSProperties}>
            <rect x={x - 3.5} y={y - 3.5} width="7" height="7" transform={`rotate(45 ${x} ${y})`} fill="#ff4655" />
            <circle cx={x} cy={y} r="8" fill="none" stroke="#ff4655" strokeOpacity="0.6" />
          </g>
        );
      })}
      <circle className="vl-spike-ring" cx="100" cy="100" r="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M100 89l7 11-7 11-7-11z" fill="currentColor" />
      <path d="M100 94l3.5 6-3.5 6-3.5-6z" fill="#ff4655" />
    </svg>
  );
}

export function Valorant() {
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [swap, setSwap] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const agent = AGENTS[index];

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    el.classList.add("vl-js");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("vl-in");
        for (const a of AGENTS) new Image().src = src(a.id);
        io.disconnect();
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (swap) kick();
  }, [swap]);

  const select = (i: number) => {
    if (i === index) return;
    setPrev(index);
    setIndex(i);
    setSwap((n) => n + 1);
  };

  const onTileKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (i + step + AGENTS.length) % AGENTS.length;
    tileRefs.current[next]?.focus();
    select(next);
  };

  return (
    <section
      id="valorant"
      ref={sectionRef}
      aria-labelledby="vl-title"
      data-world="valorant"
      className="vl relative isolate overflow-hidden bg-[#0b0b0d] text-[#f4f2f0]"
    >
      <div className="vl-hazard" aria-hidden="true">
        <div />
      </div>

      <div className="vl-grid">
        <header className="vl-head vl-enter px-[var(--vl-pad)] pt-10 lg:pt-0">
          <h2 id="vl-title" className="vl-display vl-title text-[clamp(52px,4.8vw,80px)] leading-[0.9] text-[#ff4655]">
            My agent pool
          </h2>
          <p className="vl-muted mt-5 max-w-[34ch] text-[18px] leading-[1.5] text-white/70">
            The four I pick when I want to be useful to the team without having to aim very well.
          </p>
        </header>

        <DepthStage spec={STAGE} className="vl-stage" aria-live="polite">
          {prev !== null && <StageLayer agent={AGENTS[prev]} />}
          <StageLayer key={`${agent.id}-${swap}`} agent={agent} wipe={swap > 0} />
          {swap > 0 && (
            <>
              <div key={`slash-${swap}`} className="vl-slash" aria-hidden="true" onAnimationEnd={() => setPrev(null)} />
              {/* one tracer across the stage with the slash: the select "shot", anchored to the stage */}
              <div key={`tracer-${swap}`} className="vl-tracer" aria-hidden="true">
                <span />
              </div>
            </>
          )}
          <Layer d={D.hud} className="vl-hud">
            <Brackets />
            <Radar />
            <Ladder />
            <HazardPlate />
          </Layer>
        </DepthStage>

        <div className="vl-info px-[var(--vl-pad)]">
          <Divider />
          <div key={agent.id} className="vl-swap">
            <p className="vl-muted flex items-center gap-3 text-[16px] font-semibold text-white/70">
              <span className="grid size-8 place-items-center bg-[#ff4655]">
                <img src={src(`role-${agent.role.toLowerCase()}`)} alt="" width={128} height={128} decoding="async" className="size-5 brightness-0" />
              </span>
              {agent.role}
            </p>
            <h3 className="vl-display mt-3 text-[clamp(72px,7vw,120px)] leading-[0.84]">{agent.name}</h3>
            <p className="vl-strong mt-4 max-w-[30ch] text-[20px] leading-[1.4] font-medium text-white">{agent.line}</p>
            <ul className="mt-7 grid max-w-[520px] grid-cols-2 gap-x-4 gap-y-3 min-[480px]:grid-cols-4 min-[480px]:gap-3" aria-label={`${agent.name} abilities`}>
              {agent.abilities.map((a) => (
                <li key={a.slot} className="flex items-center gap-3 min-[480px]:flex-col min-[480px]:items-start min-[480px]:gap-2">
                  <span className="vl-ability grid aspect-square w-12 shrink-0 place-items-center min-[480px]:w-full min-[480px]:max-w-16 border border-white/12 bg-[#17171b]">
                    <img src={src(`${agent.id}-${a.slot}`)} alt="" width={128} height={128} decoding="async" className="vl-ability-icon w-[58%]" />
                  </span>
                  <span className="vl-muted text-[16px] leading-[1.2] font-medium text-white/70">{a.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="vl-tiles px-[var(--vl-pad)]" role="group" aria-label="Choose an agent">
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {AGENTS.map((a, i) => (
              <div key={a.id} className="vl-cell">
                <button
                  ref={(el) => {
                    tileRefs.current[i] = el;
                  }}
                  type="button"
                  aria-pressed={i === index}
                  onClick={() => select(i)}
                  onKeyDown={(e) => onTileKey(e, i)}
                  className="vl-tile group"
                >
                  <img src={src(`${a.id}-icon`)} alt="" width={512} height={512} loading="lazy" decoding="async" className="vl-tile-img" />
                  <span className="vl-display vl-tile-name">{a.name}</span>
                </button>
                {/* agent-select lock-on: four L-marks close in on the hovered or focused tile */}
                <span className="vl-marks" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
