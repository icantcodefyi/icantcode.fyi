import { startTransition, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";

import { revealWithin } from "@/components/site";
import { atRest } from "@/lib/scroll-loop";

/**
 * Below-the-fold sections ship as their own chunks. Each one is a placeholder
 * of about the same size (keeping its id, so #anchors always resolve) until it
 * comes within a couple of screens of the viewport, then the real section
 * mounts in its place. The chunks themselves are fetched on idle after load,
 * so mounting never waits on the network in practice.
 *
 * A mount is one long task however React slices it (its commit and the
 * layout of a few hundred new boxes), so it is best done while nobody is
 * scrolling: while the visitor rests with a section within SOON of the
 * viewport, it mounts in an idle moment, one section per moment. Only a
 * visitor who never stops meets the placeholder at the usual two screens,
 * and it mounts there as it always did.
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

/** How near a section has to be for a mount at rest. */
const SOON = "300% 0px";
/** Resolves once every chunk has been fetched (or tried): mounts at rest never wait on the network. */
let warmed: Promise<unknown> = new Promise(() => {});
/** Mounts at rest, one at a time, each once the visitor is at rest and the page idle. */
let calm: Promise<unknown> = Promise.resolve();
function atRestInTurn(fn: () => Promise<void> | undefined) {
  // (a mount that never commits, say its chunk failed, holds the line for 3 s at most)
  const turn = () => Promise.race([fn(), new Promise((r) => window.setTimeout(r, 3000))]);
  calm = calm.then(() => warmed).then(atRest).then(turn).catch(() => {});
}

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

/**
 * Deep links (icantcode.fyi/#work). The browser tries the jump while the SPA
 * is still an empty <body>, finds nothing and stays at the top, so the page
 * repeats it once it has rendered. glide() keeps re-aiming while images above
 * the target load and shift the layout.
 */
export function useInitialHash() {
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    // an id that only exists inside a section still to mount: mount them all, then look again
    void mountBefore(el).then(() => requestAnimationFrame(() => document.getElementById(id) && glide(id, "instant")));
  }, []);
}

if (typeof window !== "undefined") {
  const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  // deep links and restored scroll positions need the real layout from the start
  if (location.hash || nav?.type === "reload" || nav?.type === "back_forward") mountEverything = true;

  // same-page anchors: mount what's above the target, then follow the link
  // (gates marked data-portal run their own transition, and call mountBefore themselves)
  document.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href^='#']:not([data-portal])");
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
  let ready = () => {};
  warmed = new Promise<void>((r) => (ready = r));
  const warm = () => {
    const idle = window.requestIdleCallback ?? ((cb: () => void, _o?: IdleRequestOptions) => window.setTimeout(cb, 200));
    idle(() => void Promise.all(preloads.map((p) => p().catch(() => {}))).then(ready), { timeout: 4000 });
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

    // mount on approach: at rest while it is near, or as it comes within `margin`
    useEffect(() => {
      if (on) return;
      const el = ph.current;
      if (!el) return;
      let near = false;
      let queued = false;
      // time-sliced, so a section mounting mid-scroll never blocks a frame for long
      const mount = () => {
        io.disconnect();
        soon.disconnect();
        if (committed.current) return committed.current;
        committed.current = new Promise<void>((res) => (done.current = res));
        startTransition(() => setOn(true));
        return committed.current;
      };
      const io = new IntersectionObserver(([e]) => e.isIntersecting && void mount(), { rootMargin: margin });
      const soon = new IntersectionObserver(
        ([e]) => {
          near = e.isIntersecting;
          if (!near || queued) return;
          queued = true;
          // the next in line waits for its own moment, after this one has committed
          atRestInTurn(() => {
            queued = false;
            return near ? mount() : undefined;
          });
        },
        { rootMargin: SOON },
      );
      io.observe(el);
      soon.observe(el);
      return () => {
        io.disconnect();
        soon.disconnect();
        near = false;
      };
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
