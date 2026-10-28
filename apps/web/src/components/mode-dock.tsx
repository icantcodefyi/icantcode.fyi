import { useEffect, useState } from "react";

import { SkyToggle } from "@/components/hero/sky-toggle";
import { setMode, useMode } from "@/lib/mode";

/**
 * The hero's day ⇄ night switch, docked top-right once the hero scrolls away.
 */
export function ModeDock() {
  const mode = useMode();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setShown(!e.isIntersecting), { rootMargin: "-80px 0px 0px 0px" });
    io.observe(hero);
    return () => io.disconnect();
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
