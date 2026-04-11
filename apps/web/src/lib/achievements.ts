/**
 * Achievements — a tiny pub/sub on top of localStorage so hidden
 * features can flag themselves as "discovered". The footer trophy row
 * subscribes and lights up pixel icons accordingly.
 *
 * Zero deps, SSR-safe, event-driven.
 *
 *  • unlock(id) — idempotent, persists, notifies subscribers
 *  • getUnlocked() — current Set
 *  • subscribe(cb) — returns an unsubscribe
 *
 * Nothing on the page should *depend* on an achievement being present.
 * The trophy row is additive delight: the site works the same if it's
 * stripped out.
 */

export const ACHIEVEMENTS = {
  konami: { label: "cat mode", icon: "◕‿◕" },
  terminal: { label: "terminal", icon: ">_" },
  "hire-me": { label: "hire me", icon: "✦" },
  "theme-swap": { label: "theme", icon: "◐" },
  "grid-overlay": { label: "grid", icon: "⌗" },
  snake: { label: "snake", icon: "~" },
  vim: { label: "vim", icon: ":q" },
  ssh: { label: "ssh", icon: "⇢" },
  "rm-rf": { label: "rm -rf", icon: "✗" },
  console: { label: "snoop", icon: "👁" },
  palette: { label: "⌘k", icon: "⌘" },
} as const;

export type AchievementId = keyof typeof ACHIEVEMENTS;

const STORAGE_KEY = "icc-achievements-v1";
const EVENT_NAME = "icc:achievement";

function isAchievementId(id: string): id is AchievementId {
  return id in ACHIEVEMENTS;
}

function readStore(): Set<AchievementId> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is AchievementId =>
      typeof x === "string" && isAchievementId(x),
    ));
  } catch {
    return new Set();
  }
}

function writeStore(set: Set<AchievementId>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // quota exceeded, private mode, whatever — delight is optional
  }
}

export function unlock(id: AchievementId): void {
  if (typeof window === "undefined") return;
  const set = readStore();
  if (set.has(id)) return;
  set.add(id);
  writeStore(set);
  window.dispatchEvent(
    new CustomEvent<AchievementId>(EVENT_NAME, { detail: id }),
  );
}

export function getUnlocked(): Set<AchievementId> {
  return readStore();
}

export function subscribe(
  cb: (unlocked: Set<AchievementId>, justUnlocked: AchievementId | null) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  function onEvent(e: Event) {
    const id = (e as CustomEvent<AchievementId>).detail;
    cb(readStore(), id);
  }
  function onStorage(e: StorageEvent) {
    if (e.key === STORAGE_KEY) cb(readStore(), null);
  }
  window.addEventListener(EVENT_NAME, onEvent);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onEvent);
    window.removeEventListener("storage", onStorage);
  };
}
