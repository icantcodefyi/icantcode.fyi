import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { SpotifyNowPlaying } from "@/components/spotify-now-playing";
import { art, halfSet } from "@/lib/art";
import { EMAIL, MAILTO, SOCIALS } from "@/lib/site-data";
import "./contact-footer.css";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
const TWITTER = "https://twitter.com/icantcodefyi";
const ELSEWHERE = SOCIALS.filter((s) => s.href !== TWITTER);

/* ── Sky: a seeded star field, so it paints the same on every visit ── */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const rand = seeded(20260411);
const DOTS = Array.from({ length: 90 }, () => {
  const y = rand() ** 1.4 * 62;
  return { x: rand() * 100, y, r: 0.6 + rand() ** 3 * 1.6, o: 0.35 + rand() * 0.6, t: rand() < 0.3, d: rand() * 6 };
});
const SPARKS = [
  { x: 9, y: 9, s: 16, c: "#fdf1f6", d: 0 },
  { x: 31, y: 4, s: 10, c: "#f3c98b", d: 1.8 },
  { x: 47, y: 15, s: 20, c: "#ffb3d1", d: 3.1 },
  { x: 58, y: 6, s: 12, c: "#fdf1f6", d: 0.9 },
  { x: 72, y: 29, s: 9, c: "#f3c98b", d: 2.4 },
  { x: 94, y: 40, s: 14, c: "#ffb3d1", d: 4.2 },
  { x: 22, y: 34, s: 8, c: "#fdf1f6", d: 3.6 },
];

function StarField() {
  return (
    <svg className="cf-stars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {DOTS.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r * 0.09}
          fill="#fdf1f6"
          opacity={d.o}
          className={d.t ? "cf-twinkle" : undefined}
          style={d.t ? ({ "--d": `${d.d}s` } as CSSProperties) : undefined}
        />
      ))}
    </svg>
  );
}

function Sparkles() {
  return (
    <div className="cf-sparks" aria-hidden="true">
      {SPARKS.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className="cf-spark"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, color: s.c, "--d": `${s.d}s` } as CSSProperties}
        >
          <path d="M10 0 C10.8 6.6 13.4 9.2 20 10 C13.4 10.8 10.8 13.4 10 20 C9.2 13.4 6.6 10.8 0 10 C6.6 9.2 9.2 6.6 10 0Z" fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}

/* ── Day: the sun takes the moon's place, with a few slow clouds ── */
const CLOUDS = [
  { x: 6, y: 9, w: 300, t: 140, d: 0 },
  { x: 38, y: 3, w: 220, t: 180, d: -60 },
  { x: 58, y: 30, w: 260, t: 160, d: -30 },
  { x: 18, y: 44, w: 180, t: 200, d: -120 },
];

function DaySky() {
  return (
    <div className="cf-day" aria-hidden="true">
      <div className="cf-sun">
        <div className="cf-sun-rays" />
        <div className="cf-sun-disc" />
      </div>
      {CLOUDS.map((c, i) => (
        <span
          key={i}
          className="cf-cloud"
          style={{ left: `${c.x}%`, top: `${c.y}%`, width: c.w, "--t": `${c.t}s`, "--d": `${c.d}s` } as CSSProperties}
        />
      ))}
    </div>
  );
}

/* ── Ground: three painted ridges; the front one is the footer's pink ── */
function Ground() {
  return (
    <svg className="cf-ground" viewBox="0 0 1440 300" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="cf-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--cf-far-0)" }} />
          <stop offset="1" style={{ stopColor: "var(--cf-far-1)" }} />
        </linearGradient>
        <linearGradient id="cf-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--cf-mid-0)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--cf-mid-1)" }} />
          <stop offset="1" style={{ stopColor: "var(--cf-mid-2)" }} />
        </linearGradient>
        <linearGradient id="cf-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--cf-front-0)" }} />
          <stop offset="0.35" style={{ stopColor: "var(--blush)" }} />
          <stop offset="1" style={{ stopColor: "var(--blush)" }} />
        </linearGradient>
        <filter id="cf-rim" x="-5%" y="-50%" width="110%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <path
        d="M0 112 C120 70 220 64 330 92 C430 118 520 62 640 58 C760 54 860 104 980 96 C1100 88 1190 40 1300 46 C1370 50 1410 66 1440 76 L1440 300 L0 300Z"
        fill="url(#cf-far)"
      />
      <path
        d="M0 170 C150 128 300 120 450 150 C600 180 700 132 860 126 C1000 122 1100 150 1220 142 C1320 136 1390 118 1440 112 L1440 300 L0 300Z"
        fill="url(#cf-mid)"
      />
      <path
        d="M0 236 C180 200 360 190 540 206 C700 220 800 196 900 176 C980 160 1080 154 1180 156 C1300 158 1380 170 1440 180"
        fill="none"
        style={{ stroke: "var(--cf-rim)", opacity: "var(--cf-rim-o)" }}
        strokeWidth="10"
        filter="url(#cf-rim)"
      />
      <path
        d="M0 236 C180 200 360 190 540 206 C700 220 800 196 900 176 C980 160 1080 154 1180 156 C1300 158 1380 170 1440 180 L1440 300 L0 300Z"
        fill="url(#cf-front)"
      />
    </svg>
  );
}

/* Meadow flowers: clustered, nearer ones bigger, a few gold-hearted whites. */
const FLOWERS = Array.from({ length: 30 }, (_, i) => {
  const cluster = [6, 22, 40, 58, 80, 94][i % 6];
  const x = Math.min(98, Math.max(1, cluster + (rand() - 0.5) * 16));
  const b = 2 + rand() ** 1.3 * 34;
  const s = Math.round(30 - b * 0.55 + rand() * 6);
  return { x, b, s, c: rand() < 0.55 ? "#ff2e88" : "#fdf1f6" };
}).sort((p, q) => q.b - p.b);

function Flowers() {
  return (
    <div className="cf-flowers" aria-hidden="true">
      {FLOWERS.map((f, i) => (
        <svg
          key={i}
          viewBox="-12 -12 24 24"
          className="cf-flower"
          style={{ left: `${f.x}%`, bottom: `${f.b}%`, width: f.s, height: f.s, color: f.c } as CSSProperties}
        >
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-6" rx="4.4" ry="6.2" fill="currentColor" transform={`rotate(${a})`} />
          ))}
          <circle r="3" fill="#f3c98b" />
        </svg>
      ))}
    </div>
  );
}

const PETALS = Array.from({ length: 12 }, (_, i) => ({
  x: (i * 37 + 7) % 100,
  d: (i * 1.7) % 11,
  t: 11 + (i % 5) * 2.4,
  s: 8 + (i % 4) * 3,
}));

function Petals() {
  return (
    <div className="cf-petals" aria-hidden="true">
      {PETALS.map((p, i) => (
        <span
          key={i}
          className="cf-petal"
          style={{ left: `${p.x}%`, width: p.s, height: p.s * 0.7, "--d": `${-p.d}s`, "--t": `${p.t}s` } as CSSProperties}
        />
      ))}
    </div>
  );
}

/* ── Live bits ── */
function Clock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const f = () =>
      setT(
        new Intl.DateTimeFormat("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Asia/Kolkata",
        }).format(new Date()),
      );
    f();
    const id = window.setInterval(f, 30_000);
    return () => window.clearInterval(id);
  }, []);
  return <time className="tabular-nums">{t || "—"}</time>;
}

function CopyEmail() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = MAILTO;
    }
  }, []);
  return (
    <button type="button" className="cf-copy" onClick={copy} data-copied={copied ? "" : undefined}>
      <span className="cf-copy-icon" aria-hidden="true">
        {copied ? (
          <svg viewBox="0 0 20 20" width="18" height="18">
            <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" width="18" height="18">
            <rect x="6.5" y="6.5" width="10" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13.5 4.2A2.5 2.5 0 0 0 11.2 3H5.5A2.5 2.5 0 0 0 3 5.5v5.7a2.5 2.5 0 0 0 1.2 2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        )}
      </span>
      <span className="cf-copy-text">{copied ? "Copied to your clipboard" : EMAIL}</span>
      <span className="sr-only" aria-live="polite">
        {copied ? "Email address copied" : ""}
      </span>
    </button>
  );
}

export function Contact() {
  return (
    <section id="contact" className="cf-contact" aria-labelledby="contact-title">
      <div className="cf-sky" aria-hidden="true">
        <img src={art("/site/plate-night-sky")} alt="" width={1672} height={941} loading="lazy" decoding="async" />
        <img
          className="cf-sky-day"
          src={art("/site/plate-day-sky")}
          alt=""
          width={1672}
          height={941}
          loading="lazy"
          decoding="async"
        />
      </div>
      <StarField />
      <Sparkles />
      <DaySky />
      <div className="cf-scrim" aria-hidden="true" />

      <div className="cf-copy-col">
        <h2 id="contact-title" className="cf-title" data-reveal>
          Got an odd idea? <span className="cf-title-pink">Say hi.</span>
        </h2>
        <p className="cf-lede" data-reveal style={{ "--d": "80ms" } as CSSProperties}>
          A DM on Twitter is the quickest way to reach me. Email works too, if your idea needs more room.
        </p>
        <div className="cf-actions" data-reveal style={{ "--d": "140ms" } as CSSProperties}>
          <a className="cf-btn" href={TWITTER} target="_blank" rel="noopener noreferrer">
            Talk to me <span className="cf-arr" aria-hidden="true">→</span>
          </a>
          <CopyEmail />
        </div>

        <dl className="cf-card" data-reveal style={{ "--d": "200ms" } as CSSProperties}>
          <div className="cf-row">
            <dt>Local time</dt>
            <dd>
              <Clock /> in Bengaluru
            </dd>
          </div>
          <div className="cf-row">
            <dt>Home</dt>
            <dd>Bengaluru, from Indore</dd>
          </div>
          <div className="cf-row">
            <dt>Elsewhere</dt>
            <dd className="cf-links">
              {ELSEWHERE.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="link">
                  {s.label}
                </a>
              ))}
              <a href={MAILTO} className="link">
                Email
              </a>
            </dd>
          </div>
          <div className="cf-row cf-row-music">
            <dt>On repeat</dt>
            <dd className="cf-spotify">
              <SpotifyNowPlaying serverUrl={SERVER_URL} />
            </dd>
          </div>
        </dl>
      </div>

      <div className="cf-scene" aria-hidden="true">
        <div className="cf-halo" />
        <Ground />
        <div className="cf-girl">
          <img
            src="/site/scenes/wave-cutout.webp"
            srcSet={halfSet("/site/scenes/wave-cutout.webp", 1122, "/site/scenes/wave-cutout-600.webp", 600)}
            sizes="auto, 100vw"
            alt=""
            width={1122}
            height={1402}
            loading="lazy"
            decoding="async"
          />
        </div>
        <Flowers />
        <Petals />
      </div>
    </section>
  );
}
