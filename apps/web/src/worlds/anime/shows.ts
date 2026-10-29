import type { PanelId } from "./layout";

/** Box edges as % of the panel's box: left / right / top / bottom. */
export type Pos = { l?: number; r?: number; t?: number; b?: number };
export type Corner = "tl" | "tr" | "bl" | "br";
/** A rectangle in the poster's own 0..1 coordinates: x0, y0, x1, y1. */
export type Rect = [number, number, number, number];

export interface Place {
  bubble: Pos & { w: number; tail: number };
  cap: Corner;
  sfx: Pos & { size: number };
  /**
   * A group shot too crowded to letter over fills only `span` of the panel's
   * width, from the left, and dissolves into screentone beyond it; `zoom`
   * crops in past a plain cover fit, so the faces it keeps sit large (anime.tsx Art).
   */
  art?: { span: number; zoom: number };
  /** where the camera looks in this layout, if not at the show's own focus */
  focus?: [number, number];
}

export interface Show {
  id: Exclude<PanelId, "title">;
  title: string;
  native: string;
  /** the first season: its premiere year, its episodes, and its AniList average score (anime.tsx COLOPHON) */
  year: number;
  eps: number;
  score: number;
  /** the poster's file in /lobby/anime/: `<img>-<width>.avif` (and .webp), full size and 600 px wide */
  img: string;
  /** the full-size file's natural px (faces, focus and the crop are in its 0..1 coordinates) */
  size: [number, number];
  line: string;
  sfx: string;
  sfxVertical?: boolean;
  /** Riso: black ink, or the one spot ink (Riso Blue) */
  sfxFill: "ink" | "spot";
  bubble: "round" | "burst";
  /** where the camera looks, in the poster's 0..1 coordinates */
  focus: [number, number];
  /** the faces nothing may cover (tuning aid: ?an-faces draws them) */
  faces: Rect[];
  /** which face says the line: the balloon's tail points at it */
  speaker: number;
  /** placements on a page (tablet, desktop) and on the phone strip */
  page: Place;
  strip: Place;
}

/** In reading order: the splash page first, then the facing page. */
export const SHOWS: Show[] = [
  {
    id: "hxh",
    title: "Hunter × Hunter",
    native: "ハンター×ハンター",
    year: 2011,
    eps: 148,
    score: 89,
    img: "hxh",
    size: [989, 1401],
    line: "Nen is just TypeScript generics with better marketing.",
    sfx: "ガッ",
    sfxFill: "spot",
    bubble: "burst",
    focus: [0.53, 0.32],
    faces: [
      [0.56, 0.08, 0.75, 0.21], // Leorio
      [0.22, 0.23, 0.39, 0.36], // Kurapika
      [0.43, 0.38, 0.58, 0.5], // Gon
      [0.7, 0.38, 0.87, 0.51], // Killua
    ],
    speaker: 3,
    page: { bubble: { l: 3, t: 54, w: 236, tail: -70 }, cap: "bl", sfx: { l: 3, t: 40, size: 44 } },
    strip: { bubble: { r: 2, t: 60, w: 176, tail: -110 }, cap: "bl", sfx: { l: 3, t: 4, size: 44 } },
  },
  {
    id: "mob",
    title: "Mob Psycho 100",
    native: "モブサイコ100",
    year: 2016,
    eps: 12,
    score: 84,
    img: "mob",
    size: [1200, 1693],
    line: "Stays humble while being the strongest in the room. Relatable.",
    sfx: "ドドド",
    sfxFill: "ink",
    bubble: "round",
    focus: [0.52, 0.4],
    faces: [
      [0.43, 0.22, 0.565, 0.33], // Mob
      [0.53, 0.03, 0.8, 0.24], // Reigen
    ],
    // Reigen says it about Mob: Mob would never call himself the strongest
    speaker: 1,
    page: { bubble: { r: 3, t: 40, w: 230, tail: 200 }, cap: "br", sfx: { l: 4, b: 21, size: 40 } },
    strip: { bubble: { l: 2, t: 46, w: 210, tail: -40 }, cap: "br", sfx: { l: 4, b: 26, size: 38 } },
  },
  {
    id: "bebop",
    title: "Cowboy Bebop",
    native: "カウボーイビバップ",
    year: 1998,
    eps: 26,
    score: 86,
    img: "bebop",
    size: [878, 1222],
    line: "The soundtrack ships my code faster. See you, space cowboy.",
    sfx: "バン！",
    sfxFill: "spot",
    bubble: "round",
    focus: [0.48, 0.38],
    faces: [
      [0.42, 0.4, 0.55, 0.49], // Spike
      [0.5, 0.295, 0.61, 0.39], // Faye
      [0.13, 0.035, 0.25, 0.135], // Jet
      [0.22, 0.66, 0.36, 0.77], // Ein
      [0.455, 0.09, 0.55, 0.17], // Ed, upside down
    ],
    speaker: 0,
    page: { bubble: { r: 1, t: 2, w: 226, tail: 125 }, cap: "bl", sfx: { l: 2, t: 22, size: 64 } },
    // a phone's tier is too short for the whole crew: it drops Jet and Ed off the top to keep Spike and Faye
    strip: { bubble: { r: 2, t: 3, w: 214, tail: 140 }, cap: "bl", sfx: { l: 3, t: 30, size: 44 }, focus: [0.48, 0.5] },
  },
  {
    id: "sg",
    title: "Steins;Gate",
    native: "シュタインズ・ゲート",
    year: 2011,
    eps: 24,
    score: 89,
    img: "steins-gate",
    size: [1200, 1740],
    line: "I debug time itself, one world line at a time.",
    sfx: "ゴゴゴ",
    sfxVertical: true,
    sfxFill: "ink",
    bubble: "round",
    focus: [0.52, 0.48],
    faces: [
      [0.19, 0.44, 0.32, 0.55], // Kurisu
      [0.8, 0.36, 0.95, 0.48], // Okabe
      [0.58, 0.5, 0.71, 0.6], // Mayuri
      [0.33, 0.53, 0.58, 0.67], // Suzuha, Faris, Luka, Moeka
      [0.04, 0.575, 0.14, 0.64], // Daru
    ],
    speaker: 1,
    // on a page the street rides a little higher, so the narration box clears the lab members' chins
    page: { bubble: { l: 33, t: 5, w: 236, tail: 12 }, cap: "bl", sfx: { l: 1.5, t: 7, size: 29 }, focus: [0.52, 0.505] },
    strip: { bubble: { l: 22, t: 3, w: 214, tail: 30 }, cap: "bl", sfx: { l: 2, t: 6, size: 32 } },
  },
  {
    id: "frieren",
    title: "Frieren",
    native: "葬送のフリーレン",
    year: 2023,
    eps: 28,
    score: 91,
    img: "frieren",
    size: [1200, 1799],
    line: "I collect useless spells the way you collect side projects. No regrets.",
    sfx: "シーン",
    sfxVertical: true,
    sfxFill: "ink",
    bubble: "round",
    focus: [0.55, 0.36],
    faces: [
      [0.4, 0.36, 0.53, 0.46], // Frieren
      [0.62, 0.32, 0.7, 0.375], // Fern
      [0.77, 0.33, 0.84, 0.375], // Stark
    ],
    speaker: 0,
    page: { bubble: { l: 22, t: -6, w: 236, tail: 110 }, cap: "br", sfx: { l: 7, b: 28, size: 32 } },
    strip: { bubble: { r: 2, t: 2, w: 214, tail: 150 }, cap: "br", sfx: { l: 3, t: 6, size: 30 } },
  },
  {
    id: "jjk",
    title: "Jujutsu Kaisen",
    native: "呪術廻戦",
    year: 2020,
    eps: 24,
    score: 84,
    img: "jjk",
    size: [1200, 1677],
    line: "Domain expansion: my localhost, where every test passes.",
    sfx: "ズン",
    sfxFill: "spot",
    bubble: "burst",
    focus: [0.48, 0.24],
    faces: [
      [0.14, 0.14, 0.31, 0.3], // Megumi
      [0.4, 0.21, 0.56, 0.37], // Yuji
      [0.56, 0.06, 0.85, 0.32], // Gojo
      [0.13, 0.45, 0.35, 0.6], // Nobara
      [0.36, 0.04, 0.54, 0.12], // Sukuna's eye
    ],
    speaker: 2,
    page: { bubble: { r: 1, t: 12, w: 226, tail: 180 }, cap: "bl", sfx: { l: 3, t: 6, size: 54 }, art: { span: 0.7, zoom: 1.2 } },
    strip: { bubble: { r: 2, t: 44, w: 204, tail: -30 }, cap: "bl", sfx: { l: 34, b: 6, size: 31 } },
  },
];
