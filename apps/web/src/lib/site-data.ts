export const EMAIL = "icantcodefyi@gmail.com";
export const MAILTO = `mailto:${EMAIL}?subject=${encodeURIComponent("Hey ani")}`;

export const SOCIALS = [
  { label: "GitHub", href: "https://github.com/icantcodefyi" },
  { label: "X / Twitter", href: "https://twitter.com/icantcodefyi" },
  { label: "LinkedIn", href: "https://linkedin.com/in/aniruddhdubge" },
];

export interface Work {
  name: string;
  what: string;
  tags: string;
  url: string;
  shot: string;
}

/* Only projects that are live today. The older ones are listed by name. */
export const WORK: Work[] = [
  {
    name: "Sakura Lang",
    what: "A programming language built for coding agents. The function signature is the contract, and the compiler holds every change to it.",
    tags: "Language, compiler",
    url: "https://www.sakuralang.com",
    shot: "/work/sakura.webp",
  },
  {
    name: "dot/matrix",
    what: "28 dot-matrix loaders as tiny animated SVGs. About 4 KB each, no JavaScript at runtime. 87 stars on GitHub.",
    tags: "Open source, SVG",
    url: "https://dot-matrix-animations.vercel.app",
    shot: "/work/dotmatrix.webp",
  },
  {
    name: "Slopify",
    what: "An agent skill that builds the worst websites on the internet, on purpose. Twelve cursed eras, from GeoCities to the brainrot feed.",
    tags: "Agent skill",
    url: "https://slopified.vercel.app",
    shot: "/work/slopify.webp",
  },
  {
    name: "Invoicely",
    what: "A free invoice generator that makes the invoice look as good as the work it bills for.",
    tags: "Product",
    url: "https://invoicely.gg",
    shot: "/work/invoicely.webp",
  },
  {
    name: "cattype",
    what: "A typing test made for programming languages, so practice looks like the code you actually write.",
    tags: "Web app",
    url: "https://cattype.vercel.app",
    shot: "/work/cattype.webp",
  },
  {
    name: "car-paglu",
    what: "A Chrome extension that lets a small pixel cat chase your cursor around any website.",
    tags: "Extension",
    url: "https://chromewebstore.google.com/detail/car-paglu/hjnkhnnklhigalbmmncnfjigimglmckl",
    shot: "/work/neko.webp",
  },
];

export const EARLIER = ["autodiagram", "elafda", "aurastake", "doblar", "getaresume", "Annu's poems"];

export const WINS = [
  { event: "The Better Hack", built: "AI agent for local SEO", venue: "WeWork Pune", prize: "2nd prize" },
  { event: "EthIndia 2024", built: "Drag-and-drop smart contract builder", venue: "Bengaluru", prize: "Polkadot track" },
  { event: "Unfold 2024", built: "Autonomous on-chain AI agent", venue: "Bengaluru", prize: "Nethermind track" },
  { event: "WebGranth", built: "One place to learn frameworks", venue: "CDGI Indore", prize: "1st prize" },
  { event: "Hakxite", built: "AI tool for deaf and mute users", venue: "Indore", prize: "1st prize" },
  { event: "HackVSIT 5.0", built: "CSV to dashboard analyser", venue: "VSIT Delhi", prize: "3rd prize" },
  { event: "HackHive", built: "AI agent that drives websites", venue: "DAVV Indore", prize: "1st prize" },
  { event: "Udaymitsav '24", built: "Micro-blogging platform", venue: "IIT Jammu", prize: "1st in track" },
  { event: "Genesis 1.0", built: "Web3-native game", venue: "SRM Chennai", prize: "Berachain track" },
  { event: "Syntax Error X", built: "Manga platform with AI tagging", venue: "IIT Roorkee", prize: "Manga track" },
  { event: "Version Beta", built: "Blockchain finance companion", venue: "MANIT Bhopal", prize: "3rd place" },
  { event: "EthIndia 2023", built: "My first flight to Bengaluru", venue: "Bengaluru", prize: "Sponsor tracks" },
  { event: "Hackistica '23", built: "LeetCode Chrome extension", venue: "IIT Indore", prize: "First ever win" },
] as const;

export const HOSTED = [
  { event: "Imagine Hackathon", built: "Main organiser, all tech and on-site ops", venue: "Mumbai", prize: "Organiser" },
  { event: "HackWave 2024", built: "My college's first hackathon, 500+ sign-ups", venue: "CDGI Indore", prize: "Organiser" },
] as const;
