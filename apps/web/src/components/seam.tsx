import { useRef, type CSSProperties } from "react";

import { DepthStage, useDepthLayer } from "@/components/depth-stage";
import { art, halfSet } from "@/lib/art";
import { useDayArt } from "@/lib/day-art";
import { STRENGTH } from "@/lib/depth/camera";
import type { SeamArt, StageSpec } from "@/lib/depth/types";
import "./seam.css";

/**
 * A painted horizon between two main-stage sections: two cloud layers on
 * the site camera (back d = 30, front d = 8), rendered between the sections.
 *
 *  cloud-rise  reaches up over the section above; its bottom is solid `to`
 *  cloud-fall  hangs down over the section below; its top is solid `from`
 *  fade        a plain `from` → `to` band, in flow, no layers
 *
 * Without `art` it draws a CSS stand-in of the same size, so swapping the
 * paintings in is only a matter of passing their paths.
 */

export type SeamKind = "cloud-rise" | "cloud-fall" | "fade";
export type { SeamArt };

/** Art sizes from the plan (IMG-05..08): the stand-ins take the same box. */
const SIZE: Record<Exclude<SeamKind, "fade">, [number, number]> = {
  "cloud-rise": [2400, 720],
  "cloud-fall": [2400, 640],
};
const DEPTH = { back: 30, front: 8 } as const;

const stage = (kind: string): StageSpec => ({
  id: `seam-${kind}`,
  plates: [],
  camera: { strength: STRENGTH.seam, breath: 0, arrival: { z: 0, ms: 0 } },
});
const STAGES = { "cloud-rise": stage("cloud-rise"), "cloud-fall": stage("cloud-fall") };

interface Props {
  kind: SeamKind;
  /** the ground above and below, any CSS colour (mode-aware vars work) */
  from?: string;
  to?: string;
  art?: SeamArt;
  className?: string;
}

export function Seam({ kind, from = "var(--bg)", to = "var(--blush)", art: paint, className }: Props) {
  const vars = { "--seam-from": from, "--seam-to": to } as CSSProperties;
  const cls = className ? `seam ${className}` : "seam";
  if (kind === "fade") return <div className={cls} data-kind={kind} aria-hidden="true" style={vars} />;
  const [w, h] = paint?.size ?? SIZE[kind];
  return (
    <DepthStage
      spec={STAGES[kind]}
      className={cls}
      data-kind={kind}
      aria-hidden="true"
      style={{ ...vars, "--seam-ar": `${w} / ${h}` } as CSSProperties}
    >
      <Layer which="back" paint={paint} />
      <Layer which="front" paint={paint} />
    </DepthStage>
  );
}

function Layer({ which, paint }: { which: "back" | "front"; paint?: SeamArt }) {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, DEPTH[which]);
  const day = paint?.day?.[which];
  const dayOk = useDayArt(day ? art(day) : null, ref);
  if (!paint) return <div ref={ref} className="seam-layer" data-layer={which} data-ph="" />;
  const [w, h] = paint.size;
  const img = (set: "night" | "day", src: string, half?: string) => (
    <img
      src={art(src)}
      srcSet={half ? halfSet(art(src), w, art(half), Math.round(w / 2)) : undefined}
      sizes={half ? "auto, 100vw" : undefined}
      data-set={set}
      alt=""
      width={w}
      height={h}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
    />
  );
  return (
    <div ref={ref} className="seam-layer" data-layer={which}>
      {img("night", paint.night[which], paint.half?.night[which])}
      {day && dayOk ? img("day", day, paint.half?.day?.[which]) : null}
    </div>
  );
}
