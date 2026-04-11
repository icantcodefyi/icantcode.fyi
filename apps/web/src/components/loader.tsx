import { useEffect, useState } from "react";

/**
 * Loader — a waiting moment with a point of view.
 *
 * Rotates through a short list of messages appropriate to the brand
 * voice (anime-pilled, hackathon-poisoned, self-aware). Cycles every
 * 1.1s with a 220ms fade via opacity + translateY.
 *
 * Reduced-motion fallback: freeze on the first message, no transition.
 * The underlying loading still works — the message is just quieter.
 */

const MESSAGES = [
  "finding the good anime",
  "buffering hackathon memories",
  "rolling a d20 for the layout",
  "waking up the cat",
  "almost there",
] as const;

const DOT_CYCLE = [".", "..", "...", "..."] as const;

export default function Loader() {
  const [index, setIndex] = useState(0);
  const [dots, setDots] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const msgTimer = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length);
    }, 1100);
    const dotTimer = setInterval(() => {
      setDots((d) => (d + 1) % DOT_CYCLE.length);
    }, 320);
    return () => {
      clearInterval(msgTimer);
      clearInterval(dotTimer);
    };
  }, [reduced]);

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3 pt-8"
      role="status"
      aria-live="polite"
    >
      <div
        aria-hidden="true"
        className="h-1 w-10 overflow-hidden rounded-full bg-border/70"
      >
        <div className="loader-bar h-full w-1/2 rounded-full bg-foreground/60" />
      </div>
      <p
        key={reduced ? "static" : index}
        className="loader-msg font-mono text-[11px] tracking-tight text-muted-foreground tabular-nums"
      >
        {MESSAGES[reduced ? 0 : index]}
        <span className="inline-block w-4 text-left text-foreground/50">
          {reduced ? "..." : DOT_CYCLE[dots]}
        </span>
      </p>
    </div>
  );
}
