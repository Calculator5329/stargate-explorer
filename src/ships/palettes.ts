import type { ShipPalette } from "@/ships/defs";

/**
 * Faction palettes. Slots: body (hull), accent (stripes, leading edges, tips),
 * dark (underside, nozzles, frames), glow (engine glow + plume), canopy (glass).
 * Faction slugs are placeholder franchise terms (DECISIONS.md).
 */
export const PALETTES = {
  /** Gunmetal like the show's fighters (Ethan 2026-09-03), darker chines, blue plumes. */
  tauri: { body: 0x9a9fa6, accent: 0x5b6069, dark: 0x2b2e33, glow: 0x6fb6ff, canopy: 0x16283a },
  /** The 2026-09-03 M1 look: cream hull, red stripes. Kept for `?palette=cream`. */
  cream: { body: 0xe9e3d4, accent: 0xc9362c, dark: 0x2a2d33, glow: 0x4fa3ff, canopy: 0x143a4c },
  /** Enemy: bronze/gold hull, amber glow. */
  goauld: { body: 0x8a7346, accent: 0xd4a83b, dark: 0x2f2a22, glow: 0xffb347, canopy: 0x3a2a12 },
  /** Enemy faction 2 (Netu, the blockade): oxblood hull, black trim, hot red glow. */
  lucian: { body: 0x4a2a2e, accent: 0xb8342a, dark: 0x1a1214, glow: 0xff5a3c, canopy: 0x2a1214 },
  /** Enemy faction 3 (Kheb, the Graveyard): cold steel, verdigris trim, teal glow. */
  serpent: { body: 0x3b4a4f, accent: 0x7fd6c9, dark: 0x161e20, glow: 0x5cf0d8, canopy: 0x102a2a },
} satisfies Record<string, ShipPalette>;

export type FactionName = keyof typeof PALETTES;
