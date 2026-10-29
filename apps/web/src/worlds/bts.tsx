import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { DepthStage, useDepthLayer } from "@/components/depth-stage";
import { art, BTS_STAGE, halfSet } from "@/lib/art";
import { useDayArt } from "@/lib/day-art";
import { STRENGTH } from "@/lib/depth/camera";
import type { StageSpec } from "@/lib/depth/types";
import { useMode, type Mode } from "@/lib/mode";

/* ───────── data (mirrors public/bts/manifest.json) ───────── */

type Member = {
  slug: string;
  name: string;
  position: string;
  line: string;
};

const MEMBERS: Member[] = [
  {
    slug: "rm",
    name: "RM",
    position: "Leader and rapper",
    line: "He makes thinking out loud sound brave. Every time he speaks I want to slow down and say things properly.",
  },
  {
    slug: "jin",
    name: "Jin",
    position: "Vocalist",
    line: "Equal parts grace and goofiness. He can turn a stadium into a living room with one joke.",
  },
  {
    slug: "suga",
    name: "Suga",
    position: "Rapper and producer",
    line: "Quiet until the beat drops, then every word lands. My favourite kind of focus.",
  },
  {
    slug: "jhope",
    name: "j-hope",
    position: "Rapper and dancer",
    line: "Hope is right there in the name, and he delivers. The energy I borrow on slow mornings.",
  },
  {
    slug: "jimin",
    name: "Jimin",
    position: "Vocalist and dancer",
    line: "He moves like the music starts somewhere inside him. I rewind his parts more than I'd admit.",
  },
  {
    slug: "v",
    name: "V",
    position: "Vocalist",
    line: "That low, warm voice and an artist's eye for everything. Calm, curious and a little bit of a mystery.",
  },
  {
    slug: "jungkook",
    name: "Jungkook",
    position: "Vocalist",
    line: "Makes the hard things look easy and still seems to be having the most fun on stage.",
  },
];

/**
 * Framing. Every cutout is laid out by one rule: bottom-anchored, its height a
 * fixed share of the stage (leaving the same head-room for everyone), centred. If a single
 * photo needs a nudge, adjust it here and nowhere else:
 *   scale: grows the figure from its bottom centre (1 = default)
 *   x:     which point of the photo sits on the stage centre line (0.5 = middle)
 */
const FRAMING: Record<string, { scale?: number; x?: number }> = {
  rm: {},
  jin: {},
  suga: {},
  jhope: {},
  jimin: {},
  v: {},
  jungkook: {},
};

// Head-room above every figure and how far it sinks below the deck live in
// bts.css (--bt-headroom, --bt-sink) so phones can frame a little looser.

function figureStyle(slug: string): CSSProperties {
  const f = FRAMING[slug] ?? {};
  return {
    transform: `translateX(-${(f.x ?? 0.5) * 100}%)`,
    scale: String(f.scale ?? 1),
  };
}

type Album = { slug: string; title: string; year: number };

const ALBUMS: Album[] = [
  { slug: "wings", title: "Wings", year: 2016 },
  { slug: "love-yourself-tear", title: "Love Yourself: Tear", year: 2018 },
  { slug: "love-yourself-answer", title: "Love Yourself: Answer", year: 2018 },
  {
    slug: "map-of-the-soul-persona",
    title: "Map of the Soul: Persona",
    year: 2019,
  },
  { slug: "map-of-the-soul-7", title: "Map of the Soul: 7", year: 2020 },
  { slug: "be", title: "BE", year: 2020 },
  { slug: "butter", title: "Butter", year: 2021 },
  { slug: "proof", title: "Proof", year: 2022 },
];

type Song = {
  title: string;
  album: string;
  year: number;
  previewUrl: string;
  artwork: string;
};

const A = "https://audio-ssl.itunes.apple.com/itunes-assets/";
const I = "https://is1-ssl.mzstatic.com/image/thumb/";
const SONGS: Song[] = [
  {
    title: "Spring Day",
    album: "You Never Walk Alone",
    year: 2017,
    previewUrl: `${A}AudioPreview221/v4/ba/76/d5/ba76d586-0dac-c800-f08d-467aef7dc9c0/mzaf_12707603572181808804.plus.aac.p.m4a`,
    artwork: `${I}Music116/v4/ce/fb/eb/cefbebd4-d53b-8d6c-33cf-2ee55408bd79/8804775077494_Cover.jpg/600x600bb.jpg`,
  },
  {
    title: "DNA",
    album: "Love Yourself 承 'Her'",
    year: 2017,
    previewUrl: `${A}AudioPreview211/v4/c7/13/e4/c713e4f5-632f-5afd-31dd-2c103af851e1/mzaf_237511262542737989.plus.aac.p.m4a`,
    artwork: `${I}Music126/v4/34/a5/93/34a59372-3ebd-ae5f-269d-4c9506864d3f/8804775083280_Cover.jpg/600x600bb.jpg`,
  },
  {
    title: "Fake Love",
    album: "Love Yourself 轉 'Tear'",
    year: 2018,
    previewUrl: `${A}AudioPreview221/v4/83/6f/0f/836f0f3c-fb8d-a70e-5e77-5c87e2d37d62/mzaf_1406277017641177283.plus.aac.p.m4a`,
    artwork: `${I}Music126/v4/02/c5/18/02c518f5-ac06-3321-622e-08d9429fd968/192562556672_Cover.jpg/600x600bb.jpg`,
  },
  {
    title: "Boy With Luv",
    album: "Map of the Soul: Persona",
    year: 2019,
    previewUrl: `${A}AudioPreview211/v4/0b/8d/84/0b8d84e5-5273-ae21-0c6e-591af6097294/mzaf_16252906211188582302.plus.aac.p.m4a`,
    artwork: `${I}Music116/v4/40/d4/93/40d493e3-ac9e-1746-8d4c-f380f27c97cb/193483706238_Cover.jpg/600x600bb.jpg`,
  },
  {
    title: "Dynamite",
    album: "BE",
    year: 2020,
    previewUrl: `${A}AudioPreview221/v4/a3/a0/a6/a3a0a6b5-4715-b872-1aff-21e42634d9cd/mzaf_7224423421767640589.plus.aac.p.m4a`,
    artwork: `${I}Music116/v4/22/f3/8f/22f38fb9-1690-326a-d891-7aa946c2b06f/195497623273_Cover.jpg/600x600bb.jpg`,
  },
  {
    title: "Butter",
    album: "Butter",
    year: 2021,
    previewUrl: `${A}AudioPreview116/v4/fd/16/2a/fd162abd-e7bb-2dda-0966-802045d9e6b5/mzaf_16580954066183351090.plus.aac.p.m4a`,
    artwork: `${I}Music126/v4/41/c8/dc/41c8dcd8-f883-adde-c762-dc49383b6b58/196006720476_Cover.jpg/600x600bb.jpg`,
  },
  {
    title: "Life Goes On",
    album: "BE",
    year: 2020,
    previewUrl: `${A}AudioPreview211/v4/7f/63/1c/7f631c84-92f2-0805-22cf-8b15ddae12ce/mzaf_7122502015402982287.plus.aac.p.m4a`,
    artwork: `${I}Music116/v4/22/f3/8f/22f38fb9-1690-326a-d891-7aa946c2b06f/195497623273_Cover.jpg/600x600bb.jpg`,
  },
  {
    title: "Yet To Come",
    album: "Proof",
    year: 2022,
    previewUrl: `${A}AudioPreview221/v4/12/a9/3d/12a93d0b-036b-170b-09fa-379d785e63b7/mzaf_17633343337902112849.plus.aac.p.m4a`,
    artwork: `${I}Music122/v4/f7/68/9c/f7689ce3-6d41-60cd-62d2-57a91ddf5b9d/196922067341_Cover.jpg/600x600bb.jpg`,
  },
];

const appleSearch = (s: Song) =>
  `https://music.apple.com/us/search?term=${encodeURIComponent(`BTS ${s.title}`)}`;

/* ───────── helpers ───────── */

const rand = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

/* ───────── stage ─────────
   A painted stadium stage, empty: the arena and its LED wall, the truss with
   four moving heads and their beams, a glossy floor. The members are the show.

   It is on the site camera (worlds strength), back to front: the arena at 18,
   the beams and the truss that throws them at 16 (registered: they move as
   one), the floor lip at 14, the member at 12.5 in front of all of it. The
   painting keeps its middle half free of light, so a beam never crosses the
   photo; the beams sweep a degree or two about their heads. The beams are
   soft light, so they always come from the half-size file. */

const STAGE: StageSpec = { id: "bts", plates: [], camera: { strength: STRENGTH.world } };
const D = { back: 18, rig: 16, confetti: 15, front: 14, member: 12.5, sleeve: 12, record: 13.5 } as const;

const ARENA = { w: 2000, h: 1400, half: 1000 } as const;
type Plate = "back" | "beams" | "mid" | "front";

/** A few pieces of confetti still falling behind the member long after the encore. */
const CONFETTI = (() => {
  const r = rand(53);
  const colors = ["var(--bt-soft)", "var(--bt-accent)", "var(--bt-confetti-light)"];
  return Array.from({ length: 10 }, (_, i) => ({
    x: Math.round(6 + ((i + r()) / 10) * 88),
    dur: +(23 + r() * 17).toFixed(1),
    delay: -+(r() * 40).toFixed(1),
    drift: Math.round(-40 + r() * 80),
    flip: +(2.4 + r() * 1.6).toFixed(1),
    color: colors[i % 3],
  }));
})();

function Layer({ d, className, children }: { d: number; className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, d);
  return (
    <div ref={ref} className={className} aria-hidden="true">
      {children}
    </div>
  );
}

function ArenaImg({ plate, m }: { plate: Plate; m: Mode }) {
  const set = BTS_STAGE[m];
  const half = art(set[`${plate}Half`]);
  const beams = plate === "beams";
  const full = beams ? half : art(set[plate]);
  return (
    <img
      src={full}
      srcSet={beams ? undefined : halfSet(full, ARENA.w, half, ARENA.half, 1.6)}
      sizes={beams ? undefined : "auto, 100vw"}
      data-set={m}
      alt=""
      width={beams ? ARENA.half : ARENA.w}
      height={beams ? ARENA.half * 0.7 : ARENA.h}
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
        // each pair of beams sweeps about its own heads, mirrored
        <>
          <div className="bt-sweep" data-side="l">
            {imgs}
          </div>
          <div className="bt-sweep" data-side="r">
            {imgs}
          </div>
        </>
      ) : (
        imgs
      )}
      {children}
    </div>
  );
}

/* ───────── vinyl ───────── */

function Record({ slug, label }: { slug: string; label: string }) {
  const id = `bt-lbl-${slug}`;
  return (
    <svg className="bt-record" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <circle cx="100" cy="100" r="36" />
        </clipPath>
      </defs>
      <circle cx="100" cy="100" r="99" className="bt-vinyl" />
      {Array.from({ length: 18 }, (_, i) => (
        <circle
          key={i}
          cx="100"
          cy="100"
          r={44 + i * 3.1}
          className="bt-groove"
          opacity={i % 5 === 0 ? 0.55 : 0.22}
        />
      ))}
      <circle cx="100" cy="100" r="96" className="bt-groove" opacity="0.6" />
      <path d="M100 6A94 94 0 0 1 178 48L100 100Z" className="bt-sheen" />
      <path d="M100 194A94 94 0 0 1 22 152L100 100Z" className="bt-sheen" />
      <image
        href={label}
        x="64"
        y="64"
        width="72"
        height="72"
        clipPath={`url(#${id})`}
        preserveAspectRatio="xMidYMid slice"
      />
      <circle cx="100" cy="100" r="36" className="bt-label-ring" />
      <circle cx="100" cy="100" r="3.2" className="bt-spindle" />
    </svg>
  );
}

/* ───────── player ───────── */

const BARS = 30;

function fmt(t: number) {
  const s = Math.max(0, Math.floor(t));
  return `0:${String(s).padStart(2, "0")}`;
}

function Player({ visible }: { visible: boolean }) {
  const mode = useMode();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levels = useRef(new Float32Array(BARS));
  const raf = useRef(0);
  const song = SONGS[index];

  const ensureGraph = () => {
    const audio = audioRef.current;
    if (!audio || ctxRef.current) return;
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const srcNode = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      srcNode.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      // no WebAudio: the preview still plays, the bars fall back to a gentle idle
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) return false;
    const g = canvas.getContext("2d");
    if (!g) return false;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr))
      canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr))
      canvas.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const css = getComputedStyle(canvas);
    const top = css.getPropertyValue("--bt-eq-top").trim() || "#f3ecff";
    const bottom = css.getPropertyValue("--bt-eq-bottom").trim() || "#8b5cf6";
    const idle =
      css.getPropertyValue("--bt-eq-idle").trim() || "rgba(201,167,255,.3)";

    const an = analyserRef.current;
    const live = !audio.paused && !audio.ended;
    const L = levels.current;
    let moving = false;
    if (an && live) {
      const data = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(data);
      for (let i = 0; i < BARS; i++) {
        // log-spaced bins so the bass doesn't swallow the whole meter
        const a = Math.floor(Math.pow(i / BARS, 1.6) * 90) + 1;
        const b = Math.max(
          a + 1,
          Math.floor(Math.pow((i + 1) / BARS, 1.6) * 90) + 1,
        );
        let sum = 0;
        for (let j = a; j < b; j++) sum += data[j];
        const v = sum / (b - a) / 255;
        L[i] = Math.max(v * (0.75 + i / BARS / 2), L[i] * 0.86);
      }
      moving = true;
    } else if (live) {
      const t = performance.now() / 1000;
      for (let i = 0; i < BARS; i++)
        L[i] =
          0.25 + 0.2 * Math.sin(t * 3 + i * 0.7) * Math.sin(t * 1.3 + i * 0.21);
      moving = true;
    } else {
      for (let i = 0; i < BARS; i++) {
        L[i] *= 0.9;
        if (L[i] > 0.01) moving = true;
      }
    }

    const gap = w < 420 ? 4 : 6;
    const bw = (w - gap * (BARS - 1)) / BARS;
    const base = h * 0.72;
    const grad = g.createLinearGradient(0, 0, 0, base);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    for (let i = 0; i < BARS; i++) {
      const x = i * (bw + gap);
      // at rest the meter keeps a quiet skyline so the space never reads as empty
      const rest =
        0.1 +
        0.16 *
          Math.abs(Math.sin(i * 0.55)) *
          (1 - Math.abs(i - BARS / 2) / BARS);
      const lit = L[i] > rest;
      const bh = Math.max(4, Math.max(L[i], rest) * (base - 4));
      g.fillStyle = lit ? grad : idle;
      g.beginPath();
      g.roundRect(x, base - bh, bw, bh, Math.min(bw / 2, 4));
      g.fill();
      // reflection on the stage floor
      g.globalAlpha = 0.22;
      g.beginPath();
      g.roundRect(x, base + 4, bw, Math.max(2, bh * 0.32), Math.min(bw / 2, 3));
      g.fill();
      g.globalAlpha = 1;
    }

    const d = audio.duration || 30;
    const p = Math.min(1, audio.currentTime / d);
    if (progRef.current) progRef.current.style.transform = `scaleX(${p.toFixed(4)})`;
    if (timeRef.current)
      timeRef.current.textContent = `${fmt(audio.currentTime)} / ${fmt(d)}`;
    return moving;
  }, []);

  const loop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const tick = () => {
      if (draw()) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw, mode, index]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(c);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, [draw]);

  useEffect(() => {
    if (!visible) audioRef.current?.pause();
  }, [visible]);

  const play = (i: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    setFailed(false);
    if (i !== index || !audio.src) {
      audio.src = SONGS[i].previewUrl;
      setIndex(i);
    }
    ensureGraph();
    void ctxRef.current?.resume();
    audio.play().catch(() => setFailed(true));
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) audio.pause();
    else play(index);
  };

  const pick = (i: number) => {
    const audio = audioRef.current;
    if (i === index && audio && !audio.paused) audio.pause();
    else play(i);
  };

  return (
    <div className="bt-player" data-playing={playing || undefined}>
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        preload="none"
        onPlay={() => {
          setPlaying(true);
          loop();
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          if (audioRef.current?.src) setFailed(true);
          setPlaying(false);
        }}
      />

      {/* the record stands on a low riser; the riser's lip is the progress light */}
      <div className="bt-deck">
        <div className="bt-disc">
          <div className="bt-disc-spin">
            <Record slug="np" label={song.artwork.replace("600x600", "360x360")} />
          </div>
          <button
            type="button"
            className="bt-play"
            onClick={toggle}
            aria-label={
              playing ? `Pause ${song.title}` : `Play the ${song.title} preview`
            }
          >
            <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
              {playing ? (
                <path d="M9 7h5v18H9zM18 7h5v18h-5z" rx="1.5" />
              ) : (
                <path d="M11 6.5v19a1.2 1.2 0 0 0 1.8 1l15-9.5a1.2 1.2 0 0 0 0-2l-15-9.5a1.2 1.2 0 0 0-1.8 1z" />
              )}
            </svg>
          </button>
        </div>
        <div className="bt-riser" aria-hidden="true">
          <div className="bt-reflect">
            <div className="bt-disc-spin">
              <Record slug="np-reflect" label={song.artwork.replace("600x600", "360x360")} />
            </div>
          </div>
          <span className="bt-lip">
            <span ref={progRef} className="bt-lip-fill" />
          </span>
        </div>
      </div>

      <div className="bt-np">
        <h3 className="bt-h3">
          <span className="bt-live" aria-hidden="true" />
          Now playing
        </h3>
        <p className="bt-np-title" aria-live="polite">
          {song.title}
        </p>
        <p className="bt-np-meta">
          {song.album}, {song.year}
        </p>
        <canvas ref={canvasRef} className="bt-eq" aria-hidden="true" />
        <div className="bt-np-row">
          <span ref={timeRef} className="bt-time">
            0:00 / 0:30
          </span>
          <a
            className="bt-apple"
            href={appleSearch(song)}
            target="_blank"
            rel="noreferrer"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M9 18.5V6.2l11-2.2v12.3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="6.5" cy="18.5" r="2.8" fill="currentColor" />
              <circle cx="17.5" cy="16.3" r="2.8" fill="currentColor" />
            </svg>
            Listen on Apple Music
            <span className="bt-apple-arrow" aria-hidden="true">
              ↗
            </span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
        {failed && (
          <p className="bt-fail">
            That preview wouldn't load. Try another track, or open it on Apple
            Music.
          </p>
        )}
      </div>

      {/* tonight's setlist, taped to the floor: numbers, hairlines, the current song lit */}
      <div className="bt-setlist">
        <p className="bt-setlist-head" aria-hidden="true">
          <span>Setlist</span>
          <span>{SONGS.length} songs</span>
        </p>
        <ol className="bt-tracks" aria-label="Pick a song">
          {SONGS.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                className="bt-track"
                aria-pressed={i === index}
                onClick={() => pick(i)}
              >
                <span className="bt-track-no" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="bt-track-title">{s.title}</span>
                <svg
                  className="bt-track-eq"
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  aria-hidden="true"
                >
                  <rect x="1" y="6" width="3" height="10" rx="1" />
                  <rect x="6.5" y="2" width="3" height="14" rx="1" />
                  <rect x="12" y="8" width="3" height="8" rx="1" />
                </svg>
                <span className="bt-track-year">{s.year}</span>
                <span className="sr-only">
                  {i === index && playing ? ", playing" : ""}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ───────── shelf ─────────
   Sleeves at 12 and the records behind them at 13.5, on scroll only (the
   shelf scrolls sideways on phones, and a still pointer keeps the rail and
   captions true to their sleeves). */

const SHELF: StageSpec = {
  id: "bts-shelf",
  plates: [],
  camera: { strength: STRENGTH.world, pointer: 0, breath: 0, arrival: { z: 0, ms: 0 } },
};

function Era({ album: a }: { album: Album }) {
  const record = useRef<HTMLDivElement>(null);
  const sleeve = useRef<HTMLDivElement>(null);
  useDepthLayer(record, D.record);
  useDepthLayer(sleeve, D.sleeve);
  return (
    <li className="bt-era">
      <div className="bt-sleeve-wrap">
        <div ref={record} className="bt-record-slot">
          <Record slug={a.slug} label={`/bts/albums/${a.slug}.jpg`} />
        </div>
        <div ref={sleeve} className="bt-sleeve">
          <img src={`/bts/albums/${a.slug}.jpg`} alt={`${a.title} album cover`} width={600} height={600} loading="lazy" decoding="async" />
        </div>
      </div>
      <span className="bt-node" aria-hidden="true" />
      <p className="bt-era-year">{a.year}</p>
      <p className="bt-era-title">{a.title}</p>
    </li>
  );
}

/* ───────── house lights ─────────
   The threshold into the hall: the dark of the doorway, one hairline truss
   across the top, and three beams that come up as you walk in. They throw
   onto the title, never as far down as the stage. */

const HOUSE_BEAMS = [
  { x: 18, angle: -22 },
  { x: 50, angle: 4 },
  { x: 82, angle: 20 },
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

/* ───────── world ───────── */

function Figures({ index }: { index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, D.member);
  return (
    <div ref={ref} className="bt-figures">
      {MEMBERS.map((m, i) => (
        <img
          key={m.slug}
          className="bt-figure"
          data-on={i === index || undefined}
          src={cutout(m.slug)}
          alt={i === index ? `${m.name} of BTS` : ""}
          aria-hidden={i === index ? undefined : true}
          loading={i === 0 ? "eager" : "lazy"}
          fetchPriority={i === 0 ? "high" : undefined}
          decoding="async"
          style={figureStyle(m.slug)}
        />
      ))}
    </div>
  );
}

const ROTATE_MS = 6000;
const cutout = (slug: string) => `/bts/members/${slug}.webp`;

type Hold = {
  hover: boolean;
  focus: boolean;
  hidden: boolean;
  offscreen: boolean;
};

/**
 * Advances the line-up every ROTATE_MS. Time only accrues while nothing holds
 * it (pointer over the stage or switcher, keyboard focus in the switcher, the
 * section off-screen, the tab hidden). The loop stops itself while held, so an
 * off-screen section costs nothing. The active tab's ring reads --bt-p.
 */
function useAutoAdvance(
  index: number,
  setIndex: (fn: (i: number) => number) => void,
) {
  const [auto, setAuto] = useState(false);
  const hold = useRef<Hold>({
    hover: false,
    focus: false,
    hidden: false,
    offscreen: true,
  });
  const elapsed = useRef(0);
  const raf = useRef(0);
  const last = useRef(0);
  const ringRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const indexRef = useRef(index);
  indexRef.current = index;

  const paint = () =>
    ringRefs.current[indexRef.current]?.style.setProperty(
      "--bt-p",
      String(elapsed.current / ROTATE_MS),
    );

  const kick = useCallback(() => {
    if (raf.current || !auto) return;
    last.current = performance.now();
    const tick = (t: number) => {
      const h = hold.current;
      if (h.hover || h.focus || h.hidden || h.offscreen) {
        raf.current = 0;
        return;
      }
      elapsed.current += Math.min(t - last.current, 1000);
      last.current = t;
      if (elapsed.current >= ROTATE_MS) {
        elapsed.current = 0;
        setIndex((i) => (i + 1) % MEMBERS.length);
      }
      paint();
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [auto, setIndex]);

  const set = useCallback(
    (key: keyof Hold, value: boolean) => {
      hold.current[key] = value;
      if (!value) kick();
    },
    [kick],
  );

  // reduced motion: never rotate
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setAuto(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const onVis = () => set("hidden", document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [set]);

  useEffect(() => {
    if (auto) kick();
    else {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    }
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [auto, kick]);

  // new member: clear every ring, restart the clock, warm the next cutout
  useEffect(() => {
    ringRefs.current.forEach((el) => el?.style.setProperty("--bt-p", "0"));
    elapsed.current = 0;
    const next = new Image();
    next.src = cutout(MEMBERS[(index + 1) % MEMBERS.length].slug);
    next.decode?.().catch(() => {});
  }, [index]);

  return { auto, set, ringRefs };
}

export function BtsWorld() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const member = MEMBERS[index];
  const rotation = useAutoAdvance(index, setIndex);
  // the day painting, probed once for the stage (every plate or none)
  const dayBack = useDayArt(art(BTS_STAGE.day.back), sectionRef);
  const dayBeams = useDayArt(art(BTS_STAGE.day.beamsHalf), sectionRef);
  const dayMid = useDayArt(art(BTS_STAGE.day.mid), sectionRef);
  const dayFront = useDayArt(art(BTS_STAGE.day.front), sectionRef);
  const day = dayBack && dayBeams && dayMid && dayFront;
  const { set: setHold } = rotation;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    el.classList.add("bt-js");
    let warmed = false;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        setHold("offscreen", !e.isIntersecting);
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
  }, [setHold]);

  const hoverProps = {
    onPointerEnter: (e: React.PointerEvent) =>
      e.pointerType === "mouse" && setHold("hover", true),
    onPointerLeave: () => setHold("hover", false),
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = MEMBERS.length;
    const map: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowDown: i + 1,
      ArrowLeft: i - 1,
      ArrowUp: i - 1,
      Home: 0,
      End: n - 1,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    const next = (map[e.key] + n) % n;
    setIndex(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section
      id="bts"
      ref={sectionRef}
      aria-labelledby="bt-title"
      data-world="bts"
      className="bt relative isolate overflow-hidden"
    >
      <HouseLights />
      <header className="bt-head bt-wrap bt-enter">
        <h2 id="bt-title" className="bt-display bt-title">
          Borahae, <span className="bt-title-soft">all seven of you</span>
        </h2>
        <p className="bt-lede">
          Borahae means “I purple you”: I'll love you for a long, long time.
          This is my little concert hall for the band on repeat behind most of
          my late-night code.
        </p>
      </header>

      {/* ── line-up ── */}
      <div className="bt-show bt-wrap">
        <DepthStage spec={STAGE} className="bt-stage" data-member={member.slug} {...hoverProps}>
          <Layer d={D.back} className="bt-plate">
            <Arena plate="back" day={day}>
              <div className="bt-screen-name" style={{ "--bt-len": Math.max(member.name.length, 3) } as CSSProperties}>
                <span key={member.slug}>{member.name}</span>
              </div>
            </Arena>
          </Layer>
          <Layer d={D.rig} className="bt-plate">
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
              <span key={i} style={{ "--x": `${c.x}%`, "--dur": `${c.dur}s`, "--delay": `${c.delay}s`, "--drift": `${c.drift}px`, "--c": c.color } as CSSProperties}>
                <i style={{ "--flip": `${c.flip}s` } as CSSProperties} />
              </span>
            ))}
          </Layer>
          <Layer d={D.front} className="bt-plate">
            <Arena plate="front" day={day} />
          </Layer>
          <Figures index={index} />
          <div className="bt-floor-fade" aria-hidden="true" />
        </DepthStage>

        <div className="bt-info">
          <div
            id="bt-panel"
            role="tabpanel"
            aria-labelledby={`bt-tab-${member.slug}`}
            aria-live="off"
            className="bt-panel"
          >
            <div key={member.slug} className="bt-swap">
              <p className="bt-position">
                <svg
                  viewBox="0 0 20 20"
                  width="20"
                  height="20"
                  aria-hidden="true"
                >
                  <path d="M10 1.5l2.3 5.6 6 .5-4.6 3.9 1.4 5.9L10 14.3l-5.1 3.1 1.4-5.9L1.7 7.6l6-.5z" />
                </svg>
                {member.position}
              </p>
              <h3
                className="bt-display bt-name"
                style={{ "--bt-len": member.name.length } as CSSProperties}
              >
                {member.name}
              </h3>
              <p className="bt-line">{member.line}</p>
            </div>
          </div>
        </div>

        <div
          className="bt-lineup"
          role="tablist"
          aria-label="BTS members"
          aria-orientation="horizontal"
          data-auto={rotation.auto || undefined}
          {...hoverProps}
          // keyboard focus holds the rotation; a mouse click's focus does not
          onFocus={(e) => setHold("focus", e.target.matches(":focus-visible"))}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null))
              setHold("focus", false);
          }}
        >
          {MEMBERS.map((m, i) => (
            <button
              key={m.slug}
              id={`bt-tab-${m.slug}`}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-controls="bt-panel"
              tabIndex={i === index ? 0 : -1}
              className="bt-tab"
              onClick={() => setIndex(i)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              <span className="bt-tab-avatar">
                <span
                  className="bt-tab-ring"
                  aria-hidden="true"
                  ref={(el) => {
                    rotation.ringRefs.current[i] = el;
                  }}
                >
                  <svg viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="19" pathLength="1" />
                  </svg>
                </span>
                <span className="bt-tab-face">
                  <img
                    src={`/bts/members/${m.slug}-avatar.webp`}
                    alt=""
                    width={160}
                    height={160}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    onError={(e) => {
                      // no square avatar yet: fall back to the cutout, framed from the top
                      const img = e.currentTarget;
                      if (img.dataset.fallback) return;
                      img.dataset.fallback = "1";
                      img.src = `/bts/members/${m.slug}.webp`;
                    }}
                  />
                </span>
              </span>
              <span className="bt-tab-name">{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── now playing ── */}
      <div className="bt-wrap bt-player-wrap">
        <Player visible={visible} />
      </div>

      {/* ── discography ── */}
      <div className="bt-wrap bt-disco">
        <div className="bt-disco-head">
          <h3 className="bt-display bt-h3-lg">Eras on my shelf</h3>
          <p className="bt-disco-sub">
            Eight records, six years.{" "}
            <span className="bt-hover-copy">
              Hover a sleeve to pull the vinyl out.
            </span>
            <span className="bt-touch-copy">Swipe along the shelf.</span>
          </p>
        </div>
        <DepthStage spec={SHELF}>
          <ol className="bt-shelf">
            {ALBUMS.map((a) => (
              <Era key={a.slug} album={a} />
            ))}
          </ol>
        </DepthStage>
      </div>
    </section>
  );
}
