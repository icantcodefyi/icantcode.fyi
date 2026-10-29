import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { DepthStage, useDepthLayer } from "@/components/depth-stage";
import { avif } from "@/lib/art";
import type { StageSpec } from "@/lib/depth/types";
import { damp, reducedMotion, smooth } from "@/lib/motion";
import { useScrollFrame } from "@/lib/scroll-loop";
import {
  BH,
  BW,
  bubbleGeometry,
  f,
  focusLines,
  rng,
  SEPARATIONS,
  separation,
  sfxGlyphs,
  trailLines,
} from "./anime/ink";
import { layout, quadClip, type Layout, type PageBox, type PanelBox, type PanelId } from "./anime/layout";
import { fit, sfxBox, solveAll, textWidth, type Rect, type Solved } from "./anime/place";
import { SHOWS, type Corner, type Place, type Show } from "./anime/shows";

/**
 * The Anime world: the watchlist as a two-colour riso manga spread. The
 * page is ruled in JS (anime/layout.ts) so its gutters can slant; each
 * panel is its own camera on the site camera (the poster far, the balloon
 * and SFX near, so they part as the page scrolls), and each prints itself
 * as it comes into view: the frame is ruled, the poster's black plate
 * prints through a halftone screen, the blue plate slides into register,
 * the SFX stamps down glyph by glyph and the balloon pops. Posters print
 * as black + Riso Blue; the one in focus (hover, keyboard, or the middle of
 * a phone screen) floods to full colour through the same screen.
 */

/* ── ink ── */

const TONE_STEPS = 12;
const toneRadius = (i: number) => 0.32 + i * 0.32;
const TITLE_LINES = focusLines(99);
const TRAILS = Object.fromEntries([...SHOWS.map((s) => s.id), "title"].map((id, i) => [id, trailLines(5 + i * 17)]));

function Defs() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <defs>
        {(["ink", "spot", "line"] as const).flatMap((c) =>
          Array.from({ length: TONE_STEPS }, (_, i) => {
            const rad = toneRadius(i);
            return (
              <pattern key={`${c}${i}`} id={`an-${c}-${i}`} width="7" height="7" patternUnits="userSpaceOnUse">
                <g className={`an-fill-${c}`}>
                  <circle cx="0" cy="0" r={rad} />
                  <circle cx="7" cy="0" r={rad} />
                  <circle cx="0" cy="7" r={rad} />
                  <circle cx="7" cy="7" r={rad} />
                  <circle cx="3.5" cy="3.5" r={rad} />
                </g>
              </pattern>
            );
          }),
        )}
        {SEPARATIONS.map((s) => {
          const { matrix, tables } = separation(s);
          return (
            <filter key={s.id} id={s.id} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
              <feColorMatrix type="matrix" values={matrix} />
              <feComponentTransfer>
                <feFuncR type="table" tableValues={tables[0]} />
                <feFuncG type="table" tableValues={tables[1]} />
                <feFuncB type="table" tableValues={tables[2]} />
              </feComponentTransfer>
            </filter>
          );
        })}
      </defs>
    </svg>
  );
}

function Tone({ corner, color, size, max = TONE_STEPS }: { corner: Corner; color: "ink" | "spot" | "line"; size: number; max?: number }) {
  const span = size * 1.42;
  const bw = span / TONE_STEPS;
  return (
    <svg aria-hidden="true" className={`an-tone an-tone-${corner}`} width={size} height={size}>
      <g transform={`translate(${size} ${size}) rotate(225)`}>
        {Array.from({ length: TONE_STEPS }, (_, i) => (
          <rect key={i} x={f(i * bw)} y={-size} width={f(bw + 0.6)} height={size * 2} fill={`url(#an-${color}-${Math.max(0, max - 1 - i)})`} />
        ))}
      </g>
    </svg>
  );
}

/**
 * SFX lettering: each glyph its own outline, paper rim and fill, stacked
 * like hand-lettered katakana. Every glyph (and its blue plate) is drawn on
 * its own layer the size of the whole word, so stamping it down moves a box
 * the compositor can carry, never SVG geometry, which would relayout the
 * lettering on every frame.
 */
function Sfx({ text, vertical, fill }: { text: string; vertical?: boolean; fill: "ink" | "spot" }) {
  const { glyphs, w, h } = sfxGlyphs(text, vertical);
  const box = `0 0 ${w} ${h}`;
  const glyph = (g: (typeof glyphs)[number], cls?: string) => (
    <text className={cls} x="0" y="36" textAnchor="middle">
      {g.c}
    </text>
  );
  return (
    <span aria-hidden="true" className="an-sfx" style={{ width: `${w / 100}em`, height: `${h / 100}em` }}>
      {glyphs.map((g, i) => (
        <span
          key={i}
          className="an-glyph"
          style={{ "--g": i, transformOrigin: `${f((g.x / w) * 100)}% ${f((g.y / h) * 100)}%` } as CSSProperties}
        >
          <svg viewBox={box}>
            <g transform={g.t}>
              {glyph(g, "an-sfx-out")}
              {glyph(g, "an-sfx-rim")}
              {fill === "ink" ? glyph(g, "an-sfx-ink") : null}
            </g>
          </svg>
          {fill === "spot" ? (
            <svg viewBox={box} className="an-sfx-spot">
              <g transform={g.t}>{glyph(g)}</g>
            </svg>
          ) : null}
        </span>
      ))}
    </span>
  );
}

const px = (r: Rect): CSSProperties => ({ left: f(r.x), top: f(r.y), width: f(r.w) });

/** An SFX on the near plane, with motion lines that trail it while the page moves (useTrails). */
function SfxLayer({ id, at, size, children }: { id: string; at: { x: number; y: number }; size: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, SFX_D);
  return (
    <div ref={ref} className="an-sfx-wrap" style={{ left: f(at.x), top: f(at.y), fontSize: size }}>
      <svg aria-hidden="true" className="an-trail" viewBox="0 0 100 200" preserveAspectRatio="none">
        <path d={TRAILS[id]} />
      </svg>
      <div className="an-sfx-hit">{children}</div>
    </div>
  );
}

function Bubble({ show, at }: { show: Show; at: Rect & { tail: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, BUBBLE_D);
  // the tail is aimed per layout (anime/place.ts), so the outline is drawn per layout too
  const g = useMemo(() => bubbleGeometry(41 + SHOWS.indexOf(show) * 13, show.bubble, at.tail), [show, at.tail]);
  return (
    <div ref={ref} className={`an-bubble-wrap an-bubble-${show.bubble}`} style={px(at)}>
      <div className="an-bubble" style={{ transformOrigin: g.origin }}>
        <svg aria-hidden="true" viewBox={`0 0 ${BW} ${BH}`} preserveAspectRatio="none">
          <path className="an-bubble-paper" d={g.inner} />
          <path className="an-bubble-ink" d={g.ring} fillRule="evenodd" />
        </svg>
        <p>{show.line}</p>
      </div>
    </div>
  );
}

/* ── the camera ── */

/**
 * Each panel is a stage on the site camera, a little stronger than the
 * worlds' default so the planes inside a frame visibly part: the poster
 * sits behind the frame and lags the scroll, the balloon and the SFX sit in
 * front and lead it. Scroll only (no pointer, no breath), and the eye eases
 * back once as the panel arrives, so the art settles into its frame.
 */
const CAMERA = { strength: 0.1, pointer: 0, breath: 0, arrival: { z: 0.6, ms: 1400 } };
const ART_D = 22;
const BUBBLE_D = 10.5;
const SFX_D = 9;
/** the poster's overscan above and below its frame, px: ≥ its drift (≈ 0.041 px per px of scroll, capped at a viewport) */
const OVERSCAN = 46;

const STAGES: Record<string, StageSpec> = Object.fromEntries(
  (["title", ...SHOWS.map((s) => s.id)] as PanelId[]).map((id) => [id, { id: `anime-${id}`, plates: [], camera: CAMERA }]),
);

/** How far a poster that fills only part of its panel dissolves into the screentone beyond it, px (anime.css .an-art-part). */
const ART_FADE = 80;

/** Each poster ships at its full size and at this width, as AVIF, or WebP where the browser can't decode AVIF. */
const POSTER_SMALL = 600;
/** a strip this narrow is a phone's */
const PHONE_W = 540;
const poster = (show: Show, w: number) => `/lobby/anime/${show.img}-${w}.${avif() ? "avif" : "webp"}`;

function Art({ show, box, place, phone }: { show: Show; box: PanelBox; place: Place; phone: boolean }) {
  const part = place.art;
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, ART_D);
  const h = box.h + 2 * OVERSCAN;
  const w = box.w * (part?.span ?? 1);
  const { ox, oy, dw, dh } = fit(show.size, place.focus ?? show.focus, w, h, part?.zoom);
  // cropped in past a cover fit, the poster is sized and placed outright
  const at: CSSProperties = part ? { inset: "auto", left: f(ox), top: f(oy), width: f(dw), height: f(dh), maxWidth: "none" } : { objectPosition: `${f(ox)}px ${f(oy)}px` };
  const full = poster(show, show.size[0]);
  // the file is picked by the width the poster is drawn at, with room for the focus zoom (anime.css .an-art-in);
  // a phone keeps to the small one: at 3× the full one would cost its first pass down the strip ~5 frames (4× CPU)
  const srcSet = phone ? undefined : `${poster(show, POSTER_SMALL)} ${POSTER_SMALL}w, ${full} ${show.size[0]}w`;
  const sizes = phone ? undefined : `${Math.ceil(dw * 1.06)}px`;
  const img = (cls: string, alt: string) => (
    <img
      className={`an-plate ${cls}`}
      src={phone ? poster(show, POSTER_SMALL) : full}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={show.size[0]}
      height={show.size[1]}
      loading="lazy"
      decoding="async"
      style={at}
    />
  );
  return (
    <div
      ref={ref}
      className={part ? "an-art an-art-part" : "an-art"}
      style={{ top: -OVERSCAN, height: h, ...(part && { width: f(w), "--fade": `${ART_FADE}px` }) }}
    >
      <div className="an-art-in">
        {img("an-plate-k", `${show.title} key visual`)}
        {img("an-plate-b", "")}
        {img("an-plate-c", "")}
      </div>
    </div>
  );
}

/** Screentone laid down where a poster stops short of its frame: nothing under the poster's fade, building to the frame. */
function ToneField({ box, span }: { box: PanelBox; span: number }) {
  const x = box.w * span - ART_FADE;
  const w = box.w - x;
  const bw = w / TONE_STEPS;
  return (
    <svg aria-hidden="true" className="an-tone-field" style={{ left: f(x) }} width={f(w)} height={box.h}>
      {Array.from({ length: TONE_STEPS }, (_, i) => (
        <rect key={i} x={f(i * bw)} y="0" width={f(bw + 0.6)} height={box.h} fill={`url(#an-spot-${Math.round((i / (TONE_STEPS - 1)) * 6)})`} />
      ))}
    </svg>
  );
}

/** ?an-faces: draw each poster's faces where they land, to check nothing covers them. */
function Faces({ faces }: { faces: Rect[] }) {
  return (
    <>
      {faces.map((r, i) => (
        <i key={i} className="an-face-dbg" style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />
      ))}
    </>
  );
}

/* ── frames ── */

function Frame({ box, stroke, seed }: { box: PanelBox; stroke: number; seed: number }) {
  const r = rng(seed);
  const q = box.quad;
  return (
    <svg aria-hidden="true" className="an-frame" width={box.w} height={box.h}>
      {q.map((p, e) => {
        const n = q[(e + 1) % 4];
        // the ruling pen: a touch heavier on the verticals, never quite even
        const sw = stroke * (Math.abs(n[0] - p[0]) > Math.abs(n[1] - p[1]) ? 0.92 : 1.08) + r() * 0.6;
        return (
          <line
            key={e}
            className="an-edge"
            x1={f(p[0])}
            y1={f(p[1])}
            x2={f(n[0])}
            y2={f(n[1])}
            pathLength={1}
            strokeWidth={f(sw)}
            style={{ "--e": e } as CSSProperties}
          />
        );
      })}
    </svg>
  );
}

/** A panel's box in its page's leaf. */
function boxStyle(b: PanelBox, i: number, lay: Layout): CSSProperties {
  const page = lay.pages.find((p) => p.n === b.page) ?? lay.pages[0];
  return { left: b.x - page.x, top: b.y - page.y, width: b.w, height: b.h, "--i": i } as CSSProperties;
}

/** a tuning aid for the dev server only */
const showFaces = import.meta.env.DEV && typeof location !== "undefined" && location.search.includes("an-faces");

/**
 * The narration box's size for the solver (anime.css .an-caption): as wide as
 * its longest line plus its padding and rule, and three lines tall. On a phone
 * the meta says "eps", as MyAnimeList does, so the box fits a strip's crowded tiers.
 */
const CAPTION_H = 78;
const epsWord = (lay: Layout) => (lay.kind === "strip" ? "eps" : "episodes");
const metaLine = (show: Show, lay: Layout) => `${show.year} · ${show.eps} ${epsWord(lay)} · ${show.score}%`;
function captionSize(show: Show, lay: Layout) {
  const w = Math.max(
    textWidth(show.title, '400 16px "Dela Gothic One"', 16),
    textWidth(show.native, '500 12.5px "Zen Kaku Gothic New"', 12.5),
    textWidth(metaLine(show, lay), "500 13.5px Onest", 13.5),
  );
  // its padding and rule, and a breath more so the longest line never runs into the rule
  return { w: Math.ceil(w + 2 * 10 + 2 * 2.5 + 8), h: CAPTION_H };
}

function Panel({ show, box, lay, index, at }: { show: Show; box: PanelBox; lay: Layout; index: number; at: Solved }) {
  const hint = lay.kind === "strip" ? show.strip : show.page;
  const clip = quadClip(box.quad);
  return (
    <article
      tabIndex={0}
      data-panel={show.id}
      aria-labelledby={`an-${show.id}`}
      className={`an-panel an-bubble-${show.bubble}`}
      style={boxStyle(box, index, lay)}
    >
      <div aria-hidden="true" className="an-spot" style={{ clipPath: clip }} />
      <DepthStage spec={STAGES[show.id]} className="an-stage">
        <div className={hint.art ? "an-cell an-cell-part" : "an-cell"} style={{ clipPath: clip }}>
          {hint.art ? <ToneField box={box} span={hint.art.span} /> : null}
          <Art show={show} box={box} place={hint} phone={lay.kind === "strip" && lay.w < PHONE_W} />
          {showFaces ? <Faces faces={at.faces} /> : null}
        </div>
        <Frame box={box} stroke={lay.stroke} seed={index * 11 + 3} />
        <div className="an-caption" style={px(at.cap.rect)}>
          <h3 id={`an-${show.id}`} className="an-caption-title">
            {show.title}
          </h3>
          <p lang="ja" className="an-caption-ja">
            {show.native}
          </p>
          <p className="an-caption-meta">
            {show.year} · {show.eps} <span aria-hidden={lay.kind === "strip" || undefined}>{epsWord(lay)}</span>
            {lay.kind === "strip" ? <span className="sr-only">episodes</span> : null} ·{" "}
            <span className="sr-only">AniList score </span>
            {show.score}%
          </p>
        </div>
        <Bubble show={show} at={at.bubble} />
        <SfxLayer id={show.id} at={at.sfx} size={hint.sfx.size}>
          <Sfx text={show.sfx} vertical={show.sfxVertical} fill={show.sfxFill} />
        </SfxLayer>
      </DepthStage>
    </article>
  );
}

function TitleLines() {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, 18);
  return (
    <div ref={ref} className="an-title-lines">
      <svg aria-hidden="true" className="an-lines" viewBox="0 0 400 300" preserveAspectRatio="none">
        <path d={TITLE_LINES} />
      </svg>
    </div>
  );
}

const DISPLAY = ["Watch", "list"];

/** The splash's ドン！, breaking out over its top right corner: its box in the panel, px. */
function donAt(box: PanelBox, lay: Layout) {
  const strip = lay.kind === "strip";
  const size = strip ? 44 : 56;
  const { w, h } = sfxBox({ sfx: "ドン！" }, size);
  // on a phone it rides higher, clear of the kicker that runs nearly the width of the strip
  return { x: box.w - w * (strip ? 0.92 : 0.86), y: -h * (strip ? 0.56 : 0.5), w, h, size };
}

function TitlePanel({ box, lay }: { box: PanelBox; lay: Layout }) {
  const clip = quadClip(box.quad);
  // the copy keeps clear of the slanted foot: the panel's shorter side
  const foot = Math.min(box.quad[2][1], box.quad[3][1]);
  const don = donAt(box, lay);
  let n = 0;
  return (
    <div className="an-panel an-title" style={boxStyle(box, 0, lay)}>
      <DepthStage spec={STAGES.title} className="an-stage">
        <div className="an-cell" style={{ clipPath: clip }}>
          <TitleLines />
          {/* by day blue dots on the ink flood; by night black dots on the blue */}
          <Tone corner="tr" color="spot" size={260} max={10} />
          <Tone corner="tr" color="ink" size={260} max={10} />
          <div className="an-title-copy" style={{ height: foot }}>
            <p className="an-kicker">Currently rewatching, again</p>
            <h2 id="anime-title" className="an-display" aria-label="Watch list">
              {DISPLAY.map((word) => (
                <span key={word} className="an-display-word" aria-hidden="true">
                  {[...word].map((ch) => (
                    <span key={n} className="an-display-ch" style={{ "--c": n++ } as CSSProperties}>
                      {ch}
                    </span>
                  ))}
                </span>
              ))}
            </h2>
            {/* the chapter's hook (アオリ), boxed like narration */}
            <p className="an-lede">
              Shows I rewatch instead of sleeping. Each one taught me something about shipping software, or that&rsquo;s
              my excuse.
            </p>
          </div>
          <p lang="ja" className="an-vertical">
            第七話・視聴リスト
          </p>
        </div>
        <Frame box={box} stroke={lay.stroke} seed={1} />
        <SfxLayer id="title" at={don} size={don.size}>
          <Sfx text="ドン！" fill="spot" />
        </SfxLayer>
      </DepthStage>
    </div>
  );
}

/* ── the page around the panels ── */

const HASHIRA = ["毎晩、もう一話だけ。", "ONE MORE EPISODE, EVERY NIGHT"];

/** The running hashira: down the middle of the outer margin, from a third of the way down. */
function hashiraRect(page: PageBox): Rect {
  const { live } = page;
  const margin = page.side === "l" ? live.x : page.w - live.x - live.w;
  const x = page.side === "l" ? page.x + margin / 2 - 14 : page.x + page.w - margin / 2 - 14;
  return { x, y: page.y + live.y + live.h * 0.3, w: 28, h: 420 };
}

/** The folio: in the foot margin, at the outer corner. */
const folioAt = (page: PageBox, lay: Layout) => ({ side: lay.kind === "strip" ? 0 : 16, bottom: (page.h - page.live.y - page.live.h) / 2 - 8 });
function folioRect(page: PageBox, lay: Layout): Rect {
  const { side, bottom } = folioAt(page, lay);
  const x = page.side === "l" ? page.x + side : page.x + page.w - side - 34;
  return { x, y: page.y + page.h - bottom - 18, w: 34, h: 18 };
}
const tsuzukuAt = (page: PageBox, lay: Layout) => ({
  right: lay.kind === "strip" ? 44 : page.w - page.live.x - page.live.w + 40,
  bottom: (page.h - page.live.y - page.live.h) / 2 - 10,
});
function tsuzukuRect(page: PageBox, lay: Layout): Rect {
  const { right, bottom } = tsuzukuAt(page, lay);
  return { x: page.x + page.w - right - 76, y: page.y + page.h - bottom - 22, w: 76, h: 22 };
}

/**
 * Where the captions' numbers come from, set as a footnote (※) in a page
 * margin: each show's first season, scored by AniList's average
 * (anime/shows.ts). It takes the first stretch of margin the lettering
 * leaves free, from the spine side: the last page's foot, then the foot of a
 * page before it (a phone's narration boxes hang into the feet), then the
 * last page's head, then under the page. It is set in the last leaf either
 * way, so it is read last.
 */
const COLOPHON = { mark: "※", text: "First seasons. Scores: AniList, Oct 2026", w: 218, h: 16 };
type Spot = { left: number; top: number };
function colophonSpot(lay: Layout, placed: Record<string, Solved>, boxes: Record<string, PanelBox>): Spot {
  const pages = lay.pages;
  const last = pages[pages.length - 1];
  const taken: Rect[] = [...pages.map((p) => folioRect(p, lay)), tsuzukuRect(last, lay)];
  for (const [id, s] of Object.entries(placed)) {
    const b = boxes[id as PanelId];
    for (const r of [s.cap.rect, s.bubble, s.sfx]) taken.push({ x: b.x + r.x - 10, y: b.y + r.y - 6, w: r.w + 20, h: r.h + 12 });
  }
  const strip = lay.kind === "strip";
  const foot = (p: PageBox) => p.y + p.h - ((p.h - p.live.y - p.live.h) / 2 - 8) - COLOPHON.h;
  const head = (p: PageBox) => p.y + (p.live.y - COLOPHON.h) / 2;
  // (a spread's right-hand leaf turns, so there it keeps to its own page)
  const before = lay.kind === "spread" ? [] : pages.slice(0, -1).reverse();
  const rows: [PageBox, number][] = [[last, foot(last)], ...before.map((p): [PageBox, number] => [p, foot(p)]), [last, head(last)]];
  const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const [p, y] of rows) {
    const x0 = p.x + (strip ? 0 : p.live.x);
    const x1 = p.x + (strip ? p.w : p.live.x + p.live.w) - COLOPHON.w;
    // the spine is on a left-hand page's right
    const xs = Array.from({ length: Math.max(0, Math.floor((x1 - x0) / 4) + 1) }, (_, i) => (p.side === "l" ? x1 - i * 4 : x0 + i * 4));
    for (const x of xs) {
      if (!taken.some((t) => hit({ x, y, w: COLOPHON.w, h: COLOPHON.h }, t))) return { left: x - last.x, top: y - last.y };
    }
  }
  // a very narrow phone has no stretch free: under the page, in the sheet's own margin
  return { left: strip ? 0 : last.live.x, top: last.h + 6 };
}
function Colophon({ at }: { at: Spot }) {
  return (
    <p className="an-colophon" style={at}>
      <span lang="ja" aria-hidden="true">
        {COLOPHON.mark}
      </span>{" "}
      {COLOPHON.text}
    </p>
  );
}

function Furniture({ page, lay, last }: { page: PageBox; lay: Layout; last: boolean }) {
  const outer = page.side === "l" ? "l" : "r";
  const { live } = page;
  const folio = folioAt(page, lay);
  return (
    <div aria-hidden="true" className={`an-page an-page-${outer}`}>
      {lay.kind !== "spread" ? <Trims /> : null}
      {lay.kind === "spread" ? <i className="an-spine" /> : null}
      <span className="an-folio" style={{ [outer === "l" ? "left" : "right"]: folio.side, bottom: folio.bottom }}>
        {page.n}
      </span>
      {lay.kind !== "strip" ? (
        <span className="an-hashira" style={{ [outer === "l" ? "left" : "right"]: (outer === "l" ? live.x : page.w - live.x - live.w) / 2 - 7, top: live.y + live.h * 0.3 }}>
          <span lang="ja">{HASHIRA[0]}</span>
          <span className="an-hashira-en">{HASHIRA[1]}</span>
        </span>
      ) : null}
      {last ? (
        <span className="an-tsuzuku" style={tsuzukuAt(page, lay)}>
          <span lang="ja">つづく</span>
          <svg viewBox="0 0 12 12" width="11" height="11">
            <path d="M2 1 11 6 2 11Z" />
          </svg>
        </span>
      ) : null}
    </div>
  );
}

/** Crop marks at the four corners, outside the trim. */
function Trims() {
  return (
    <>
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <svg key={c} className={`an-trim an-trim-${c}`} width="22" height="22" viewBox="0 0 22 22">
          <path d="M0 8.5H14M8.5 0V14" />
        </svg>
      ))}
    </>
  );
}

function Register({ style }: { style: CSSProperties }) {
  return (
    <svg aria-hidden="true" className="an-register" width="26" height="26" viewBox="0 0 26 26" style={style}>
      <g className="an-register-b">
        <circle cx="13" cy="13" r="6.5" />
        <path d="M13 0V26M0 13H26" />
      </g>
      <g className="an-register-k">
        <circle cx="13" cy="13" r="6.5" />
        <path d="M13 0V26M0 13H26" />
      </g>
    </svg>
  );
}

function Spread({ lay }: { lay: Layout }) {
  if (lay.kind !== "spread") return null;
  const mid = lay.pages[1].x;
  return (
    <>
      <div aria-hidden="true" className="an-spread-trims">
        <Trims />
      </div>
      <Register style={{ left: mid - 13, top: -34 }} />
      <Register style={{ left: mid - 13, bottom: -34 }} />
    </>
  );
}

/**
 * The halftone thresholds the page prints in and out through: by day black
 * dots that close up into the neighbouring dark, by night the blue plate's
 * dots thinning out into the black stock.
 */
function EdgeTone({ side }: { side: "top" | "bottom" }) {
  return (
    <svg aria-hidden="true" className={`an-edge-tone an-edge-${side}`} width="100%" height={TONE_STEPS * 7}>
      <g className="an-edge-ink">
        {Array.from({ length: TONE_STEPS }, (_, i) => (
          <rect key={i} x="0" y={i * 7} width="100%" height="7.4" fill={`url(#an-ink-${TONE_STEPS - 1 - i})`} />
        ))}
      </g>
      <g className="an-edge-spot">
        {Array.from({ length: TONE_STEPS }, (_, i) => (
          <rect key={i} x="0" y={i * 7} width="100%" height="7.4" fill={`url(#an-spot-${Math.max(0, 8 - i)})`} />
        ))}
      </g>
    </svg>
  );
}

/* ── behaviour ── */

/** One panel's entrance, start to rest (anime.css): its balloon lands last, at about 1.35 s. */
const ENTRANCE_MS = 1500;
/** reading-order stagger between panels that come into view together */
const STAGGER_MS = 130;
/**
 * The right-hand page of a spread turning down (anime.css an-turn): it waits
 * a beat for the left page to start printing, falls already printed, and is
 * down at 62% of the turn, when its lettering lands (the caption is the first
 * of it, 420 ms into a panel's entrance).
 */
const TURN_MS = 900;
const TURN_DELAY = 180;
const TURN_DOWN = 560;
const LETTERING_AT = 420;

/**
 * The page prints panel by panel as each comes into view, in reading order
 * when several arrive together. A panel prints once a visit: if the layout
 * changes (a phone turned sideways) the panels already printed come back
 * printed.
 */
function useEntrances(ref: React.RefObject<HTMLElement | null>, lay: Layout) {
  const [phase, setPhase] = useState<"static" | "armed">("static");
  const printed = useRef(new Set<string>());
  useLayoutEffect(() => {
    if (!reducedMotion()) setPhase("armed");
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || phase !== "armed") return;
    for (const p of el.querySelectorAll<HTMLElement>(".an-panel")) {
      if (!printed.current.has(p.dataset.panel ?? "title")) continue;
      p.setAttribute("data-in", "");
      p.setAttribute("data-done", "");
    }
    // a page already turned stays down
    const r = el.querySelector(".an-leaf-r");
    if (r && el.querySelector(".an-leaf-r [data-done]")) {
      r.setAttribute("data-turn", "");
      r.setAttribute("data-flat", "");
    }
  }, [ref, phase, lay.kind]);
  useEffect(() => {
    const el = ref.current;
    if (!el || phase !== "armed") return;
    const timers = new Set<number>();
    let queue: HTMLElement[] = [];
    let flush = 0;
    const later = (ms: number, fn: () => void) => {
      const t = window.setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    // the right-hand leaf of a spread turns down the first time any of it comes into view
    const leaf = lay.kind === "spread" ? el.querySelector<HTMLElement>(".an-leaf-r") : null;
    let turnAt = leaf?.hasAttribute("data-turn") ? -Infinity : 0;
    const run = () => {
      flush = 0;
      queue.sort((a, b) => Number(a.style.getPropertyValue("--i")) - Number(b.style.getPropertyValue("--i")));
      let onLeaf = 0;
      queue.forEach((p, k) => {
        let d = k * STAGGER_MS;
        if (leaf?.contains(p)) {
          if (turnAt === 0) {
            turnAt = performance.now() + TURN_DELAY;
            later(TURN_DELAY, () => leaf.setAttribute("data-turn", ""));
            later(TURN_DELAY + TURN_MS, () => leaf.setAttribute("data-flat", ""));
          }
          // its lettering waits for the page to be down, then goes down the page in reading order
          d = Math.max(onLeaf * STAGGER_MS, turnAt + TURN_DOWN - LETTERING_AT - performance.now() + onLeaf * STAGGER_MS);
          onLeaf++;
        }
        printed.current.add(p.dataset.panel ?? "title");
        p.style.setProperty("--d0", `${Math.round(d)}ms`);
        p.setAttribute("data-in", "");
        later(ENTRANCE_MS + d, () => p.setAttribute("data-done", ""));
      });
      queue = [];
    };
    const panelFor = (id: string) =>
      el.querySelector<HTMLElement>(id === "title" ? ".an-title" : `[data-panel="${id}"]`);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          const p = panelFor((e.target as HTMLElement).dataset.for ?? "");
          if (p && !p.hasAttribute("data-in")) queue.push(p);
        }
        if (queue.length && !flush) flush = requestAnimationFrame(run);
      },
      { rootMargin: "0px 0px -14% 0px", threshold: 0.18 },
    );
    for (const s of el.querySelectorAll<HTMLElement>(".an-sentinel")) {
      if (!printed.current.has(s.dataset.for ?? "")) io.observe(s);
    }
    return () => {
      io.disconnect();
      cancelAnimationFrame(flush);
      for (const t of timers) clearTimeout(t);
    };
  }, [ref, phase, lay.kind]);
  return phase;
}

/** On touch screens the panel in the middle of the screen is the one in focus: it floods to colour. */
function useReadingLine(ref: React.RefObject<HTMLElement | null>, lay: Layout) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: none)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.target.toggleAttribute("data-active", e.isIntersecting);
      },
      { rootMargin: "-44% 0px -44% 0px" },
    );
    el.querySelectorAll("[data-panel]").forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, [ref, lay.kind]);
}

/**
 * Motion lines while the page moves: the SFX trail lines and the splash's
 * focus lines come up with scroll speed and die away as it stops. Written
 * straight to the few elements, only while the section is near.
 */
function useTrails(ref: React.RefObject<HTMLElement | null>) {
  const els = useRef<HTMLElement[]>([]);
  const state = useRef({ y: Number.NaN, v: 0, dir: 1, out: "" });
  useScrollFrame(
    ref,
    (fr) => {
      const st = state.current;
      if (fr.reduced) return;
      const dy = Number.isNaN(st.y) ? 0 : fr.y - st.y;
      st.y = fr.y;
      const speed = fr.dt > 0 ? Math.abs(dy) / fr.dt : 0;
      // the lines trail behind the lettering: below it while the page rises, above it while it falls
      if (Math.abs(dy) > 0.5) st.dir = dy > 0 ? 1 : -1;
      // quick to rise, slower to die away, like ink lines fading from a panel
      st.v += (speed - st.v) * damp(speed > st.v ? 14 : 4.5, fr.dt);
      const k = Math.round(smooth(260, 2600, st.v) * 50) / 50;
      const out = `${k} ${st.dir}`;
      if (out !== st.out) {
        st.out = out;
        for (const e of els.current) {
          e.style.opacity = String(k);
          // the title's focus lines only flare; the SFX trails stretch out behind the motion
          e.style.transform = e.classList.contains("an-trail")
            ? `scaleY(${(st.dir * (0.45 + 0.55 * k)).toFixed(2)})`
            : `scale(${(1.08 - 0.08 * k).toFixed(3)})`;
        }
      }
      return st.v > 4;
    },
    {
      onMeasure: () => {
        els.current = ref.current ? [...ref.current.querySelectorAll<HTMLElement>(".an-trail, .an-title-lines .an-lines")] : [];
      },
    },
  );
}

/** The sheet's width before it can be measured: the same sums as .an-sheet in anime.css. */
function guessWidth() {
  if (typeof window === "undefined") return 1280;
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const pad = vw >= 640 ? 32 : 14;
  return Math.min(1280, vw - 2 * pad);
}

/** the balloons' and narration boxes' faces, which their sizes are measured in */
const LETTERING_FACES = ["600 15px Onest", "500 13.5px Onest", '400 16px "Dela Gothic One"', '500 12.5px "Zen Kaku Gothic New"'];
const SOLVED = new Map<string, Record<string, Solved>>();

export function AnimeWorld() {
  const ref = useRef<HTMLElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(guessWidth);
  const lay = useMemo(() => layout(width), [width]);

  useLayoutEffect(() => {
    const el = sheet.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const phase = useEntrances(ref, lay);
  useReadingLine(ref, lay);
  useTrails(ref);

  const boxes = Object.fromEntries(lay.panels.map((p) => [p.id, p])) as Record<PanelId, PanelBox>;
  if (showFaces) (window as unknown as { __an: unknown }).__an = { lay, placed: null };
  // the balloons are fitted to their text as Onest sets it: solve again once the face has loaded (unless it already has)
  const [fonts, setFonts] = useState(() => (typeof document !== "undefined" && LETTERING_FACES.every((f) => document.fonts?.check(f)) ? 1 : 0));
  useEffect(() => {
    let alive = true;
    Promise.all(LETTERING_FACES.map((f) => document.fonts?.load(f))).then(() => alive && setFonts(1), () => {});
    return () => {
      alive = false;
    };
  }, []);
  const placed = useMemo(() => {
    // a width solved before (the window resized back, the world mounted again) is not solved twice
    const key = `${lay.w}:${fonts}`;
    const hit = SOLVED.get(key);
    if (hit) return hit;
    const b = Object.fromEntries(lay.panels.map((p) => [p.id, p]));
    // the splash is all lettering already, and the margins carry the page's own: nothing leans into them
    const t = b.title;
    const fixed: Rect[] = [{ x: t.x, y: t.y, w: t.w, h: Math.min(t.quad[2][1], t.quad[3][1]) }];
    for (const p of lay.pages) {
      if (lay.kind !== "strip") fixed.push(hashiraRect(p));
      fixed.push(folioRect(p, lay), ...(p === lay.pages[lay.pages.length - 1] ? [tsuzukuRect(p, lay)] : []));
    }
    const strip = lay.kind === "strip";
    // on a phone the lettering may lean into the sheet's 14px edge, never off the screen; on a page, never over the fold
    const bounds = (n: number): [number, number] => {
      if (strip) return [-10, lay.w + 10];
      const p = lay.pages.find((g) => g.n === n) ?? lay.pages[0];
      return [p.x + 6, p.x + p.w - 6];
    };
    const don = donAt(t, lay);
    fixed.push({ x: t.x + don.x, y: t.y + don.y, w: don.w, h: don.h });
    const res = solveAll(SHOWS, b, strip, { overscan: OVERSCAN, small: strip, cap: (s) => captionSize(s, lay), bounds }, fixed);
    if (SOLVED.size > 48) SOLVED.clear(); // a window dragged through every width
    SOLVED.set(key, res);
    return res;
  }, [lay, fonts]);
  if (showFaces) (window as unknown as { __an: { placed: unknown } }).__an.placed = placed;

  return (
    <section
      id="anime"
      ref={ref}
      data-world="anime"
      data-phase={phase}
      data-kind={lay.kind}
      aria-labelledby="anime-title"
      className="an-world"
    >
      <Defs />
      <EdgeTone side="top" />
      <div className="an-sheet">
        <div ref={sheet} className="an-spread" style={{ height: lay.h }}>
          <Spread lay={lay} />
          {/* where each panel lies, untransformed: what the entrances watch, since a leaf may be mid-turn */}
          {lay.panels.map((b) => (
            <i key={b.id} aria-hidden="true" className="an-sentinel" data-for={b.id} style={{ left: b.x, top: b.y, width: b.w, height: b.h }} />
          ))}
          {lay.pages.map((p, pi) => (
            // each page is a leaf of the book: on a spread the right-hand one turns down onto the spine (anime.css)
            <div key={`${p.n}-${lay.kind}`} className={`an-leaf an-leaf-${p.side}`} style={{ left: p.x, top: p.y, width: p.w, height: p.h }}>
              <Furniture page={p} lay={lay} last={pi === lay.pages.length - 1} />
              {pi === 0 ? <TitlePanel box={boxes.title} lay={lay} /> : null}
              {SHOWS.map((show, i) =>
                boxes[show.id].page === p.n ? (
                  <Panel key={show.id} show={show} box={boxes[show.id]} lay={lay} index={i + 1} at={placed[show.id]} />
                ) : null,
              )}
              {pi === lay.pages.length - 1 ? <Colophon at={colophonSpot(lay, placed, boxes)} /> : null}
            </div>
          ))}
        </div>
      </div>
      <EdgeTone side="bottom" />
    </section>
  );
}
