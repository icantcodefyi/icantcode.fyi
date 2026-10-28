import { useEffect, useState, type RefObject } from "react";

import { useMode } from "@/lib/mode";

/**
 * Day paintings ship separately from the night ones. A section renders its
 * day plate only once the file is known to exist, so a missing painting
 * falls back to the night one instead of a broken image.
 *
 * Probing starts once the section is within a screen and a half of the
 * viewport: straight away in day mode and after a short idle in night mode,
 * so the plate is decoded and ready before the first switch.
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

export function useDayArt(src: string, near?: RefObject<HTMLElement | null>) {
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
      { rootMargin: "150% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near, close]);
  useEffect(() => {
    if (ok || !close) return;
    let alive = true;
    const t = window.setTimeout(
      () => probe(src).then((v) => alive && v && setOk(true)),
      mode === "day" ? 0 : 1500,
    );
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [src, mode, ok, close]);
  return ok;
}
