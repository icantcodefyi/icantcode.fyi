import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import { DepthStage, useDepthLayer } from "@/components/depth-stage";
import { art, BTS_STAGE, halfSet } from "@/lib/art";
import { useDayArt } from "@/lib/day-art";
import { STRENGTH } from "@/lib/depth/camera";
import type { PlateSpec, StageSpec } from "@/lib/depth/types";
import type { Mode } from "@/lib/mode";
import { clamp01, DAMP, damp, smooth } from "@/lib/motion";
import { useScrollFrame } from "@/lib/scroll-loop";
import { useSetlist, type Setlist } from "./bts/audio";
import { cutout, MEMBERS } from "./bts/data";
import { Eras } from "./bts/eras";
import { Figures, LineupAct, useCues, useWarmNext } from "./bts/lineup";
import { LedMeter, LiftRecord, MusicAct } from "./bts/music";

/* ───────── the stage ─────────
   A painted stadium stage, empty: the arena and its LED wall, the truss with
   four moving heads and their beams, a glossy floor. The members are the
   show, and then the music is.

   The arena is a relief on the site camera: its depth map pushes the floor
   out towards you and leaves the wall and the sky far back (22 → 14), so the
   floor slides under the wall as the stage is scrolled. On it, back to
   front: the LED wall's own pixels at the wall's distance, the beams and the
   truss that throws them at 16 (registered: they move as one), confetti at
   15, the floor lip at 14 and the lift at 12.5, in front of all of it. The
   painting keeps its middle half free of light, so a beam never crosses the
   lift; the heads re-aim on each cue, always outwards. The beams are soft
   light, so they always come from the half-size file.

   The stage is pinned while the run scrolls past it: two acts, the line-up
   and then the music, with the lift carrying the member down and a record up
   in between. */

const W = 2000;
const H = 1400;
const D = { wall: 22, rig: 16, confetti: 15, front: 14, lift: 12.5 } as const;

const ARENA: PlateSpec = {
  id: "arena",
  art: { night: BTS_STAGE.night.back, day: BTS_STAGE.day.back },
  half: { night: BTS_STAGE.night.backHalf, day: BTS_STAGE.day.backHalf },
  size: [W, H],
  // sized in bts.css to cover the pinned stage in the painting's own 10:7
  box: { x: 0, y: 0, w: 100 },
  kind: "opaque",
  range: { far: D.wall, near: D.front, flat: D.wall },
  depth: { atlas: { night: BTS_STAGE.night.depthHalf, day: BTS_STAGE.day.depthHalf }, tile: [0, 0, W / 2, H / 2] },
  pad: [0.04, 0.03, 0.04, 0.03],
  z: 0,
};

// No pointer (nothing here follows the cursor) and no breath: at these
// distances it would move nothing you could see, and it would keep the
// relief drawing every frame at rest.
const STAGE: StageSpec = { id: "bts", plates: [ARENA], camera: { strength: STRENGTH.world, pointer: 0, breath: 0 } };

type Plate = "beams" | "mid" | "front";

function Layer({ d, className, style, children }: { d: number; className: string; style?: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, d);
  return (
    <div ref={ref} className={className} style={style} aria-hidden="true">
      {children}
    </div>
  );
}

function ArenaImg({ plate, m }: { plate: Plate; m: Mode }) {
  const set = BTS_STAGE[m];
  const beams = plate === "beams";
  const half = art(set[`${plate}Half`]);
  const full = beams ? half : art(set[plate]);
  return (
    <img
      src={full}
      srcSet={beams ? undefined : halfSet(full, W, half, W / 2, 1.6)}
      sizes={beams ? undefined : "auto, 100vw"}
      data-set={m}
      alt=""
      width={beams ? W / 2 : W}
      height={beams ? H / 2 : H}
      loading="lazy"
      decoding="async"
    />
  );
}

/** One plate of the painting, cover-fitted in the painting's own aspect so its points sit at fixed %. */
function Arena({ plate, day, children }: { plate: Plate; day: boolean; children?: ReactNode }) {
  const imgs = (
    <>
      <ArenaImg plate={plate} m="night" />
      {day ? <ArenaImg plate={plate} m="day" /> : null}
    </>
  );
  return (
    <div className={`bt-art bt-art-${plate}`}>
      {plate === "beams" ? (
        // each pair of beams turns about its own heads, mirrored: a cue's aim, and a slow sweep on top
        <>
          <div className="bt-aim" data-side="l">
            <div className="bt-sweep">{imgs}</div>
          </div>
          <div className="bt-aim" data-side="r">
            <div className="bt-sweep">{imgs}</div>
          </div>
        </>
      ) : (
        imgs
      )}
      {children}
    </div>
  );
}

/* ───────── the LED wall ─────────
   Lit text in the wall's own pixels: a dot mask over the wall's face, and
   under it a line that runs across, the member's name in act one and the
   song in act two, with the meter along the bottom of the wall. */

function Marquee({ parts, lang }: { parts: string[]; lang?: string }) {
  const unit = parts.join("").length + parts.length * 2;
  const reps = Math.max(2, Math.ceil(34 / unit));
  const seq = Array.from({ length: reps }, (_, r) =>
    parts.map((p, i) => (
      <span key={`${r}-${i}`} lang={i % 2 ? lang : undefined}>
        {p}
        <i>✦</i>
      </span>
    )),
  );
  return (
    <div className="bt-led-run" style={{ "--dur": `${(reps * unit * 0.62).toFixed(1)}s` } as CSSProperties}>
      <span className="bt-led-seq">{seq}</span>
      <span className="bt-led-seq">{seq}</span>
    </div>
  );
}

function Wall({ index, set, nameRef, songRef }: { index: number; set: Setlist; nameRef: RefObject<HTMLDivElement | null>; songRef: RefObject<HTMLDivElement | null> }) {
  const m = MEMBERS[index];
  return (
    <div className="bt-art">
      <div className="bt-led">
        <div ref={nameRef} className="bt-led-line bt-led-name">
          <div key={m.slug} className="bt-led-boot">
            <Marquee parts={[m.name.toUpperCase(), m.hangul]} lang="ko" />
          </div>
        </div>
        <div ref={songRef} className="bt-led-line bt-led-song" style={{ opacity: 0 }}>
          <div key={set.song.title} className="bt-led-boot">
            <Marquee parts={[set.song.title.toUpperCase(), String(set.song.year)]} />
          </div>
          <LedMeter set={set} />
        </div>
      </div>
    </div>
  );
}

/* A few pieces of paper confetti still coming down behind the lift long after the encore. Each rides
   a column the stage's height, so its fall is a plain percentage, and takes one of three drifts and
   tumbles: every keyframe is a constant, so all of it runs on the compositor. */
const rand = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};
const CONFETTI = (() => {
  const r = rand(71);
  const colors = ["var(--bt-soft)", "var(--bt-accent)", "var(--bt-confetti-light)"];
  return Array.from({ length: 12 }, (_, i) => ({
    x: Math.round(4 + ((i + r()) / 12) * 92),
    dur: +(19 + r() * 15).toFixed(1),
    delay: -+(r() * 34).toFixed(1),
    flip: +(1.6 + r() * 1.8).toFixed(1),
    fall: "abc"[i % 3],
    tumble: "abc"[(i + 1) % 3],
    color: colors[i % 3],
  }));
})();

/* ───────── house lights ─────────
   The threshold into the hall: the dark of the doorway, one hairline truss
   across the top, and three beams that come up as you walk in. They throw
   onto the title, never as far as the stage. */

const HOUSE_BEAMS = [
  { x: 16, angle: -20 },
  { x: 50, angle: 0 },
  { x: 84, angle: 20 },
];

function HouseLights() {
  const ref = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setLit(true);
        io.disconnect();
      },
      { rootMargin: "0px 0px -18% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="bt-house" data-lit={lit || undefined} aria-hidden="true">
      <span className="bt-house-truss" />
      {HOUSE_BEAMS.map((b, i) => (
        <span key={b.x} className="bt-house-beam" style={{ "--x": `${b.x}%`, "--a": `${b.angle}deg`, "--i": i } as CSSProperties}>
          <span />
        </span>
      ))}
    </div>
  );
}

/* ───────── the run: two acts on one pinned stage ───────── */

type Els = {
  pin: RefObject<HTMLDivElement | null>;
  member: RefObject<HTMLDivElement | null>;
  record: RefObject<HTMLDivElement | null>;
  act1: RefObject<HTMLDivElement | null>;
  act2: RefObject<HTMLDivElement | null>;
  name: RefObject<HTMLDivElement | null>;
  song: RefObject<HTMLDivElement | null>;
  curtain: RefObject<HTMLDivElement | null>;
};

/**
 * Where the run is (0 = act one fills the stage, 1 = act two), damped like
 * the camera, and everything it moves: written straight to the few elements
 * involved, only on frames where it changed. With reduced motion the acts
 * swap at the midpoint and CSS crossfades them.
 */
function useRun(run: RefObject<HTMLDivElement | null>, els: Els, onAct: (music: boolean, past: boolean) => void) {
  const q = useRef(-1);
  const rise = useRef(-1);
  const live = useRef({ a1: true, a2: false, music: false, past: false });
  /** `v`: the run (0..1, damped); `c`: how far the stage still has to come up the screen (1 → 0 as it pins) */
  const write = (v: number, c: number, reduced: boolean) => {
    const s = reduced ? (v < 0.5 ? 0 : 1) : v;
    const out = smooth(0.16, 0.5, s);
    const up = smooth(0.44, 0.82, s);
    const a1 = 1 - smooth(0.1, 0.34, s);
    const a2 = smooth(0.62, 0.86, s);
    const m = els.member.current;
    const r = els.record.current;
    // the curtain over the top of the stage rises as the stage arrives; the member comes up on the lift with it
    if (els.curtain.current) els.curtain.current.style.opacity = c.toFixed(3);
    if (m) {
      m.style.transform = reduced ? "" : `translate3d(0, ${(c * 22 + out * 34).toFixed(3)}%, 0)`;
      m.style.opacity = ((1 - smooth(0.22, 0.48, s)) * (reduced ? 1 : 1 - smooth(0.15, 0.85, c))).toFixed(3);
    }
    if (r) {
      // the record comes up through the floor and stands on it
      r.style.transform = reduced ? "" : `translate3d(0, ${((1 - up) * 62).toFixed(3)}%, 0)`;
      r.style.opacity = smooth(0.42, 0.62, s).toFixed(3);
    }
    const a = els.act1.current;
    const b = els.act2.current;
    if (a) {
      a.style.opacity = a1.toFixed(3);
      a.style.transform = reduced ? "" : `translate3d(0, ${(-(1 - a1) * 28).toFixed(2)}px, 0)`;
    }
    if (b) {
      b.style.opacity = a2.toFixed(3);
      b.style.transform = reduced ? "" : `translate3d(0, ${((1 - a2) * 28).toFixed(2)}px, 0)`;
    }
    if (els.name.current) els.name.current.style.opacity = (1 - smooth(0.24, 0.44, s)).toFixed(3);
    if (els.song.current) els.song.current.style.opacity = smooth(0.56, 0.76, s).toFixed(3);
    const l = live.current;
    const next = { a1: a1 > 0.5, a2: a2 > 0.5, music: s > 0.5, past: s > 0.12 };
    if (next.a1 !== l.a1) a?.toggleAttribute("data-live", next.a1);
    if (next.a2 !== l.a2) b?.toggleAttribute("data-live", next.a2);
    if (next.music !== l.music) els.pin.current?.setAttribute("data-act", next.music ? "music" : "lineup");
    if (next.music !== l.music || next.past !== l.past) onAct(next.music, next.past);
    live.current = next;
  };
  useScrollFrame(run, (f) => {
    // closed while the stage comes up the screen, open by the time it pins
    const c = smooth(0.02, 0.36, clamp01((f.top - f.y) / f.vh));
    const travel = f.h - f.vh;
    const goal = travel > 0 ? clamp01((f.y - f.top) / travel) : 0;
    const first = q.current < 0;
    const cur = first || f.reduced ? goal : q.current + (goal - q.current) * damp(DAMP.scroll, f.dt);
    const settled = Math.abs(goal - cur) < 1e-4;
    const v = settled ? goal : cur;
    if (v !== q.current || c !== rise.current) write(v, c, f.reduced);
    q.current = v;
    rise.current = c;
    return !settled;
  });
  /** where the run puts act `n` (0 or 1) on screen, for keyboard focus landing in a hidden act */
  return useCallback(
    (n: 0 | 1) => {
      const el = run.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const travel = el.offsetHeight - window.innerHeight;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: top + n * travel, behavior: reduced ? "auto" : "smooth" });
    },
    [run],
  );
}

/* ───────── world ───────── */

export function BtsWorld() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const runRef = useRef<HTMLDivElement>(null);
  const els: Els = {
    pin: useRef<HTMLDivElement>(null),
    member: useRef<HTMLDivElement>(null),
    record: useRef<HTMLDivElement>(null),
    act1: useRef<HTMLDivElement>(null),
    act2: useRef<HTMLDivElement>(null),
    name: useRef<HTMLDivElement>(null),
    song: useRef<HTMLDivElement>(null),
    curtain: useRef<HTMLDivElement>(null),
  };
  const set = useSetlist(visible);
  const cues = useCues(setIndex, els.pin);
  useWarmNext(index);
  const member = MEMBERS[index];
  // the day painting, probed once for the stage (every plate or none)
  const dayBack = useDayArt(art(BTS_STAGE.day.back), sectionRef);
  const dayBeams = useDayArt(art(BTS_STAGE.day.beamsHalf), sectionRef);
  const dayMid = useDayArt(art(BTS_STAGE.day.mid), sectionRef);
  const dayFront = useDayArt(art(BTS_STAGE.day.front), sectionRef);
  const day = dayBack && dayBeams && dayMid && dayFront;
  const { set: setHold } = cues;

  const toAct = useRun(runRef, els, (_music, past) => setHold("act", past));

  // the moving heads ride the kick drum while a preview plays
  const { draw } = set;
  useEffect(() => {
    const el = els.pin.current?.querySelector<HTMLElement>(".bt-plate-beams");
    if (!el) return;
    return draw((f) => {
      el.style.opacity = f.live ? (0.6 + 0.4 * Math.min(1, f.beat * 1.6)).toFixed(3) : "";
    });
  }, [draw, els.pin]);

  // the section: in view at all (audio pauses when it isn't), warming the cutouts once
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    el.classList.add("bt-js");
    let warmed = false;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (e.isIntersecting) {
          el.classList.add("bt-in");
          if (!warmed) {
            warmed = true;
            for (const m of MEMBERS) new Image().src = cutout(m.slug);
          }
        }
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // the stage: the line-up runs while it is mostly on screen; its loops stop when it is off
  useEffect(() => {
    const el = els.pin.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        // the line-up waits until the stage has arrived (most of it on screen)
        setHold("offscreen", e.intersectionRatio < 0.8);
        el.toggleAttribute("data-off", !e.isIntersecting);
      },
      { threshold: [0, 0.8] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [setHold, els.pin]);

  const hoverProps = {
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && setHold("hover", true),
    onPointerLeave: () => setHold("hover", false),
  };

  return (
    <section id="bts" ref={sectionRef} aria-labelledby="bt-title" data-world="bts" className="bt relative isolate">
      <HouseLights />
      <header className="bt-overture bt-enter">
        <p className="bt-kicker">
          <span>BTS</span>
          <span aria-hidden="true" className="bt-dot" />
          <span lang="ko">방탄소년단</span>
        </p>
        <h2 id="bt-title" className="bt-display bt-title">
          Borahae, <span className="bt-title-soft">all seven of you</span>
        </h2>
        <p className="bt-lede">
          Borahae means “I purple you”: I'll love you for a long, long time. This is my little concert hall for the band on repeat behind most
          of my late-night code.
        </p>
      </header>

      <div ref={runRef} className="bt-run">
        <div
          ref={els.pin}
          className="bt-pin"
          data-act="lineup"
          data-playing={set.playing || undefined}
          style={{ "--bt-aim": `${member.aim}deg` } as CSSProperties}
        >
          <DepthStage spec={STAGE} track={runRef} className="bt-stage" data-member={member.slug}>
            <Layer d={D.wall} className="bt-plate bt-plate-wall">
              <Wall index={index} set={set} nameRef={els.name} songRef={els.song} />
            </Layer>
            <Layer d={D.rig} className="bt-plate bt-plate-beams">
              <Arena plate="beams" day={day} />
              <div className="bt-haze">
                <span />
                <span />
              </div>
            </Layer>
            <Layer d={D.rig} className="bt-plate">
              <Arena plate="mid" day={day} />
            </Layer>
            <Layer d={D.confetti} className="bt-confetti">
              {CONFETTI.map((c, i) => (
                <span key={i} data-fall={c.fall} style={{ left: `${c.x}%`, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s`, "--c": c.color } as CSSProperties}>
                  <i data-tumble={c.tumble} style={{ animationDuration: `${c.flip}s` }} />
                </span>
              ))}
            </Layer>
            <Layer d={D.front} className="bt-plate">
              <Arena plate="front" day={day} />
            </Layer>
            <div className="bt-fade" aria-hidden="true" />
            {/* a cue is a lighting change: the stage dips, the next member rises, the lights come back */}
            <div key={member.slug} className="bt-dip" aria-hidden="true" />
            <div ref={els.curtain} className="bt-curtain" aria-hidden="true" />
            <Lift index={index} set={set} els={els} hoverProps={hoverProps} />
          </DepthStage>

          <div className="bt-acts">
            <div
              ref={els.act1}
              className="bt-act bt-act-lineup"
              data-live=""
              onFocus={(e) => {
                if (!els.act1.current?.hasAttribute("data-live") && e.target.matches(":focus-visible")) toAct(0);
              }}
            >
              <LineupAct index={index} setIndex={setIndex} cues={cues} hoverProps={hoverProps} />
            </div>
            <div
              ref={els.act2}
              className="bt-act bt-act-music"
              style={{ opacity: 0 }}
              onFocus={(e) => {
                if (!els.act2.current?.hasAttribute("data-live") && e.target.matches(":focus-visible")) toAct(1);
              }}
            >
              <MusicAct set={set} />
            </div>
          </div>
        </div>
      </div>

      <Eras set={set} />
      {/* the one player for the whole world */}
      <audio {...set.audioProps} />
    </section>
  );
}

/** The lift in the middle of the stage: the member, and under the floor the record waiting to come up. */
function Lift({ index, set, els, hoverProps }: { index: number; set: Setlist; els: Els; hoverProps: Parameters<typeof Figures>[0]["hoverProps"] }) {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, D.lift);
  return (
    <div ref={ref} className="bt-lift">
      <div ref={els.member} className="bt-lift-member">
        <Figures index={index} hoverProps={hoverProps} />
      </div>
      <div ref={els.record} className="bt-lift-record" style={{ opacity: 0 }}>
        <LiftRecord set={set} />
      </div>
    </div>
  );
}
