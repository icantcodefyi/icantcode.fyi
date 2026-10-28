import { useRef } from "react";
import { CommandPalette } from "@/components/command-palette";
import { deferred, useInitialHash } from "@/components/deferred";
import { Hero } from "@/components/hero";
import { ModeDock } from "@/components/mode-dock";
import { useOffscreenPause, useReveal } from "@/components/site";
import { Contact } from "@/sections/contact";
import { Experience } from "@/sections/experience";
import { SiteFooter } from "@/sections/footer";
import { RecentWork } from "@/sections/work";
// The worlds' styles stay in the page stylesheet, in their original order, so
// the cascade is exactly what it was; only their scripts load on approach.
import "@/worlds/anime.css";
import "@/worlds/bts.css";
import "@/worlds/teyvat.css";
import "@/worlds/valorant.css";
import "@/sections/wins.css";

/* Below-the-fold pieces, each split into its own chunk (see components/deferred). */
const ph = (id: string) => (ref: React.Ref<HTMLElement>) => (
  <section ref={ref} id={id} className="defer-ph" data-ph={id} aria-hidden="true" />
);
const Wins = deferred(() => import("@/components/wins").then((m) => ({ default: m.Wins })), ph("hackathons"), {
  id: "hackathons",
});
const Teyvat = deferred(() => import("@/worlds/teyvat").then((m) => ({ default: m.Teyvat })), ph("teyvat"), {
  id: "teyvat",
});
const Valorant = deferred(() => import("@/worlds/valorant").then((m) => ({ default: m.Valorant })), ph("valorant"), {
  id: "valorant",
});
const AnimeWorld = deferred(() => import("@/worlds/anime").then((m) => ({ default: m.AnimeWorld })), ph("anime"), {
  id: "anime",
});
const BtsWorld = deferred(() => import("@/worlds/bts").then((m) => ({ default: m.BtsWorld })), ph("bts"), {
  id: "bts",
});
// the guestbook carries the auth + RPC client (zod, better-auth, oRPC, TanStack Query, sonner)
const GuestbookWall = deferred(
  () => import("@/components/guestbook-wall").then((m) => ({ default: m.GuestbookWall })),
  (ref) => <div ref={ref as React.Ref<HTMLDivElement>} className="defer-ph" data-ph="guestbook" aria-hidden="true" />,
);

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

export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  useReveal();
  useInitialHash();
  useOffscreenPause(root);

  return (
    <div ref={root} className="relative overflow-x-clip">
      <CommandPalette />
      <ModeDock />

      <Hero />

      <Experience />

      <RecentWork />

      <Wins />

      {/* ═══ Off the clock: a channel guide into four separate worlds ═══ */}
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

      {/* ═══ The four worlds ═══ */}
      <Teyvat />
      <Valorant />
      <AnimeWorld />
      <BtsWorld />

      {/* ═══ Guestbook ═══ */}
      <section className="bg-surface px-[var(--margin)] py-36">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 className="t-head" data-reveal>
              Leave a mark
            </h2>
            <p className="mt-6 max-w-[36ch]" data-reveal style={{ "--d": "80ms" } as React.CSSProperties}>
              Draw a signature, a doodle or a tiny cat. One per visitor, and it stays on the wall.
            </p>
          </div>
          <div className="lg:col-span-6 lg:col-start-7" data-reveal style={{ "--d": "120ms" } as React.CSSProperties}>
            <GuestbookWall />
          </div>
        </div>
      </section>

      <Contact />

      <SiteFooter />
    </div>
  );
}
