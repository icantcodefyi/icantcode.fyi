import { useCallback, useEffect, useRef, useState } from "react";

import { unlock } from "@/lib/achievements";

/**
 * Terminal — a hidden in-page terminal opened with the backtick key.
 *
 * The command palette's evil twin. Canned commands include:
 *   help, whoami, ls, projects, anime, cowsay, hire me,
 *   sudo hire me, date, pwd, cat, ssh, vim, sudo rm -rf, clear, exit
 *
 *  • Press `  (backtick) anywhere on the page to open
 *  • Press Esc or type `exit` to close
 *  • Maintains a history buffer; arrow keys recall previous commands
 *  • vim swaps the scrollback for a faux vim editor until `:q`
 *  • `sudo rm -rf portfolio/` triggers a CRT destruct + reboot
 *  • Achievements unlock on first use of hidden commands
 */

interface Line {
  prompt?: string;
  text: string;
  isInput?: boolean;
}

type CommandResult =
  | string
  | string[]
  | { clear: true }
  | { exit: true }
  | { vim: true }
  | { rmrf: true }
  | { ssh: string }
  | { noop: true };

const BANNER = `aniruddh@icantcode.fyi [~]
type 'help' for a list of commands, 'exit' to close.`;

const ABOUT_TEXT = `  _
 / \\__  aniruddh dubge
(    @\\___     developer from india
 /         O   self-taught, anime-pilled, hackathon-poisoned
/   (_____/    currently: supernova ai (bengaluru)
/_____/ U      here: icantcode.fyi`;

const PROJECTS_LIST = [
  "autodiagram      AI-powered text to diagrams",
  "cattype          typing practice with themes",
  "elafda           discussion platform",
  "invoicely        invoice generator",
  "aurastake        SOL staking productivity",
  "doblar           local image converter",
  "annu's poems     poems by annu",
  "getaresume       resume → portfolio",
];

const ANIME_LIST = [
  "currently watching    frieren: beyond journey's end",
  "all-time favorite     re:zero",
  "crying in the corner  clannad after story",
  "on the list           monster, vinland saga s2",
];

// ssh targets — name → real URL
const SSH_TARGETS: Record<string, string> = {
  autodiagram: "https://autodiagram.com/",
  cattype: "https://cattype.live/",
  elafda: "https://elafda.fun/",
  invoicely: "https://invoicely.gg/",
  aurastake: "https://aurastake.xyz/",
  doblar: "https://doblar.ani.ink/",
  "annu's-poems": "https://annnu.art/",
  annu: "https://annnu.art/",
  getaresume: "https://getaresu.me/",
};

const HIRE_TEXT = [
  "permission granted.",
  "email:  icantcodefyi@gmail.com",
  "status: open to full-time and serious contract work",
  "bonus:  will debug your tailwind on a call for free",
];

function cowsay(msg: string): string {
  const line = msg || "moo";
  const bar = "-".repeat(line.length + 2);
  return [
    ` ${bar}`,
    `< ${line} >`,
    ` ${bar}`,
    "        \\   ^__^",
    "         \\  (oo)\\_______",
    "            (__)\\       )\\/\\",
    "                ||----w |",
    "                ||     ||",
  ].join("\n");
}

/* ── Help screen ── */
const HELP_LINES = [
  "available commands:",
  "  help              show this message",
  "  whoami            who you're talking to",
  "  ls                list things around here",
  "  projects          list projects",
  "  anime             what ani is watching",
  "  cat about         ani in ascii",
  "  cowsay <msg>      cow says it",
  "  hire me           (i'm open to work)",
  "  ssh <project>     jump into a project",
  "  vim about.md      open the vim about card",
  "  date              what time is it in bengaluru",
  "  pwd               present working directory",
  "  theme <id>        re-zero | frieren | storm | default",
  "  clear             clear the scrollback",
  "  exit              close the terminal",
  "",
  "and a couple of things you'll have to discover :)",
];

/* ── Commands ── */
const COMMANDS: Record<string, (args: string[]) => CommandResult> = {
  help: () => HELP_LINES,
  whoami: () =>
    "aniruddh — developer from india, product engineer @ supernova ai",
  ls: () => [
    "experience/  projects/  hackathons/  moments/  guestbook/",
    "pfp.jpeg  resume.pdf  secrets.env",
  ],
  projects: () => PROJECTS_LIST,
  anime: () => ANIME_LIST,
  cat: (args) => {
    if (args[0] === "about") return ABOUT_TEXT.split("\n");
    if (args[0] === "secrets.env") return "nice try ;)";
    return `cat: ${args[0] || ""}: no such file`;
  },
  cowsay: (args) => cowsay(args.join(" ")),
  hire: (args) => {
    if (args[0] === "me" || args.length === 0) {
      unlock("hire-me");
      return HIRE_TEXT;
    }
    return `hire: unknown target '${args.join(" ")}'`;
  },
  sudo: (args) => {
    const joined = args.join(" ");
    if (joined === "hire me") {
      unlock("hire-me");
      return HIRE_TEXT;
    }
    if (joined === "rm -rf portfolio/" || joined === "rm -rf /") {
      return { rmrf: true };
    }
    return `sudo: ${joined || ""}: command not authorized.`;
  },
  ssh: (args) => {
    const target = (args[0] || "").toLowerCase();
    if (!target) {
      return [
        "ssh: missing target. try one of:",
        ...Object.keys(SSH_TARGETS).map((k) => `  ssh ${k}`),
      ];
    }
    const url = SSH_TARGETS[target];
    if (!url) return `ssh: unknown host '${target}'`;
    unlock("ssh");
    return { ssh: url };
  },
  vim: (args) => {
    const file = args[0] || "";
    if (file !== "about.md" && file !== "about" && file !== "") {
      return `vim: ${file}: can only open 'about.md' here`;
    }
    unlock("vim");
    return { vim: true };
  },
  nano: (args) => COMMANDS.vim(args),
  theme: (args) => {
    const id = (args[0] || "").toLowerCase();
    const root = document.documentElement;
    if (id === "default" || id === "reset" || id === "") {
      delete root.dataset.theme;
      try {
        window.sessionStorage.removeItem("icc-theme");
      } catch {
        // ignore
      }
      return "theme reset to default.";
    }
    if (id === "re-zero" || id === "frieren" || id === "storm") {
      root.dataset.theme = id;
      try {
        window.sessionStorage.setItem("icc-theme", id);
      } catch {
        // ignore
      }
      unlock("theme-swap");
      return `theme set to ${id}.`;
    }
    return `theme: unknown '${id}' — try re-zero, frieren, storm, default`;
  },
  date: () =>
    new Intl.DateTimeFormat("en-IN", {
      dateStyle: "full",
      timeStyle: "long",
      timeZone: "Asia/Kolkata",
    }).format(new Date()),
  pwd: () => "/home/aniruddh/portfolio",
  clear: () => ({ clear: true }),
  exit: () => ({ exit: true }),
};

/* ── Vim faux editor ── */
const VIM_ABOUT = [
  "# about.md",
  "",
  "name:     aniruddh dubge",
  "handle:   icantcodefyi",
  "location: bengaluru, india",
  "role:     product engineer @ supernova ai",
  "",
  "## stack",
  "- typescript, react, react router, node, postgres, drizzle",
  "- cloudflare workers, vercel, trpc, tailwind, shadcn",
  "",
  "## currently",
  "- shipping internal tools at supernova",
  "- over-engineering this portfolio",
  "- watching frieren, re-reading vinland saga",
  "",
  "## contact",
  "- mail:   icantcodefyi@gmail.com",
  "- github: icantcodefyi",
  "",
  "(press `:q` to leave vim.  `:wq` works too, i don't judge.)",
];

function VimView({ onExit }: { onExit: () => void }) {
  const [cmd, setCmd] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="relative min-h-[320px] bg-[oklch(0.16_0.01_60)] text-[oklch(0.92_0.01_60)]">
      <div className="px-4 py-3 font-mono text-[12px] leading-relaxed">
        {VIM_ABOUT.map((line, i) => (
          <div key={i} className="flex gap-3">
            <span className="w-6 select-none text-right text-white/25 tabular-nums">
              {i + 1}
            </span>
            <span className="whitespace-pre">{line || " "}</span>
          </div>
        ))}
        {/* trailing tildes, vim style */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`~${i}`} className="flex gap-3">
            <span className="w-6 select-none text-right text-white/15">~</span>
            <span />
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 border-t border-white/10 bg-[oklch(0.13_0.01_60)] px-4 py-2 font-mono text-[11px] text-white/70">
        <span className="mr-3 rounded bg-[oklch(0.40_0.12_145)] px-1.5 text-[10px] font-bold uppercase text-white">
          normal
        </span>
        <span>about.md</span>
        <span className="ml-3 text-white/40">
          {VIM_ABOUT.length}L, {VIM_ABOUT.reduce((n, l) => n + l.length, 0)}B
        </span>
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 bg-black/40 px-4 py-2 font-mono text-[12px]">
        <span className="text-[oklch(0.80_0.12_145)]">:</span>
        <input
          ref={inputRef}
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const c = cmd.trim();
              if (c === "q" || c === "q!" || c === "wq" || c === "x") {
                onExit();
              } else {
                setCmd("");
              }
            } else if (e.key === "Escape") {
              e.preventDefault();
              onExit();
            }
          }}
          placeholder="q to quit"
          className="flex-1 bg-transparent text-inherit outline-none placeholder:text-white/25"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

/* ── CRT reboot overlay ── */
const RM_LINES = [
  "sudo rm -rf portfolio/",
  "removing projects/autodiagram...",
  "removing projects/cattype...",
  "removing projects/elafda...",
  "removing hackathons/ethindia-2024...",
  "removing hackathons/hackwave...",
  "removing moments/image17.webp...",
  "removing components/oneko.tsx...",
  "removing components/terminal.tsx...",
  "removing src/routes/_index.tsx...",
  "removing .env ...",
  "wait.",
  "...",
];

const BOOT_LINES = [
  "[    0.000000] icc-bios v4.6 booting...",
  "[    0.124091] memory: 640KB ought to be enough",
  "[    0.310887] oneko.ko loaded",
  "[    0.612004] terminal.ko loaded",
  "[    0.840221] weather/bengaluru: clear 28°C",
  "[    0.961733] spotify: now playing — radwimps",
  "[    1.044210] projects: 8 shipped, 13 hackathons won",
  "[    1.220001] portfolio reassembled successfully",
  "",
  "welcome back. bringing the site back...",
];

function CrtReboot({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"collapse" | "boot" | "done">("collapse");
  const [shown, setShown] = useState<string[]>([]);
  const reducedRef = useRef(false);

  // Reduced-motion: skip the whole show, reload immediately
  useEffect(() => {
    if (typeof window === "undefined") return;
    reducedRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedRef.current) {
      window.location.reload();
    }
  }, []);

  // Phase transitions
  useEffect(() => {
    if (reducedRef.current) return;
    if (phase === "collapse") {
      // type the rm lines while we collapse
      let i = 0;
      const id = setInterval(() => {
        setShown((arr) => [...arr, RM_LINES[i]]);
        i++;
        if (i >= RM_LINES.length) {
          clearInterval(id);
          // collapse CSS animation runs 700ms; schedule boot at 750ms
          setTimeout(() => {
            setShown([]);
            setPhase("boot");
          }, 750);
        }
      }, 120);
      return () => clearInterval(id);
    }
    if (phase === "boot") {
      let i = 0;
      const id = setInterval(() => {
        setShown((arr) => [...arr, BOOT_LINES[i]]);
        i++;
        if (i >= BOOT_LINES.length) {
          clearInterval(id);
          setTimeout(() => setPhase("done"), 700);
        }
      }, 110);
      return () => clearInterval(id);
    }
    if (phase === "done") {
      // refresh for real
      window.location.reload();
      onDone();
    }
  }, [phase, onDone]);

  const cls =
    phase === "collapse"
      ? "crt-overlay is-collapsing"
      : phase === "boot"
      ? "crt-overlay is-booting"
      : "crt-overlay";

  return (
    <div className={cls} role="alert" aria-live="assertive">
      <pre>
        {shown.map((l, i) => (
          <div key={`${phase}-${i}`} className="crt-line">
            {l}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function Terminal() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>(() => [{ text: BANNER }]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [mode, setMode] = useState<"shell" | "vim" | "rmrf">("shell");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Backtick to open (except when user is typing in an input/textarea)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "`" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        const tag = target.tagName;
        const isEditable =
          tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
        if (isEditable) return;
        e.preventDefault();
        setOpen((o) => {
          const next = !o;
          if (next) unlock("terminal");
          return next;
        });
      } else if (e.key === "Escape" && mode === "shell") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  useEffect(() => {
    if (open && mode === "shell") {
      const id = requestAnimationFrame(() => {
        inputRef.current?.focus();
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
        });
      });
      return () => cancelAnimationFrame(id);
    }
  }, [open, lines, mode]);

  const run = useCallback((raw: string) => {
    const trimmed = raw.trim();
    const echo: Line = { text: trimmed, prompt: "$", isInput: true };
    if (!trimmed) {
      setLines((ls) => [...ls, echo]);
      return;
    }

    const tokens = trimmed.split(/\s+/);
    let cmd = tokens[0];
    let args = tokens.slice(1);

    // "hire me" → hire me
    if (cmd === "hire" && args[0] === "me") {
      args = ["me"];
    }

    const handler = COMMANDS[cmd];

    setHistory((h) => [trimmed, ...h].slice(0, 50));
    setHistoryIdx(-1);

    if (!handler) {
      setLines((ls) => [
        ...ls,
        echo,
        { text: `command not found: ${cmd}. try 'help'` },
      ]);
      return;
    }

    const result = handler(args);

    if (typeof result === "object" && !Array.isArray(result)) {
      if ("clear" in result) {
        setLines([]);
        return;
      }
      if ("exit" in result) {
        setLines((ls) => [...ls, echo, { text: "bye ✦" }]);
        setTimeout(() => setOpen(false), 300);
        return;
      }
      if ("vim" in result) {
        setLines((ls) => [...ls, echo]);
        setMode("vim");
        return;
      }
      if ("rmrf" in result) {
        setLines((ls) => [...ls, echo]);
        unlock("rm-rf");
        // close terminal, then mount CRT overlay
        setTimeout(() => {
          setOpen(false);
          setMode("rmrf");
        }, 250);
        return;
      }
      if ("ssh" in result) {
        const url = result.ssh;
        setLines((ls) => [
          ...ls,
          echo,
          { text: `connecting to ${new URL(url).hostname}...` },
          { text: "key exchange... ok" },
          { text: "authenticating... ok" },
          { text: `redirecting → ${url}` },
        ]);
        setTimeout(() => window.open(url, "_blank", "noopener"), 600);
        return;
      }
    }

    const out = Array.isArray(result) ? result : [result as string];
    setLines((ls) => [...ls, echo, ...out.map((text) => ({ text }))]);
  }, []);

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      run(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const next = Math.min(history.length - 1, historyIdx + 1);
      setHistoryIdx(next);
      setInput(history[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx <= 0) {
        setHistoryIdx(-1);
        setInput("");
      } else {
        const next = historyIdx - 1;
        setHistoryIdx(next);
        setInput(history[next]);
      }
    }
  }

  // Render the CRT overlay without the shell chrome
  if (mode === "rmrf") {
    return <CrtReboot onDone={() => setMode("shell")} />;
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center px-4 pb-6 sm:items-start sm:pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Terminal"
    >
      <button
        type="button"
        aria-label="Close terminal"
        onClick={() => {
          if (mode === "vim") {
            setMode("shell");
            return;
          }
          setOpen(false);
        }}
        className="absolute inset-0 bg-foreground/15 backdrop-blur-[2px]"
        style={{ animation: "fade-in 0.15s ease-out" }}
      />
      <div
        className="relative w-full max-w-[640px] overflow-hidden rounded-xl bg-[oklch(0.16_0.01_60)] text-[oklch(0.92_0.01_60)] shadow-2xl ring-1 ring-black/20"
        style={{
          animation: "cmd-enter 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          fontFamily:
            "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace",
        }}
      >
        {/* Chrome bar */}
        <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[oklch(0.72_0.18_25)]" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[oklch(0.83_0.15_85)]" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[oklch(0.78_0.15_145)]" />
          <span className="ml-3 text-[11px] text-white/40">
            {mode === "vim"
              ? "vim — about.md — icantcode.fyi"
              : "zsh — 80×24 — icantcode.fyi"}
          </span>
        </div>

        {mode === "vim" ? (
          <VimView onExit={() => setMode("shell")} />
        ) : (
          <div
            ref={scrollRef}
            className="terminal-scroll max-h-[55vh] min-h-[260px] overflow-y-auto px-4 py-3 text-[13px] leading-relaxed"
          >
            {lines.map((line, i) => (
              <pre
                key={i}
                className="whitespace-pre-wrap font-mono"
                style={{ margin: 0 }}
              >
                {line.prompt ? (
                  <span className="text-[oklch(0.80_0.12_145)]">
                    {line.prompt}{" "}
                  </span>
                ) : null}
                {line.text}
              </pre>
            ))}
            {/* Input line */}
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[oklch(0.80_0.12_145)]">$</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onInputKey}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="flex-1 bg-transparent text-[13px] font-mono text-inherit outline-none placeholder:text-white/30"
                placeholder="help"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
