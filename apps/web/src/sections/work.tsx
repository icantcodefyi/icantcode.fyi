import { useEffect, useRef, useState, type CSSProperties, type FocusEvent } from "react";
import { DepthStage, useDepthLayer } from "@/components/depth-stage";
import { halfSet, WORK_ART } from "@/lib/art";
import { firstScroll } from "@/lib/day-art";
import { camera, reach, STRENGTH } from "@/lib/depth/camera";
import type { AmbientSpec, PlateSpec, StageSpec } from "@/lib/depth/types";
import { clamp, delay } from "@/lib/motion";
import { kick, useScrollFrame } from "@/lib/scroll-loop";
import { EARLIER, WORK, type Work } from "@/lib/site-data";
import "./work.css";

/** Screenshots ship at 1080w with a 540w half (panes zoom to 1.16 when current). */
const shotSet = (src: string) => halfSet(src, 1080, src.replace(/\.webp$/, "-540.webp"), 540, 1.16);

/** The screenshots wait for the visitor's first scroll, so the hero loads alone. */
function useShots() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    void firstScroll().then(() => alive && setOn(true));
    return () => {
      alive = false;
    };
  }, []);
  return on;
}
const shot = (src: string, on: boolean) => (on ? { src, srcSet: shotSet(src) } : {});

/* ── The scene ──
 * The original painting split into three plates on a 2:3 stage: the sky
 * (extended upward, her removed), her, and the near flowers. Boxes are % of
 * the stage, from T1's offsets, so night and day line up to the pixel. */
type PlateId = keyof typeof WORK_ART.layers;
const [SW, SH] = WORK_ART.size;

function plate(id: PlateId, extra: Pick<PlateSpec, "kind" | "range" | "z"> & Partial<PlateSpec>): PlateSpec {
  const { size, offset } = WORK_ART.layers[id];
  return {
    id,
    art: { night: WORK_ART.night[id], day: WORK_ART.day[id] },
    half: { night: WORK_ART.night[`${id}Half`], day: WORK_ART.day[`${id}Half`] },
    size: [size[0], size[1]],
    box: { x: (offset[0] / SW) * 100, y: (offset[1] / SH) * 100, w: (size[0] / SW) * 100 },
    depth: { atlas: { night: WORK_ART.night.depth, day: WORK_ART.day.depth }, tile: [...WORK_ART.atlas.tiles[id]] },
    ...extra,
  };
}

/* Where each project's pane hangs in the sky, % of the stage (top-left,
 * width), with its tilt and distance. They zig-zag either side of her,
 * clear of her face and the paper plane, evenly spaced from the line that
 * is mid-screen as the dive lands (the first is current then) to the one
 * mid-screen as the copy column lets go (the last). Above them the
 * painting's own panes fill the sky. */
const PANES: { x: number; y: number; w: number; r: number; ry: number; d: number }[] = [
  { x: 3, y: 23, w: 26, r: -5, ry: 14, d: 8.5 }, // Sakura Lang
  { x: 76, y: 34.6, w: 23, r: 4, ry: -14, d: 10 }, // dot/matrix
  { x: -4, y: 42, w: 23, r: -3, ry: 12, d: 9 }, // Slopify
  { x: 74, y: 51, w: 24, r: 3, ry: -10, d: 11 }, // Invoicely
  { x: -5, y: 60.5, w: 23, r: -4, ry: 14, d: 7.5 }, // cattype
  { x: 72, y: 69.2, w: 25, r: 4, ry: -12, d: 9.5 }, // car-paglu
];
/** a pane's height in % of the stage: screenshots are 1800×1407, the stage 2:3 */
const paneH = (w: number) => w * (1407 / 1800) * (SW / SH);

/** keep the petals off her face and every pane */
const CLEAR: NonNullable<AmbientSpec["mask"]> = [
  { x: 30, y: 30, w: 22, h: 16 },
  ...PANES.map((g) => ({ x: g.x - 2, y: g.y - 2, w: g.w + 4, h: paneH(g.w) + 4 })),
];

const STAGE: StageSpec = {
  id: "work",
  plates: [
    plate("sky", { kind: "opaque", range: { far: 300, near: 26, flat: 80 }, pad: [0.08, 0.08, 0.08, 0.08], z: 0 }),
    plate("girl", { kind: "cutout", range: { far: 14, near: 12.2, flat: 13.1 }, grid: [128, 192], z: 1 }),
    // the near flowers rise fastest as the scene scrolls away: their bottom edge feathers out over the sky
    // plate's own painted field, so lifting off it never shows a line
    plate("flowers", { kind: "cutout", range: { far: 9, near: 4.5, flat: 6.5 }, fade: [0, 0, 0.5, 0], z: 2 }),
  ],
  // no breath until the rig stops changing every layer's `scale` each frame (REQUESTS R6): at rest it
  // re-layerized the page, six times the cost of the still scene; the petals keep it alive meanwhile
  camera: { strength: STRENGTH.main, breath: 0 },
  ambient: [
    { kind: "petals", count: 10, depth: [18, 30], mask: CLEAR },
    { kind: "petals", count: 6, depth: [7, 9], mask: CLEAR },
  ],
};
const CAM = camera(STAGE.camera);

/* Phones and tablets: each card hangs on its own camera, alternating
 * distances so neighbours drift apart by a few px as they pass. */
const CARD_D = [9, 11];
const CARDS: StageSpec[] = WORK.map((_, i) => ({
  id: `work-card-${i}`,
  plates: [],
  camera: { strength: 0.05, pointer: 0, breath: 0, arrival: { z: 0, ms: 0 } },
}));

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

/** An invisible copy of a detail: together they give the cell the tallest one's height. */
function Sizer({ w }: { w: Work }) {
  return (
    <div className="wk-detail wk-sizer" aria-hidden="true">
      <p className="wk-tags">{w.tags}</p>
      <p className="wk-name">{w.name}</p>
      <p className="wk-what">{w.what}</p>
      <span className="wk-visit">{site(w.url)} ↗</span>
    </div>
  );
}

interface Hold {
  hover(i: number): void;
  leave(): void;
}

function Pane({ p, i, on, shots, h }: { p: Work; i: number; on: boolean; shots: boolean; h: Hold }) {
  const ref = useRef<HTMLLIElement>(null);
  const g = PANES[i];
  useDepthLayer(ref, g.d);
  return (
    <li
      ref={ref}
      className="wk-pane-slot"
      data-on={on ? "" : undefined}
      style={{ left: `${g.x}%`, top: `${g.y}%`, width: `${g.w}%`, "--r": `${g.r}deg`, "--ry": `${g.ry}deg` } as CSSProperties}
    >
      <a
        className="wk-pane"
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={-1}
        onPointerEnter={() => h.hover(i)}
        onPointerLeave={h.leave}
      >
        <img {...shot(p.shot, shots)} sizes="auto, 100vw" alt="" width={1080} height={844} loading="lazy" decoding="async" />
        <span className="wk-pane-label">{p.name}</span>
      </a>
    </li>
  );
}

/** The trail the paper plane leaves from her fingertips: a glint runs along it. It lives on the sky's distance. */
function Trail() {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, STAGE.plates[0].range.flat);
  return (
    <div ref={ref} className="wk-trail">
      <span className="wk-trail-run" />
    </div>
  );
}

function Card({ p, i, shots }: { p: Work; i: number; shots: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useDepthLayer(ref, CARD_D[i % 2]);
  return (
    <a ref={ref} className="wk-card" href={p.url} target="_blank" rel="noopener noreferrer">
      <span className="wk-card-shot">
        <img
          {...shot(p.shot, shots)}
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
  );
}

function Cards({ from, to, label, shots }: { from: number; to: number; label: string; shots: boolean }) {
  return (
    <ul className="wk-stack" aria-label={label}>
      {WORK.slice(from, to).map((p, k) => {
        const i = from + k;
        return (
          <li key={p.name} data-reveal="settle" style={{ "--d": delay(k % 2) } as CSSProperties}>
            <DepthStage spec={CARDS[i]} className="wk-card-stage">
              <Card p={p} i={i} shots={shots} />
            </DepthStage>
          </li>
        );
      })}
    </ul>
  );
}

/** Project panes nearer a selection than this (css px) don't take it over, so it never flickers between two. */
const HYSTERESIS = 24;

export function RecentWork() {
  const root = useRef<HTMLElement>(null);
  const live = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(0);
  const shots = useShots();
  // scroll selection (desktop): pane centres in document px, cached on measure; hover and focus holds (-1: none)
  const sel = useRef({ cur: 0, hover: -1, focus: -1, timer: 0, stage: 0, centres: [] as number[] });

  const pick = (i: number, quiet: boolean) => {
    const s = sel.current;
    if (i === s.cur) return;
    s.cur = i;
    // set before the content changes: a scroll-driven swap is not announced
    live.current?.setAttribute("aria-live", quiet ? "off" : "polite");
    setCur(i);
  };
  // hover and focus take over from the scroll, which resumes 600ms after both let go
  const resume = () => {
    const s = sel.current;
    clearTimeout(s.timer);
    s.timer = window.setTimeout(() => {
      s.timer = 0;
      kick();
    }, 600);
  };
  const h: Hold = {
    hover(i) {
      const s = sel.current;
      clearTimeout(s.timer);
      s.timer = 0;
      s.hover = i;
      pick(i, false);
    },
    leave() {
      const s = sel.current;
      s.hover = -1;
      if (s.focus >= 0) pick(s.focus, false);
      else resume();
    },
  };
  // focus anywhere in the column holds the current project, so a scroll never swaps out a focused link
  const onFocus = (e: FocusEvent<HTMLElement>) => {
    const s = sel.current;
    const i = Number(e.target.dataset.i ?? s.cur);
    clearTimeout(s.timer);
    s.timer = 0;
    s.focus = i;
    if (s.hover < 0) pick(i, false);
  };
  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    sel.current.focus = -1;
    if (sel.current.hover < 0) resume();
  };

  useScrollFrame(
    root,
    (f) => {
      const s = sel.current;
      if (s.hover >= 0 || s.focus >= 0 || s.timer || !s.centres.length) return;
      const c = f.y + f.vh / 2;
      // the panes' scroll drift, so the one that looks centred is the one picked
      const ds = clamp(c - s.stage, -f.vh, f.vh);
      const dist = (i: number) => Math.abs(s.centres[i] + reach(CAM, PANES[i].d) * ds - c);
      let best = s.cur;
      for (let i = 0; i < s.centres.length; i++) if (dist(i) < dist(best) - HYSTERESIS) best = i;
      pick(best, true);
    },
    {
      onMeasure() {
        const s = sel.current;
        const slots = root.current?.querySelectorAll<HTMLElement>(".wk-pane-slot") ?? [];
        const stage = root.current?.querySelector<HTMLElement>(".wk-scene");
        // no panes on phones and tablets: nothing to select
        if (!stage || !slots.length || !slots[0].offsetParent) {
          s.centres = [];
          return;
        }
        s.stage = docTop(stage) + stage.offsetHeight / 2;
        s.centres = [...slots].map((el) => docTop(el) + el.offsetHeight / 2);
      },
    },
  );

  const earlier = <p className="wk-earlier">Earlier projects, now offline: {EARLIER.join(", ")}.</p>;

  return (
    <section id="work" ref={root} className="wk" aria-labelledby="wk-title">
      <div className="wk-stage">
        <div className="wk-sky" aria-hidden="true" />

        <div className="wk-copy" onFocus={onFocus} onBlur={onBlur}>
          <h2 id="wk-title" className="wk-title" data-reveal>
            Recent <br />
            work
          </h2>
          <p className="wk-lede" data-reveal style={{ "--d": "80ms" } as CSSProperties}>
            Six things I built and shipped, all still live.
          </p>
          <div ref={live} className="wk-live" aria-live="polite" data-reveal style={{ "--d": "80ms" } as CSSProperties}>
            {WORK.map((w) => (
              <Sizer key={w.name} w={w} />
            ))}
            <Detail w={WORK[cur]} />
          </div>
          <ul className="wk-index" aria-label="Projects" data-reveal style={{ "--d": "140ms" } as CSSProperties}>
            {WORK.map((p, i) => (
              <li key={p.name}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-i={i}
                  aria-current={i === cur ? "true" : undefined}
                  onPointerEnter={() => h.hover(i)}
                  onPointerLeave={h.leave}
                >
                  {p.name}
                </a>
              </li>
            ))}
          </ul>
          <div className="wk-earlier-d" data-reveal style={{ "--d": "210ms" } as CSSProperties}>
            {earlier}
          </div>
        </div>

        {/* phones and tablets: the first two panes, then her, then the rest */}
        <Cards from={0} to={2} label="Projects" shots={shots} />

        <DepthStage spec={STAGE} className="wk-scene" aria-hidden="true">
          <div className="wk-veil" />
          <Trail />
          {/* desktop: the projects are the glowing panes around her */}
          <ul className="wk-panes">
            {WORK.map((p, i) => (
              <Pane key={p.name} p={p} i={i} on={i === cur} shots={shots} h={h} />
            ))}
          </ul>
        </DepthStage>

        <Cards from={2} to={WORK.length} label="More projects" shots={shots} />
      </div>
      <div className="wk-earlier-m">{earlier}</div>
    </section>
  );
}

/** document top of an element, from the offset chain (ignores transforms, so depth layers measure at rest) */
function docTop(el: HTMLElement) {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
  return y;
}
