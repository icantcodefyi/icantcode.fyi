import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";

import { art, FINALE_ART } from "@/lib/art";
import { useDayArt } from "@/lib/day-art";
import { useMode } from "@/lib/mode";
import { EASE, reducedMotion } from "@/lib/motion";
import { Contact } from "./contact";
import "./finale.css";

/**
 * The finale: Guestbook, then Contact, under the hero's own sky. The sky is
 * at infinity, so it holds still (sticky) while both scroll over it; it is
 * the hero's plate, already in the cache, so it costs no bytes. The footer
 * is pulled up over the finale's last stretch (.fn-floor), so the sky stays
 * put behind the meadow to the very end of the page.
 *
 * `wall` is the guestbook itself, which the page hands in already wrapped as
 * a deferred chunk (it carries the auth and RPC client). It fills the band's
 * subgrid: its tally joins the copy column, its panel the right one.
 */

/** The sky plate's natural size and its painted moon (centre, radius), plate px. */
const SKY = [1672, 941] as const;
const MOON = { x: 1435, y: 150.5, r: 76 };
/** Twinkles sit on the plate's own brightest stars (plate px), so they never double them. */
const STARS = [
  [552, 81], [1012, 200], [303, 29], [893, 23], [470, 69], [821, 95],
  [286, 256], [424, 299], [1101, 216], [1183, 87], [1354, 435], [1618, 307],
];
/** Day: three of the hero's painted clouds (sky-day atlas boxes, px) drifting in open sky. */
const ATLAS = [1800, 234] as const;
const CLOUDS = [
  { box: [513, 43, 326, 116], v: 0.13, w: 330, t: 420, at: 0.3 },
  { box: [1405, 34, 342, 118], v: 0.31, w: 290, t: 520, at: 0.86 },
  { box: [943, 2, 363, 131], v: 0.2, w: 380, t: 380, at: 0.55 },
];

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;

export function Finale({ wall }: { wall: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  return (
    <section ref={root} className="finale">
      <Sky near={root} />
      <div className="fn-open" aria-hidden="true" />

      <div className="fn-gb">
        <div className="fn-gb-copy">
          <h2 className="t-head" data-reveal>
            Leave a mark
          </h2>
          <p className="fn-gb-lede" data-reveal style={{ "--d": "80ms" } as CSSProperties}>
            Draw a signature, a doodle or a tiny cat. One per visitor, and it stays on the wall.
          </p>
        </div>
        <div className="fn-gb-wall" data-reveal style={{ "--d": "140ms" } as CSSProperties}>
          {wall}
        </div>
      </div>

      <Contact />
      <div className="fn-floor" aria-hidden="true" />
    </section>
  );
}

function Sky({ near }: { near: RefObject<HTMLElement | null> }) {
  const mode = useMode();
  const dayOk = useDayArt(art(FINALE_ART.day.sky), near);
  const meteor = useRef<HTMLSpanElement>(null);
  useMeteor(near, meteor);
  const img = (m: "night" | "day") => (
    <img src={art(FINALE_ART[m].sky)} data-set={m} alt="" width={SKY[0]} height={SKY[1]} loading="lazy" decoding="async" />
  );
  return (
    <div className="fn-sky" aria-hidden="true">
      {/* the plate's cover rect, so everything below can sit at a point of the painting */}
      <div className="fn-paint">
        {img("night")}
        {dayOk ? img("day") : null}
        <div className="fn-night">
          <span
            className="fn-halo"
            style={{ left: pct(MOON.x, SKY[0]), top: pct(MOON.y, SKY[1]), width: pct(MOON.r * 5.2, SKY[0]) }}
          />
          {STARS.map(([x, y], i) => (
            <span
              key={i}
              className="fn-tw"
              style={
                {
                  left: pct(x, SKY[0]),
                  top: pct(y, SKY[1]),
                  "--t": `${(2.4 + ((i * 0.77) % 2.1)).toFixed(2)}s`,
                  "--d": `${(-((i * 1.37) % 4.5)).toFixed(2)}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        {/* the atlas is the hero's day sprites: only asked for in day mode */}
        {mode === "day" ? (
          <div className="fn-day">
            {CLOUDS.map((c, i) => {
              const [x, y, w, h] = c.box;
              return (
                <span
                  key={i}
                  className="fn-cloud"
                  style={
                    {
                      top: pct(c.v, 1),
                      "--wf": c.w / SKY[0],
                      aspectRatio: `${w} / ${h}`,
                      backgroundImage: `url(${art("/site/sky-day")})`,
                      backgroundSize: `${((ATLAS[0] / w) * 100).toFixed(2)}% auto`,
                      backgroundPosition: `${pct(x, ATLAS[0] - w)} ${pct(y, ATLAS[1] - h)}`,
                      "--t": `${c.t}s`,
                      "--d": `${-c.at * c.t}s`,
                    } as CSSProperties
                  }
                />
              );
            })}
          </div>
        ) : null}
      </div>
      <span ref={meteor} className="fn-meteor" />
    </div>
  );
}

/**
 * Now and then (every 20 to 40 s) a shooting star crosses the open sky at the
 * top of the screen, only while Contact is in view and only at night.
 */
function useMeteor(root: RefObject<HTMLElement | null>, star: RefObject<HTMLSpanElement | null>) {
  useEffect(() => {
    const el = star.current;
    const contact = root.current?.querySelector("#contact");
    if (!el || !contact || reducedMotion()) return;
    let seen = false;
    let timer = 0;
    let anim: Animation | null = null;
    const io = new IntersectionObserver(([e]) => (seen = e.isIntersecting), { threshold: 0.2 });
    io.observe(contact);
    const narrow = window.matchMedia("(max-width: 639px)");
    const fly = () => {
      timer = window.setTimeout(fly, 20_000 + Math.random() * 20_000);
      if (!seen || document.documentElement.dataset.mode === "day") return;
      // open sky: above the Contact title on wide screens, left of the moon on phones
      const [x0, x1, y0, y1] = narrow.matches ? [8, 42, 7, 15] : [16, 46, 4, 12];
      el.style.left = `${x0 + Math.random() * (x1 - x0)}%`;
      el.style.top = `${y0 + Math.random() * (y1 - y0)}%`;
      const a = 152 + Math.random() * 12;
      const run = narrow.matches ? 150 : 260;
      anim = el.animate(
        [
          { transform: `rotate(${a}deg) translateX(0)`, opacity: 0 },
          { opacity: 0.8, offset: 0.2 },
          { opacity: 0.8, offset: 0.6 },
          { transform: `rotate(${a}deg) translateX(${run}px)`, opacity: 0 },
        ],
        { duration: 1100, easing: EASE.in },
      );
    };
    timer = window.setTimeout(fly, 6000 + Math.random() * 8000);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
      anim?.cancel();
    };
  }, [root, star]);
}
