import { useEffect, useState } from "react";

interface ContributionDay {
  date: string;
  count: number;
  level: number;
}

const WEEKS = 52;
const CELL_SIZE = 11;
const GAP = 3;

const LEVEL_COLORS = [
  "oklch(0.94 0.01 60)", // 0 — almost bg
  "oklch(0.87 0.04 155)", // 1 — light sage
  "oklch(0.78 0.06 155)", // 2 — medium sage
  "oklch(0.65 0.09 155)", // 3 — strong sage
  "oklch(0.50 0.12 155)", // 4 — deep sage
];

export function GitHubHeatmap({ username = "icantcodefyi" }: { username?: string }) {
  const [contributions, setContributions] = useState<ContributionDay[]>([]);
  const [totalRecent, setTotalRecent] = useState(0);
  const [loading, setLoading] = useState(true);

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
            recentDays.reduce((sum: number, d: ContributionDay) => sum + d.count, 0),
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

  if (loading) {
    return (
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground/60">
            Activity
          </h3>
        </div>
        <div className="h-[98px] w-full animate-pulse rounded-lg bg-muted/50" />
      </div>
    );
  }

  if (contributions.length === 0) return null;

  // Build weeks grid (columns = weeks, rows = days 0-6)
  const weeks: ContributionDay[][] = [];
  for (let i = 0; i < contributions.length; i += 7) {
    weeks.push(contributions.slice(i, i + 7));
  }

  const width = weeks.length * (CELL_SIZE + GAP) - GAP;
  const height = 7 * (CELL_SIZE + GAP) - GAP;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground/60">
          Activity
        </h3>
        <a
          href={`https://github.com/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground"
        >
          {totalRecent} contributions
        </a>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-auto"
        role="img"
        aria-label={`GitHub contribution graph — ${totalRecent} contributions in the last year`}
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
          )),
        )}
      </svg>
    </div>
  );
}
