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
 * Player fighter, ~15.7 m long, ~13.7 m span, modelled on the show's twin-engine
 * space-superiority fighter. The body is a broad flat wedge: a deep flat-decked
 * fuselage that reads as an arrow from above and a shallow slab from the side,
 * with a short slender nose that droops at the tip and a tandem two-seat canopy
 * sitting far forward on the deck, its two frame bands splitting the seats.
 * The defining feature is the pair of rectangular intake boxes on the sides at
 * the wing roots, mouths open at z = +2.1, running aft to feed the round jet
 * exhausts behind them. Cropped-delta wings (45 deg leading edge, dead straight
 * trailing edge, slight anhedral) carry wingtip missile rails. The tail is
 * deliberately chunky: two large round rocket bells low and central, the two jet
 * nozzles outboard of them, and two vertical tails canted 24 deg outward off the
 * aft deck. Markings are minimal, as the show's are: recessed panel breaks, a
 * small nose number and one dark stripe per wing.
 */
export const F11_HALBERD: ShipDef = {
  name: "F-11 Halberd",
  ringVerts: 16,
  hull: [
    { z: 7.0, w: 0.34, h: 0.2, n: 2.4, yOff: -0.44 },
    { z: 6.1, w: 0.82, h: 0.42, n: 3.2, yOff: -0.34 },
    { z: 5.1, w: 1.28, h: 0.6, n: 3.8, yOff: -0.2 },
    { z: 3.9, w: 1.68, h: 0.72, n: 4.2, yOff: -0.16 },
    { z: 2.2, w: 1.98, h: 0.78, n: 4.4, yOff: -0.18 },
    { z: 0.4, w: 2.2, h: 0.82, n: 4.6, yOff: -0.2 },
    { z: -1.8, w: 2.25, h: 0.84, n: 4.6, yOff: -0.22 },
    { z: -4.2, w: 2.1, h: 0.8, n: 4.2, yOff: -0.22 },
    { z: -6.4, w: 1.72, h: 0.68, n: 3.8, yOff: -0.2 },
    { z: -8.0, w: 1.32, h: 0.54, n: 3.4, yOff: -0.16 },
  ],
  // panel breaks only: the show's airframe is one flat grey with recessed plates
  panels: [
    { ring: 5, seg: 3, mirror: true },
    { ring: 4, seg: 3, mirror: true },
    { ring: 3, seg: 2, mirror: true },
    { ring: 6, seg: 1, mirror: true },
    { ring: 2, seg: 11, mirror: true },
    { ring: 3, seg: 12, mirror: true },
  ],
  stripes: [],
  canopy: {
    sections: [
      { z: 5.9, w: 0.38, h: 0.18, n: 2.4, yOff: 0.14 },
      { z: 5.0, w: 0.7, h: 0.44, n: 2.6, yOff: 0.3 },
      { z: 3.9, w: 0.84, h: 0.56, n: 2.8, yOff: 0.4 },
      { z: 2.7, w: 0.78, h: 0.48, n: 2.8, yOff: 0.44 },
      { z: 1.7, w: 0.56, h: 0.28, n: 2.8, yOff: 0.48 },
    ],
    frameBands: [1, 3],
  },
  wings: [
    // cropped delta: 45 deg leading edge, trailing edge dead straight across the span
    { root: [1.9, -0.35, -0.8], span: 4.8, rootChord: 7.2, tipChord: 2.2, sweep: 5.0, dihedral: -0.09, thickness: 0.2 },
    // nose chines: thin strakes carrying the wedge nose back into the intake mouths
    { root: [0.5, -0.04, 3.9], span: 1.8, rootChord: 4.6, tipChord: 2.2, sweep: 2.4, dihedral: -0.05, thickness: 0.1 },
  ],
  fins: [
    { root: [1.55, 0.42, -4.3], height: 2.4, rootChord: 3.2, tipChord: 1.1, sweep: 2.2, angle: Math.PI / 2 - 0.42, thickness: 0.12 },
    { root: [-1.55, 0.42, -4.3], height: 2.4, rootChord: 3.2, tipChord: 1.1, sweep: 2.2, angle: Math.PI / 2 + 0.42, thickness: 0.12 },
  ],
  engines: [
    // jet exhausts, emerging from behind the intake boxes
    { pos: [2.15, -0.1, -5.6], radius: 0.5, length: 2.4 },
    { pos: [-2.15, -0.1, -5.6], radius: 0.5, length: 2.4 },
    // rocket bells, big and round, low and central between them
    { pos: [0.85, -0.18, -6.5], radius: 0.72, length: 2.2 },
    { pos: [-0.85, -0.18, -6.5], radius: 0.72, length: 2.2 },
  ],
  pods: [
    // the defining feature: boxy intake ducts on the sides at the wing roots,
    // mouths open at z = +2.1, running aft to feed the jet exhausts
    { pos: [2.35, -0.05, -1.2], radius: 0.75, length: 6.6, intake: true, aspect: [0.95, 1.0], boxiness: 5.5, segments: 16 },
    { pos: [-2.35, -0.05, -1.2], radius: 0.75, length: 6.6, intake: true, aspect: [0.95, 1.0], boxiness: 5.5, segments: 16 },
    // wingtip missile rails
    { pos: [6.7, -0.78, -2.7], radius: 0.16, length: 3.4 },
    { pos: [-6.7, -0.78, -2.7], radius: 0.16, length: 3.4 },
  ],
  hatches: [{ pos: [0, 0.6, -1.4], size: [0.9, 1.4], face: "top" }],
  decals: [
    { kind: "number", text: "11", pos: [0.8, -0.26, 5.4], rot: [0, Math.PI / 2, 0], size: [0.55, 0.28], mirror: true },
    { kind: "stripe", pos: [4.0, -0.44, -2.4], rot: [-Math.PI / 2, 0, 0], size: [1.2, 0.35], mirror: true, slot: "dark" },
  ],
  palette: PALETTES.tauri,
};
