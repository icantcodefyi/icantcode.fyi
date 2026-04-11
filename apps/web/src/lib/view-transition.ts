/**
 * startViewTransition — a safe wrapper around the View Transitions API.
 *
 * Falls back to running the callback directly if unsupported or if the
 * user prefers reduced motion.
 */

export function startViewTransition(cb: () => void) {
  if (typeof document === "undefined") {
    cb();
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    cb();
    return;
  }
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };
  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(cb);
    return;
  }
  cb();
}
