import { useEffect, useRef, useState } from "react";

import { SkyToggle } from "@/components/hero/sky-toggle";
import { setMode, useMode } from "@/lib/mode";

/**
 * The hero's day ⇄ night switch, docked top-right once the hero scrolls
 * away, and always there from then on (the owner wants it findable at any
 * point; sections keep a safe zone clear for it instead). Over a fandom
 * world (a top-level section with [data-world]) it drops the main stage's
 * colours for a neutral glass.
 */
export function ModeDock() {
  const mode = useMode();
  const ref = useRef<HTMLDivElement>(null);
  const [past, setPast] = useState(false);
  const [world, setWorld] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting), { rootMargin: "-80px 0px 0px 0px" });
    io.observe(hero);
    return () => io.disconnect();
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

  return (
    <div ref={ref} className="mode-dock" data-shown={past ? "" : undefined} data-world={world ? "" : undefined} inert={!past}>
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
