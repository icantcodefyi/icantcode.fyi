import type { ReactNode } from "react";

/**
 * A 12" record: grooves and the label on a disc that turns (.bt-vinyl-disc),
 * and the light on it, which doesn't (.bt-vinyl-sheen: the house light lies
 * along the grooves in two opposite wedges, as it does on a real record).
 */
export function Vinyl({ id, label, className = "", children }: { id: string; label: string; className?: string; children?: ReactNode }) {
  const clip = `bt-lbl-${id}`;
  return (
    <div className={`bt-vinyl ${className}`}>
      <span className="bt-vinyl-disc">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <clipPath id={clip}>
              <circle cx="100" cy="100" r="35" />
            </clipPath>
          </defs>
          <circle cx="100" cy="100" r="99.5" className="bt-vinyl-black" />
          <circle cx="100" cy="100" r="97.5" className="bt-vinyl-rim" />
          {GROOVES.map((g) => (
            <circle key={g.r} cx="100" cy="100" r={g.r} className="bt-vinyl-groove" opacity={g.o} />
          ))}
          {/* the run-out: a smooth band before the label */}
          <circle cx="100" cy="100" r="40.5" className="bt-vinyl-runout" />
          <image href={label} x="65" y="65" width="70" height="70" clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
          <circle cx="100" cy="100" r="35" className="bt-vinyl-label-edge" />
          {/* a mark on the label, so the turn reads even on a plain cover */}
          <path d="M100 68.5v7" className="bt-vinyl-tick" />
          <circle cx="100" cy="100" r="2.6" className="bt-vinyl-hole" />
        </svg>
      </span>
      <span className="bt-vinyl-sheen" aria-hidden="true" />
      {children}
    </div>
  );
}

/** the lead-in, three bands with gaps between the tracks, the run-out */
const GROOVES = (() => {
  const out: { r: number; o: number }[] = [];
  for (let r = 44; r <= 95; r += 2.1) {
    const gap = Math.abs(r - 58) < 1 || Math.abs(r - 71.5) < 1 || Math.abs(r - 84) < 1;
    out.push({ r: +r.toFixed(2), o: gap ? 0.9 : r % 4.2 < 2.1 ? 0.42 : 0.26 });
  }
  return out;
})();
