/**
 * Data-driven ship definitions consumed by `ships/builder.ts`.
 * Ship-local axes: +Z forward, +Y up, +X port (left). Metres.
 * The player fighter follows the show's F-302 closely by Ethan's 2026-09-03 call
 * (DECISIONS.md); franchise names still stay out of identifiers.
 */
import { PALETTES } from "@/ships/palettes";

export type Vec3 = [number, number, number];
export type PaletteSlot = "body" | "accent" | "dark" | "glow" | "canopy";

export interface ShipPalette {
  body: number;
  accent: number;
  dark: number;
  glow: number;
  canopy: number;
}

/** One cross-section. `n` is the superellipse exponent: 2 = ellipse, higher = boxier. */
export interface HullSection {
  z: number;
  w: number;
  h: number;
  n: number;
  yOff?: number;
}

/**
 * Airfoil-section wing spanning +X from `root`; mirrored to −X unless `mirror: false`.
 * Dihedral rotates about the root. Leading-edge faces and the tip cap take the accent slot.
 */
export interface AirfoilDef {
  root: Vec3;
  span: number;
  rootChord: number;
  tipChord: number;
  /** how far back (−Z) the tip leading edge sits relative to the root leading edge */
  sweep: number;
  dihedral: number;
  thickness: number;
  mirror?: boolean;
}

/** Same airfoil as a fin; `angle` is its direction in the XY plane (π/2 = straight up). Not mirrored. */
export interface FinDef {
  root: Vec3;
  height: number;
  rootChord: number;
  tipChord: number;
  sweep: number;
  angle: number;
  thickness: number;
}

export interface EngineDef {
  pos: Vec3;
  radius: number;
  length: number;
  /** open dark intake at the front instead of a pointed cap */
  intake?: boolean;
  /** cross-section width/height multipliers on `radius`; default [1, 1] (square) */
  aspect?: [number, number];
  /** superellipse exponent of the body sections: 2 = round, 5+ = a rounded-corner box */
  boxiness?: number;
  /** ring vertex count; 12 by default, raise it so a boxy section keeps crisp corners */
  segments?: number;
}

/**
 * Recessed hull panel at loft cell (ring, seg). Rings index the hull sections
 * sorted tail→nose (0 = tail); segs run counter-clockwise seen from the nose,
 * starting at +X (port): seg 0 = port beam, 4 = top, 8 = starboard, 12 = belly for 16 verts.
 */
export interface PanelDef {
  ring: number;
  seg: number;
  depth?: number;
  mirror?: boolean;
}

/** Accent-coloured run of loft cells along one segment column. */
export interface StripeDef {
  seg: number;
  ringFrom: number;
  ringTo: number;
  mirror?: boolean;
}

export interface CanopyDef {
  sections: HullSection[];
  /** indices into `sections` that get a dark frame band */
  frameBands: number[];
}

export interface HatchDef {
  pos: Vec3;
  /** width (across) × length (along z) */
  size: [number, number];
  face: "top" | "bottom" | "port" | "starboard";
  mirror?: boolean;
}

/** Convex armor footprint in local XZ, extruded upward from y. */
export interface ArmorDef {
  points: [number, number][];
  y: number;
  thickness: number;
  slot: PaletteSlot;
  mirror?: boolean;
}

export interface DecalDef {
  kind: "chevron" | "number" | "stripe";
  text?: string;
  pos: Vec3;
  /** euler XYZ; a plane faces +Z with +Y up before rotation */
  rot: Vec3;
  size: [number, number];
  mirror?: boolean;
  slot?: PaletteSlot;
}

export interface ShipDef {
  name: string;
  ringVerts: number;
  hull: HullSection[];
  panels: PanelDef[];
  stripes: StripeDef[];
  canopy?: CanopyDef;
  wings: AirfoilDef[];
  fins: FinDef[];
  engines: EngineDef[];
  /** plume length multiplier for hulls far bigger than the fighter (T.plume lengths are fighter metres) */
  plumeScale?: number;
  /** engine-shaped bodies with no plume (booster pods, tanks) */
  pods?: EngineDef[];
  armor?: ArmorDef[];
  hatches: HatchDef[];
  decals: DecalDef[];
  palette: ShipPalette;
}

/**
 * Player fighter, ~16 m long, ~14 m span, modelled on the show's fighter from
 * Ethan's two reference images (2026-09-04, pass 3). What those show: a slender,
 * faceted fuselage with a long pointed nose and a low tandem canopy well forward;
 * one enormous thin delta wing whose leading edge runs from beside the canopy
 * almost to the tail and whose trailing edge is dead straight; two round engine
 * nacelles with open circular intakes riding above the wing on either side of
 * the aft body, exhausts flush with the trailing edge; small vertical plates at
 * the wingtips; no big tail fins. One flat grey with recessed panel breaks.
 */
export const F11_HALBERD: ShipDef = {
  name: "F-11 Halberd",
  ringVerts: 16,
  hull: [
    { z: 8.2, w: 0.18, h: 0.14, n: 2.6, yOff: -0.1 },
    { z: 7.0, w: 0.5, h: 0.36, n: 3.0, yOff: -0.06 },
    { z: 5.6, w: 0.86, h: 0.6, n: 3.2, yOff: 0 },
    { z: 3.8, w: 1.1, h: 0.78, n: 3.4 },
    { z: 1.4, w: 1.28, h: 0.9, n: 3.6 },
    { z: -1.4, w: 1.36, h: 0.96, n: 3.6 },
    { z: -4.2, w: 1.32, h: 0.92, n: 3.4 },
    { z: -6.2, w: 1.16, h: 0.78, n: 3.2 },
    { z: -7.6, w: 0.92, h: 0.6, n: 3.0 },
  ],
  // panel breaks only: the show's airframe is one flat grey with recessed plates
  panels: [
    { ring: 5, seg: 3, mirror: true },
    { ring: 4, seg: 4 },
    { ring: 3, seg: 2, mirror: true },
    { ring: 6, seg: 1, mirror: true },
    { ring: 2, seg: 12 },
    { ring: 4, seg: 12 },
  ],
  stripes: [],
  canopy: {
    sections: [
      { z: 5.8, w: 0.3, h: 0.14, n: 2.4, yOff: 0.5 },
      { z: 5.0, w: 0.56, h: 0.4, n: 2.6, yOff: 0.62 },
      { z: 4.0, w: 0.66, h: 0.5, n: 2.8, yOff: 0.72 },
      { z: 2.9, w: 0.62, h: 0.44, n: 2.8, yOff: 0.78 },
      { z: 1.9, w: 0.46, h: 0.24, n: 2.8, yOff: 0.86 },
    ],
    frameBands: [1, 3],
  },
  wings: [
    // the delta (root z is the chord centre): leading edge z 3 → -5.5, trailing edge dead straight at z = -7
    { root: [1.0, -0.2, -2.0], span: 6.1, rootChord: 10.0, tipChord: 1.5, sweep: 8.5, dihedral: 0.0, thickness: 0.16 },
  ],
  fins: [
    // wingtip plates, slightly canted outward
    { root: [7.05, -0.2, -6.35], height: 0.95, rootChord: 1.5, tipChord: 0.7, sweep: 0.6, angle: Math.PI / 2 - 0.25, thickness: 0.08 },
    { root: [-7.05, -0.2, -6.35], height: 0.95, rootChord: 1.5, tipChord: 0.7, sweep: 0.6, angle: Math.PI / 2 + 0.25, thickness: 0.08 },
  ],
  engines: [
    // round nacelles above the wing either side of the aft body; open circular intakes; exhausts at the trailing edge
    { pos: [1.95, 0.42, -3.9], radius: 0.74, length: 6.2, intake: true },
    { pos: [-1.95, 0.42, -3.9], radius: 0.74, length: 6.2, intake: true },
  ],
  hatches: [{ pos: [0, 0.9, -2.2], size: [0.8, 1.3], face: "top" }],
  decals: [
    { kind: "number", text: "11", pos: [0.72, 0.05, 6.0], rot: [0, Math.PI / 2, 0], size: [0.5, 0.26], mirror: true },
    { kind: "stripe", pos: [4.2, -0.3, -4.6], rot: [-Math.PI / 2, 0, 0], size: [1.4, 0.3], mirror: true, slot: "dark" },
  ],
  palette: PALETTES.tauri,
};
