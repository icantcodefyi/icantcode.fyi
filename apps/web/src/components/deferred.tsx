import { startTransition, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";

import { revealWithin } from "@/components/site";

/**
 * Below-the-fold sections ship as their own chunks. Each one is a placeholder
 * of about the same size (keeping its id, so #anchors always resolve) until it
 * comes within a couple of screens of the viewport, then the real section
 * mounts in its place. The chunks themselves are fetched on idle after load,
 * so mounting never waits on the network in practice.
 *
 * Anything that jumps (an #anchor link, the ⌘K palette, a deep link, a reload
 * that restores the scroll position) first mounts every deferred section above
 * its target, so the jump lands exactly where it always did.
 */

type Entry = {
  el: () => Element | null;
  mount: () => Promise<void>;
};

const entries = new Set<Entry>();
const preloads: (() => Promise<unknown>)[] = [];
let mountEverything = false;

/** Mount every deferred section that sits above `target` (or all of them). */
export function mountBefore(target?: Element | null): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const e of entries) {
    const el = e.el();
    if (!target || !el || el === target || el.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) {
      jobs.push(e.mount());
    }
  }
  return Promise.all(jobs).then(() => {});
}

/**
 * Scroll to `#id`. Sections that just mounted can still settle by a few
 * pixels (a widget swapping its loading state) while the smooth scroll is in
 * flight, so the target is re-aimed, mid-flight, whenever its offset moves.
 */
function glide(id: string, behavior?: ScrollBehavior) {
  const el = document.getElementById(id);
  if (!el) return;
  const opts = behavior ? { behavior } : undefined;
  el.scrollIntoView(opts);
  let at = el.getBoundingClientRect().top + window.scrollY;
  let frames = 0;
  const watch = () => {
    const cur = document.getElementById(id) ?? el;
    const now = cur.getBoundingClientRect().top + window.scrollY;
    if (Math.abs(now - at) > 0.5) {
      at = now;
      cur.scrollIntoView(opts);
    }
    if (++frames < 150) requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
  const stop = () => {
    frames = 150;
  };
  window.addEventListener("wheel", stop, { once: true, passive: true });
  window.addEventListener("touchstart", stop, { once: true, passive: true });
}

/** Smoothly scroll to `#id` after anything above it has mounted. */
export function scrollToSection(id: string, behavior?: ScrollBehavior) {
  void mountBefore(document.getElementById(id)).then(() => requestAnimationFrame(() => glide(id, behavior)));
}

if (typeof window !== "undefined") {
  const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  // deep links and restored scroll positions need the real layout from the start
  if (location.hash || nav?.type === "reload" || nav?.type === "back_forward") mountEverything = true;

  // same-page anchors: mount what's above the target, then follow the link
  document.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href^='#']");
      if (!a) return;
      const hash = a.getAttribute("href")!;
      const target = hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
      if (!target) return;
      const pending = [...entries].some((en) => {
        const el = en.el();
        return el && (el === target || el.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      if (!pending) return;
      e.preventDefault();
      // Follow the link the way the browser would (a history entry for the
      // hash, a CSS-smooth scroll), starting at once; the sections above mount
      // while it is in flight and glide() re-aims when the target moves.
      if (location.hash !== hash) history.pushState(null, "", hash);
      glide(target.id);
      requestAnimationFrame(() => requestAnimationFrame(() => void mountBefore(target)));
    },
    true,
  );
  window.addEventListener("hashchange", () => {
    const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (t && [...entries].length) void mountBefore(t);
  });

  // fetch every chunk once the page has settled, so mounting is instant
  const warm = () => {
    const idle = window.requestIdleCallback ?? ((cb: () => void, _o?: IdleRequestOptions) => window.setTimeout(cb, 200));
    idle(() => preloads.forEach((p) => void p().catch(() => {})), { timeout: 4000 });
  };
  if (document.readyState === "complete") window.setTimeout(warm, 1200);
  else window.addEventListener("load", () => window.setTimeout(warm, 1200), { once: true });
}

/** Signals that the real section has committed. */
function Committed({ onCommit }: { onCommit: () => void }) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the section commits
  useLayoutEffect(onCommit, []);
  return null;
}

/**
 * Build a deferred section. `placeholder` renders in its place until it mounts:
 * same element, same id, same box.
 */
export function deferred(
  load: () => Promise<{ default: ComponentType }>,
  placeholder: (ref: React.Ref<HTMLElement>) => React.ReactElement,
  { id, margin = "200% 0px" }: { id?: string; margin?: string } = {},
) {
  // Not React.lazy: a lazy component suspends at least once even when its
  // chunk is already here, and React then holds the reveal for its ~300 ms
  // Suspense throttle. A plain dynamic import renders the moment it can.
  let Comp: ComponentType | null = null;
  let mod: Promise<unknown> | null = null;
  const preload = () =>
    (mod ??= load().then((m) => {
      Comp = m.default;
    }));
  preloads.push(preload);

  return function Deferred() {
    const ph = useRef<HTMLElement>(null);
    const [on, setOn] = useState(mountEverything);
    const [, setLoaded] = useState(false);
    const done = useRef<(() => void) | null>(null);
    const committed = useRef<Promise<void> | null>(null);

    // register for anchor jumps
    useEffect(() => {
      const entry: Entry = {
        el: () => ph.current,
        mount: () => {
          if (!committed.current) {
            committed.current = new Promise<void>((res) => (done.current = res));
            setOn(true);
          }
          return committed.current;
        },
      };
      entries.add(entry);
      if (on) void entry.mount();
      return () => {
        entries.delete(entry);
      };
    }, []);

    // mount on approach
    useEffect(() => {
      if (on) return;
      const el = ph.current;
      if (!el) return;
      const io = new IntersectionObserver(
        ([e]) => {
          if (!e.isIntersecting) return;
          io.disconnect();
          // time-sliced, so a section mounting mid-scroll never blocks a frame for long
          startTransition(() => setOn(true));
        },
        { rootMargin: margin },
      );
      io.observe(el);
      return () => io.disconnect();
    }, [on]);

    // wanted but the chunk isn't here yet
    useEffect(() => {
      if (!on || Comp) return;
      let alive = true;
      preload().then(
        () => alive && startTransition(() => setLoaded(true)),
        () => {
          // offline / failed chunk: keep the placeholder, but never strand a jump
          done.current?.();
          done.current = null;
        },
      );
      return () => {
        alive = false;
      };
    }, [on]);

    if (!on || !Comp) return placeholder(ph);
    return (
      <>
        <Comp />
        <Committed
          onCommit={() => {
            // the real section now owns the id: wire up its entrances
            const el = id ? document.getElementById(id) : null;
            if (el) revealWithin(el);
            done.current?.();
            done.current = null;
            if (!committed.current) committed.current = Promise.resolve();
          }}
        />
      </>
    );
  };
}
