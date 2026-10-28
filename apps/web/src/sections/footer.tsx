import { useEffect, useRef } from "react";
import { art, avif, halfSet } from "@/lib/art";
import { MAILTO, SOCIALS } from "@/lib/site-data";
import "./contact-footer.css";

export function SiteFooter() {
  const root = useRef<HTMLElement>(null);

  // The sitting art may not exist yet; hide a failed image instead of showing a broken icon.
  useEffect(() => {
    const img = root.current?.querySelector<HTMLImageElement>(".ft-sit img");
    if (!img) return;
    const mark = () => img.setAttribute("data-broken", "");
    if (img.complete && img.naturalWidth === 0) mark();
    img.addEventListener("error", mark);
    return () => img.removeEventListener("error", mark);
  }, []);

  return (
    <footer ref={root} className="ft" aria-labelledby="footer-title">
      <div className="ft-top">
        <ul className="ft-links">
          {SOCIALS.map((s) => (
            <li key={s.label}>
              <a href={s.href} target="_blank" rel="noopener noreferrer" className="link">
                {s.label}
              </a>
            </li>
          ))}
          <li>
            <a href={MAILTO} className="link">
              Email
            </a>
          </li>
          <li>
            <a href="#top" className="link">
              Back to top
            </a>
          </li>
        </ul>
        <div className="ft-legal">
          <p>© 2026 Aniruddh Dubge. Press ⌘K to jump around, or ` for a terminal.</p>
          <p>Character art © Riot Games, HoYoverse and the anime studios. Photos are mine.</p>
        </div>
      </div>

      <div className="ft-mark">
        <h2 id="footer-title" className="wordmark foil-text" aria-label="icantcode.fyi">
          icantcode
        </h2>
        <div className="ft-sit" aria-hidden="true">
          <img
            src={art("/site/scenes/sit-cutout")}
            srcSet={avif() ? halfSet("/site/scenes/sit-cutout.avif", 1448, "/site/scenes/sit-cutout-724.avif", 724) : undefined}
            sizes={avif() ? "auto, 100vw" : undefined}
            alt=""
            width={1448}
            height={1086}
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </footer>
  );
}
