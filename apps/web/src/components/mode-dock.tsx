import { useEffect, useRef, useState } from "react";

import { SkyToggle } from "@/components/hero/sky-toggle";
import { setMode, useMode } from "@/lib/mode";
import { watchScroll } from "@/lib/scroll-loop";

/** How long the page must rest before a dock tucked away by a downward scroll comes back. */
const REST = 900; // ms

/**
 * The hero's day ⇄ night switch, docked top-right once the hero scrolls away.
 * It tucks away while you scroll down (so it never sits on what you are
 * reading) and returns on the way back up or once the page rests. Over a
 * fandom world (a top-level section with [data-world]) it drops the main
 * stage's colours for a neutral glass.
 */
export function ModeDock() {
  const mode = useMode();
  const ref = useRef<HTMLDivElement>(null);
  const [past, setPast] = useState(false);
  const [away, setAway] = useState(false);
  const [world, setWorld] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting), { rootMargin: "-80px 0px 0px 0px" });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let rest = 0;
    const stop = watchScroll((_, dy) => {
      // never pull it out from under keyboard focus
      if (dy > 2 && !ref.current?.contains(document.activeElement)) setAway(true);
      else if (dy < -2) setAway(false);
      window.clearTimeout(rest);
      rest = window.setTimeout(() => setAway(false), REST);
    });
    return () => {
      stop();
      window.clearTimeout(rest);
    };
  }, []);

  // which top-level sections sit under the dock: a thin band level with it
  useEffect(() => {
    const dock = ref.current;
    const page = dock?.parentElement;
    if (!dock || !page) return;
    const under = new Set<Element>();
    let io: IntersectionObserver | null = null;
    const watch = () => {
      io?.disconnect();
      under.clear();
      const top = dock.offsetTop;
      const bottom = window.innerHeight - (top + dock.offsetHeight);
      io = new IntersectionObserver(
        (records) => {
          for (const r of records) {
            if (r.isIntersecting) under.add(r.target);
            else under.delete(r.target);
          }
          setWorld([...under].some((el) => el.hasAttribute("data-world")));
        },
        { rootMargin: `${-top}px 0px ${-bottom}px 0px` },
      );
      for (const el of page.children) if (el !== dock) io.observe(el);
    };
    watch();
    // deferred sections swap their placeholder for the real element
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.removedNodes) {
          if (!(n instanceof Element)) continue;
          io?.unobserve(n);
          under.delete(n);
        }
        for (const n of r.addedNodes) if (n instanceof Element) io?.observe(n);
      }
    });
    mo.observe(page, { childList: true });
    window.addEventListener("resize", watch);
    return () => {
      io?.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", watch);
    };
  }, []);

  const shown = past && !away;
  return (
    <div ref={ref} className="mode-dock" data-shown={shown ? "" : undefined} data-world={world ? "" : undefined} inert={!shown}>
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
