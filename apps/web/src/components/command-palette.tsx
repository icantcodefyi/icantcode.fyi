import { lazy, Suspense, useEffect, useState } from "react";

import { unlock } from "@/lib/achievements";

/*
 * ⌘K command palette. Only the shortcut lives in the page bundle; the panel
 * (and its class-merging helper) is its own chunk, fetched on idle so the
 * first ⌘K still opens instantly.
 */

const load = () => import("./command-palette-panel");
const CommandPanel = lazy(() => load().then((m) => ({ default: m.CommandPanel })));

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  // a fresh panel per opening: query and selection start clean every time
  const [session, setSession] = useState(0);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) unlock("palette");
          return !prev;
        });
        setSession((n) => n + 1);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    const idle = window.requestIdleCallback ?? ((cb: () => void, _o?: IdleRequestOptions) => window.setTimeout(cb, 1500));
    const handle = idle(() => void load().catch(() => {}), { timeout: 5000 });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (window.cancelIdleCallback && typeof handle === "number") window.cancelIdleCallback(handle);
    };
  }, []);

  // No floating trigger: ⌘K opens it, and the footer says so.
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <CommandPanel key={session} onClose={() => setOpen(false)} />
    </Suspense>
  );
}
