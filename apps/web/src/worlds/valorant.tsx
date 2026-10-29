import { useEffect, useRef, useState, type AnimationEvent, type CSSProperties, type KeyboardEvent } from "react";

import { DepthStage, useDepthLayer } from "@/components/depth-stage";
import { VALORANT_STAGE } from "@/lib/art";
import { STRENGTH } from "@/lib/depth/camera";
import type { PlateSpec, StageSpec } from "@/lib/depth/types";
import { reducedMotion } from "@/lib/motion";
import { kick } from "@/lib/scroll-loop";
import { AGENTS, type Ability, type Agent, type Key } from "./valorant/agents";
import { Brackets, Divider, HazardPlate, Ladder, MapTag, Radar } from "./valorant/hud";
import { Layer, SignatureLayer } from "./valorant/signatures";

const src = (file: string) => `/lobby/val/${file}.webp`;

/**
 * The stage on the site camera (worlds strength): the painted rooftop over
 * Ascent fills it, sky, city and parapet as their own plates. Where WebGL
 * is allowed the city and the parapet become reliefs on the composite depth
 * map (one range for both, so they assemble as one scene); elsewhere
 * they're flat cards at their planes.
 * In front of the painting: the agent's typography at 16, their trace on
 * the rooftop, the dust at 14, the HUD on the glass at 12.5 and the agent
 * forward at 11.5, all shifting against the camera by 1/d.
 */
const D = { sky: 40, far: 26, near: 17, crystals: 30, type: 16, air: 14, hud: 12.5, agent: 11.5 } as const;
const RANGE = { far: 40, near: 15 };

const [PW, PH] = VALORANT_STAGE.size;
const [HW, HH] = VALORANT_STAGE.halfSize;
type Roof = "sky" | "far" | "near";

function roof(id: Roof, extra: Pick<PlateSpec, "kind" | "range"> & Partial<PlateSpec>): PlateSpec {
  return {
    id,
    art: { night: VALORANT_STAGE.night[id], day: VALORANT_STAGE.day[id] },
    half: { night: VALORANT_STAGE.night[`${id}Half`], day: VALORANT_STAGE.day[`${id}Half`] },
    size: [PW, PH],
    // a placeholder: valorant.css sizes every plate to cover the stage with overscan (the <img> is object-fit: cover)
    box: { x: -6, y: -6, w: 112 },
    z: 0,
    ...extra,
  };
}

const RELIEF: PlateSpec["depth"] = {
  atlas: { night: VALORANT_STAGE.night.depthHalf, day: VALORANT_STAGE.day.depthHalf },
  tile: [0, 0, HW, HH],
};

const STAGE: StageSpec = {
  id: "valorant",
  plates: [
    roof("sky", { kind: "opaque", range: { far: D.sky, near: D.sky, flat: D.sky } }),
    roof("far", { kind: "cutout", range: { ...RANGE, flat: D.far }, depth: RELIEF }),
    roof("near", { kind: "cutout", range: { ...RANGE, flat: D.near }, depth: RELIEF }),
  ],
  // No idle breath and no GL sprites: either would keep the reliefs drawing every frame while nothing
  // moves (at worlds strength the breath shifts the city a pixel or two). Scroll, the pointer and the
  // arrival carry the depth; the dust, glints and signatures live on the compositor.
  camera: { strength: STRENGTH.world, breath: 0 },
};

/** The painting's crop and red wash, from the art job, as CSS variables on the stage. */
const { tint } = VALORANT_STAGE;
const [PX, PY] = VALORANT_STAGE.objectPosition.split(" ").map((s) => Number.parseFloat(s) / 100);
const ROOF_VARS = {
  "--vl-roof-pos": VALORANT_STAGE.objectPosition,
  "--vl-px": PX,
  "--vl-py": PY,
  "--vl-wash": `color-mix(in srgb, ${tint.color} ${tint.night * 100}%, transparent)`,
  "--vl-wash-day": `color-mix(in srgb, ${tint.color} ${tint.day * 100}%, transparent)`,
} as CSSProperties;

const v = (o: Record<string, string | number>) => o as CSSProperties;

/** Radianite on the painting's own crystals (% of the painting), and the vein that glows through the island. */
const CRYSTALS = [
  { x: 14.4, y: 15.6, dur: 9.7, delay: -2.1 },
  { x: 24.8, y: 9.2, dur: 12.3, delay: -7.4 },
  { x: 25.6, y: 27.4, dur: 15.1, delay: -11.8 },
  { x: 65, y: 16.8, dur: 11.2, delay: -4.6 },
  { x: 66.6, y: 24, dur: 13.9, delay: -9.3 },
  { x: 48, y: 35, dur: 10.6, delay: -0.8 },
];

function Crystals() {
  return (
    <Layer d={D.crystals} className="vl-frame vl-crystals">
      <div className="vl-cover">
        <span className="vl-vein" />
        {CRYSTALS.map((c) => (
          <span key={c.x} className="vl-glint" style={v({ "--x": `${c.x}%`, "--y": `${c.y}%`, "--dur": `${c.dur}s`, "--delay": `${c.delay}s` })} />
        ))}
      </div>
    </Layer>
  );
}

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const PERIODS = [13.7, 17.9, 23.1];

/** Dust turning in the agent's light shaft, behind them; never in front, so never over a face. */
const DUST = (() => {
  const r = seeded(29);
  return Array.from({ length: 16 }, (_, i) => ({
    x: +(-40 + r() * 80).toFixed(1),
    y: +(6 + r() * 86).toFixed(1),
    s: +(1.4 + r() * 1.8).toFixed(1),
    dx: Math.round(-18 + r() * 36),
    dy: Math.round(-30 - r() * 50),
    dur: PERIODS[i % 3] + +(r() * 2).toFixed(1),
    delay: -+(r() * 23).toFixed(1),
  }));
})();

function Air() {
  return (
    <Layer d={D.air} className="vl-air">
      <span className="vl-shaft" />
      {DUST.map((p, i) => (
        <span
          key={i}
          className="vl-dust"
          style={v({ "--x": `${p.x}%`, "--y": `${p.y}%`, "--s": `${p.s}px`, "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--dur": `${p.dur}s`, "--delay": `${p.delay}s` })}
        />
      ))}
    </Layer>
  );
}

type Phase = "rest" | "in" | "out";

/** An agent's light on the painting: a screened key glow and a multiplied shade, straight on the stage so they blend with it. */
function Light({ agent, phase }: { agent: Agent; phase: Phase }) {
  const l = agent.light;
  const style = v({ "--kx": `${l.key[0]}%`, "--ky": `${l.key[1]}%`, "--kr": `${l.r}%`, "--kg": l.glow, "--sa": `${l.from}deg`, "--sd": l.shade });
  return (
    <>
      <div className="vl-key" data-phase={phase} style={style} aria-hidden="true" />
      <div className="vl-shade" data-phase={phase} style={style} aria-hidden="true" />
    </>
  );
}

/** A cast: the agent's key light flares once where it falls. */
function Flare({ agent, onDone }: { agent: Agent; onDone: () => void }) {
  const l = agent.light;
  return (
    <div
      className="vl-flare"
      style={v({ "--kx": `${l.key[0]}%`, "--ky": `${l.key[1]}%`, "--kr": `${l.r}%` })}
      onAnimationEnd={onDone}
      aria-hidden="true"
    />
  );
}

function AgentLayer({ agent, phase, onSettle }: { agent: Agent; phase: Phase; onSettle?: () => void }) {
  const portrait = useRef<HTMLImageElement>(null);
  useDepthLayer(portrait, D.agent);
  const onEnd = (e: AnimationEvent) => {
    if (e.target === portrait.current) onSettle?.();
  };
  return (
    <div
      className="vl-agent"
      data-phase={phase}
      data-agent={agent.id}
      style={v({
        "--sx": `${agent.light.shaft}%`,
        "--st": `${agent.light.tilt}deg`,
        // the key's rim on the agent's edge that faces it
        "--rim-x": `${Math.sign(agent.light.key[0] - 50) * 2}px`,
        "--rim-y": `${agent.light.key[1] < 50 ? -1.5 : 1.5}px`,
      })}
      onAnimationEnd={onEnd}
    >
      <Layer d={D.type} className="vl-type">
        <img src={src(`${agent.id}-bg`)} alt="" width={700} height={1024} decoding="async" />
      </Layer>
      <SignatureLayer kind={agent.signature} />
      <Air />
      <img
        ref={portrait}
        className="vl-portrait"
        src={src(agent.id)}
        alt={phase === "out" ? "" : `${agent.name}, full portrait`}
        width={2048}
        height={1860}
        decoding="async"
      />
    </div>
  );
}

const KEYS: Key[] = ["C", "Q", "E", "X"];

/** The stage's feed, bottom right, the way the game reports a cast: newest last, three at most. */
type Post = { id: number; agent: Agent; ability: Ability };
const POST_MS = 3800;

function Feed({ posts }: { posts: Post[] }) {
  return (
    <ol className="vl-feed" aria-hidden="true">
      {posts.map((p) => (
        <li key={p.id} className="vl-feed-row">
          <span className="vl-feed-who">{p.agent.name}</span>
          <span className="vl-feed-key">{p.ability.key}</span>
          <img src={src(`${p.agent.id}-${p.ability.slot}`)} alt="" width={128} height={128} decoding="async" />
          <b>{p.ability.name}</b>
        </li>
      ))}
    </ol>
  );
}

export function Valorant() {
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [swap, setSwap] = useState(0);
  const [live, setLive] = useState(false);
  const [slot, setSlot] = useState(0);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cast, setCast] = useState(0);
  const [flaring, setFlaring] = useState(false);
  const postId = useRef(0);
  const timers = useRef(new Set<number>());
  const sectionRef = useRef<HTMLElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const keyRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const agent = AGENTS[index];
  const ability = agent.abilities[slot];

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    el.classList.add("vl-js");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("vl-in");
        io.disconnect();
        // the other agents, decoded ahead in idle time so the first swap never waits on a portrait
        const warm = () => {
          for (const a of AGENTS) {
            const img = new Image();
            img.src = src(a.id);
            void img.decode().catch(() => {});
            new Image().src = src(`${a.id}-bg`);
          }
        };
        if (window.requestIdleCallback) window.requestIdleCallback(warm, { timeout: 2000 });
        else window.setTimeout(warm, 200);
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (swap) kick();
  }, [swap]);

  useEffect(() => {
    const t = timers.current;
    return () => {
      for (const id of t) window.clearTimeout(id);
    };
  }, []);

  const post = (agent: Agent, ability: Ability) => {
    const id = ++postId.current;
    setPosts((l) => [...l.slice(-2), { id, agent, ability }]);
    const t = window.setTimeout(() => {
      timers.current.delete(t);
      setPosts((l) => l.filter((p) => p.id !== id));
    }, POST_MS);
    timers.current.add(t);
  };

  const select = (i: number) => {
    if (i === index) return;
    const motion = !reducedMotion();
    setPrev(motion ? index : null);
    setLive(motion);
    setIndex(i);
    setSwap((n) => n + 1);
  };

  /** Pick an ability: the readout changes, the agent's key light flares and the feed reports the cast. */
  const pick = (i: number) => {
    setSlot(i);
    setCast((n) => n + 1);
    setFlaring(!reducedMotion());
    post(agent, agent.abilities[i]);
  };
  const settle = () => {
    setPrev(null);
    setLive(false);
  };

  const onTileKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (i + step + AGENTS.length) % AGENTS.length;
    tileRefs.current[next]?.focus();
    select(next);
  };

  const onKeyTab = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: KEYS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = (to + KEYS.length) % KEYS.length;
    keyRefs.current[next]?.focus();
    pick(next);
  };

  // the game's binds: with focus anywhere in the section, C Q E X pick that ability
  const onSectionKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
    const k = KEYS.indexOf(e.key.toUpperCase() as Key);
    if (k < 0) return;
    pick(k);
  };

  const current: Phase = live ? "in" : "rest";

  return (
    <section
      id="valorant"
      ref={sectionRef}
      aria-labelledby="vl-title"
      data-world="valorant"
      data-swapped={swap > 0 ? "" : undefined}
      className="vl relative isolate overflow-hidden bg-[#0b0b0d] text-[#f4f2f0]"
      onKeyDown={onSectionKey}
    >
      <div className="vl-hazard" aria-hidden="true">
        <div />
      </div>
      {/* the left rail: a tick ladder down the column, its red mark on the pick */}
      <div className="vl-rail" aria-hidden="true" style={v({ "--at": (index + 0.5) / AGENTS.length })}>
        <i />
        <span>{`Val // Pool ${String(AGENTS.length).padStart(2, "0")}`}</span>
      </div>

      <div className="vl-grid">
        <header className="vl-head vl-enter px-[var(--vl-pad)] pt-10 lg:pt-0">
          <p className="vl-eyebrow">
            <span aria-hidden="true">{"//"}</span> Agent select
          </p>
          <h2 id="vl-title" className="vl-display vl-title text-[clamp(52px,4.6vw,76px)] leading-[0.9] text-[#ff4655]">
            My agent pool
          </h2>
          <p className="vl-muted mt-4 max-w-[34ch] text-[18px] leading-[1.5] text-white/70">
            The four I pick when I want to be useful to the team without having to aim very well.
          </p>
        </header>

        <DepthStage spec={STAGE} className="vl-stage" style={ROOF_VARS}>
          <Crystals />
          <div className="vl-ink vl-ink-tone" aria-hidden="true" />
          <div className="vl-ink vl-ink-dark" aria-hidden="true" />
          <div className="vl-wash" aria-hidden="true" />
          {prev !== null && <Light key={`light-out-${swap}`} agent={AGENTS[prev]} phase="out" />}
          <Light key={`light-${swap}`} agent={agent} phase={current} />
          {flaring && <Flare key={`cast-${cast}`} agent={agent} onDone={() => setFlaring(false)} />}
          <div className="vl-seam" aria-hidden="true" />
          {prev !== null && <AgentLayer key={`out-${swap}`} agent={AGENTS[prev]} phase="out" />}
          <AgentLayer key={`${agent.id}-${swap}`} agent={agent} phase={current} onSettle={settle} />
          {live && (
            <>
              <div key={`flare-${swap}`} className="vl-seam vl-seam-flare" aria-hidden="true" />
              <div key={`pass-${swap}`} className="vl-slash-pass" aria-hidden="true" />
              <div key={`edge-${swap}`} className="vl-slash-edge" aria-hidden="true" />
              <div key={`slash-${swap}`} className="vl-slash" aria-hidden="true" />
              {/* one tracer across the stage with the slash: the select "shot", anchored to the stage */}
              <div key={`tracer-${swap}`} className="vl-tracer" aria-hidden="true">
                <span />
              </div>
            </>
          )}
          <Layer d={D.hud} className="vl-hud">
            <Brackets />
            <MapTag />
            <Radar key={index} seed={index} />
            <Ladder />
            <HazardPlate name={agent.name} />
            <Feed posts={posts} />
          </Layer>
        </DepthStage>

        <div className="vl-info px-[var(--vl-pad)]">
          <Divider />
          <div key={agent.id} className="vl-swap">
            <p className="vl-role vl-muted">
              <span className="vl-role-icon">
                <img src={src(`role-${agent.role.toLowerCase()}`)} alt="" width={128} height={128} decoding="async" />
              </span>
              <span className="vl-role-name">{agent.role}</span>
              <span className="vl-role-num" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
                <i> / {String(AGENTS.length).padStart(2, "0")}</i>
              </span>
            </p>
            <h3 className="vl-display vl-name text-[clamp(72px,7vw,116px)] leading-[0.84]">
              <span>{agent.name}</span>
            </h3>
            <p className="vl-strong vl-line mt-4 max-w-[30ch] text-[20px] leading-[1.4] font-medium text-white">{agent.line}</p>

            <div className="vl-kit">
              <div className="vl-keys" role="tablist" aria-label={`${agent.name}'s abilities`}>
                {agent.abilities.map((a, i) => (
                  <button
                    key={a.slot}
                    ref={(el) => {
                      keyRefs.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`vl-key-${a.key}`}
                    aria-selected={i === slot}
                    aria-controls="vl-readout"
                    tabIndex={i === slot ? 0 : -1}
                    className="vl-keycap"
                    data-ult={a.key === "X" ? "" : undefined}
                    onClick={() => pick(i)}
                    onKeyDown={(e) => onKeyTab(e, i)}
                    style={v({ "--i": i })}
                  >
                    <span className="vl-keycap-face">
                      <img src={src(`${agent.id}-${a.slot}`)} alt="" width={128} height={128} decoding="async" />
                    </span>
                    <span className="vl-keycap-key" aria-hidden="true">
                      {a.key}
                    </span>
                    <span className="vl-charge" aria-hidden="true">
                      {Array.from({ length: a.key === "X" ? 7 : 3 }, (_, k) => (
                        <i key={k} style={v({ "--k": k })} />
                      ))}
                    </span>
                    <span className="sr-only">{a.name}</span>
                  </button>
                ))}
              </div>
              <div id="vl-readout" role="tabpanel" aria-labelledby={`vl-key-${ability.key}`} className="vl-readout">
                <div key={`${agent.id}-${slot}`} className="vl-readout-in">
                  <p className="vl-readout-head">
                    <span className="vl-readout-key" aria-hidden="true">
                      {ability.key}
                    </span>
                    <span className="vl-display vl-readout-name">{ability.name}</span>
                    {ability.key === "X" && <span className="vl-readout-tag">Ultimate</span>}
                  </p>
                  <p className="vl-muted vl-readout-what">{ability.what}</p>
                </div>
              </div>
            </div>
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
      <p className="sr-only" aria-live="polite">
        {swap > 0 ? `${agent.name}, ${agent.role}, locked in.` : ""}
      </p>
    </section>
  );
}
