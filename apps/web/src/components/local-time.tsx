import { useEffect, useState } from "react";

function formatIST() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).formatToParts(now);
  const hourPart = parts.find((p) => p.type === "hour");
  const hour = hourPart ? Number(hourPart.value) : 0;
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value ?? "AM";
  const hour24 =
    dayPeriod.toUpperCase() === "PM" && hour !== 12
      ? hour + 12
      : dayPeriod.toUpperCase() === "AM" && hour === 12
        ? 0
        : hour;
  const label = parts.map((p) => p.value).join("");
  return { label, hour24 };
}

const MorningIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const NightIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

export function LocalTime() {
  const [state, setState] = useState<{ label: string; hour24: number } | null>(null);

  useEffect(() => {
    function update() {
      setState(formatIST());
    }
    update();
    // Update every 20 s (minute-level precision is fine, no need to re-render every second)
    const interval = setInterval(update, 20_000);
    return () => clearInterval(interval);
  }, []);

  if (!state) return null;

  const isDay = state.hour24 >= 6 && state.hour24 < 18;

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <span className="text-muted-foreground/50">
        {isDay ? MorningIcon : NightIcon}
      </span>
      <span>
        {state.label}{" "}
        <span className="text-muted-foreground/50">IST</span>
      </span>
    </span>
  );
}
