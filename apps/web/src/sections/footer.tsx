import { useEffect, useRef, type CSSProperties, type HTMLAttributes } from "react";

import { DepthStage, useDepthLayer } from "@/components/depth-stage";
import { art, avif, FINALE_ART, FINALE_ART_LAYOUT, halfSet } from "@/lib/art";
import type { StageSpec } from "@/lib/depth/types";
import { useMode } from "@/lib/mode";
import { MAILTO, SOCIALS } from "@/lib/site-data";
import "./contact-footer.css";

/**
 * The footer is the hero's reprise: the same kind of meadow, under the same
 * sky (the finale's, held still behind it), with her sitting on its boulder
 * and the wordmark huge behind her and the ridge, the way the name sits
 * behind her in the hero. A ghost of the wordmark prints across her, and
 * the links sit on the calm ground at the bottom.
 *
 * One camera: the meadow and she are the focus plane (she must not slide on
 * her rock), the wordmark sits just behind the ridge, and the fireflies
 * (petals by day) drift a little nearer. The meadow carries its depth
 * atlas, so the GL backend can give it relief (PLAN F5); without GL it is
 * a flat plate at her distance.
 */

const { meadowSize, sit } = FINALE_ART_LAYOUT;

const STAGE: StageSpec = {
  id: "footer",
  plates: [
    {
      id: "meadow",
      art: { night: FINALE_ART.night.meadow, day: FINALE_ART.day.meadow },
      half: { night: FINALE_ART.night.meadowHalf, day: FINALE_ART.day.meadowHalf },
      size: [meadowSize[0], meadowSize[1]],
      box: { x: 0, y: 0, w: 100 },
      kind: "cutout",
      // her seat (depth ≈ 0.33 in both modes' maps) lands on 13, her own distance, so she never slides on her rock
      range: { far: 15, near: 10.2, flat: 13 },
      depth: {
        atlas: { night: FINALE_ART.night.depth, day: FINALE_ART.day.depth },
        tile: [0, 0, FINALE_ART_LAYOUT.depthSize[0], FINALE_ART_LAYOUT.depthSize[1]],
      },
      z: 2,
    },
  ],
  // no idle breath: in the DOM rig its scale term re-layerizes four big layers every frame at rest
  camera: { breath: 0 },
};

/** She is the focus plane; the wordmark sits just behind the ridge (the relief's far end, 15), as the name sits behind her in the hero. */
const WORD_D = 15.2;
const SIT_D = 13;
const LIFE_D = 10.5;

/** Ambient, % of the meadow box: fireflies along the ridge at night, petals by day (both kept off her). */
const FIREFLIES = [
  [6, 44], [14, 52], [23, 40], [31, 56], [38, 47], [84, 41], [89, 55], [94, 46], [73, 62], [18, 64],
].map(([x, y], i) => ({ x, y, t: [10.3, 13.7, 17.9, 23.1][i % 4], b: [2.4, 3.1, 4.5, 3.7][i % 4], d: -((i * 2.3) % 9) }));
const PETALS = [4, 11, 19, 27, 34, 84, 88, 92, 96, 7].map((x, i) => ({
  x,
  t: [13.7, 17.9, 23.1, 17.9, 13.7][i % 5],
  d: -((i * 3.1) % 23),
  s: 8 + (i % 3) * 3,
}));

function Layer({ d, ...rest }: { d: number } & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, d);
  return <div ref={ref} {...rest} />;
}

/** "icantcode": one line, or "icant / code" on phones. */
const Lines = () => (
  <>
    <span className="ft-l">icant</span>
    <span className="ft-l">code</span>
  </>
);

/**
 * She sits on the boulder. The ghost of the wordmark is masked by her own
 * painting (the file her <img> already chose), so it prints on her and
 * nowhere else.
 */
function Sitter() {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, SIT_D);
  useEffect(() => {
    const el = ref.current;
    const img = el?.querySelector("img");
    if (!el || !img) return;
    const ready = () => {
      if (img.naturalWidth === 0) return el.setAttribute("data-broken", "");
      el.style.setProperty("--mask", `url("${img.currentSrc || img.src}")`);
      el.setAttribute("data-ready", "");
    };
    if (img.complete) ready();
    img.addEventListener("load", ready);
    img.addEventListener("error", ready);
    return () => {
      img.removeEventListener("load", ready);
      img.removeEventListener("error", ready);
    };
  }, []);
  const [w, h] = sit.sourceSize;
  return (
    <div
      ref={ref}
      className="ft-sit"
      aria-hidden="true"
      style={{ left: `${sit.x}%`, top: `${sit.y}%`, width: `${sit.w}%` }}
    >
      {/* where she meets the rock (meadow px 1493, 571; about 350 × 22) */}
      <span className="ft-sit-shadow" />
      <img
        src={art(FINALE_ART.night.sit)}
        srcSet={avif() ? halfSet(`${FINALE_ART.night.sit}.avif`, w, `${FINALE_ART.night.sit}-724.avif`, w / 2) : undefined}
        sizes={avif() ? "auto, 100vw" : undefined}
        alt=""
        width={w}
        height={h}
        loading="lazy"
        decoding="async"
      />
      <div className="ft-ghost">
        <span className="ft-word">
          <Lines />
        </span>
      </div>
    </div>
  );
}

export function SiteFooter() {
  const mode = useMode();
  return (
    <footer className="ft" aria-labelledby="footer-title">
      <DepthStage spec={STAGE} className="ft-stage">
        <Layer d={WORD_D} className="ft-wordlayer">
          <span className="ft-word ft-word-glow" aria-hidden="true">
            <Lines />
          </span>
          <h2 id="footer-title" className="ft-word" aria-label="icantcode.fyi">
            <Lines />
          </h2>
          {/* the foil sheen: a window sweeping across a light copy of the word, which counter-moves so it holds still */}
          <span className="ft-sheen" aria-hidden="true">
            <span className="ft-word">
              <Lines />
            </span>
          </span>
        </Layer>
        <Sitter />
        <Layer d={LIFE_D} className="ft-life" aria-hidden="true">
          {mode === "day"
            ? PETALS.map((p, i) => (
                <span
                  key={i}
                  className="ft-petal"
                  style={{ left: `${p.x}%`, width: p.s, height: p.s * 0.7, "--t": `${p.t}s`, "--d": `${p.d}s` } as CSSProperties}
                />
              ))
            : FIREFLIES.map((f, i) => (
                <span
                  key={i}
                  className="ft-fly"
                  style={{ left: `${f.x}%`, top: `${f.y}%`, "--t": `${f.t}s`, "--b": `${f.b}s`, "--d": `${f.d}s` } as CSSProperties}
                />
              ))}
        </Layer>
      </DepthStage>

      <div className="ft-base">
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
    </footer>
  );
}
