/** The agent pool: who, the four abilities in HUD order (C Q E X), and how each one lights the rooftop. */

export type Key = "C" | "Q" | "E" | "X";

export interface Ability {
  key: Key;
  /** file slot under /lobby/val: grenade (C), ability1 (Q), ability2 (E), ultimate (X) */
  slot: "grenade" | "ability1" | "ability2" | "ultimate";
  name: string;
  what: string;
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

const kit = (c: [string, string], q: [string, string], e: [string, string], x: [string, string]): Ability[] => [
  { key: "C", slot: "grenade", name: c[0], what: c[1] },
  { key: "Q", slot: "ability1", name: q[0], what: q[1] },
  { key: "E", slot: "ability2", name: e[0], what: e[1] },
  { key: "X", slot: "ultimate", name: x[0], what: x[1] },
];

export const AGENTS: Agent[] = [
  {
    id: "jett",
    name: "Jett",
    role: "Duelist",
    line: "Dash in, ship the thing, gone before the design review.",
    abilities: kit(
      ["Cloudburst", "A cloud that bursts into smoke where it lands. Hold to curve it."],
      ["Updraft", "Straight up into the air, no questions asked."],
      ["Tailwind", "Prime a dash, then burst a short way in the direction you're moving."],
      ["Blade Storm", "A set of throwing knives. Every kill gives them back."],
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
      ["Owl Drone", "Fly a drone ahead; its dart marks whoever it hits."],
      ["Shock Bolt", "A bolt that bursts into a damaging pulse on impact."],
      ["Recon Bolt", "A bolt that pings sonar, revealing anyone in its line of sight."],
      ["Hunter's Fury", "Three blasts of energy that cut through walls across the map."],
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
      ["Nanoswarm", "A hidden grenade; trigger it to set a damaging swarm loose."],
      ["Alarmbot", "A bot that hunts anyone in range and leaves them vulnerable."],
      ["Turret", "A turret that covers a 180 degree cone on its own."],
      ["Lockdown", "After a wind-up, detains everyone inside the radius."],
    ),
    // floodlit from below: the rooftop glows, the sky above goes deep
    light: { key: [64, 98], r: 58, glow: 0.56, from: 0, shade: 0.44, shaft: 60, tilt: 6 },
    signature: "swarm",
  },
  {
    id: "cypher",
    name: "Cypher",
    role: "Sentinel",
    line: "Knows where every edge case hides. Tripwire on all of them.",
    abilities: kit(
      ["Trapwire", "A hidden tripwire between two walls that holds whoever crosses it."],
      ["Cyber Cage", "A remote cage that becomes a wall of smoke on command."],
      ["Spycam", "A remote camera that can fire a tracking dart."],
      ["Neural Theft", "Read a fallen enemy and reveal where their team is."],
    ),
    // one hard spot from the top left, everything else in shadow
    light: { key: [28, 6], r: 42, glow: 0.5, from: 135, shade: 0.56, shaft: 48, tilt: 18 },
    signature: "wire",
  },
];
