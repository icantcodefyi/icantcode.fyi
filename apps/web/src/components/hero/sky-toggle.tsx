import { useId } from "react";

/**
 * Day ⇄ night switch drawn as a tiny sky. The track holds clouds by day and
 * stars by night; the knob slides across and turns from a haloed sun with
 * fine rays into a full moon with shaded craters.
 */

const STARS: [number, number, number][] = [
  [12, 10, 1.6],
  [20, 24, 1.1],
  [27, 13, 0.9],
  [8, 22, 0.8],
  [31, 26, 1.3],
];

function sparkle(x: number, y: number, r: number) {
  const k = r * 0.28;
  return `M${x} ${y - r} Q${x + k} ${y - k} ${x + r} ${y} Q${x + k} ${y + k} ${x} ${y + r} Q${x - k} ${y + k} ${x - r} ${y} Q${x - k} ${y - k} ${x} ${y - r} Z`;
}

export function SkyToggle({
  night,
  onToggle,
  hidden,
  className,
}: {
  night: boolean;
  onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void;
  hidden?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const rays = Array.from({ length: 12 }, (_, i) => i);
  return (
    <button
      type="button"
      className={className ? `hero-toggle ${className}` : "hero-toggle"}
      aria-pressed={night}
      aria-label="Night mode"
      title={night ? "Switch to day" : "Switch to night"}
      onClick={onToggle}
      hidden={hidden}
      data-night={night ? "" : undefined}
    >
      <svg viewBox="0 0 76 38" width="76" height="38" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={`${id}-track`}>
            <rect x="1" y="1" width="74" height="36" rx="18" />
          </clipPath>
          <radialGradient id={`${id}-sun`} cx="38%" cy="34%" r="70%">
            <stop offset="0" stopColor="#fffaf0" />
            <stop offset="0.5" stopColor="#ffd77a" />
            <stop offset="1" stopColor="#ffab4c" />
          </radialGradient>
          <radialGradient id={`${id}-halo`}>
            <stop offset="0.45" stopColor="#fff1c4" stopOpacity="0.9" />
            <stop offset="1" stopColor="#fff1c4" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-moon`} cx="36%" cy="32%" r="78%">
            <stop offset="0" stopColor="#fff6fa" />
            <stop offset="0.62" stopColor="#ffd6e7" />
            <stop offset="1" stopColor="#f39cc2" />
          </radialGradient>
          <radialGradient id={`${id}-crater`} cx="60%" cy="62%" r="70%">
            <stop offset="0" stopColor="#f7b7d2" />
            <stop offset="1" stopColor="#e88db5" />
          </radialGradient>
        </defs>

        <g clipPath={`url(#${id}-track)`}>
          <rect className="hero-toggle-day" x="0" y="0" width="76" height="38" />
          <rect className="hero-toggle-night" x="0" y="0" width="76" height="38" />

          <g className="hero-toggle-clouds">
            <path d="M44 27.5h18.5a4.6 4.6 0 0 0 .4-9.2 6.4 6.4 0 0 0-12.2-1.4A5.3 5.3 0 0 0 44 27.5Z" />
            <path
              className="hero-toggle-cloud-far"
              d="M53 13.5h10a3 3 0 0 0 .2-6 4.1 4.1 0 0 0-7.8-.9A3.4 3.4 0 0 0 53 13.5Z"
            />
          </g>

          <g className="hero-toggle-stars">
            {STARS.map(([x, y, r], i) => (
              <path key={i} d={sparkle(x, y, r * 2)} style={{ "--s": i } as React.CSSProperties} />
            ))}
          </g>
        </g>
        <rect className="hero-toggle-rim" x="1" y="1" width="74" height="36" rx="18" fill="none" />

        <g className="hero-toggle-knob">
          <g className="hero-toggle-sunface">
            <circle cx="19" cy="19" r="15" fill={`url(#${id}-halo)`} />
            <g className="hero-toggle-rays">
              {rays.map((i) => (
                <line
                  key={i}
                  x1="19"
                  y1={i % 2 ? 6.6 : 5.4}
                  x2="19"
                  y2="8.4"
                  transform={`rotate(${i * 30} 19 19)`}
                />
              ))}
            </g>
            <circle cx="19" cy="19" r="8.6" fill={`url(#${id}-sun)`} />
            <circle cx="16.4" cy="16.2" r="2.4" fill="#fff" opacity="0.55" />
          </g>
          <g className="hero-toggle-moonface">
            <circle cx="19" cy="19" r="11.5" fill="#ff8fc0" opacity="0.18" />
            <circle cx="19" cy="19" r="10" fill={`url(#${id}-moon)`} />
            <circle cx="15.6" cy="16.4" r="2.6" fill={`url(#${id}-crater)`} />
            <circle cx="22.4" cy="22" r="1.9" fill={`url(#${id}-crater)`} />
            <circle cx="21.6" cy="14.6" r="1.1" fill={`url(#${id}-crater)`} />
            <circle cx="14.8" cy="22.8" r="0.9" fill={`url(#${id}-crater)`} />
            <path d="M27.6 13.8a10 10 0 0 1-9.4 15.2 10 10 0 0 0 9.4-15.2Z" fill="#e383af" opacity="0.45" />
          </g>
        </g>
      </svg>
    </button>
  );
}
