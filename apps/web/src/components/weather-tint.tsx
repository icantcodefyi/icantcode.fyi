import { useEffect, useState } from "react";

/**
 * WeatherTint — fetches Bengaluru weather and nudges the palette.
 *
 * Layered on top of TimeTheme. It sets data-weather on <html> which
 * our CSS picks up to subtly shift --background chroma/hue.
 *
 * Also exposes a tiny weather pill next to the status row.
 *
 * WMO weather codes:
 *   0        Clear
 *   1-3      Mainly clear / partly cloudy
 *   45, 48   Fog
 *   51-57    Drizzle
 *   61-67    Rain
 *   71-77    Snow
 *   80-82    Rain showers
 *   95-99    Thunderstorm
 */

interface Weather {
  temperatureC: number | null;
  weatherCode: number | null;
  isDay: boolean | null;
}

function bandForCode(code: number | null): string {
  if (code == null) return "clear";
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "partly";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 57) || (code >= 80 && code <= 82)) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 95) return "storm";
  return "clear";
}

// Warm / cool tints so the icon reads "weather" at a glance.
const ICON_COLOR: Record<string, string> = {
  clear:   "oklch(0.72 0.15 70)",   // warm sun amber
  partly:  "oklch(0.65 0.04 240)",  // soft cloud grey-blue
  fog:     "oklch(0.68 0.02 60)",   // neutral warm grey
  drizzle: "oklch(0.60 0.09 235)",  // cool rain blue
  rain:    "oklch(0.55 0.10 235)",  // deeper rain blue
  snow:    "oklch(0.72 0.04 220)",  // icy pale blue
  storm:   "oklch(0.50 0.09 275)",  // storm indigo
};

const LABEL_FOR_BAND: Record<string, string> = {
  clear: "clear",
  partly: "partly cloudy",
  fog: "foggy",
  drizzle: "drizzling",
  rain: "raining",
  snow: "snowing",
  storm: "storming",
};

function iconFor(code: number | null) {
  const b = bandForCode(code);
  // Rendered at 16px — shapes are kept simple and chunky so they're
  // legible at that size. Stroke uses currentColor; fills stay as
  // currentColor too so hue inherits from the parent text color.
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (b === "clear") {
    // Solid sun disk + 4 cardinal rays. Simpler = reads as "sun".
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
        <path d="M12 3.2v2.4M12 18.4v2.4M3.2 12h2.4M18.4 12h2.4M6 6l1.7 1.7M16.3 16.3 18 18M6 18l1.7-1.7M16.3 7.7 18 6" />
      </svg>
    );
  }

  if (b === "partly") {
    // A sun peeking behind a single cloud — no interior stroke noise.
    return (
      <svg {...common}>
        <circle cx="8.5" cy="9" r="3.1" fill="currentColor" stroke="none" />
        <path d="M8.5 4.2v1.6M4.2 9h1.6M5.4 5.9l1.1 1.1M11.6 5.9l-1.1 1.1" />
        <path
          d="M9 19.5a4.2 4.2 0 0 1-.2-8.4 5 5 0 0 1 9.45 1.55 3.4 3.4 0 0 1 .25 6.85z"
          fill="currentColor"
          fillOpacity="0.16"
        />
      </svg>
    );
  }

  if (b === "fog") {
    // Three fog lines with varying length & offset to feel like drifting mist.
    return (
      <svg {...common}>
        <path d="M4 9h12M6 13h14M4 17h11" />
      </svg>
    );
  }

  if (b === "drizzle" || b === "rain") {
    // Fat cloud body with two clear droplets underneath.
    return (
      <svg {...common}>
        <path
          d="M7 16a4 4 0 0 1-.3-8 5 5 0 0 1 9.6 1.2 3.4 3.4 0 0 1 .3 6.8z"
          fill="currentColor"
          fillOpacity="0.16"
        />
        <path d="M10 18.5v2.5M14 18.5v2.5" strokeWidth="1.9" />
      </svg>
    );
  }

  if (b === "snow") {
    // 6-arm snowflake — each arm matches the others so it reads as symmetric.
    return (
      <svg {...common}>
        <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
        <path d="M10.5 4.5 12 6l1.5-1.5M10.5 19.5 12 18l1.5 1.5" strokeWidth="1.3" />
      </svg>
    );
  }

  // storm — cloud + bolt
  return (
    <svg {...common}>
      <path
        d="M7 14a4 4 0 0 1-.3-8 5 5 0 0 1 9.6 1.2 3.4 3.4 0 0 1 .3 6.8z"
        fill="currentColor"
        fillOpacity="0.16"
      />
      <path d="m13 13-3 5h3l-1.5 4" strokeWidth="1.9" />
    </svg>
  );
}

export function WeatherTint({ serverUrl }: { serverUrl: string }) {
  const [data, setData] = useState<Weather | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchWeather() {
      try {
        const res = await fetch(`${serverUrl}/rpc/weather`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const body = await res.json();
        if (cancelled) return;
        const payload = (body?.json ?? body) as Weather;
        setData(payload);
        document.documentElement.dataset.weather = bandForCode(payload.weatherCode);
      } catch {
        // fail silently
      }
    }
    fetchWeather();
    const id = setInterval(fetchWeather, 10 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [serverUrl]);

  if (!data || data.temperatureC == null) return null;

  const band = bandForCode(data.weatherCode);
  const iconColor = ICON_COLOR[band] ?? "oklch(0.60 0.02 60)";
  const label = LABEL_FOR_BAND[band] ?? "clear";

  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
      aria-label={`Bengaluru weather: ${label}, ${Math.round(data.temperatureC)}°C`}
    >
      <span style={{ color: iconColor }} className="shrink-0">
        {iconFor(data.weatherCode)}
      </span>
      <span>
        <span className="text-foreground/80 tabular-nums">
          {Math.round(data.temperatureC)}°
        </span>
        <span className="text-muted-foreground/70"> Bengaluru</span>
      </span>
    </span>
  );
}
