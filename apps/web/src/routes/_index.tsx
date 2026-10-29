import { useRef } from "react";
import { CommandPalette } from "@/components/command-palette";
import { deferred, useInitialHash } from "@/components/deferred";
import { Hero } from "@/components/hero";
import { ModeDock } from "@/components/mode-dock";
import { useOffscreenPause, useReveal } from "@/components/site";
import { Finale } from "@/sections/finale";
import { SiteFooter } from "@/sections/footer";
import { Gates } from "@/sections/gates";
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
  // keeps the id, so /#guestbook resolves before the wall has loaded
  (ref) => <div ref={ref as React.Ref<HTMLDivElement>} id="guestbook" className="defer-ph" data-ph="guestbook" aria-hidden="true" />,
);

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

      <RecentWork />

      <Wins />

      <Gates />

      {/* ═══ The four worlds ═══ */}
      <Teyvat />
      <Valorant />
      <AnimeWorld />
      <BtsWorld />

      <Finale wall={<GuestbookWall />} />

      <SiteFooter />
    </div>
  );
}
