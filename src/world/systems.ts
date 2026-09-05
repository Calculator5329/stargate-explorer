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
  /** who flies against you here: recolours every enemy hull (PALETTES); omitted = each hull's own default */
  faction?: FactionName;
}

export const SYSTEMS: SystemDef[] = [
  {
    id: "abydos",
    name: "ABYDOS",
    blurb: "The home belt. Orange sand below, the thickest rock in the sector.",
    sky: "abydos",
    planet: "desert",
    planetPos: [-2600, -900, 3800],
    sunDir: [0.6, 0.35, -0.7],
    belt: { count: 1900, seed: 1337, inner: 60, outer: 1400, thickness: 420, shapes: 6, clusters: 5, clusterR: 280, clusterShare: 0.5 },
  },
  {
    id: "chulak",
    name: "CHULAK",
    blurb: "Green sky, a jungle world, a flat wide belt the gliders stage from.",
    sky: "chulak",
    planet: "jungle",
    planetPos: [2400, 500, -3600],
    sunDir: [-0.55, 0.4, 0.55],
    belt: { count: 2100, seed: 2024, inner: 60, outer: 1450, thickness: 260, shapes: 6, band: 720, bandW: 130, bandShare: 0.45, clusters: 3, clusterR: 240, clusterShare: 0.2 },
  },
  {
    id: "p3x774",
    name: "P3X-774",
    blurb: "Deep space over an ice world. Sparse rock, long sight lines, nowhere to hide.",
    sky: "deepSpace",
    planet: "ice",
    planetPos: [400, -2400, -4200],
    sunDir: [0.2, 0.6, 0.75],
    belt: { count: 1200, seed: 7741, inner: 80, outer: 1400, thickness: 600, shapes: 6, clusters: 7, clusterR: 220, clusterShare: 0.6 },
  },
  {
    id: "tollana",
    name: "TOLLANA",
    blurb: "A ringed giant and a thin belt of dust. The racers' circuit.",
    sky: "void",
    planet: "gasGiant",
    planetPos: [-1800, -1600, 4600],
    sunDir: [-0.7, 0.3, -0.6],
    belt: { count: 1000, seed: 5150, inner: 100, outer: 1450, thickness: 520, shapes: 6, band: 900, bandW: 160, bandShare: 0.5 },
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
    belt: { count: 1600, seed: 6660, inner: 60, outer: 1400, thickness: 380, shapes: 6, clusters: 4, clusterR: 320, clusterShare: 0.5 },
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
    belt: { count: 900, seed: 4040, inner: 80, outer: 1300, thickness: 360, shapes: 4, style: "wreck", clusters: 5, clusterR: 230, clusterShare: 0.7 },
  },
];

export function parseSystem(v: string | null | undefined): SystemDef {
  return SYSTEMS.find((s) => s.id === v) ?? SYSTEMS[0]!;
}
