import { useEffect, useState } from "react";

import { SkyToggle } from "@/components/hero/sky-toggle";
import { setMode, useMode } from "@/lib/mode";

/**
 * The hero's day ⇄ night switch, docked top-right once the hero scrolls away.
 * It tucks away while you scroll down (so it never sits on what you're
 * reading) and comes back as soon as you scroll up.
 */
export function ModeDock() {
  const mode = useMode();
  const [pastHero, setPastHero] = useState(false);
  const [goingDown, setGoingDown] = useState(false);
  const shown = pastHero && !goingDown;

  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setPastHero(!e.isIntersecting), { rootMargin: "-80px 0px 0px 0px" });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 12) return;
      setGoingDown(y > last);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="mode-dock" data-shown={shown ? "" : undefined} inert={!shown}>
      <SkyToggle
        night={mode === "night"}
        onToggle={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMode(mode === "night" ? "day" : "night", { x: r.left + r.width / 2, y: r.top + r.height / 2 });
        }}
      />
    </div>
  );
}
