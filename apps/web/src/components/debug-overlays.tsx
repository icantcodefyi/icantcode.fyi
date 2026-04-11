import { useEffect, useRef, useState } from "react";

import { unlock } from "@/lib/achievements";

/**
 * DebugOverlays — two hidden "designer" layers you can summon by
 * holding a key:
 *
 *   hold G   →  8px grid with a centerline cross (the classic
 *               "am i aligned?" check)
 *   hold D   →  hover outlines + a pill showing the hovered element's
 *               Tailwind-ish class list
 *
 * Both respect focus (don't hijack input/textarea). Both unlock the
 * grid-overlay achievement on first use. Both reveal with a 180ms
 * opacity fade (no layout animation — /animate rules).
 *
 * Safe under SSR: everything is gated on useEffect.
 */

export function DebugOverlays() {
  const [gridOn, setGridOn] = useState(false);
  const [classOn, setClassOn] = useState(false);
  const [hovered, setHovered] = useState<string>("");
  const gKey = useRef(false);
  const dKey = useRef(false);

  // Keyboard
  useEffect(() => {
    if (typeof window === "undefined") return;

    function isTyping(e: KeyboardEvent): boolean {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (t?.isContentEditable ?? false)
      );
    }

    function onDown(e: KeyboardEvent) {
      if (isTyping(e)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "g" || e.key === "G") {
        if (gKey.current) return;
        gKey.current = true;
        setGridOn(true);
        unlock("grid-overlay");
      }
      if (e.key === "d" || e.key === "D") {
        if (dKey.current) return;
        dKey.current = true;
        setClassOn(true);
        document.documentElement.dataset.debugClasses = "true";
      }
    }
    function onUp(e: KeyboardEvent) {
      if (e.key === "g" || e.key === "G") {
        gKey.current = false;
        setGridOn(false);
      }
      if (e.key === "d" || e.key === "D") {
        dKey.current = false;
        setClassOn(false);
        delete document.documentElement.dataset.debugClasses;
        setHovered("");
      }
    }
    // If the user alt-tabs or loses focus, release both keys so we
    // don't end up with a stuck overlay.
    function onBlur() {
      gKey.current = false;
      dKey.current = false;
      setGridOn(false);
      setClassOn(false);
      delete document.documentElement.dataset.debugClasses;
      setHovered("");
    }

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Class-name tracking — only listen while class mode is on
  useEffect(() => {
    if (!classOn) return;
    function onMove(e: PointerEvent) {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const cls = el.className;
      if (typeof cls !== "string") return;
      const trimmed = cls.trim();
      if (!trimmed) {
        setHovered(`<${el.tagName.toLowerCase()}>`);
        return;
      }
      // clip to a sensible preview; the full thing is in devtools
      const display =
        trimmed.length > 64 ? `${trimmed.slice(0, 61)}…` : trimmed;
      setHovered(`<${el.tagName.toLowerCase()}> ${display}`);
    }
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, [classOn]);

  return (
    <>
      <div
        aria-hidden="true"
        className={`debug-grid ${gridOn ? "is-on" : ""}`}
      />
      <div
        aria-hidden="true"
        className={`debug-classes-pill ${classOn ? "is-on" : ""}`}
      >
        {hovered || "hold D · hover anything"}
      </div>
    </>
  );
}
