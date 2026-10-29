import { useCallback, useEffect, useRef, useState, type AnimationEvent, type CSSProperties, type KeyboardEvent, type RefObject } from "react";

import { avatar, cutout, MEMBERS } from "./data";

/** one member's cue, ms (mirrored as --bt-cue in bts.css) */
export const CUE_MS = 6400;

type Hold = { hover: boolean; focus: boolean; hidden: boolean; offscreen: boolean; act: boolean; paused: boolean };

/**
 * The line-up's clock is a CSS animation: the current cue's rule runs out
 * over CUE_MS on the compositor, and when it ends the next member comes up
 * (`next`, from its animationend). Anything that holds the line-up (the
 * pointer on the stage or the cue sheet, keyboard focus in the cue sheet,
 * the stage off screen or past the first act, the tab hidden, the visitor's
 * own hold) sets [data-hold] on the stage, which pauses the rule and the
 * slow push on the member together. No script runs between cues.
 */
export function useCues(setIndex: (fn: (i: number) => number) => void, stage: RefObject<HTMLElement | null>) {
  const [auto, setAuto] = useState(false);
  const [paused, setPaused] = useState(false);
  /** bumped to restart the current cue's clock (its rule and ring remount) */
  const [lap, setLap] = useState(0);
  const hold = useRef<Hold>({ hover: false, focus: false, hidden: false, offscreen: true, act: false, paused: false });
  const autoRef = useRef(auto);
  autoRef.current = auto;

  const held = () => {
    const h = hold.current;
    return !autoRef.current || h.hover || h.focus || h.hidden || h.offscreen || h.act || h.paused;
  };
  const mark = useCallback(() => {
    stage.current?.toggleAttribute("data-hold", held());
  }, [stage]);

  const set = useCallback(
    (key: keyof Hold, value: boolean) => {
      if (hold.current[key] === value) return;
      hold.current[key] = value;
      mark();
    },
    [mark],
  );

  /**
   * The current rule has run out. If something took hold in the same moment (the pointer landing on the
   * stage, the tab going away), the rule has still ended and would never end again: the line-up would
   * stay on this member for good. So the clock starts over instead, held at zero until the hold lets go.
   */
  const next = useCallback(() => {
    if (!held()) setIndex((i) => (i + 1) % MEMBERS.length);
    else setLap((l) => l + 1);
  }, [setIndex]);

  // reduced motion: no rotation at all, the cue sheet is plain tabs
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setAuto(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  useEffect(mark, [auto, mark]);

  useEffect(() => {
    const onVis = () => set("hidden", document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [set]);

  useEffect(() => {
    set("paused", paused);
  }, [paused, set]);

  return { auto, paused, setPaused, set, next, lap };
}

/** Warm the next member's cutout while this one is on. */
export function useWarmNext(index: number) {
  useEffect(() => {
    const img = new Image();
    img.src = cutout(MEMBERS[(index + 1) % MEMBERS.length].slug);
    img.decode?.().catch(() => {});
  }, [index]);
}

export type Cues = ReturnType<typeof useCues>;

/* ───────── the member on the lift ───────── */

/**
 * Framing. Every cutout is laid out by one rule: bottom-anchored on the
 * lift, its height a fixed share of the stage (the same head-room for
 * everyone), centred. A nudge for one photo goes here and nowhere else:
 *   scale: its height against the others' (1 = default), from its foot
 */
const FRAMING: Record<string, { scale?: number }> = {
  suga: { scale: 0.97 },
};

type HoverProps = { onPointerEnter: (e: React.PointerEvent) => void; onPointerLeave: () => void };

/** The member on the lift; the pointer on the current photo holds the line-up. */
export function Figures({ index, hoverProps }: { index: number; hoverProps: HoverProps }) {
  // the one leaving keeps its exit transition while the next one rises
  const [prev, setPrev] = useState(-1);
  const cur = useRef(index);
  useEffect(() => {
    if (cur.current === index) return;
    setPrev(cur.current);
    cur.current = index;
    const t = window.setTimeout(() => setPrev(-1), 900);
    return () => window.clearTimeout(t);
  }, [index]);
  return (
    <div className="bt-figures" {...hoverProps}>
      {MEMBERS.map((m, i) => {
        const f = FRAMING[m.slug] ?? {};
        return (
          <img
            key={m.slug}
            className="bt-figure"
            data-state={i === index ? "on" : i === prev ? "off" : undefined}
            src={cutout(m.slug)}
            alt={i === index ? `${m.name} of BTS` : ""}
            aria-hidden={i === index ? undefined : true}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : undefined}
            decoding="async"
            style={{ "--fs": f.scale ?? 1 } as CSSProperties}
          />
        );
      })}
    </div>
  );
}

/* ───────── act one: the cue, and the cue sheet ───────── */

/**
 * A name's length for its fitted size (bts.css): a capital is about a quarter wider than a lower-case
 * letter. On the stage the name is sized by its longest word and may break at a space (Jung / Kook,
 * as big as everyone else's); on phones it stays on one line, sized by the whole name.
 */
const fitLength = (name: string) => [...name].reduce((n, c) => n + (c !== c.toLowerCase() ? 1.25 : 1), 0);

export function LineupAct({
  index,
  setIndex,
  cues,
  hoverProps,
}: {
  index: number;
  setIndex: (i: number) => void;
  cues: Cues;
  hoverProps: HoverProps;
}) {
  const m = MEMBERS[index];
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const n = MEMBERS.length;

  const onRunOut = (e: AnimationEvent<Element>) => {
    if (e.animationName.startsWith("bt-cue")) cues.next();
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const map: Record<string, number> = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    const next = (map[e.key] + n) % n;
    setIndex(next);
    tabs.current[next]?.focus();
  };

  return (
    <>
      <div id="bt-panel" role="tabpanel" aria-labelledby={`bt-tab-${m.slug}`} className="bt-cue" {...hoverProps}>
        <div key={m.slug} className="bt-cue-in">
          <p className="bt-cue-no" aria-hidden="true">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span className="bt-cue-of">/ {String(n).padStart(2, "0")}</span>
          </p>
          <h3
            className="bt-display bt-name"
            style={{ "--bt-len": Math.max(fitLength(m.name), 4), "--bt-word": Math.max(...m.name.split(" ").map(fitLength), 4) } as CSSProperties}
          >
            {m.name}
          </h3>
          <p className="bt-role">
            <span lang="ko" className="bt-hangul">
              {m.hangul}
            </span>
            <span aria-hidden="true" className="bt-dot" />
            {m.position}
          </p>
          <p className="bt-line">{m.line}</p>
        </div>
      </div>

      <div className="bt-sheet" {...hoverProps}>
        <div className="bt-sheet-head">
          <span className="bt-eyebrow">Line-up</span>
          {cues.auto ? (
            <button
              type="button"
              className="bt-hold"
              aria-pressed={cues.paused}
              onClick={() => cues.setPaused((p) => !p)}
            >
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                {cues.paused ? <path d="M4 2.5v11l9-5.5z" /> : <path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" />}
              </svg>
              {cues.paused ? "Resume" : "Hold"}
              <span className="sr-only"> the line-up’s rotation</span>
            </button>
          ) : null}
        </div>
        <div
          className="bt-cues"
          role="tablist"
          aria-label="BTS members"
          data-auto={cues.auto || undefined}
          // keyboard focus holds the rotation; a mouse click's focus does not
          onFocus={(e) => cues.set("focus", e.target.matches(":focus-visible"))}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) cues.set("focus", false);
          }}
        >
          {MEMBERS.map((mm, i) => (
            <button
              key={mm.slug}
              id={`bt-tab-${mm.slug}`}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-controls="bt-panel"
              tabIndex={i === index ? 0 : -1}
              className="bt-tab"
              onClick={() => setIndex(i)}
              onKeyDown={(e) => onKey(e, i)}
            >
              <span className="bt-tab-face" aria-hidden="true">
                <img src={avatar(mm.slug)} alt="" width={160} height={160} loading="lazy" decoding="async" />
              </span>
              <span className="bt-tab-no" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="bt-tab-name">{mm.name}</span>
              {/* the clock: a rule that runs out on desktop, a ring around the face on phones */}
              <span
                key={`rule-${i === index ? cues.lap : "idle"}`}
                className="bt-tab-rule"
                aria-hidden="true"
                onAnimationEnd={i === index ? onRunOut : undefined}
              />
              <svg
                key={`ring-${i === index ? cues.lap : "idle"}`}
                className="bt-tab-ring"
                viewBox="0 0 40 40"
                aria-hidden="true"
                onAnimationEnd={i === index ? onRunOut : undefined}
              >
                <circle cx="20" cy="20" r="19" pathLength="1" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
