import {
  type CSSProperties,
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type RefObject,
} from "react";

import { art, halfSet } from "@/lib/art";
import { useDayArt } from "@/lib/day-art";
import { allowed } from "@/lib/depth/budget";
import { createRig, type Rig } from "@/lib/depth/dom";
import { canvasesAfter, createGL, groupsOf, type GL } from "@/lib/depth/gl";
import type { PlateSpec, StageSpec } from "@/lib/depth/types";
import { useMode } from "@/lib/mode";
import "./depth-stage.css";

/**
 * A painted scene on the site camera. The plates render as <img>s (always
 * the first paint, and the fallback) placed at their `range.flat` distance;
 * DOM children join the same camera with useDepthLayer(). Where WebGL is
 * allowed (lib/depth/budget.ts), plates with depth atlases become reliefs
 * as the stage comes near (lib/depth/gl.ts), taking over from the <img>s
 * invisibly; DOM layers keep their place between the plates' canvases.
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

export function DepthStage({ spec: given, track, children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [spec] = useState(given);
  const [rig] = useState(() => createRig(spec.id, spec.camera));
  const [groups] = useState(() => (allowed() ? groupsOf(spec) : null));
  const [after] = useState(() => canvasesAfter(spec, groups));
  const gl = useRef<GL | null>(null);
  const mode = useMode();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return rig.attach(el, track?.current);
  }, [rig, track]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !groups) return;
    const g = createGL(el, spec, groups, rig, document.documentElement.dataset.mode === "day" ? "day" : "night");
    gl.current = g;
    return () => {
      g.dispose();
      gl.current = null;
    };
  }, [spec, rig, groups]);

  // Under the view-transition switch the new mode has to be on the canvases
  // before the page is snapshotted, so this runs in the commit.
  useLayoutEffect(() => {
    gl.current?.mode(mode, document.documentElement.classList.contains("mode-instant"));
  }, [mode]);

  const onDay = useCallback((id: string) => gl.current?.day(id), []);

  return (
    <Layers.Provider value={rig}>
      <div ref={ref} data-depth-stage={spec.id} {...rest}>
        {spec.plates.map((p) => (
          <Fragment key={p.id}>
            <Plate p={p} gl={!!groups && p.backend !== "dom"} onDay={onDay} />
            {after.get(p.id)?.map((i) => (
              <div key={i} className="depth-gl" data-depth-gl={i} aria-hidden="true" style={{ zIndex: groups?.[i].z }} />
            ))}
          </Fragment>
        ))}
        {children}
      </div>
    </Layers.Provider>
  );
}

/** PlateSpec.fade as a CSS mask: one linear ramp per axis, intersected. */
function fadeMask(fade?: PlateSpec["fade"]): CSSProperties {
  if (!fade?.some((f) => f > 0)) return {};
  const [t, r, b, l] = fade.map((f) => f * 100);
  const ramp = (dir: string, a: number, z: number) =>
    `linear-gradient(${dir}, ${a ? `transparent 0%, #000 ${a}%` : "#000 0%"}, ${z ? `#000 ${100 - z}%, transparent 100%` : "#000 100%"})`;
  const layers = [t || b ? ramp("to bottom", t, b) : "", l || r ? ramp("to right", l, r) : ""].filter(Boolean);
  const image = layers.join(", ");
  return { maskImage: image, WebkitMaskImage: image, maskComposite: "intersect", WebkitMaskComposite: "source-in" };
}

function Plate({ p, gl, onDay }: { p: PlateSpec; gl: boolean; onDay: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rig = useContext(Layers);
  useEffect(() => {
    const el = ref.current;
    if (!rig || !el) return;
    // a relief reaches nearer and farther than its flat card: the drift cap counts both
    return rig.add(el, p.range.flat, gl && p.depth ? [p.range.far, p.range.near] : undefined);
  }, [rig, p, gl]);
  const [w, h] = p.size;
  const day = p.art.day !== p.art.night;
  const dayOk = useDayArt(day ? art(p.art.day) : null, ref);
  useEffect(() => {
    if (dayOk) onDay(p.id);
  }, [dayOk, onDay, p.id]);
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
      style={{ left: `${p.box.x}%`, top: `${p.box.y}%`, width: `${p.box.w}%`, aspectRatio: `${w} / ${h}`, zIndex: p.z, ...fadeMask(p.fade) }}
    >
      {img("night")}
      {day && dayOk ? img("day") : null}
    </div>
  );
}
