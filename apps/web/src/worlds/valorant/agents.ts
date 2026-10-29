/** The agent pool: who, the four abilities in HUD order (C Q E X), and how each one lights the rooftop. */

export type Key = "C" | "Q" | "E" | "X";

export interface Ability {
  key: Key;
  /** file slot under /lobby/val: grenade (C), ability1 (Q), ability2 (E), ultimate (X) */
  slot: "grenade" | "ability1" | "ability2" | "ultimate";
  name: string;
  what: string;
  /** the pips under the key: charges for C, Q and E, ultimate points for X (checked against patch 13.08) */
  pips: number;
  /** who it takes out in the feed: the day job's usual enemies */
  foe: string;
}

/**
 * How an agent lights the vista, in % of the stage: an off-white key glow
 * screened over the painting at `key` (radius `r`, strength `glow`), a
 * multiply shade sculpting it from `from` (deg, CSS gradient angle) at
 * `shade`, and the light shaft the dust turns in, at `shaft` x and tilted
 * `tilt` deg. Red, black and off-white only: the agents differ in where the
 * light falls and how much of it there is, never in hue.
 */
export interface Light {
  key: [number, number];
  r: number;
  glow: number;
  from: number;
  shade: number;
  shaft: number;
  tilt: number;
}

/** Each agent's ambient signature on the rooftop, behind them. */
export type Signature = "wind" | "recon" | "swarm" | "wire";

export interface Agent {
  id: string;
  name: string;
  role: "Duelist" | "Initiator" | "Sentinel";
  line: string;
  abilities: Ability[];
  light: Light;
  signature: Signature;
}

type Spec = [name: string, what: string, pips: number, foe: string];
const ability = (key: Key, slot: Ability["slot"], [name, what, pips, foe]: Spec): Ability => ({ key, slot, name, what, pips, foe });
const kit = (c: Spec, q: Spec, e: Spec, x: Spec): Ability[] => [
  ability("C", "grenade", c),
  ability("Q", "ability1", q),
  ability("E", "ability2", e),
  ability("X", "ultimate", x),
];

export const AGENTS: Agent[] = [
  {
    id: "jett",
    name: "Jett",
    role: "Duelist",
    line: "Dash in, ship the thing, gone before the design review.",
    abilities: kit(
      ["Cloudburst", "A cloud that bursts into a quick smoke where it lands. Hold to curve it.", 2, "Code review"],
      ["Updraft", "Straight up into the air, no questions asked.", 1, "Standup"],
      ["Tailwind", "Prime a dash, then burst the way you're moving. Two kills and it's back.", 1, "Design review"],
      ["Blade Storm", "Five dead-accurate throwing knives. Land a kill and they all come back.", 8, "Deadline"],
    ),
    // high noon over the campanile: bright, open, the shaft falling steep from the top right
    light: { key: [80, 2], r: 70, glow: 0.78, from: 200, shade: 0.06, shaft: 56, tilt: 12 },
    signature: "wind",
  },
  {
    id: "sova",
    name: "Sova",
    role: "Initiator",
    line: "Recon dart first. Reading the docs, basically.",
    abilities: kit(
      ["Owl Drone", "Fly a drone ahead; its dart marks whoever it hits.", 1, "Guesswork"],
      ["Shock Bolt", "A bolt that bursts into a damaging pulse on impact.", 2, "Typo"],
      ["Recon Bolt", "A bolt that pings sonar, revealing enemies in its line of sight.", 1, "Hidden bug"],
      ["Hunter's Fury", "Three long-range blasts that cut through walls and reveal whoever they hit.", 8, "Legacy code"],
    ),
    // low light off the horizon behind the city: long, raking, a darker sky above
    light: { key: [30, 66], r: 56, glow: 0.58, from: 180, shade: 0.36, shaft: 44, tilt: 22 },
    signature: "recon",
  },
  {
    id: "killjoy",
    name: "Killjoy",
    role: "Sentinel",
    line: "Why hold the site yourself when the turret can? Automate everything.",
    abilities: kit(
      ["Nanoswarm", "A hidden grenade; trigger it to set a damaging swarm loose.", 2, "Busywork"],
      ["Alarmbot", "A hidden bot that chases enemies in range and leaves them Vulnerable.", 1, "Regression"],
      ["Turret", "A turret that watches a 100 degree cone and fires on its own.", 1, "Manual QA"],
      ["Lockdown", "After a long wind-up, detains every enemy inside the radius.", 9, "Tech debt"],
    ),
    // floodlit from below: the rooftop glows, the sky above goes deep
    light: { key: [64, 98], r: 58, glow: 0.56, from: 0, shade: 0.44, shaft: 60, tilt: 6 },
    signature: "swarm",
  },
  {
    id: "cypher",
    name: "Cypher",
    role: "Sentinel",
    line: "Knows where every edge case hides. Trapwire on all of them.",
    abilities: kit(
      ["Trapwire", "A hidden wire between walls. Trip it and you're slowed, then revealed if it holds.", 2, "Edge case"],
      ["Cyber Cage", "A tossed cage you trigger into smoke that sounds off when enemies walk through.", 2, "Flaky test"],
      ["Spycam", "A hidden camera you can watch through and fire a marking dart from.", 1, "Silent failure"],
      ["Neural Theft", "Read a fallen enemy and reveal where the rest of their team is, twice.", 7, "Root cause"],
    ),
    // one hard spot from the top left, everything else in shadow
    light: { key: [28, 6], r: 42, glow: 0.5, from: 135, shade: 0.56, shaft: 48, tilt: 18 },
    signature: "wire",
  },
];
