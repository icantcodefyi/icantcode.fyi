import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

import type { Setlist } from "./audio";
import { ALBUMS, sleeve, SONGS } from "./data";
import { Vinyl } from "./record";

/**
 * The shelf, as a crate you flip through: the sleeve in front faces you, the
 * rest lean back on either side with their faces turned in. Pulling one
 * (click, Enter, a tap) brings it to the front and slides its record out of
 * the open edge, rolling as it goes; putting it back slides the record home
 * first, then the crate closes up.
 *
 * Every motion is one transform per element, each owning one job: the
 * sleeve's place in the crate on .bt-era-obj, the slide on .bt-era-disc,
 * the roll on .bt-era-spin. (The old shelf put the roll on `rotate` and the
 * pull on `transform` of one element; `rotate` applies first, so the record
 * slid out sideways along its own turned axis.)
 */

/** where sleeve `k` places from the front (k = 0) sits, in sleeve widths, and how it is turned */
function place(k: number, open: boolean) {
  if (k === 0) return { x: open ? -0.34 : 0, z: open ? 0.06 : 0, ry: 0 };
  const s = Math.sign(k);
  const a = Math.abs(k);
  // with a record out, the front sleeve moves left and the stacks part around sleeve and record
  const room = open ? (s < 0 ? -0.34 : 0.56) : 0;
  return { x: s * (0.66 + (a - 1) * 0.17) + room, z: -0.5 - Math.min(a - 1, 3) * 0.04, ry: -s * 62 };
}

export function Eras({ set }: { set: Setlist }) {
  const [focus, setFocus] = useState(3);
  const [open, setOpen] = useState(false);
  /** a record was out when the front sleeve changed: the next one waits for its sleeve to arrive */
  const [switching, setSwitching] = useState(false);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  /** a swipe ends in a click on the sleeve under the finger: that click is the swipe's, not a pull */
  const swiped = useRef(false);
  const n = ALBUMS.length;
  const a = ALBUMS[focus];
  const song = a.song === undefined ? null : SONGS[a.song];
  const onAir = song !== null && set.index === a.song && set.playing;

  const go = (i: number, pull: boolean) => {
    const next = Math.max(0, Math.min(n - 1, i));
    if (next !== focus) {
      setSwitching(open && pull);
      setFocus(next);
    }
    setOpen(pull);
  };

  useEffect(() => {
    if (!switching) return;
    const t = window.setTimeout(() => setSwitching(false), 1200);
    return () => window.clearTimeout(t);
  }, [switching]);

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    const map: Record<string, number> = { ArrowLeft: focus - 1, ArrowRight: focus + 1, Home: 0, End: n - 1 };
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (!(e.key in map)) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(n - 1, map[e.key]));
    go(next, false);
    items.current[next]?.focus();
  };

  // a horizontal swipe flips the crate (vertical drags still scroll the page: touch-action pan-y)
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse") return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    swiped.current = true;
    window.setTimeout(() => (swiped.current = false), 400);
    go(focus + (dx < 0 ? 1 : -1), false);
  };

  return (
    <div className="bt-eras">
      <div className="bt-wrap bt-eras-head">
        <h3 className="bt-display bt-h3-lg">Eras on my shelf</h3>
        <p className="bt-eras-sub">
          Eight records, six years. <span className="bt-hover-copy">Pull one out.</span>
          <span className="bt-touch-copy">Swipe through, tap to pull one out.</span>
        </p>
      </div>

      <div
        className="bt-crate"
        data-open={open || undefined}
        data-switching={switching || undefined}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => (drag.current = null)}
      >
        <ul className="bt-crate-row" aria-label="Albums" onKeyDown={onKey}>
          {ALBUMS.map((al, i) => {
            const k = i - focus;
            const p = place(k, open);
            const front = k === 0;
            return (
              <li
                key={al.slug}
                className="bt-era"
                data-front={front || undefined}
                data-open={(front && open) || undefined}
                style={
                  {
                    "--x": p.x,
                    "--z": p.z,
                    "--ry": `${p.ry}deg`,
                    "--tone": al.tone,
                    zIndex: 20 - Math.abs(k),
                    // past three either side the crate is too deep to read
                    opacity: Math.abs(k) > 3 ? 0 : 1,
                  } as CSSProperties
                }
              >
                <button
                  ref={(el) => {
                    items.current[i] = el;
                  }}
                  type="button"
                  className="bt-era-hit"
                  tabIndex={front ? 0 : -1}
                  aria-label={`${al.title}, ${al.year}`}
                  aria-current={front || undefined}
                  aria-expanded={front ? open : undefined}
                  aria-controls={front ? "bt-era-card" : undefined}
                  onClick={() => {
                    if (swiped.current) {
                      swiped.current = false;
                      return;
                    }
                    go(i, front ? !open : true);
                  }}
                >
                  <span className="bt-era-obj">
                    {Math.abs(k) <= 1 ? (
                      <span className="bt-era-disc" aria-hidden="true">
                        <span className="bt-era-spin" data-on-air={(front && onAir) || undefined}>
                          <Vinyl id={`era-${al.slug}`} label={sleeve(al.slug)} />
                        </span>
                      </span>
                    ) : null}
                    <span className="bt-era-sleeve">
                      <img src={sleeve(al.slug)} alt="" width={600} height={600} loading="lazy" decoding="async" draggable={false} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div id="bt-era-card" className="bt-wrap bt-era-card" data-open={open || undefined}>
        <button type="button" className="bt-era-step" onClick={() => go(focus - 1, false)} disabled={focus === 0} aria-label="Previous album">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M10 3 5 8l5 5" />
          </svg>
        </button>
        <div key={a.slug} className="bt-era-text" aria-live="polite">
          <p className="bt-era-year">
            {a.year}
            <span className="bt-era-count" aria-hidden="true">
              {String(focus + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
            </span>
          </p>
          <p className="bt-display bt-era-title">{a.title}</p>
          <p className="bt-era-track">
            Title track <span>{a.track}</span>
          </p>
        </div>
        <div className="bt-era-actions">
          <button type="button" className="bt-era-pull" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? "Put it back" : "Pull the record"}
          </button>
          {song && a.song !== undefined ? (
            <button
              type="button"
              className="bt-era-play"
              aria-pressed={onAir}
              onClick={() => {
                setOpen(true);
                set.pick(a.song as number);
              }}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                {onAir ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="M5 2.8v10.4a.6.6 0 0 0 .9.5l8-5.2a.6.6 0 0 0 0-1l-8-5.2a.6.6 0 0 0-.9.5z" />}
              </svg>
              {onAir ? "Pause" : "Play"} {a.track}
            </button>
          ) : null}
        </div>
        <button type="button" className="bt-era-step" onClick={() => go(focus + 1, false)} disabled={focus === n - 1} aria-label="Next album">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="m6 3 5 5-5 5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
