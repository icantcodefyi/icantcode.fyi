import { cn } from "@my-better-t-app/ui/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CommandGroup = "Navigate" | "Links" | "Projects";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  group: CommandGroup;
  action: () => void;
  keywords?: string[];
}

const GROUP_ORDER: CommandGroup[] = ["Navigate", "Links", "Projects"];

const GithubIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const TwitterIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const MailIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const ArrowRightIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const HashIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" x2="20" y1="9" y2="9" />
    <line x1="4" x2="20" y1="15" y2="15" />
    <line x1="10" x2="8" y1="3" y2="21" />
    <line x1="16" x2="14" y1="3" y2="21" />
  </svg>
);

const ArrowUpIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 7-7 7 7" />
    <path d="M12 19V5" />
  </svg>
);

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

const COMMANDS: CommandItem[] = [
  // ── Navigate ──
  {
    id: "scroll-experience",
    label: "Experience",
    icon: HashIcon,
    group: "Navigate",
    action: () => scrollToId("experience"),
    keywords: ["work", "jobs", "career"],
  },
  {
    id: "scroll-projects",
    label: "Projects",
    icon: HashIcon,
    group: "Navigate",
    action: () => scrollToId("projects"),
    keywords: ["work", "build", "ship"],
  },
  {
    id: "scroll-hackathons",
    label: "Hackathons",
    icon: HashIcon,
    group: "Navigate",
    action: () => scrollToId("hackathons"),
    keywords: ["wins", "competition"],
  },
  {
    id: "scroll-gallery",
    label: "Moments",
    icon: HashIcon,
    group: "Navigate",
    action: () => scrollToId("gallery"),
    keywords: ["photos", "gallery"],
  },
  {
    id: "top",
    label: "Back to top",
    icon: ArrowUpIcon,
    group: "Navigate",
    action: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    keywords: ["scroll", "beginning", "start"],
  },

  // ── Links ──
  {
    id: "github",
    label: "GitHub",
    icon: GithubIcon,
    group: "Links",
    action: () => window.open("https://github.com/icantcodefyi", "_blank"),
    keywords: ["code", "repository", "open source"],
  },
  {
    id: "twitter",
    label: "Twitter",
    icon: TwitterIcon,
    group: "Links",
    action: () => window.open("https://twitter.com/icantcodefyi", "_blank"),
    keywords: ["social", "x", "tweet"],
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: LinkedInIcon,
    group: "Links",
    action: () => window.open("https://linkedin.com/in/aniruddhdubge", "_blank"),
    keywords: ["professional", "connect"],
  },
  {
    id: "email",
    label: "Email",
    description: "icantcodefyi@gmail.com",
    icon: MailIcon,
    group: "Links",
    action: () => window.open("mailto:icantcodefyi@gmail.com"),
    keywords: ["contact", "mail", "message"],
  },

  // ── Projects ──
  {
    id: "autodiagram",
    label: "autodiagram",
    icon: ArrowRightIcon,
    group: "Projects",
    action: () => window.open("https://autodiagram.com/", "_blank"),
    keywords: ["ai", "diagram"],
  },
  {
    id: "cattype",
    label: "cattype",
    icon: ArrowRightIcon,
    group: "Projects",
    action: () => window.open("https://cattype.live/", "_blank"),
    keywords: ["typing", "speed"],
  },
  {
    id: "elafda",
    label: "elafda",
    icon: ArrowRightIcon,
    group: "Projects",
    action: () => window.open("https://elafda.fun/", "_blank"),
    keywords: ["discussion", "twitter"],
  },
  {
    id: "invoicely",
    label: "invoicely",
    icon: ArrowRightIcon,
    group: "Projects",
    action: () => window.open("https://invoicely.gg/", "_blank"),
    keywords: ["invoice", "business"],
  },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Flat filtered list (for keyboard navigation)
  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q) ||
        cmd.keywords?.some((k) => k.includes(q)),
    );
  }, [query]);

  // Group filtered items in stable order
  const grouped = useMemo(() => {
    const map = new Map<CommandGroup, CommandItem[]>();
    for (const cmd of filtered) {
      const bucket = map.get(cmd.group);
      if (bucket) bucket.push(cmd);
      else map.set(cmd.group, [cmd]);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      items: map.get(g)!,
    }));
  }, [filtered]);

  const runCommand = useCallback((cmd: CommandItem) => {
    setOpen(false);
    setQuery("");
    cmd.action();
  }, []);

  // Keyboard shortcut to open / close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelectedIndex(0);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-command-item]");
    items[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      runCommand(filtered[selectedIndex]);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setQuery("");
          setSelectedIndex(0);
        }}
        aria-label="Open command palette"
        className="group fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-border bg-card/90 p-2 text-xs text-muted-foreground shadow-sm backdrop-blur transition-all hover:text-foreground hover:shadow-md sm:px-3 sm:py-1.5"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="sm:h-3 sm:w-3"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="hidden sm:inline">Quick nav</span>
        <kbd className="hidden rounded border border-border bg-background px-1 py-0.5 font-sans text-[10px] font-medium sm:inline-block">
          ⌘K
        </kbd>
      </button>
    );
  }

  // Build an index → item lookup so groups can share the flat selectedIndex
  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[15vh] sm:pt-[18vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close command palette"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-foreground/10 backdrop-blur-sm"
        style={{ animation: "fade-in 0.15s ease-out" }}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-[480px] overflow-hidden rounded-2xl bg-card shadow-2xl shadow-foreground/10 ring-1 ring-border"
        style={{ animation: "cmd-enter 0.18s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-muted-foreground/50"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
          />
          <kbd className="hidden shrink-0 rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70 sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[340px] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground/50">
              No results found.
            </p>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group} className="mb-1 last:mb-0">
                <div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">
                  {group}
                </div>
                {items.map((cmd) => {
                  flatIndex++;
                  const isSelected = flatIndex === selectedIndex;
                  const itemIndex = flatIndex;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      data-command-item
                      onClick={() => runCommand(cmd)}
                      onMouseMove={() => setSelectedIndex(itemIndex)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
                        isSelected
                          ? "bg-pastel-lavender/25 text-foreground"
                          : "text-foreground/80",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center transition-colors",
                          isSelected
                            ? "text-foreground/70"
                            : "text-muted-foreground/50",
                        )}
                      >
                        {cmd.icon}
                      </span>
                      <span className="flex-1 truncate font-medium">
                        {cmd.label}
                      </span>
                      {cmd.description ? (
                        <span className="hidden truncate text-[11px] text-muted-foreground/50 sm:inline">
                          {cmd.description}
                        </span>
                      ) : null}
                      {isSelected ? (
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="shrink-0 text-muted-foreground/50"
                          aria-hidden="true"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="hidden items-center justify-between gap-4 border-t border-border bg-muted/30 px-4 py-2 text-[10px] text-muted-foreground/60 sm:flex">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-sans">↑↓</kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-sans">↵</kbd>
              select
            </span>
          </div>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border bg-background px-1 py-0.5 font-sans">⌘K</kbd>
            toggle
          </span>
        </div>
      </div>
    </div>
  );
}
