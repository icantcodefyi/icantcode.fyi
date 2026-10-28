import { useRef, useState, type CSSProperties } from "react";
import { art, halfSet } from "@/lib/art";
import { useDayArt } from "@/lib/day-art";
import { EARLIER, WORK, type Work } from "@/lib/site-data";
import { useSceneMotion } from "./scene-motion";
import "./work.css";

const SHIP = "/site/scenes/ship-launch";
/** Screenshots ship at 1080w with a 540w half (panes zoom to 1.16 on hover). */
const shotSet = (src: string) => halfSet(src, 1080, src.replace(/\.webp$/, "-540.webp"), 540, 1.16);
const SHIP_DAY = "/site/scenes/ship-launch-day";

/* Where each project's pane floats in the painting (ship-launch, 4:5).
 * x / y / w are percentages of the painting box; r is the tilt in degrees,
 * z is depth: nearer panes drift further with the pointer and the scroll. */
const PANES: { x: number; y: number; w: number; r: number; ry: number; z: number }[] = [
  { x: -8, y: 8, w: 30, r: -5, ry: 14, z: 1 }, // Sakura Lang
  { x: 66, y: 35, w: 28, r: 4, ry: -14, z: 0.8 }, // dot/matrix
  { x: 77, y: 15, w: 22, r: -3, ry: -10, z: 0.55 }, // Slopify
  { x: 52, y: 66, w: 26, r: 3, ry: -6, z: 1.15 }, // Invoicely
  { x: 76, y: 57, w: 22, r: -4, ry: -12, z: 0.65 }, // cattype
  { x: -2, y: 33, w: 21, r: 5, ry: 16, z: 0.7 }, // car-paglu
];

function site(url: string) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return host.startsWith("chromewebstore") ? "Chrome Web Store" : host;
}

function Detail({ w }: { w: Work }) {
  return (
    <div key={w.name} className="wk-detail">
      <p className="wk-tags">{w.tags}</p>
      <h3 className="wk-name">{w.name}</h3>
      <p className="wk-what">{w.what}</p>
      <a className="wk-visit" href={w.url} target="_blank" rel="noopener noreferrer">
        {site(w.url)} <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

export function RecentWork() {
  const root = useRef<HTMLElement>(null);
  const [cur, setCur] = useState(0);
  useSceneMotion(root);
  const dayArt = useDayArt(art(SHIP_DAY), root);

  const earlier = (
    <p className="wk-earlier">Earlier projects, now offline: {EARLIER.join(", ")}.</p>
  );

  return (
    <section id="work" ref={root} className="wk" aria-labelledby="wk-title">
      <div className="wk-stage">
        <div className="wk-sky" aria-hidden="true" />

        <div className="wk-art">
          <div className="wk-art-in" aria-hidden="true">
            <img
              className="wk-img"
              src={art(SHIP)}
              alt=""
              width={1122}
              height={1402}
              loading="lazy"
              decoding="async"
            />
            {dayArt ? (
              <img className="wk-img wk-img-day" src={art(SHIP_DAY)} alt="" width={1122} height={1402} decoding="async" />
            ) : null}
          </div>

          {/* desktop: the projects are the glowing panes around her */}
          <ul className="wk-panes" aria-hidden="true">
            {WORK.map((p, i) => {
              const g = PANES[i];
              return (
                <li
                  key={p.name}
                  className="wk-pane-slot"
                  style={
                    {
                      "--x": `${g.x}%`,
                      "--y": `${g.y}%`,
                      "--w": `${g.w}%`,
                      "--r": `${g.r}deg`,
                      "--ry": `${g.ry}deg`,
                      "--z": g.z,
                      "--i": i,
                    } as CSSProperties
                  }
                >
                  <a
                    className="wk-pane"
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-hidden="true"
                    tabIndex={-1}
                    data-on={i === cur ? "" : undefined}
                    onMouseEnter={() => setCur(i)}
                  >
                    <img src={p.shot} srcSet={shotSet(p.shot)} sizes="auto, 100vw" alt="" width={1080} height={844} loading="lazy" decoding="async" />
                    <span className="wk-pane-label" aria-hidden="true">
                      {p.name}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="wk-copy">
          <h2 id="wk-title" className="wk-title" data-reveal>
            Recent <br />
            work
          </h2>
          <div className="wk-live" aria-live="polite" data-reveal style={{ "--d": "90ms" } as CSSProperties}>
            <Detail w={WORK[cur]} />
          </div>
          <ul className="wk-index" aria-label="Projects" data-reveal style={{ "--d": "130ms" } as CSSProperties}>
            {WORK.map((p, i) => (
              <li key={p.name}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-current={i === cur ? "true" : undefined}
                  onMouseEnter={() => setCur(i)}
                  onFocus={() => setCur(i)}
                >
                  {p.name}
                </a>
              </li>
            ))}
          </ul>
          <div className="wk-earlier-d" data-reveal style={{ "--d": "160ms" } as CSSProperties}>
            {earlier}
          </div>
        </div>
      </div>

      {/* phone and tablet: a clean stack */}
      <ul className="wk-stack">
        {WORK.map((p) => (
          <li key={p.name} data-reveal>
            <a className="wk-card" href={p.url} target="_blank" rel="noopener noreferrer">
              <span className="wk-card-shot">
                <img
                  src={p.shot}
                  srcSet={shotSet(p.shot)}
                  sizes="auto, 100vw"
                  alt={`${p.name} website`}
                  width={1080}
                  height={844}
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <span className="wk-card-head">
                <span className="wk-card-name">{p.name}</span>
                <span className="wk-card-arr" aria-hidden="true">
                  ↗
                </span>
              </span>
              <span className="wk-card-tags">{p.tags}</span>
              <span className="wk-card-what">{p.what}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="wk-earlier-m">{earlier}</div>
    </section>
  );
}
