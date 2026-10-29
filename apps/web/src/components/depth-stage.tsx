import { createContext, useContext, useEffect, useRef, useState, type HTMLAttributes, type RefObject } from "react";

import { art, halfSet } from "@/lib/art";
import { useDayArt } from "@/lib/day-art";
import { createRig, type Rig } from "@/lib/depth/dom";
import type { PlateSpec, StageSpec } from "@/lib/depth/types";
import "./depth-stage.css";

/**
 * A painted scene on the site camera. The plates render as <img>s (always
 * the first paint, and the fallback) placed at their `range.flat` distance;
 * DOM children join the same camera with useDepthLayer(). The GL backend
 * will take over plates with depth atlases from the same spec, with no
 * change for consumers.
 *
 * `spec` is read once: define it at module scope.
 */

const Layers = createContext<Rig | null>(null);

/** Put `ref`'s element on the nearest stage's camera at distance `d` (world units, ≥ 6). */
export function useDepthLayer(ref: RefObject<HTMLElement | null>, d: number) {
  const rig = useContext(Layers);
  useEffect(() => {
    const el = ref.current;
    if (!rig || !el) return;
    return rig.add(el, d);
  }, [rig, ref, d]);
}

interface Props extends HTMLAttributes<HTMLDivElement> {
  spec: StageSpec;
  /** Drive the camera from this element's scroll position instead of the stage's (for stages inside sticky boxes). */
  track?: RefObject<HTMLElement | null>;
}

export function DepthStage({ spec, track, children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [rig] = useState(() => createRig(spec.id, spec.camera));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return rig.attach(el, track?.current);
  }, [rig, track]);

  return (
    <Layers.Provider value={rig}>
      <div ref={ref} data-depth-stage={spec.id} {...rest}>
        {spec.plates.map((p) => (
          <Plate key={p.id} p={p} />
        ))}
        {children}
      </div>
    </Layers.Provider>
  );
}

function Plate({ p }: { p: PlateSpec }) {
  const ref = useRef<HTMLDivElement>(null);
  useDepthLayer(ref, p.range.flat);
  const [w, h] = p.size;
  const day = p.art.day !== p.art.night;
  const dayOk = useDayArt(day ? art(p.art.day) : null, ref);
  const img = (m: "night" | "day") => (
    <img
      src={art(p.art[m])}
      srcSet={p.half ? halfSet(art(p.art[m]), w, art(p.half[m]), Math.round(w / 2)) : undefined}
      sizes={p.half ? "auto, 100vw" : undefined}
      data-set={m}
      alt=""
      width={w}
      height={h}
      loading="lazy"
      decoding="async"
    />
  );
  return (
    <div
      ref={ref}
      className="depth-plate"
      data-plate={p.id}
      data-backend={p.backend ?? "gl"}
      aria-hidden="true"
      style={{ left: `${p.box.x}%`, top: `${p.box.y}%`, width: `${p.box.w}%`, aspectRatio: `${w} / ${h}`, zIndex: p.z }}
    >
      {img("night")}
      {day && dayOk ? img("day") : null}
    </div>
  );
}
