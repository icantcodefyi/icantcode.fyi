import { useEffect } from "react";

import { unlock } from "@/lib/achievements";

/**
 * UrlTheme — reads `?theme=<id>` and applies it as `data-theme` on
 * <html>. CSS in globals.css owns the palette shift; this component
 * is just the bridge.
 *
 * Shareable themes:
 *   ?theme=re-zero    witch-cult indigo + pink
 *   ?theme=frieren    elven forest greens
 *   ?theme=storm      quieter ink variant
 *
 * Unknown themes get cleared (no error). Leaving the page with a
 * theme active sticks it in sessionStorage so client navigations
 * keep it until the tab closes.
 */

const ALLOWED = new Set(["re-zero", "frieren", "storm"]);
const SESSION_KEY = "icc-theme";

export function UrlTheme() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    function apply(theme: string | null) {
      const root = document.documentElement;
      if (theme && ALLOWED.has(theme)) {
        root.dataset.theme = theme;
        try {
          window.sessionStorage.setItem(SESSION_KEY, theme);
        } catch {
          // ignore
        }
        unlock("theme-swap");
      } else {
        delete root.dataset.theme;
        try {
          window.sessionStorage.removeItem(SESSION_KEY);
        } catch {
          // ignore
        }
      }
    }

    function readFromUrl(): string | null {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("theme");
      if (t) return t;
      try {
        return window.sessionStorage.getItem(SESSION_KEY);
      } catch {
        return null;
      }
    }

    apply(readFromUrl());

    // Respond to back/forward nav and any client-side pushState.
    const onPop = () => apply(readFromUrl());
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  return null;
}
