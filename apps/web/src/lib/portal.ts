import { startTransition, type MouseEvent } from "react";
import type { NavigateFunction } from "react-router";

import { mountBefore, scrollToSection } from "@/components/deferred";
import { DUR, EASE, reducedMotion } from "@/lib/motion";
import { holdRest } from "@/lib/scroll-loop";

/**
 * The gates' portal (PLAN §7 G3). The card's ground grows from the card to
 * the whole viewport, the page jumps to the world underneath it, and the
 * wash dissolves into the world's own entrance.
 *
 * The wash is a fixed overlay rather than a View Transition: the jump has
 * to wait for the world, and every deferred section above it, to mount, and
 * a view transition would hold a frozen full-page snapshot for that whole
 * time. The overlay keeps the page live underneath and needs no new API.
 * Its look per world lives in sections/gates.css (`.portal[data-gate]`).
 */

let busy = false;

const frame = () => new Promise((res) => requestAnimationFrame(res));

/**
 * onClick for `<a href="#world" data-portal data-gate="world">` (deferred.tsx
 * leaves these to us). The hash goes through the router, once the wash
 * covers the page, so its scroll restoration brings back and forward to
 * the gate and the world.
 */
export function portal(e: MouseEvent<HTMLAnchorElement>, navigate: NavigateFunction) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const card = e.currentTarget;
  const hash = card.getAttribute("href") ?? "";
  const id = decodeURIComponent(hash.slice(1));
  if (!document.getElementById(id)) return;
  e.preventDefault();
  if (busy) return;
  const go = () => {
    if (location.hash !== hash) void navigate(hash);
  };
  // keyboard activation (detail 0) moves focus into the world, as following the link would
  const keyboard = e.detail === 0;
  if (reducedMotion()) {
    go();
    scrollToSection(id);
    if (keyboard) void mountBefore(document.getElementById(id)).then(() => focusWorld(id));
    return;
  }
  busy = true;
  // what waits for a still page (mounts ahead, WebGL) waits for the world's arrival too
  void holdRest(open(card, id, keyboard, go)).finally(() => {
    busy = false;
  });
}

async function open(card: HTMLElement, id: string, keyboard: boolean, go: () => void) {
  const r = card.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const round = getComputedStyle(card).borderTopLeftRadius;

  const wash = document.createElement("div");
  wash.className = "portal";
  wash.dataset.gate = card.dataset.gate;
  wash.setAttribute("aria-hidden", "true");
  wash.append(document.createElement("i"));
  document.body.append(wash);

  const from = `inset(${r.top}px ${vw - r.right}px ${vh - r.bottom}px ${r.left}px round ${round})`;
  // the card dissolves into its own ground as that ground starts to grow
  const grow = wash.animate(
    [{ clipPath: from, opacity: 0 }, { opacity: 1, offset: 0.22 }, { clipPath: "inset(0px 0px 0px 0px round 0px)", opacity: 1 }],
    { duration: DUR.portalIn, easing: EASE.in, fill: "forwards" },
  );
  // the sections above the world mount once the wash covers the page: a mount's commit and layout are
  // one long task however React slices it, and the clip-path grows on the main thread, so it would stall
  // there (the wash just holds a moment longer); after a rest nearby they are mostly mounted already
  await grow.finished;
  let mounted = Promise.resolve();
  startTransition(() => {
    mounted = mountBefore(document.getElementById(id));
  });
  await mounted;

  // jump under the wash; glide() keeps re-aiming while anything above settles
  go();
  scrollToSection(id, "instant");
  for (let i = 0; i < 3; i++) await frame();
  if (keyboard) focusWorld(id);

  await wash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.portalOut, easing: EASE.io, fill: "forwards" })
    .finished;
  wash.remove();
}

function focusWorld(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!el.hasAttribute("tabindex")) {
    el.setAttribute("tabindex", "-1");
    el.setAttribute("data-portal-target", "");
  }
  el.focus({ preventScroll: true });
}
