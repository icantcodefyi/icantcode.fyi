import { useEffect, useState } from "react";

import { unlock } from "@/lib/achievements";

/**
 * KonamiMode — shortened konami unlock: ↑ ↑ ↓ ↓
 *
 * We keep the "konami" label for the spirit of the thing, but the
 * sequence is the recognizable opening only — that's what's shown in
 * the footer hint and that's what triggers cat mode.
 *
 * When triggered:
 *  • Sets `data-cat-mode="true"` on <html> (Oneko watches this and
 *    spawns/despawns the cursor-chasing cat)
 *  • Shows a small "cat mode" pill at the bottom of the viewport
 *  • Enter the sequence again to revert
 *
 * Implementation notes:
 *  • Progress resets after 1.2s of inactivity so arrow-key scrolling
 *    while reading the page can't incidentally complete it.
 *  • Progress also resets on any non-matching key so interleaved
 *    keyboard shortcuts don't partially advance the sequence.
 */

const SEQUENCE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown"] as const;
const RESET_AFTER_MS = 1200;

export function KonamiMode() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let progress = 0;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    function clearReset() {
      if (resetTimer != null) {
        clearTimeout(resetTimer);
        resetTimer = null;
      }
    }

    function scheduleReset() {
      clearReset();
      resetTimer = setTimeout(() => {
        progress = 0;
        resetTimer = null;
      }, RESET_AFTER_MS);
    }

    function onKey(e: KeyboardEvent) {
      // Skip when typing in an input / textarea / contentEditable
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }

      const needed = SEQUENCE[progress];
      if (e.key === needed) {
        progress++;
        if (progress === SEQUENCE.length) {
          progress = 0;
          clearReset();
          setActive((a) => !a);
          unlock("konami");
          return;
        }
        scheduleReset();
        return;
      }

      // Any other key resets progress.
      progress = 0;
      clearReset();
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearReset();
    };
  }, []);

  // Sync the root dataset so Oneko can react
  useEffect(() => {
    document.documentElement.dataset.catMode = active ? "true" : "false";
    return () => {
      delete document.documentElement.dataset.catMode;
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full border border-border/60 bg-card/90 px-3 py-1 text-[11px] text-foreground shadow-sm backdrop-blur">
      <span className="mr-1">≽^•⩊•^≼</span> cat mode
    </div>
  );
}
