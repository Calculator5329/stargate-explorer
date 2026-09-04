import type { SkyName } from "@/world/skybox";

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
  belt: { count: number; seed: number; inner: number; outer: number; thickness: number; shapes: number };
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
    belt: { count: 900, seed: 1337, inner: 60, outer: 1400, thickness: 420, shapes: 6 },
  },
  {
    id: "chulak",
    name: "CHULAK",
    blurb: "Green sky, a jungle world, a flat wide belt the gliders stage from.",
    sky: "chulak",
    planet: "jungle",
    planetPos: [2400, 500, -3600],
    sunDir: [-0.55, 0.4, 0.55],
    belt: { count: 1000, seed: 2024, inner: 60, outer: 1450, thickness: 260, shapes: 6 },
  },
  {
    id: "p3x774",
    name: "P3X-774",
    blurb: "Deep space over an ice world. Sparse rock, long sight lines, nowhere to hide.",
    sky: "deepSpace",
    planet: "ice",
    planetPos: [400, -2400, -4200],
    sunDir: [0.2, 0.6, 0.75],
    belt: { count: 520, seed: 7741, inner: 80, outer: 1400, thickness: 600, shapes: 6 },
  },
];

export function parseSystem(v: string | null | undefined): SystemDef {
  return SYSTEMS.find((s) => s.id === v) ?? SYSTEMS[0]!;
}
