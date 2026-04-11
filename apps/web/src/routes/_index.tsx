import type { Route } from "./+types/_index";
import { CommandPalette } from "@/components/command-palette";
import { GalleryImage } from "@/components/gallery-image";
import { GitHubHeatmap } from "@/components/github-heatmap";
import { LocalTime } from "@/components/local-time";
import { PageViews } from "@/components/page-views";
import { Reveal } from "@/components/reveal";
import { SpotifyNowPlaying } from "@/components/spotify-now-playing";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Aniruddh Dubge" },
    {
      name: "description",
      content:
        "Developer from India. Building tools, winning hackathons, shipping code.",
    },
    { property: "og:title", content: "Aniruddh Dubge" },
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

const TOYS = [
  { name: "linkedin alignment chart", desc: "D&D-style charts for LinkedIn using AI" },
  { name: "citronics", desc: "College fest event website" },
  { name: "glanza labs", desc: "Landing page and app" },
  { name: "nexus visualize", desc: "AI dashboard generator for data tables" },
] as const;

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

const HACKATHON_IMAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21];

const HACKATHON_HEIGHTS: Record<number, number> = {
  1: 300, 2: 400, 3: 300, 4: 350, 5: 300, 6: 350, 7: 300, 8: 320,
  9: 300, 10: 350, 11: 300, 12: 400, 13: 350, 14: 300, 16: 350,
  17: 300, 18: 320, 19: 300, 20: 400, 21: 300,
};

/* ── Components ── */

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
              alt="Aniruddh"
              width={60}
              height={60}
              className="h-[60px] w-[60px] shrink-0 rounded-full object-cover ring-2 ring-border"
            />
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Aniruddh Dubge
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

          {/* Status row: time + now-playing */}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-4">
            <LocalTime />
            <span
              className="hidden h-3 w-px bg-border sm:inline-block"
              aria-hidden="true"
            />
            <SpotifyNowPlaying serverUrl={SERVER_URL} />
          </div>
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
            <h2 className="font-display text-lg font-medium text-foreground tracking-tight">
              Projects
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {PROJECTS.map((project) => (
                <a
                  key={project.name}
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start justify-between gap-3 rounded-xl bg-card/60 px-4 py-3.5 transition-all duration-200 hover:bg-pastel-lavender/30"
                >
                  <div className="min-w-0">
                    <h3 className="font-medium text-foreground">
                      {project.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                      {project.desc}
                    </p>
                  </div>
                  <ArrowIcon className="mt-1 shrink-0 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-muted-foreground" />
                </a>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── Toys ── */}
        <Reveal className="mt-8" delay={50}>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground/60">
              Fun experiments
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {TOYS.map((toy) => (
                <span
                  key={toy.name}
                  className="inline-block rounded-full bg-pastel-butter/40 px-3 py-1 text-sm text-foreground/70"
                  title={toy.desc}
                >
                  {toy.name}
                </span>
              ))}
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
                <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground/60 mb-3">
                  13 Wins
                </h3>
                <div className="space-y-2.5">
                  {HACKATHON_WINS.map((h) => (
                    <div key={h.name} className="flex items-start gap-3">
                      <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-pastel-sage" />
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
                <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground/60 mb-3">
                  Organized
                </h3>
                <div className="space-y-2.5">
                  {HACKATHONS_ORGANIZED.map((h) => (
                    <div key={h.name} className="flex items-start gap-3">
                      <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-pastel-blush" />
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
                height={HACKATHON_HEIGHTS[num] || 300}
                index={i}
              />
            ))}
          </div>
        </section>

        {/* ── Footer ── */}
        <Reveal className="mt-24">
          <footer className="border-t border-border pt-6 pb-8">
            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
              <p className="text-sm text-muted-foreground">Aniruddh Dubge</p>
              <div className="flex items-center gap-3">
                <PageViews serverUrl={SERVER_URL} />
                <span className="text-xs text-muted-foreground/30">&middot;</span>
                <p className="text-xs text-muted-foreground/40">
                  Built with care from India
                </p>
              </div>
            </div>
          </footer>
        </Reveal>
      </div>
    </div>
  );
}
