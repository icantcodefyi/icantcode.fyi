import { useEffect, useRef } from "react";

const TOYS = [
  { label: "TypeScript", bg: "var(--pastel-sky)", round: false },
  { label: "React", bg: "var(--pastel-lavender)", round: true },
  { label: "Next.js", bg: "var(--pastel-butter)", round: false },
  { label: "Tailwind", bg: "var(--pastel-sage)", round: false },
  { label: "Node", bg: "var(--pastel-blush)", round: true },
  { label: "Bun", bg: "var(--pastel-butter)", round: true },
  { label: "Postgres", bg: "var(--pastel-sky)", round: false },
  { label: "Solana", bg: "var(--pastel-lavender)", round: false },
  { label: "Python", bg: "var(--pastel-sage)", round: true },
  { label: "AI SDK", bg: "var(--pastel-blush)", round: false },
  { label: "Figma", bg: "var(--pastel-sky)", round: true },
  { label: "Vercel", bg: "var(--pastel-butter)", round: false },
];

/** Tech-stack stickers that drop into a box and can be flung around (matter-js). */
export function ToyBox() {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let stop = () => {};
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const M = (await import("matter-js")).default;
      const W = box.clientWidth, H = box.clientHeight;
      const engine = M.Engine.create({ gravity: { x: 0, y: 1.1 } });
      const wall = { isStatic: true, render: { visible: false } };
      M.Composite.add(engine.world, [
        M.Bodies.rectangle(W / 2, H + 25, W * 2, 50, wall),
        M.Bodies.rectangle(-25, H / 2, 50, H * 4, wall),
        M.Bodies.rectangle(W + 25, H / 2, 50, H * 4, wall),
      ]);
      const els = [...box.querySelectorAll<HTMLElement>("[data-toy]")];
      const bodies = els.map((el, i) => {
        const w = el.offsetWidth, h = el.offsetHeight;
        const x = 60 + ((i * 97) % Math.max(1, W - 120));
        const y = -60 - i * 45;
        const opts = { restitution: 0.5, friction: 0.3, angle: ((i % 5) - 2) * 0.2 };
        const b = el.dataset.round ? M.Bodies.circle(x, y, w / 2, opts) : M.Bodies.rectangle(x, y, w, h, { ...opts, chamfer: { radius: 12 } });
        M.Composite.add(engine.world, b);
        return b;
      });
      const mouse = M.Mouse.create(box);
      // ponytail: matter grabs wheel events by default, which would block page scroll
      const m = mouse as unknown as { mousewheel: EventListener };
      box.removeEventListener("wheel", m.mousewheel);
      box.removeEventListener("mousewheel", m.mousewheel);
      box.removeEventListener("DOMMouseScroll", m.mousewheel);
      M.Composite.add(engine.world, M.MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2 } }));

      let raf = 0, last = performance.now();
      const tick = (t: number) => {
        M.Engine.update(engine, Math.min(t - last, 32));
        last = t;
        bodies.forEach((b, i) => {
          const el = els[i];
          el.style.transform = `translate(${b.position.x - el.offsetWidth / 2}px, ${b.position.y - el.offsetHeight / 2}px) rotate(${b.angle}rad)`;
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      stop = () => {
        cancelAnimationFrame(raf);
        M.Engine.clear(engine);
      };
    }, { threshold: 0.4 });
    io.observe(box);
    return () => {
      io.disconnect();
      stop();
    };
  }, []);

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground/80">Toolbox</h3>
        <span className="font-display text-[13px] italic text-muted-foreground/70">— grab one and throw it</span>
      </div>
      <div
        ref={boxRef}
        className="relative mt-4 h-[260px] cursor-grab touch-pan-y select-none overflow-hidden rounded-2xl border-2 border-dashed border-foreground/15 bg-card/60 active:cursor-grabbing"
      >
        {TOYS.map((t) => (
          <div
            key={t.label}
            data-toy
            data-round={t.round || undefined}
            className={`absolute left-0 top-0 flex items-center justify-center border border-foreground/15 font-display text-[15px] font-medium text-foreground shadow-[0_0_0_3px_var(--card),0_8px_14px_-8px_oklch(0.2_0.02_60/0.4)] will-change-transform ${t.round ? "h-[78px] w-[78px] rounded-full text-[13px]" : "h-[44px] rounded-xl px-4"}`}
            style={{ background: t.bg, transform: "translate(-200px,-200px)" }}
          >
            {t.label}
          </div>
        ))}
      </div>
    </div>
  );
}
