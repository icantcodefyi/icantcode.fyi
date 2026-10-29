import "./gates.css";

const WORLDS = [
  {
    id: "teyvat",
    kind: "Genshin Impact",
    name: "Teyvat",
    ground: "#1f6f6a",
    ink: "#fff4d6",
    type: { fontFamily: "Cinzel, serif", fontWeight: 800, fontSize: "clamp(40px, 3.6vw, 60px)" },
    art: "/lobby/gi/kazuha-portrait.webp",
  },
  {
    id: "valorant",
    kind: "Valorant",
    name: "AGENT POOL",
    ground: "#111114",
    ink: "#ff4655",
    type: { fontFamily: "Anton, sans-serif", fontSize: "clamp(44px, 4vw, 68px)" },
    art: "/lobby/val/jett.webp",
  },
  {
    id: "anime",
    kind: "Anime",
    name: "視聴リスト",
    ground: "#f4f1ea",
    ink: "#0b0a0d",
    type: { fontFamily: "'Dela Gothic One', sans-serif", fontSize: "clamp(36px, 3.2vw, 54px)" },
    art: "/lobby/anime/steins-gate.webp",
    poster: true,
  },
  {
    id: "bts",
    kind: "BTS",
    name: "Borahae",
    ground: "#140a24",
    ink: "#c9a7ff",
    type: { fontFamily: "Unbounded, sans-serif", fontWeight: 800, fontSize: "clamp(36px, 3.2vw, 54px)" },
    art: "/bts/albums/proof.jpg",
    poster: true,
  },
];

/** Off the clock: a channel guide into four separate worlds. */
export function Gates() {
  return (
    <section id="off-the-clock" className="bg-ground px-[var(--margin)] pt-40 pb-24">
      <div className="grid gap-10 lg:grid-cols-12">
        <h2 className="t-head lg:col-span-6" data-reveal>
          Off the clock
        </h2>
        <p className="max-w-[38ch] lg:col-span-4 lg:col-start-8 lg:self-end" data-reveal style={{ "--d": "80ms" } as React.CSSProperties}>
          Four worlds I'd rather be in when I'm not shipping. Each one gets its own room, its own colours and its
          own rules.
        </p>
      </div>
      <ul className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {WORLDS.map((w, i) => (
          <li key={w.id} data-reveal style={{ "--d": `${i * 70}ms` } as React.CSSProperties}>
            <a
              href={`#${w.id}`}
              className="gate group relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-[28px] p-6 max-sm:aspect-[16/10] [html[data-mode=day]_&]:shadow-[0_0_0_1px_rgb(29_11_21/0.08),0_18px_40px_-22px_rgb(120_20_70/0.45)]"
              style={{ background: w.ground, color: w.ink }}
            >
              <span className="relative z-[1] text-[15px] font-medium opacity-90">{w.kind}</span>
              <span className="relative z-[1] leading-[0.95]" style={w.type}>
                {w.name}
              </span>
              <img
                src={w.art}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className={
                  w.poster
                    ? "gate-art pointer-events-none absolute right-[8%] bottom-[10%] h-[52%] w-auto rotate-[7deg] rounded-xl object-cover shadow-[0_18px_40px_rgb(0_0_0/0.35)]"
                    : "gate-art pointer-events-none absolute right-[-12%] bottom-0 h-[86%] w-auto max-w-none object-contain"
                }
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
