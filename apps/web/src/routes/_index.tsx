import type { Route } from "./+types/_index";
import { AchievementTrophy } from "@/components/achievement-trophy";
import { CommandPalette } from "@/components/command-palette";
import { GalleryImage } from "@/components/gallery-image";
import { GitHubHeatmap } from "@/components/github-heatmap";
import { GuestbookWall } from "@/components/guestbook-wall";
import { LocalTime } from "@/components/local-time";
import { PageViews } from "@/components/page-views";
import { Reveal } from "@/components/reveal";
import { WeatherTint } from "@/components/weather-tint";
import { YearBar } from "@/components/year-bar";
import { SpotifyNowPlaying } from "@/components/spotify-now-playing";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "ani" },
    {
      name: "description",
      content:
        "Developer from India. Building tools, winning hackathons, shipping code.",
    },
    { property: "og:title", content: "ani" },
    {
      property: "og:description",
      content:
        "Developer from India. Building tools, winning hackathons, shipping code.",
    },
    { property: "og:type", content: "website" },
  ];
}

/* ── Data ── */

const PROJECTS = [
  {
    name: "autodiagram",
    desc: "AI-powered text to professional diagrams",
    url: "https://autodiagram.com/",
  },
  {
    name: "cattype",
    desc: "Typing practice with themes and real-time stats",
    url: "https://cattype.live/",
  },
  {
    name: "elafda",
    desc: "Discussion platform with Twitter integration and polls",
    url: "https://elafda.fun/",
  },
  {
    name: "invoicely",
    desc: "Beautiful professional invoice generator",
    url: "https://invoicely.gg/",
  },
  {
    name: "aurastake",
    desc: "Decentralized productivity via SOL staking",
    url: "https://aurastake.xyz/",
  },
  {
    name: "doblar",
    desc: "Fully local image converter for privacy",
    url: "https://doblar.ani.ink/",
  },
  {
    name: "annu's poems",
    desc: "A collection of poems written by Annu",
    url: "https://annnu.art/",
  },
  {
    name: "getaresume",
    desc: "Turn your resume into a portfolio website",
    url: "https://getaresu.me/",
  },
] as const;

/** Precomputed hostname labels for the editorial project listing. */
const PROJECT_HOSTS: string[] = PROJECTS.map((p) => {
  try {
    return new URL(p.url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
});

interface Toy {
  name: string;
  desc: string;
  /** Optional external URL. If omitted the chip renders as plain text. */
  url?: string;
}

const TOYS: Toy[] = [
  {
    name: "linkedin alignment chart",
    desc: "D&D alignment charts from LinkedIn profiles",
    url: "https://linkedin-alignment-chart.vercel.app/",
  },
  {
    name: "nexus visualize",
    desc: "AI dashboard generator for data tables",
    url: "https://dashboard.aniruddh.tech/",
  },
  {
    name: "glanza labs",
    desc: "Landing page + internal app",
    url: "https://www.glanza.org/",
  },
  {
    name: "citronics",
    desc: "College fest event website",
    url: "https://citronics.netlify.app/",
  },
];

/**
 * Toy chips are intentionally different from the real Projects grid —
 * mismatched tilts, cycling pastel bgs, display-italic name. Feels like
 * scrapbook paper scraps stuck to the page.
 */
const TOY_BG = [
  "bg-pastel-butter/60",
  "bg-pastel-sage/55",
  "bg-pastel-blush/55",
  "bg-pastel-sky/55",
];
const TOY_TILT = [
  "-rotate-[1.2deg]",
  "rotate-[0.9deg]",
  "-rotate-[0.5deg]",
  "rotate-[1.4deg]",
];

const EXPERIENCE = [
  {
    company: "Supernova AI",
    role: "Product Engineer",
    period: "Jul 2025 \u2013 Present",
    location: "Bengaluru, India",
    logo: "/supernova.png",
  },
  {
    company: "Merlin AI",
    role: "Software Engineer Intern",
    period: "Sep 2024 \u2013 Feb 2025",
    location: "Bengaluru, India",
    logo: "/merlin.svg",
  },
  {
    company: "DevKit",
    role: "Software Engineer Intern",
    period: "Jun 2024 \u2013 Aug 2024",
    location: "Remote",
    logo: "/techkareer.jpeg",
  },
] as const;

const HACKATHON_WINS = [
  { name: "The Better Hack", venue: "WeWork Pune", prize: "2nd prize", desc: "AI-based local SEO agent for local businesses" },
  { name: "EthIndia 2024", venue: "KTPO Bangalore", prize: "Polkadot track", desc: "Drag-and-drop smart contract builder" },
  { name: "Unfold 2024", venue: "Marriott Bangalore", prize: "Nethermind track", desc: "Autonomous AI agent for blockchain interaction" },
  { name: "WebGranth", venue: "CDGI Indore", prize: "1st prize", desc: "All-in-one platform for learning frameworks" },
  { name: "Hakxite", venue: "", prize: "1st prize", desc: "AI-based solution for deaf and dumb people" },
  { name: "HackVSIT 5.0", venue: "VSIT Delhi", prize: "3rd prize", desc: "CSV analyser that generates dashboards" },
  { name: "HackHive", venue: "DAVV Indore", prize: "1st prize", desc: "AI agent to interact with websites" },
  { name: "Udaymitsav '24", venue: "IIT Jammu", prize: "1st track + 2nd overall", desc: "Micro blogging solution" },
  { name: "Genesis 1.0", venue: "SRM Chennai", prize: "Berachain track", desc: "Web3 native game" },
  { name: "Syntax Error X", venue: "IIT Roorkee", prize: "Manga maestro track", desc: "Manga platform with AI tagging" },
  { name: "Version Beta", venue: "MANIT Bhopal", prize: "3rd place", desc: "Blockchain-based financial companion" },
  { name: "EthIndia 2023", venue: "KTPO Bangalore", prize: "Multiple sponsor tracks", desc: "First flight to Bangalore" },
  { name: "Hackistica '23", venue: "IIT Indore", prize: "1st win", desc: "Leetcode chrome extension \u2014 first hackathon ever" },
] as const;

const HACKATHONS_ORGANIZED = [
  { name: "Imagine Hackathon", venue: "Piwot PanIIT", detail: "Main organiser, handled all tech and operations onsite in Mumbai" },
  { name: "HackWave 2024", venue: "CDGI Indore", detail: "College\u2019s first hackathon. 500+ registrations, 40 teams offline" },
] as const;

const HACKATHON_IMAGES = [1, 3, 4, 6, 7, 8, 9, 10, 12, 13, 16, 19, 20, 21];

// Size pattern keyed by array position. Traced against grid-auto-flow:dense
// to pack 14 items (2 big + 2 wide + 2 tall + 8 small) into a 4×6 rectangle.
const HACKATHON_SIZES: Record<number, "big" | "wide" | "tall"> = {
  0: "big",
  3: "tall",
  6: "wide",
  9: "big",
  10: "tall",
  13: "wide",
};

/* ── Components ── */

/**
 * Small keycap-style <kbd> chip used in the footer shortcut row.
 * Border + soft card fill + a 1px bottom shadow so it reads as a
 * pressable key rather than a badge.
 */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded-md border border-border/80 bg-card/90 px-1.5 py-[3px] font-mono text-[11px] leading-none text-foreground/85 shadow-[0_1px_0_oklch(0.86_0.01_60)]">
      {children}
    </kbd>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
    >
      <path
        d="M1.16675 12.8333L12.8334 1.16667M12.8334 1.16667H3.50008M12.8334 1.16667V10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors duration-200 hover:text-foreground"
      aria-label={label}
    >
      {children}
    </a>
  );
}

/* ── Page ── */

export default function Home() {
  return (
    <div className="min-h-screen">
      <CommandPalette />

      <div className="mx-auto max-w-2xl px-5 pb-24 pt-12 sm:pt-20">
        {/* ── Intro ── */}
        <header className="animate-fade-up">
          <div className="flex items-center gap-5">
            <img
              src="/pfp.jpeg"
              alt="ani"
              width={60}
              height={60}
              className="h-[60px] w-[60px] shrink-0 rounded-full object-cover ring-2 ring-border"
            />
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                ani
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Developer from India
              </p>
            </div>
          </div>

          <p
            className="mt-6 leading-relaxed text-foreground/80"
            style={{ maxWidth: "60ch" }}
          >
            Self-taught developer who loves building things. Currently working on
            app development, software engineering, and web design. I enjoy
            creating interactive websites, investigating AI in my free time, and
            I'm an unapologetic anime enthusiast.
          </p>

          {/* Social links */}
          <div className="mt-5 flex flex-wrap items-center gap-5">
            <SocialLink href="https://github.com/icantcodefyi" label="GitHub">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span className="text-sm">GitHub</span>
            </SocialLink>
            <SocialLink href="https://twitter.com/icantcodefyi" label="Twitter">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span className="text-sm">Twitter</span>
            </SocialLink>
            <SocialLink
              href="https://linkedin.com/in/aniruddhdubge"
              label="LinkedIn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              <span className="text-sm">LinkedIn</span>
            </SocialLink>
            <SocialLink href="mailto:icantcodefyi@gmail.com" label="Email">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <span className="text-sm">Email</span>
            </SocialLink>
          </div>

          {/* Status row: clock + now-playing + weather */}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-4">
            <LocalTime />
            <span
              className="hidden h-3 w-px bg-border sm:inline-block"
              aria-hidden="true"
            />
            <SpotifyNowPlaying serverUrl={SERVER_URL} />
            <span
              className="hidden h-3 w-px bg-border sm:inline-block"
              aria-hidden="true"
            />
            <WeatherTint serverUrl={SERVER_URL} />
          </div>

          <YearBar />
        </header>

        {/* ── Experience ── */}
        <Reveal className="mt-14" delay={50}>
          <section id="experience">
            <h2 className="font-display text-lg font-medium text-foreground tracking-tight">
              Experience
            </h2>
            <div className="mt-5 space-y-5">
              {EXPERIENCE.map((exp) => (
                <div key={exp.company} className="flex items-start gap-4">
                  <img
                    src={exp.logo}
                    alt={exp.company}
                    width={36}
                    height={36}
                    className="mt-0.5 rounded-lg object-contain"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <h3 className="font-medium text-foreground">
                        {exp.company}
                      </h3>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {exp.period}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {exp.role} &middot; {exp.location}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── Projects ── */}
        <Reveal className="mt-14" delay={50}>
          <section id="projects">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-lg font-medium tracking-tight text-foreground">
                Projects
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80 tabular-nums">
                {PROJECTS.length.toString().padStart(2, "0")} shipped
              </span>
            </div>

            {/* Editorial directory — numbered index, no cards.
                Hairline dividers via divide-y; hover wash via negative-margin
                trick so the background extends past the text columns. */}
            <ol className="mt-6 list-none divide-y divide-border/60">
              {PROJECTS.map((project, i) => (
                <li key={project.name} className="first:border-t first:border-border/60">
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group -mx-3 flex items-start gap-5 rounded-lg px-3 py-4 transition-colors duration-300 hover:bg-pastel-lavender/25"
                  >
                    <span
                      aria-hidden="true"
                      className="w-6 shrink-0 pt-[7px] font-mono text-[10px] tabular-nums text-muted-foreground/60 transition-colors duration-300 group-hover:text-foreground/80"
                    >
                      {(i + 1).toString().padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                        <h3 className="font-display text-[17px] font-medium tracking-tight text-foreground">
                          {project.name}
                        </h3>
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                          {PROJECT_HOSTS[i]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-snug text-muted-foreground">
                        {project.desc}
                      </p>
                    </div>
                    <ArrowIcon className="mt-[9px] shrink-0 text-muted-foreground/40 transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-foreground" />
                  </a>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>

        {/* ── Toys ── */}
        <Reveal className="mt-10" delay={50}>
          <div>
            <div className="flex items-baseline gap-3">
              <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                Fun experiments
              </h3>
              <span className="font-display text-[13px] italic text-muted-foreground/70">
                — things I made on weekends
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {TOYS.map((toy, i) => {
                const bg = TOY_BG[i % TOY_BG.length];
                const tilt = TOY_TILT[i % TOY_TILT.length];
                const chipClass = `group relative inline-flex max-w-full items-baseline gap-2 rounded-[10px] px-3.5 py-2 shadow-[0_1px_0_oklch(0.85_0.01_60),0_8px_16px_-12px_oklch(0.2_0.02_60/0.25)] transition-[transform,box-shadow] duration-300 ease-out ${bg} ${tilt} hover:rotate-0 hover:-translate-y-0.5 hover:shadow-[0_1px_0_oklch(0.82_0.01_60),0_14px_22px_-14px_oklch(0.2_0.02_60/0.3)]`;
                const content = (
                  <>
                    <span className="font-display text-[15px] font-medium italic text-foreground/90 leading-none">
                      {toy.name}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-1 w-1 shrink-0 translate-y-[-2px] rounded-full bg-foreground/25"
                    />
                    <span className="text-[12px] leading-tight text-foreground/65">
                      {toy.desc}
                    </span>
                    {toy.url ? (
                      <span
                        aria-hidden="true"
                        className="ml-0.5 text-[11px] text-foreground/35 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground/75"
                      >
                        ↗
                      </span>
                    ) : null}
                  </>
                );
                return toy.url ? (
                  <a
                    key={toy.name}
                    href={toy.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={chipClass}
                  >
                    {content}
                  </a>
                ) : (
                  <div key={toy.name} className={chipClass}>
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* ── GitHub Heatmap ── */}
        <Reveal className="mt-14" delay={50}>
          <section>
            <GitHubHeatmap username="icantcodefyi" />
          </section>
        </Reveal>

        {/* ── Hackathons ── */}
        <Reveal className="mt-14" delay={50}>
          <section id="hackathons">
            <h2 className="font-display text-lg font-medium text-foreground tracking-tight">
              Hackathons
            </h2>

            <div className="mt-5 space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                  13 Wins
                </h3>
                <div className="space-y-2.5">
                  {HACKATHON_WINS.map((h) => (
                    <div key={h.name} className="flex items-start gap-3">
                      {/* 24px tall flex cell so the dot sits on the title's optical center */}
                      <span
                        aria-hidden="true"
                        className="flex h-6 shrink-0 items-center"
                      >
                        <span className="block h-1.5 w-1.5 rounded-full bg-pastel-sage" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {h.name}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {h.prize}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {h.desc}
                          {h.venue && ` \u00B7 ${h.venue}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                  Organized
                </h3>
                <div className="space-y-2.5">
                  {HACKATHONS_ORGANIZED.map((h) => (
                    <div key={h.name} className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-6 shrink-0 items-center"
                      >
                        <span className="block h-1.5 w-1.5 rounded-full bg-pastel-blush" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{h.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {h.venue}
                          {h.detail && ` \u00B7 ${h.detail}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* ── Photo Gallery (Masonry) ── */}
        <section id="gallery" className="mt-14">
          <Reveal>
            <h2 className="font-display text-lg font-medium text-foreground tracking-tight mb-5">
              Moments
            </h2>
          </Reveal>
          <div className="masonry">
            {HACKATHON_IMAGES.map((num, i) => (
              <GalleryImage
                key={num}
                src={`/hackathons/image${num}.webp`}
                alt={`Hackathon moment ${num}`}
                width={400}
                height={400}
                index={i}
                size={HACKATHON_SIZES[i]}
              />
            ))}
          </div>
        </section>

        {/* ── Guestbook ── */}
        <Reveal className="mt-16" delay={50}>
          <GuestbookWall />
        </Reveal>

        {/* ── Footer ── */}
        <Reveal className="mt-24">
          <footer className="border-t border-border pt-6 pb-8">
            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
              <p className="text-sm font-medium text-foreground/80">
                ani
              </p>
              <div className="flex items-center gap-3">
                <PageViews serverUrl={SERVER_URL} />
                <span
                  aria-hidden="true"
                  className="h-1 w-1 rounded-full bg-border"
                />
                <p className="text-xs text-muted-foreground">
                  Built with care from India
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-baseline gap-1.5">
                <Kbd>⌘K</Kbd>
                palette
              </span>
              <span className="inline-flex items-baseline gap-1.5">
                <Kbd>`</Kbd>
                terminal
              </span>
              <span className="inline-flex items-baseline gap-1.5">
                <Kbd>↑↑↓↓</Kbd>
                konami
              </span>
              <span className="inline-flex items-baseline gap-1.5">
                hold
                <Kbd>S</Kbd>
              </span>
              <span className="inline-flex items-baseline gap-1.5">
                hold
                <Kbd>G</Kbd>
                grid
              </span>
              <span className="inline-flex items-baseline gap-1.5">
                hold
                <Kbd>D</Kbd>
                debug
              </span>
            </div>
            <AchievementTrophy />
          </footer>
        </Reveal>
      </div>
    </div>
  );
}
