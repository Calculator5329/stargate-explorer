import type { SkyName } from "@/world/skybox";
import type { AsteroidOptions } from "@/world/asteroids";
import type { FactionName } from "@/ships/palettes";

/**
 * A star system is a look and a belt: which sky, which planet preset, where the
 * planet and the sun sit, how thick the rock is. Missions name the system they
 * happen in; the hub groups them by it and the gate dials between them.
 * Franchise place names stay in strings.
 */
export interface SystemDef {
  id: string;
  name: string;
  blurb: string;
  sky: SkyName;
  /** key into PLANET_PRESETS; an unknown key falls back to the desert world */
  planet: string;
  planetPos: [number, number, number];
  sunDir: [number, number, number];
  belt: AsteroidOptions;
  /** play-field radius (m); the soft current past it turns you back. Default 1500. Systems differ so the maps do not all feel the same size. */
  arena?: number;
  /** who flies against you here: recolours every enemy hull (PALETTES); omitted = each hull's own default */
  faction?: FactionName;
}

// Rock tints, one per base shape (six shapes cycle through them). Ethan 2026-09-05: "maybe gray, maybe
// different colors, maybe different sizes": each belt mixes a couple of families instead of one plum.
const PLUM = [0x8a4a32, 0x7a4030, 0x925438, 0x6e3c3a];
const GREY = [0x6f6a66, 0x5b5754, 0x7c7671, 0x4f4b4a];
const OCHRE = [0x9a7a3e, 0x8a6a36, 0xa48848];
const CHAR = [0x3e3a3c, 0x4a4244, 0x35313a];
const mix = (...fams: number[][]): number[] => {
  const out: number[] = [];
  for (let i = 0; i < 6; i++) out.push(fams[i % fams.length]![Math.floor(i / fams.length) % fams[i % fams.length]!.length]!);
  return out;
};

export const SYSTEMS: SystemDef[] = [
  {
    id: "abydos",
    name: "ABYDOS",
    blurb: "The home belt. Orange sand below, the thickest rock in the sector.",
    sky: "abydos",
    planet: "desert",
    planetPos: [-2600, -900, 3800],
    sunDir: [0.6, 0.35, -0.7],
    arena: 2000,
    belt: { count: 2200, seed: 1337, inner: 60, outer: 1900, thickness: 460, shapes: 6, clusters: 6, clusterR: 300, clusterShare: 0.5, voids: 4, voidR: 260, tints: mix(PLUM, PLUM, GREY), bigChance: 0.14, big: [22, 60], small: [2, 14] },
  },
  {
    id: "chulak",
    name: "CHULAK",
    blurb: "Green sky, a jungle world, a flat wide belt the gliders stage from.",
    sky: "chulak",
    planet: "jungle",
    planetPos: [2400, 500, -3600],
    sunDir: [-0.55, 0.4, 0.55],
    arena: 1900,
    belt: { count: 2300, seed: 2024, inner: 60, outer: 1800, thickness: 280, shapes: 6, band: 900, bandW: 150, bandShare: 0.45, clusters: 4, clusterR: 240, clusterShare: 0.2, voids: 3, voidR: 240, tints: mix(GREY, PLUM, OCHRE), bigChance: 0.1, big: [20, 36], small: [3, 12] },
  },
  {
    id: "p3x774",
    name: "P3X-774",
    blurb: "Deep space over an ice world. Sparse rock, long sight lines, nowhere to hide.",
    sky: "deepSpace",
    planet: "ice",
    planetPos: [400, -2400, -4200],
    sunDir: [0.2, 0.6, 0.75],
    arena: 2400,
    belt: { count: 1300, seed: 7741, inner: 80, outer: 2300, thickness: 700, shapes: 6, clusters: 8, clusterR: 260, clusterShare: 0.65, tints: mix(GREY, CHAR), bigChance: 0.22, big: [30, 80], small: [4, 16] },
  },
  {
    id: "tollana",
    name: "TOLLANA",
    blurb: "A ringed giant and a thin belt of dust. The racers' circuit.",
    sky: "void",
    planet: "gasGiant",
    planetPos: [-1800, -1600, 4600],
    sunDir: [-0.7, 0.3, -0.6],
    arena: 2200,
    belt: { count: 1100, seed: 5150, inner: 100, outer: 2100, thickness: 560, shapes: 6, band: 1300, bandW: 180, bandShare: 0.55, voids: 3, voidR: 300, tints: mix(OCHRE, GREY), bigChance: 0.08, big: [18, 30], small: [2, 10] },
  },
  {
    id: "netu",
    name: "NETU",
    faction: "lucian",
    blurb: "A lava moon under an ember sky. The heavies hold the lane out.",
    sky: "ember",
    planet: "lava",
    planetPos: [2200, -1200, 3600],
    sunDir: [0.5, -0.2, -0.85],
    arena: 1800,
    belt: { count: 1700, seed: 6660, inner: 60, outer: 1700, thickness: 400, shapes: 6, clusters: 5, clusterR: 320, clusterShare: 0.5, voids: 2, voidR: 280, tints: mix(CHAR, PLUM), bigChance: 0.16, big: [24, 50], small: [3, 14] },
  },
  {
    id: "kheb",
    name: "KHEB",
    faction: "serpent",
    blurb: "A dead grey moon and a field of ice. The shards are long and the gaps are narrow.",
    sky: "frost",
    planet: "moon",
    planetPos: [-1600, 1500, 4300],
    sunDir: [0.3, 0.75, 0.55],
    belt: { count: 2300, seed: 9090, inner: 60, outer: 1350, thickness: 240, shapes: 6, style: "ice", band: 820, bandW: 200, bandShare: 0.4, clusters: 3, clusterR: 260, clusterShare: 0.2 },
  },
  {
    id: "graveyard",
    name: "THE GRAVEYARD",
    faction: "serpent",
    blurb: "Where the last fleet died. Hull plate and engine blocks tumbling under a ringed giant.",
    sky: "deepSpace",
    planet: "gasGiant",
    planetPos: [3400, 2400, 5800],
    sunDir: [-0.4, 0.5, -0.75],
    arena: 1700,
    belt: { count: 950, seed: 4040, inner: 80, outer: 1600, thickness: 380, shapes: 4, style: "wreck", clusters: 6, clusterR: 240, clusterShare: 0.7, voids: 2, voidR: 260 },
  },
];

export function parseSystem(v: string | null | undefined): SystemDef {
  return SYSTEMS.find((s) => s.id === v) ?? SYSTEMS[0]!;
}
