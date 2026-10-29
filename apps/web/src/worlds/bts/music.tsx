import { useEffect, useRef } from "react";

import { useMode } from "@/lib/mode";
import { BARS, type Setlist } from "./audio";
import { appleSearch, SONGS, songArt } from "./data";
import { Vinyl } from "./record";

const fmt = (t: number) => `0:${String(Math.max(0, Math.floor(t))).padStart(2, "0")}`;

function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      {playing ? <path d="M9 7h5v18H9zM18 7h5v18h-5z" /> : <path d="M11 6.5v19a1.2 1.2 0 0 0 1.8 1l15-9.5a1.2 1.2 0 0 0 0-2l-15-9.5a1.2 1.2 0 0 0-1.8 1z" />}
    </svg>
  );
}

/* ───────── on the lift: the record that takes the member's place ───────── */

export function LiftRecord({ set }: { set: Setlist }) {
  return (
    // the whole record is the target for a pointer; keyboards and screen readers have the act's own play button
    <div className="bt-lift-disc" data-playing={set.playing || undefined} aria-hidden="true" onClick={set.toggle}>
      <Vinyl id="lift" label={songArt(set.song)} className="bt-lift-vinyl">
        <span className="bt-play">
          <PlayIcon playing={set.playing} />
        </span>
      </Vinyl>
    </div>
  );
}

/* ───────── on the LED wall: the meter, in the wall's own pixels ─────────
   A ring of bars around the record on the lift, drawn on the wall behind
   it: the wall's dot mask turns them into LEDs, and the wall's edges cut
   the ring to the two arcs either side of the record, which is where the
   bass goes. It only draws while the levels move. */

const SPOKES = 84;

export function LedMeter({ set }: { set: Setlist }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mode = useMode();
  const { draw } = set;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let w = 0;
    let h = 0;
    // the record's centre and radius on this canvas, css px
    let ring = { x: 0, y: 0, r: 0 };
    let colors = { top: "#f3ecff", bottom: "#8f5cff", idle: "rgb(201 167 255 / 0.3)" };
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = getComputedStyle(c);
      colors = {
        top: cs.getPropertyValue("--bt-eq-top").trim() || colors.top,
        bottom: cs.getPropertyValue("--bt-eq-bottom").trim() || colors.bottom,
        idle: cs.getPropertyValue("--bt-eq-idle").trim() || colors.idle,
      };
      // where the record stands once it is up: its layout box, without the lift's travel
      const stage = c.closest<HTMLElement>(".bt-stage");
      const disc = stage?.querySelector<HTMLElement>(".bt-lift-disc");
      if (stage && disc) {
        const sr = stage.getBoundingClientRect();
        const cr = c.getBoundingClientRect();
        ring = { x: sr.left + disc.offsetLeft - cr.left, y: sr.top + disc.offsetTop - cr.top, r: disc.offsetWidth / 2 };
      }
    };
    let last: Float32Array | null = null;
    const paint = (L: Float32Array) => {
      last = L;
      const g = c.getContext("2d");
      if (!g || !w || !h || !ring.r) return;
      g.clearRect(0, 0, w, h);
      const r0 = ring.r * 1.06;
      const reach = ring.r * 0.42;
      const grad = g.createRadialGradient(ring.x, ring.y, r0, ring.x, ring.y, r0 + reach);
      grad.addColorStop(0, colors.top);
      grad.addColorStop(1, colors.bottom);
      g.lineWidth = Math.max(3, ((Math.PI * 2 * r0) / SPOKES) * 0.46);
      g.lineCap = "butt";
      for (let i = 0; i < SPOKES; i++) {
        const a = (i / SPOKES) * Math.PI * 2;
        // the bass along the horizontal, where the wall shows either side of the record; the trebles up and down
        const bin = Math.round(Math.abs(Math.sin(a)) * (BARS - 1));
        const rest = 0.08 + 0.05 * Math.abs(Math.sin(i * 1.7));
        const v = Math.max(L[bin], rest);
        const len = Math.max(4, v * reach);
        const cx = Math.cos(a);
        const cy = Math.sin(a);
        g.strokeStyle = L[bin] > rest ? grad : colors.idle;
        g.beginPath();
        g.moveTo(ring.x + cx * r0, ring.y + cy * r0);
        g.lineTo(ring.x + cx * (r0 + len), ring.y + cy * (r0 + len));
        g.stroke();
      }
    };
    const ro = new ResizeObserver(() => {
      size();
      if (last) paint(last);
    });
    ro.observe(c);
    size();
    const off = draw((f) => paint(f.levels));
    return () => {
      ro.disconnect();
      off();
    };
    // colours follow the mode
  }, [draw, mode]);
  return <canvas ref={ref} className="bt-meter" aria-hidden="true" />;
}

/* ───────── act two: now playing, and tonight's setlist ───────── */

export function MusicAct({ set }: { set: Setlist }) {
  const prog = useRef<HTMLSpanElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      set.draw((f) => {
        const p = Math.min(1, f.t / f.d);
        if (prog.current) prog.current.style.transform = `scaleX(${p.toFixed(4)})`;
        if (time.current) time.current.textContent = `${fmt(f.t)} / ${fmt(f.d)}`;
      }),
    [set.draw],
  );
  const s = set.song;
  return (
    <>
      <div className="bt-np" data-playing={set.playing || undefined}>
        <p className="bt-eyebrow bt-np-head">
          <span className="bt-tally" aria-hidden="true" />
          {set.playing ? "Now playing" : "Up next"}
        </p>
        <h3 className="bt-display bt-np-title" aria-live="polite">
          {s.title}
        </h3>
        <p className="bt-np-meta">
          {s.album}, {s.year}
        </p>
        <div className="bt-np-bar" aria-hidden="true">
          <span ref={prog} className="bt-np-fill" />
        </div>
        <div className="bt-np-row">
          <button type="button" className="bt-np-play" onClick={set.toggle} aria-label={set.playing ? `Pause ${s.title}` : `Play the ${s.title} preview`}>
            <PlayIcon playing={set.playing} />
          </button>
          <span ref={time} className="bt-time">
            0:00 / 0:30
          </span>
          <a className="bt-apple" href={appleSearch(s)} target="_blank" rel="noreferrer">
            Apple Music
            <span className="bt-apple-arrow" aria-hidden="true">
              ↗
            </span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
        {set.failed && <p className="bt-fail">That preview wouldn’t load. Try another song, or open it on Apple Music.</p>}
      </div>

      <div className="bt-setlist">
        <p className="bt-setlist-head" aria-hidden="true">
          <span className="bt-eyebrow">Setlist</span>
          <span>{SONGS.length} songs, 30 seconds each</span>
        </p>
        <ol className="bt-tracks" aria-label="Pick a song">
          {SONGS.map((song, i) => (
            <li key={song.title}>
              <button type="button" className="bt-track" aria-pressed={i === set.index} onClick={() => set.pick(i)}>
                <span className="bt-track-no" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="bt-track-title">{song.title}</span>
                <svg className="bt-track-eq" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <rect x="1" y="6" width="3" height="10" rx="1" />
                  <rect x="6.5" y="2" width="3" height="14" rx="1" />
                  <rect x="12" y="8" width="3" height="8" rx="1" />
                </svg>
                <span className="bt-track-year">{song.year}</span>
                <span className="sr-only">{i === set.index && set.playing ? ", playing" : ""}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
