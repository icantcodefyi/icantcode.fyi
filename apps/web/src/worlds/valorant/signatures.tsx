import { useRef, type CSSProperties, type ReactNode } from "react";

import { useDepthLayer } from "@/components/depth-stage";
import type { Signature } from "./agents";

/**
 * Each agent's trace on the rooftop, drawn behind them (so never over a
 * face) and only while they're picked: Jett's wind through the sky, Sova's
 * recon pulse sweeping the city and marking it, Killjoy's nanoswarms
 * blinking on the floor under a lockdown ring, Cypher's tripwire across the
 * parapet. Every loop is transform and opacity only, slow and sparse, with
 * one brief event per cycle.
 */

export function Layer({ d, className, style, children }: { d: number; className: string; style?: CSSProperties; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, d);
  return (
    <div ref={ref} className={className} style={style} aria-hidden="true">
      {children}
    </div>
  );
}

const v = (o: Record<string, string | number>) => o as CSSProperties;

/** Streaks of wind across the sky, % of the stage; each crosses once per its cycle. */
const GUSTS = [
  { y: 14, w: 22, dur: 7.3, delay: -1.2 },
  { y: 27, w: 30, dur: 9.1, delay: -5.6 },
  { y: 38, w: 16, dur: 6.7, delay: -3.9 },
  { y: 52, w: 26, dur: 10.3, delay: -8.4 },
  { y: 63, w: 18, dur: 8.2, delay: -0.4 },
];

/** Recon: the pulse sweeps the city in the first 30% of its cycle; marks flash as it passes them. */
const RECON_S = 7.2;
// clear of Sova himself: the dark city left of the seam and the arcades bottom right
const MARKS = [
  { x: 9, y: 58 },
  { x: 19, y: 71 },
  { x: 83, y: 73 },
  { x: 94, y: 66 },
];
const reconAt = (x: number) => (((x + 12) / 124) * 0.3 * RECON_S).toFixed(2);

/** Killjoy's nanoswarms on the floor, clear of where the agent stands. */
const SWARMS = [
  { x: 22, y: 93, delay: 0 },
  { x: 81, y: 90, delay: -0.7 },
  { x: 92, y: 96, delay: -1.3 },
];

export function SignatureLayer({ kind }: { kind: Signature }) {
  if (kind === "wind")
    return (
      <Layer d={22} className="vl-sig vl-wind">
        {GUSTS.map((g) => (
          <span key={g.y} style={v({ "--y": `${g.y}%`, "--w": `${g.w}%`, "--dur": `${g.dur}s`, "--delay": `${g.delay}s` })} />
        ))}
      </Layer>
    );
  if (kind === "recon")
    return (
      <Layer d={26} className="vl-sig vl-recon" style={v({ "--dur": `${RECON_S}s` })}>
        <span className="vl-recon-wave" />
        {MARKS.map((m) => (
          <span key={m.x} className="vl-recon-mark" style={v({ "--x": `${m.x}%`, "--y": `${m.y}%`, "--delay": `${reconAt(m.x)}s` })} />
        ))}
      </Layer>
    );
  if (kind === "swarm")
    return (
      <Layer d={17} className="vl-sig vl-swarm">
        <span className="vl-lockdown" />
        {SWARMS.map((s) => (
          <span key={s.x} className="vl-nano" style={v({ "--x": `${s.x}%`, "--y": `${s.y}%`, "--delay": `${s.delay}s` })} />
        ))}
      </Layer>
    );
  return (
    <Layer d={17} className="vl-sig vl-wire">
      <span className="vl-wire-line">
        <i />
      </span>
      <span className="vl-wire-post vl-wire-a" />
      <span className="vl-wire-post vl-wire-b" />
    </Layer>
  );
}
