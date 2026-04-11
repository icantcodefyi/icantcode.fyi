import { useEffect, useState } from "react";

/**
 * YearBar — a hairline bar showing % of the current year elapsed.
 *
 * Pairs a 1px progress line with the percentage + day count. Updates
 * once a minute (plenty for a yearly timescale).
 */

function computeYear() {
  const now = new Date();
  const y = now.getFullYear();
  const start = new Date(y, 0, 1).getTime();
  const end = new Date(y + 1, 0, 1).getTime();
  const elapsed = now.getTime() - start;
  const total = end - start;
  const pct = (elapsed / total) * 100;
  const dayOfYear = Math.floor(
    (now.getTime() - start) / (1000 * 60 * 60 * 24)
  ) + 1;
  return { year: y, pct, dayOfYear };
}

export function YearBar() {
  const [state, setState] = useState(computeYear);

  useEffect(() => {
    const id = setInterval(() => setState(computeYear()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="mt-4 select-none"
      aria-label={`${state.pct.toFixed(1)}% of ${state.year} elapsed`}
    >
      <div className="mb-1.5 flex items-baseline justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
        <span className="font-medium">{state.year}</span>
        <span className="tabular-nums text-muted-foreground/80">
          {state.pct.toFixed(1)}% · day {state.dayOfYear}/365
        </span>
      </div>
      <div
        className="year-bar"
        style={{ ["--year-progress" as string]: `${state.pct}%` }}
      />
    </div>
  );
}
