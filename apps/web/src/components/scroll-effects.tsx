import { useEffect } from "react";

/**
 * ScrollEffects — small scroll-driven flourishes.
 *
 *  • A hairline reading progress bar fixed at the top of the viewport
 *  • A currently-active section label in the bottom-left corner
 *
 * Pure native scroll listeners with rAF throttling. Respects
 * prefers-reduced-motion (transitions disabled, everything else works).
 */

export function ScrollEffects() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ── Reading progress bar ──
    const progress = document.createElement("div");
    progress.className =
      "fixed left-0 top-0 z-[60] h-[2px] origin-left pointer-events-none";
    progress.style.background = "oklch(0.55 0.07 145)";
    progress.style.width = "100vw";
    progress.style.transform = "scaleX(0)";
    progress.style.transition = reduced ? "none" : "transform 120ms linear";
    document.body.appendChild(progress);

    // ── Section indicator ──
    // A small pill in the bottom-left with a section counter (01/05) and the
    // active section name. Sits on a soft card so it's actually legible on
    // the warm off-white ground.
    const indicator = document.createElement("div");
    indicator.className =
      "fixed bottom-6 left-6 z-[55] pointer-events-none select-none inline-flex items-baseline gap-2 rounded-full border border-border/70 bg-card/85 px-3 py-1.5 text-[11px] tracking-[0.06em] text-foreground/75 shadow-sm backdrop-blur transition-[opacity,transform] duration-500";
    indicator.style.fontFamily = "Satoshi, sans-serif";
    indicator.style.opacity = "0";
    indicator.style.transform = "translateY(6px)";
    // Two <span>s so the counter stays tabular + muted and the label reads clearly.
    const counterEl = document.createElement("span");
    counterEl.className = "tabular-nums text-muted-foreground/70 text-[10px]";
    const labelEl = document.createElement("span");
    labelEl.className = "text-foreground/80";
    indicator.appendChild(counterEl);
    indicator.appendChild(labelEl);
    document.body.appendChild(indicator);

    const SECTIONS: Array<{ id: string; label: string }> = [
      { id: "experience", label: "experience" },
      { id: "projects", label: "projects" },
      { id: "hackathons", label: "hackathons" },
      { id: "gallery", label: "moments" },
      { id: "guestbook", label: "guestbook" },
    ];
    const TOTAL = SECTIONS.length.toString().padStart(2, "0");

    let raf = 0;
    let lastActive: string | null = null;

    function tick() {
      const scroll = window.scrollY;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = docH > 0 ? Math.min(1, scroll / docH) : 0;
      progress.style.transform = `scaleX(${ratio})`;

      // Find currently centered section
      const centerY = scroll + window.innerHeight / 2;
      let active: { id: string; label: string } | null = null;
      let activeIdx = -1;
      for (let i = 0; i < SECTIONS.length; i++) {
        const s = SECTIONS[i];
        const el = document.getElementById(s.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const top = scroll + rect.top;
        const bottom = top + rect.height;
        if (centerY >= top && centerY <= bottom) {
          active = s;
          activeIdx = i;
          break;
        }
      }
      if (active && active.id !== lastActive) {
        lastActive = active.id;
        counterEl.textContent = `${(activeIdx + 1).toString().padStart(2, "0")} / ${TOTAL}`;
        labelEl.textContent = active.label;
        indicator.style.opacity = "1";
        indicator.style.transform = "translateY(0)";
      } else if (!active && lastActive !== null) {
        lastActive = null;
        indicator.style.opacity = "0";
        indicator.style.transform = "translateY(6px)";
      }

      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      progress.remove();
      indicator.remove();
    };
  }, []);

  return null;
}
