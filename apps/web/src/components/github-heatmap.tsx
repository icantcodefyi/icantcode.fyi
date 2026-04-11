import { useEffect, useMemo, useState } from "react";
import { startViewTransition } from "@/lib/view-transition";

interface ContributionDay {
  date: string;
  count: number;
  level: number;
}

const WEEKS = 52;
const CELL_SIZE = 11;
const GAP = 3;

// Flat-mode colours (original sage ramp)
const LEVEL_COLORS = [
  "oklch(0.94 0.01 60)",
  "oklch(0.87 0.04 155)",
  "oklch(0.78 0.06 155)",
  "oklch(0.65 0.09 155)",
  "oklch(0.50 0.12 155)",
];

// 3D mode — top / right / left faces per level
// Lit from upper-right, darker on left face
const TOP_COLORS = LEVEL_COLORS;
const RIGHT_COLORS = [
  "oklch(0.88 0.01 60)",
  "oklch(0.79 0.04 155)",
  "oklch(0.70 0.06 155)",
  "oklch(0.56 0.09 155)",
  "oklch(0.42 0.12 155)",
];
const LEFT_COLORS = [
  "oklch(0.82 0.01 60)",
  "oklch(0.72 0.04 155)",
  "oklch(0.63 0.06 155)",
  "oklch(0.49 0.09 155)",
  "oklch(0.36 0.12 155)",
];

type Mode = "flat" | "3d";

export function GitHubHeatmap({ username = "icantcodefyi" }: { username?: string }) {
  const [contributions, setContributions] = useState<ContributionDay[]>([]);
  const [totalRecent, setTotalRecent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("flat");

  useEffect(() => {
    let cancelled = false;
    async function fetchContributions() {
      try {
        const response = await fetch(
          `https://github-contributions-api.jogruber.de/v4/${username}?y=last`
        );
        const data = await response.json();
        if (cancelled) return;

        if (data.contributions) {
          const allDays: ContributionDay[] = data.contributions.flat();
          const recentDays = allDays.slice(-WEEKS * 7);
          setContributions(recentDays);
          setTotalRecent(
            recentDays.reduce((sum: number, d: ContributionDay) => sum + d.count, 0)
          );
        }
      } catch {
        // Silently fail — widget just won't show
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchContributions();
    return () => {
      cancelled = true;
    };
  }, [username]);

  const weeks = useMemo(() => {
    const out: ContributionDay[][] = [];
    for (let i = 0; i < contributions.length; i += 7) {
      out.push(contributions.slice(i, i + 7));
    }
    return out;
  }, [contributions]);

  function toggle() {
    startViewTransition(() => setMode((m) => (m === "flat" ? "3d" : "flat")));
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
            Activity
          </h3>
        </div>
        <div className="h-[98px] w-full animate-pulse rounded-lg bg-muted/50" />
      </div>
    );
  }

  if (contributions.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
          Activity
        </h3>
        <div className="flex items-baseline gap-3">
          <button
            type="button"
            onClick={toggle}
            className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Switch to ${mode === "flat" ? "isometric" : "flat"} view`}
          >
            {mode === "flat" ? "isometric ↗" : "flat →"}
          </button>
          <a
            href={`https://github.com/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground tabular-nums transition-colors hover:text-foreground"
          >
            {totalRecent} contributions
          </a>
        </div>
      </div>
      <div style={{ viewTransitionName: "heatmap" }}>
        {mode === "flat" ? (
          <FlatHeatmap weeks={weeks} />
        ) : (
          <IsoHeatmap weeks={weeks} />
        )}
      </div>
    </div>
  );
}

/* ── Flat (classic) ──────────────────────────────────────────────────── */

function FlatHeatmap({ weeks }: { weeks: ContributionDay[][] }) {
  const width = weeks.length * (CELL_SIZE + GAP) - GAP;
  const height = 7 * (CELL_SIZE + GAP) - GAP;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="block w-full h-auto"
      role="img"
    >
      {weeks.map((week, wi) =>
        week.map((day, di) => (
          <rect
            key={day.date}
            x={wi * (CELL_SIZE + GAP)}
            y={di * (CELL_SIZE + GAP)}
            width={CELL_SIZE}
            height={CELL_SIZE}
            rx={2}
            fill={LEVEL_COLORS[day.level] || LEVEL_COLORS[0]}
          >
            <title>
              {day.count} contribution{day.count !== 1 ? "s" : ""} on{" "}
              {new Date(day.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </title>
          </rect>
        ))
      )}
    </svg>
  );
}

/* ── Isometric (3D cubes) ────────────────────────────────────────────── */

const COS30 = Math.cos(Math.PI / 6); // 0.866
const SIN30 = Math.sin(Math.PI / 6); // 0.5

function project(x: number, y: number, z: number): [number, number] {
  return [(x - y) * COS30, (x + y) * SIN30 - z];
}

function IsoHeatmap({ weeks }: { weeks: ContributionDay[][] }) {
  const unit = 10; // cube edge in world units
  const gap = 1.4; // gap between cubes
  const pitch = unit + gap;
  const heightStep = 3.8; // z-units per contribution level

  // Build renderable cells sorted back-to-front (by x + y)
  const cells: Array<{
    day: ContributionDay;
    wi: number;
    di: number;
    h: number;
  }> = [];

  weeks.forEach((week, wi) => {
    week.forEach((day, di) => {
      cells.push({
        day,
        wi,
        di,
        h: Math.max(2, (day.level || 0) * heightStep + 2),
      });
    });
  });

  cells.sort((a, b) => a.wi + a.di - (b.wi + b.di));

  // Compute bounding box for viewBox
  const maxWi = weeks.length - 1;
  const maxDi = 6;
  const corners = [
    project(0, 0, 0),
    project(maxWi * pitch + unit, 0, 0),
    project(0, maxDi * pitch + unit, 0),
    project(maxWi * pitch + unit, maxDi * pitch + unit, 0),
    project(0, 0, heightStep * 5),
    project(maxWi * pitch + unit, 0, heightStep * 5),
    project(0, maxDi * pitch + unit, heightStep * 5),
    project(maxWi * pitch + unit, maxDi * pitch + unit, heightStep * 5),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const minX = Math.min(...xs) - 2;
  const maxX = Math.max(...xs) + 2;
  const minY = Math.min(...ys) - 2;
  const maxY = Math.max(...ys) + 2;
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  return (
    <svg
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      className="block w-full h-auto"
      role="img"
    >
      {cells.map(({ day, wi, di, h }) => {
        const x = wi * pitch;
        const y = di * pitch;
        const s = unit;
        const level = day.level || 0;

        // 8 corners
        const [tlB] = [project(x, y + s, 0)];
        const [trB] = [project(x + s, y + s, 0)];
        const [tlT] = [project(x, y + s, h)];
        const [trT] = [project(x + s, y + s, h)];
        const [blT] = [project(x, y, h)];
        const [brT] = [project(x + s, y, h)];
        const [blB] = [project(x, y, 0)];
        const [brB] = [project(x + s, y, 0)];

        // Top face (visible)
        const topPts = `${tlT.join(",")} ${trT.join(",")} ${brT.join(",")} ${blT.join(",")}`;
        // Right face (x = x+s, visible)
        const rightPts = `${trT.join(",")} ${trB.join(",")} ${brB.join(",")} ${brT.join(",")}`;
        // Front face (y = y, visible from the front)
        const frontPts = `${brT.join(",")} ${brB.join(",")} ${blB.join(",")} ${blT.join(",")}`;

        return (
          <g key={day.date}>
            <title>
              {day.count} contribution{day.count !== 1 ? "s" : ""} on{" "}
              {new Date(day.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </title>
            {/* Left face (the one facing us on the left — actually front) */}
            <polygon points={frontPts} fill={LEFT_COLORS[level]} />
            {/* Right face */}
            <polygon points={rightPts} fill={RIGHT_COLORS[level]} />
            {/* Top */}
            <polygon points={topPts} fill={TOP_COLORS[level]} />
          </g>
        );
      })}
    </svg>
  );
}
