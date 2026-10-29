/* The band, the setlist and the shelf (the photos mirror public/bts/manifest.json). */

export type Member = {
  slug: string;
  name: string;
  /** given name in Hangul */
  hangul: string;
  position: string;
  line: string;
  /** where the moving heads point for this member's cue, degrees outward (the centre stays dark at any of them) */
  aim: number;
};

export const MEMBERS: Member[] = [
  {
    slug: "rm",
    name: "RM",
    hangul: "김남준",
    position: "Leader and rapper",
    line: "He makes thinking out loud sound brave. Every time he speaks I want to slow down and say things properly.",
    aim: 1.2,
  },
  {
    slug: "jin",
    name: "Jin",
    hangul: "김석진",
    position: "Vocalist",
    line: "Equal parts grace and goofiness. He can turn a stadium into a living room with one joke.",
    aim: 4.2,
  },
  {
    slug: "suga",
    name: "Suga",
    hangul: "민윤기",
    position: "Rapper and producer",
    line: "Quiet until the beat drops, then every word lands. My favourite kind of focus.",
    aim: 0.2,
  },
  {
    slug: "jhope",
    name: "j-hope",
    hangul: "정호석",
    position: "Rapper and dancer",
    line: "Hope is right there in the name, and he delivers. The energy I borrow on slow mornings.",
    aim: 5.4,
  },
  {
    slug: "jimin",
    name: "Jimin",
    hangul: "박지민",
    position: "Vocalist and dancer",
    line: "He moves like the music starts somewhere inside him. I rewind his parts more than I'd admit.",
    aim: 2.4,
  },
  {
    slug: "v",
    name: "V",
    hangul: "김태형",
    position: "Vocalist",
    line: "That low, warm voice and an artist's eye for everything. Calm, curious and a little bit of a mystery.",
    aim: 6,
  },
  {
    slug: "jungkook",
    name: "Jungkook",
    hangul: "전정국",
    position: "Vocalist",
    line: "Makes the hard things look easy and still seems to be having the most fun on stage.",
    aim: 3,
  },
];

export const cutout = (slug: string) => `/bts/members/${slug}.webp`;
export const avatar = (slug: string) => `/bts/members/${slug}-avatar.webp`;

export type Song = {
  title: string;
  album: string;
  year: number;
  previewUrl: string;
  artwork: string;
};

const A = "https://audio-ssl.itunes.apple.com/itunes-assets/";
const I = "https://is1-ssl.mzstatic.com/image/thumb/";
export const SONGS: Song[] = [
  {
    title: "Spring Day",
    album: "You Never Walk Alone",
    year: 2017,
    previewUrl: `${A}AudioPreview221/v4/ba/76/d5/ba76d586-0dac-c800-f08d-467aef7dc9c0/mzaf_12707603572181808804.plus.aac.p.m4a`,
    artwork: `${I}Music116/v4/ce/fb/eb/cefbebd4-d53b-8d6c-33cf-2ee55408bd79/8804775077494_Cover.jpg/600x600bb.jpg`,
  },
  {
    title: "DNA",
    album: "Love Yourself 承 'Her'",
    year: 2017,
    previewUrl: `${A}AudioPreview211/v4/c7/13/e4/c713e4f5-632f-5afd-31dd-2c103af851e1/mzaf_237511262542737989.plus.aac.p.m4a`,
    artwork: `${I}Music126/v4/34/a5/93/34a59372-3ebd-ae5f-269d-4c9506864d3f/8804775083280_Cover.jpg/600x600bb.jpg`,
  },
  {
    title: "Fake Love",
    album: "Love Yourself 轉 'Tear'",
    year: 2018,
    previewUrl: `${A}AudioPreview221/v4/83/6f/0f/836f0f3c-fb8d-a70e-5e77-5c87e2d37d62/mzaf_1406277017641177283.plus.aac.p.m4a`,
    artwork: `${I}Music126/v4/02/c5/18/02c518f5-ac06-3321-622e-08d9429fd968/192562556672_Cover.jpg/600x600bb.jpg`,
  },
  {
    title: "Boy With Luv",
    album: "Map of the Soul: Persona",
    year: 2019,
    previewUrl: `${A}AudioPreview211/v4/0b/8d/84/0b8d84e5-5273-ae21-0c6e-591af6097294/mzaf_16252906211188582302.plus.aac.p.m4a`,
    artwork: `${I}Music116/v4/40/d4/93/40d493e3-ac9e-1746-8d4c-f380f27c97cb/193483706238_Cover.jpg/600x600bb.jpg`,
  },
  {
    title: "Dynamite",
    album: "BE",
    year: 2020,
    previewUrl: `${A}AudioPreview221/v4/a3/a0/a6/a3a0a6b5-4715-b872-1aff-21e42634d9cd/mzaf_7224423421767640589.plus.aac.p.m4a`,
    artwork: `${I}Music116/v4/22/f3/8f/22f38fb9-1690-326a-d891-7aa946c2b06f/195497623273_Cover.jpg/600x600bb.jpg`,
  },
  {
    title: "Butter",
    album: "Butter",
    year: 2021,
    previewUrl: `${A}AudioPreview116/v4/fd/16/2a/fd162abd-e7bb-2dda-0966-802045d9e6b5/mzaf_16580954066183351090.plus.aac.p.m4a`,
    artwork: `${I}Music126/v4/41/c8/dc/41c8dcd8-f883-adde-c762-dc49383b6b58/196006720476_Cover.jpg/600x600bb.jpg`,
  },
  {
    title: "Life Goes On",
    album: "BE",
    year: 2020,
    previewUrl: `${A}AudioPreview211/v4/7f/63/1c/7f631c84-92f2-0805-22cf-8b15ddae12ce/mzaf_7122502015402982287.plus.aac.p.m4a`,
    artwork: `${I}Music116/v4/22/f3/8f/22f38fb9-1690-326a-d891-7aa946c2b06f/195497623273_Cover.jpg/600x600bb.jpg`,
  },
  {
    title: "Yet To Come",
    album: "Proof",
    year: 2022,
    previewUrl: `${A}AudioPreview221/v4/12/a9/3d/12a93d0b-036b-170b-09fa-379d785e63b7/mzaf_17633343337902112849.plus.aac.p.m4a`,
    artwork: `${I}Music122/v4/f7/68/9c/f7689ce3-6d41-60cd-62d2-57a91ddf5b9d/196922067341_Cover.jpg/600x600bb.jpg`,
  },
];

export const appleSearch = (s: Song) => `https://music.apple.com/us/search?term=${encodeURIComponent(`BTS ${s.title}`)}`;
export const songArt = (s: Song, px = 360) => s.artwork.replace("600x600", `${px}x${px}`);

export type Album = {
  slug: string;
  title: string;
  year: number;
  /** its title track, and where that is in the setlist (if it is) */
  track: string;
  song?: number;
  /** the sleeve's board, for its spine and edge */
  tone: string;
};

export const ALBUMS: Album[] = [
  { slug: "wings", title: "Wings", year: 2016, track: "Blood Sweat & Tears", tone: "#d9d6d2" },
  { slug: "love-yourself-tear", title: "Love Yourself: Tear", year: 2018, track: "Fake Love", song: 2, tone: "#22252e" },
  { slug: "love-yourself-answer", title: "Love Yourself: Answer", year: 2018, track: "Idol", tone: "#e8b9cc" },
  { slug: "map-of-the-soul-persona", title: "Map of the Soul: Persona", year: 2019, track: "Boy With Luv", song: 3, tone: "#f4729a" },
  { slug: "map-of-the-soul-7", title: "Map of the Soul: 7", year: 2020, track: "ON", tone: "#dfe7ec" },
  { slug: "be", title: "BE", year: 2020, track: "Life Goes On", song: 6, tone: "#ecebe8" },
  { slug: "butter", title: "Butter", year: 2021, track: "Butter", song: 5, tone: "#e07019" },
  { slug: "proof", title: "Proof", year: 2022, track: "Yet To Come", song: 7, tone: "#141414" },
];

export const sleeve = (slug: string) => `/bts/albums/${slug}.jpg`;
