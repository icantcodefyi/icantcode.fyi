import { useEffect, useRef, useState } from "react";

/**
 * LocalTime — a tiny SVG analog clock showing IST.
 *
 * Intentionally small (20px) so it sits inline with the status row.
 * No numerals — just four hairline tick marks at 12/3/6/9 and three
 * hands. The seconds hand sweeps smoothly via requestAnimationFrame.
 */

function getISTParts() {
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    fractionalSecondDigits: 3,
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
  const parts = fmt.formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const second = Number(parts.find((p) => p.type === "second")?.value ?? "0");
  const ms = Number(parts.find((p) => p.type === "fractionalSecond")?.value ?? "0");
  return { hour, minute, second, ms };
}

function formatLabel(h: number, m: number): string {
  const h12 = ((h + 11) % 12) + 1;
  const mm = m.toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h12}:${mm} ${ampm}`;
}

export function LocalTime() {
  const [mounted, setMounted] = useState(false);
  const hourRef = useRef<SVGLineElement>(null);
  const minRef = useRef<SVGLineElement>(null);
  const secRef = useRef<SVGLineElement>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    setMounted(true);
    let raf = 0;
    let lastLabelMinute = -1;

    function tick() {
      const { hour, minute, second, ms } = getISTParts();
      const secF = second + ms / 1000;
      const minF = minute + secF / 60;
      const hourF = (hour % 12) + minF / 60;

      const hourAngle = hourF * 30; // 360 / 12
      const minAngle = minF * 6; // 360 / 60
      const secAngle = secF * 6;

      hourRef.current?.setAttribute("transform", `rotate(${hourAngle} 50 50)`);
      minRef.current?.setAttribute("transform", `rotate(${minAngle} 50 50)`);
      secRef.current?.setAttribute("transform", `rotate(${secAngle} 50 50)`);

      if (minute !== lastLabelMinute) {
        lastLabelMinute = minute;
        setLabel(formatLabel(hour, minute));
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!mounted) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums"
      aria-label={`Current time in India: ${label}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 100 100"
        fill="none"
        className="text-muted-foreground/60"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r="46"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.55"
        />
        {/* 4 tick marks at 12 / 3 / 6 / 9 */}
        <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.7">
          <line x1="50" y1="8" x2="50" y2="16" />
          <line x1="92" y1="50" x2="84" y2="50" />
          <line x1="50" y1="92" x2="50" y2="84" />
          <line x1="8" y1="50" x2="16" y2="50" />
        </g>
        {/* Hour hand */}
        <line
          ref={hourRef}
          x1="50"
          y1="50"
          x2="50"
          y2="28"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Minute hand */}
        <line
          ref={minRef}
          x1="50"
          y1="50"
          x2="50"
          y2="16"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Second hand — accent color */}
        <line
          ref={secRef}
          x1="50"
          y1="56"
          x2="50"
          y2="12"
          stroke="oklch(0.70 0.16 20)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="50" cy="50" r="3" fill="currentColor" />
      </svg>
      <span>
        <span className="text-foreground/80">{label}</span>{" "}
        <span className="text-muted-foreground/70">IST</span>
      </span>
    </span>
  );
}
