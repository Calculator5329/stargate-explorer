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
  /** engine-shaped bodies with no plume (booster pods, tanks) */
  pods?: EngineDef[];
  hatches: HatchDef[];
  decals: DecalDef[];
  palette: ShipPalette;
}

/**
 * Player fighter, ~17 m long, ~14 m span, modelled on the show's twin-engine
 * space-superiority fighter: long flat wedge nose, tandem canopy far forward,
 * wide flat body, anhedral swept wings, two intake-fed engines on top of the
 * aft fuselage with outward-canted fins on them, booster pods under the wings.
 */
export const F11_HALBERD: ShipDef = {
  name: "F-11 Halberd",
  ringVerts: 16,
  hull: [
    { z: 9.2, w: 0.14, h: 0.06, n: 2.2 },
    { z: 7.6, w: 0.55, h: 0.22, n: 2.6 },
    { z: 5.8, w: 1.0, h: 0.42, n: 3.0 },
    { z: 3.8, w: 1.5, h: 0.6, n: 3.4, yOff: 0.02 },
    { z: 1.5, w: 2.1, h: 0.72, n: 3.8 },
    { z: -1.0, w: 2.5, h: 0.78, n: 4.0 },
    { z: -3.5, w: 2.5, h: 0.75, n: 4.0 },
    { z: -6.0, w: 2.0, h: 0.62, n: 3.4 },
    { z: -7.6, w: 1.4, h: 0.45, n: 3.0 },
  ],
  panels: [
    { ring: 5, seg: 3, mirror: true },
    { ring: 4, seg: 3, mirror: true },
    { ring: 6, seg: 3, mirror: true },
    { ring: 2, seg: 1, mirror: true },
    { ring: 3, seg: 14, mirror: true },
    { ring: 5, seg: 13, mirror: true },
  ],
  stripes: [{ seg: 0, ringFrom: 1, ringTo: 6, mirror: true }],
  canopy: {
    sections: [
      { z: 6.7, w: 0.26, h: 0.1, n: 2.4, yOff: 0.34 },
      { z: 5.7, w: 0.5, h: 0.42, n: 2.4, yOff: 0.4 },
      { z: 4.5, w: 0.6, h: 0.5, n: 2.6, yOff: 0.48 },
      { z: 3.5, w: 0.56, h: 0.34, n: 2.6, yOff: 0.62 },
    ],
    frameBands: [1, 2],
  },
  wings: [
    { root: [2.3, -0.1, -0.8], span: 4.6, rootChord: 5.6, tipChord: 1.5, sweep: 3.4, dihedral: -0.06, thickness: 0.2 },
    // nose chines: thin strakes blending the wedge nose into the wing roots
    { root: [0.5, 0.0, 4.6], span: 1.1, rootChord: 6.4, tipChord: 2.2, sweep: 4.0, dihedral: 0, thickness: 0.08 },
  ],
  fins: [
    { root: [1.45, 1.3, -5.2], height: 1.7, rootChord: 2.0, tipChord: 0.7, sweep: 1.1, angle: Math.PI / 2 - 0.35, thickness: 0.1 },
    { root: [-1.45, 1.3, -5.2], height: 1.7, rootChord: 2.0, tipChord: 0.7, sweep: 1.1, angle: Math.PI / 2 + 0.35, thickness: 0.1 },
  ],
  engines: [
    { pos: [0.95, 0.85, -4.4], radius: 0.62, length: 4.6, intake: true },
    { pos: [-0.95, 0.85, -4.4], radius: 0.62, length: 4.6, intake: true },
  ],
  pods: [
    { pos: [3.1, -0.5, -1.4], radius: 0.38, length: 3.8 },
    { pos: [-3.1, -0.5, -1.4], radius: 0.38, length: 3.8 },
  ],
  hatches: [{ pos: [0, 0.78, -1.6], size: [1.0, 1.6], face: "top" }],
  decals: [
    { kind: "number", text: "11", pos: [0.86, 0.1, 6.5], rot: [0, Math.PI / 2, 0], size: [0.8, 0.4], mirror: true },
    { kind: "stripe", pos: [4.4, 0.06, -2.6], rot: [-Math.PI / 2, 0, 0], size: [1.6, 0.5], mirror: true, slot: "dark" },
  ],
  palette: PALETTES.tauri,
};
