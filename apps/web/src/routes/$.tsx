import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { unlock } from "@/lib/achievements";

/**
 * 404 — a playable snake game. ESC bails back home.
 *
 * /delight rules: every delight moment must still work if you delete it.
 * The game is entirely optional; the page is a fully legible 404 even
 * before you press a single key, and the [home] link is always there.
 *
 * /animate rules: transform & opacity only. Movement on the board is
 * handled by a 16x16 CSS grid and data-attribute swaps, no layout props.
 *
 * /harden: reduced-motion skips auto-advance and turns the game into a
 * step-by-step click puzzle (press an arrow once, snake moves once).
 */

type Dir = "up" | "down" | "left" | "right";
type Cell = { x: number; y: number };

const SIZE = 16;
const TICK_MS = 160;

function eq(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}
function randomApple(snake: Cell[]): Cell {
  // reject-sample until we land on an empty cell
  while (true) {
    const c = {
      x: Math.floor(Math.random() * SIZE),
      y: Math.floor(Math.random() * SIZE),
    };
    if (!snake.some((s) => eq(s, c))) return c;
  }
}

export function meta() {
  return [
    { title: "404 · icantcode.fyi" },
    { name: "description", content: "Page not found. But there's a snake." },
    { name: "robots", content: "noindex" },
  ];
}

export default function NotFound() {
  const [snake, setSnake] = useState<Cell[]>(() => [
    { x: 8, y: 8 },
    { x: 7, y: 8 },
    { x: 6, y: 8 },
  ]);
  const [apple, setApple] = useState<Cell>({ x: 12, y: 8 });
  const [dir, setDir] = useState<Dir>("right");
  const dirRef = useRef<Dir>("right");
  const [running, setRunning] = useState(false);
  const [dead, setDead] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [reduced, setReduced] = useState(false);

  // Track reduced motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  // Best score from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("icc-snake-best");
      const n = raw ? parseInt(raw, 10) : 0;
      if (Number.isFinite(n)) setBest(n);
    } catch {
      // ignore
    }
  }, []);

  const reset = useCallback(() => {
    const init = [
      { x: 8, y: 8 },
      { x: 7, y: 8 },
      { x: 6, y: 8 },
    ];
    setSnake(init);
    setApple(randomApple(init));
    setDir("right");
    dirRef.current = "right";
    setDead(false);
    setScore(0);
  }, []);

  const step = useCallback(() => {
    setSnake((prev) => {
      const head = prev[0];
      const d = dirRef.current;
      const next: Cell = {
        x: head.x + (d === "right" ? 1 : d === "left" ? -1 : 0),
        y: head.y + (d === "down" ? 1 : d === "up" ? -1 : 0),
      };
      // wall
      if (next.x < 0 || next.x >= SIZE || next.y < 0 || next.y >= SIZE) {
        setDead(true);
        setRunning(false);
        return prev;
      }
      // self
      if (prev.some((c) => eq(c, next))) {
        setDead(true);
        setRunning(false);
        return prev;
      }
      // apple
      if (eq(next, apple)) {
        const grown = [next, ...prev];
        setApple(randomApple(grown));
        setScore((s) => {
          const ns = s + 1;
          setBest((b) => {
            const nb = Math.max(b, ns);
            try {
              window.localStorage.setItem("icc-snake-best", String(nb));
            } catch {
              // ignore
            }
            return nb;
          });
          if (ns >= 3) unlock("snake");
          return ns;
        });
        return grown;
      }
      // regular move
      return [next, ...prev.slice(0, -1)];
    });
  }, [apple]);

  // Tick loop
  useEffect(() => {
    if (!running || dead || reduced) return;
    const id = setInterval(step, TICK_MS);
    return () => clearInterval(id);
  }, [running, dead, reduced, step]);

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        window.location.href = "/";
        return;
      }
      let nd: Dir | null = null;
      if (e.key === "ArrowUp" || e.key === "w") nd = "up";
      else if (e.key === "ArrowDown" || e.key === "s") nd = "down";
      else if (e.key === "ArrowLeft" || e.key === "a") nd = "left";
      else if (e.key === "ArrowRight" || e.key === "d") nd = "right";
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (dead) reset();
        setRunning((r) => !r);
        return;
      }
      if (!nd) return;
      e.preventDefault();
      // ignore 180° reversals
      const d = dirRef.current;
      if (
        (d === "up" && nd === "down") ||
        (d === "down" && nd === "up") ||
        (d === "left" && nd === "right") ||
        (d === "right" && nd === "left")
      ) {
        return;
      }
      dirRef.current = nd;
      setDir(nd);
      if (!running && !dead) setRunning(true);
      if (reduced) {
        // reduced-motion: manual step per key
        step();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, dead, reduced, step, reset]);

  // Build the board cells
  const cells = useMemo(() => {
    const out: Array<{ type: "empty" | "snake" | "head" | "apple" }> = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (eq({ x, y }, apple)) {
          out.push({ type: "apple" });
        } else if (eq(snake[0], { x, y })) {
          out.push({ type: "head" });
        } else if (snake.some((c) => eq(c, { x, y }))) {
          out.push({ type: "snake" });
        } else {
          out.push({ type: "empty" });
        }
      }
    }
    return out;
  }, [snake, apple]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-5 py-12">
      <header className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          error 404
        </p>
        <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight">
          nothing here
        </h1>
        <p
          className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground"
          style={{ maxWidth: "44ch" }}
        >
          this page doesn&apos;t exist. but you can play snake while you
          figure out where you meant to go.
        </p>
      </header>

      <div
        className="snake-board w-full max-w-[320px]"
        style={{ "--snake-size": SIZE } as React.CSSProperties}
        role="img"
        aria-label={`Snake game — score ${score}, best ${best}`}
      >
        {cells.map((c, i) => (
          <div
            key={i}
            className="snake-cell"
            data-type={c.type === "empty" ? undefined : c.type}
          />
        ))}
      </div>

      <div className="flex items-center gap-5 font-mono text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          score <span className="text-foreground">{score.toString().padStart(2, "0")}</span>
        </span>
        <span className="tabular-nums">
          best <span className="text-foreground">{best.toString().padStart(2, "0")}</span>
        </span>
        <span className="text-muted-foreground/70">
          {dead ? "you died · press ⏎" : running ? "" : "press ⏎ to start"}
        </span>
      </div>

      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/85">
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-border bg-card px-1.5 py-px font-mono text-[10px] text-foreground/70">
            ↑↓←→
          </kbd>
          move
        </span>
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-border bg-card px-1.5 py-px font-mono text-[10px] text-foreground/70">
            ⏎
          </kbd>
          start / pause
        </span>
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-border bg-card px-1.5 py-px font-mono text-[10px] text-foreground/70">
            esc
          </kbd>
          home
        </span>
      </p>

      <Link
        to="/"
        className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
      >
        ← back to icantcode.fyi
      </Link>

      {/* dir is tracked via ref for the loop; expose it in DOM for tests */}
      <span className="sr-only" aria-hidden="true">
        direction: {dir}
      </span>
    </main>
  );
}
