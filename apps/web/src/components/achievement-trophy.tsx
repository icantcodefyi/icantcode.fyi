import { useEffect, useState } from "react";

import {
  ACHIEVEMENTS,
  type AchievementId,
  getUnlocked,
  subscribe,
} from "@/lib/achievements";

/**
 * AchievementTrophy — a wordless progress bar for how many hidden
 * features a visitor has tripped. Lives in the footer.
 *
 * Each slot shows a muted glyph by default; on unlock, the slot pops
 * to full color with a brief 260ms scale + opacity entrance. On hover
 * the label is revealed as a tooltip.
 *
 * /delight rule: the page works perfectly if this component is
 * deleted. It's a reward, not a requirement.
 */

const IDS = Object.keys(ACHIEVEMENTS) as AchievementId[];

export function AchievementTrophy() {
  const [unlocked, setUnlocked] = useState<Set<AchievementId>>(() => new Set());
  const [pulseId, setPulseId] = useState<AchievementId | null>(null);

  useEffect(() => {
    setUnlocked(getUnlocked());
    let pulseTimer: ReturnType<typeof setTimeout> | null = null;
    const unsub = subscribe((next, just) => {
      setUnlocked(next);
      if (just) {
        setPulseId(just);
        if (pulseTimer) clearTimeout(pulseTimer);
        pulseTimer = setTimeout(() => setPulseId(null), 1200);
      }
    });
    return () => {
      if (pulseTimer) clearTimeout(pulseTimer);
      unsub();
    };
  }, []);

  const count = unlocked.size;
  const total = IDS.length;

  return (
    <div
      className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between"
      aria-label={`Secrets found: ${count} of ${total}`}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
        secrets · <span className="tabular-nums text-foreground/70">
          {count.toString().padStart(2, "0")}
        </span>
        /{total.toString().padStart(2, "0")}
      </span>
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        {IDS.map((id) => {
          const meta = ACHIEVEMENTS[id];
          const got = unlocked.has(id);
          const pulsing = pulseId === id;
          return (
            <li
              key={id}
              title={got ? meta.label : "???"}
              className={[
                "inline-flex h-6 min-w-6 items-center justify-center rounded-[6px] border px-1.5 font-mono text-[10px] leading-none transition-[transform,opacity,background-color,border-color] duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                got
                  ? "border-border/80 bg-card text-foreground/85"
                  : "border-dashed border-border/50 bg-transparent text-muted-foreground/30",
                pulsing ? "scale-[1.15]" : "",
              ].join(" ")}
              aria-label={got ? meta.label : "locked"}
            >
              <span aria-hidden="true">{got ? meta.icon : "·"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
