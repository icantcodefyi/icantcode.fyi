import { useEffect, useState, type RefObject } from "react";

import { useMode } from "@/lib/mode";

/**
 * Day paintings ship separately from the night ones. A section renders its
 * day plate only once the file is known to exist, so a missing painting
 * falls back to the night one instead of a broken image.
 *
 * In day mode the probe starts as soon as the section is within `margin` of
 * the viewport. In night mode the day plate is only there to make a first
 * switch seamless, so it waits for the visitor's first scroll and then for
 * idle time (`idle`) as well: nothing of the other mode is fetched while
 * the page is still loading.
 */
const known = new Map<string, Promise<boolean>>();

function probe(src: string) {
  let p = known.get(src);
  if (!p) {
    p = new Promise<boolean>((resolve) => {
      const img = new Image();
      // decode up front so the first switch doesn't stall on a big plate
      img.onload = () => img.decode().catch(() => {}).then(() => resolve(img.naturalWidth > 0));
      img.onerror = () => resolve(false);
      img.src = src;
    });
    known.set(src, p);
  }
  return p;
}

let scrolled: Promise<void> | null = null;
/** Resolves on the visitor's first scroll (at once for a restored or deep-linked position). */
export function firstScroll() {
  scrolled ??= new Promise<void>((resolve) => {
    if (window.scrollY > 0) resolve();
    else window.addEventListener("scroll", () => resolve(), { once: true, passive: true });
  });
  return scrolled;
}

const onIdle = (fn: () => void) =>
  window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 3000 }) : window.setTimeout(fn, 200);
const offIdle = (id: number) => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : window.clearTimeout(id));

/** `src` null: nothing to probe (a plate with one set for both modes). */
export function useDayArt(
  src: string | null,
  near?: RefObject<HTMLElement | null>,
  { margin = "100% 0px", idle = true }: { margin?: string; idle?: boolean } = {},
) {
  const mode = useMode();
  const [ok, setOk] = useState(false);
  const [close, setClose] = useState(!near);
  useEffect(() => {
    const el = near?.current;
    if (close || !el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          io.disconnect();
          setClose(true);
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near, close, margin]);
  useEffect(() => {
    if (!src || ok || !close) return;
    let alive = true;
    let task = 0;
    const go = () => probe(src).then((v) => alive && v && setOk(true));
    if (mode === "day") void go();
    else
      void firstScroll().then(() => {
        if (!alive) return;
        if (idle) task = onIdle(go);
        else void go();
      });
    return () => {
      alive = false;
      if (task) offIdle(task);
    };
  }, [src, mode, ok, close, idle]);
  return ok;
}
