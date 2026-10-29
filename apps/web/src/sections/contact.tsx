import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { SpotifyNowPlaying } from "@/components/spotify-now-playing";
import { EMAIL, MAILTO, SOCIALS } from "@/lib/site-data";
import "./contact-footer.css";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
const TWITTER = "https://twitter.com/icantcodefyi";
const ELSEWHERE = SOCIALS.filter((s) => s.href !== TWITTER);

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
      {/* the sky is the finale's (sticky, behind both Guestbook and Contact); this only steadies the copy */}
      <div className="cf-scrim" aria-hidden="true" />

      <div className="cf-body">
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
    </section>
  );
}
