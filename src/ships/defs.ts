/**
 * Data-driven ship definitions consumed by `ships/builder.ts`.
 * Ship-local axes: +Z forward, +Y up, +X port (left). Metres.
 * Designs are original; franchise names never enter here (see DECISIONS.md).
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
  hatches: HatchDef[];
  decals: DecalDef[];
  palette: ShipPalette;
}

/**
 * Tau'ri-flavoured strike fighter, ~16 m long, ~12 m span. Original design in
 * the spirit of a wedge-nosed twin-engine interceptor: forward canopy, boxy
 * mid-body, swept mid wings, canted twin tails, half-embedded nacelles.
 */
export const F11_HALBERD: ShipDef = {
  name: "F-11 Halberd",
  ringVerts: 16,
  hull: [
    { z: 8.5, w: 0.12, h: 0.1, n: 2.0 },
    { z: 7.0, w: 0.45, h: 0.32, n: 2.2 },
    { z: 5.0, w: 1.0, h: 0.6, n: 2.6 },
    { z: 3.0, w: 1.5, h: 0.85, n: 3.0, yOff: 0.05 },
    { z: 0.5, w: 1.8, h: 1.0, n: 3.4, yOff: 0.05 },
    { z: -2.0, w: 1.9, h: 1.0, n: 3.4 },
    { z: -4.5, w: 1.6, h: 0.9, n: 3.0 },
    { z: -6.5, w: 1.0, h: 0.7, n: 2.6 },
    { z: -7.2, w: 0.8, h: 0.55, n: 2.4 },
  ],
  panels: [
    { ring: 3, seg: 1, mirror: true },
    { ring: 4, seg: 1, mirror: true },
    { ring: 2, seg: 3, mirror: true },
    { ring: 3, seg: 14, mirror: true },
    { ring: 4, seg: 13, mirror: true },
  ],
  stripes: [{ seg: 2, ringFrom: 2, ringTo: 5, mirror: true }],
  canopy: {
    sections: [
      { z: 4.6, w: 0.3, h: 0.18, n: 2.4, yOff: 0.62 },
      { z: 3.6, w: 0.55, h: 0.45, n: 2.4, yOff: 0.68 },
      { z: 2.2, w: 0.68, h: 0.55, n: 2.6, yOff: 0.72 },
      { z: 0.9, w: 0.62, h: 0.42, n: 2.6, yOff: 0.85 },
    ],
    frameBands: [1, 2],
  },
  wings: [{ root: [1.7, -0.1, -0.5], span: 5.2, rootChord: 4.5, tipChord: 1.3, sweep: 3.3, dihedral: 0.04, thickness: 0.24 }],
  fins: [
    { root: [0.95, 0.75, -4.6], height: 1.9, rootChord: 2.2, tipChord: 0.7, sweep: 1.2, angle: Math.PI / 2 - 0.32, thickness: 0.12 },
    { root: [-0.95, 0.75, -4.6], height: 1.9, rootChord: 2.2, tipChord: 0.7, sweep: 1.2, angle: Math.PI / 2 + 0.32, thickness: 0.12 },
    { root: [0.7, -0.75, -4.6], height: 1.0, rootChord: 1.5, tipChord: 0.5, sweep: 0.7, angle: -Math.PI / 2 + 0.5, thickness: 0.1 },
    { root: [-0.7, -0.75, -4.6], height: 1.0, rootChord: 1.5, tipChord: 0.5, sweep: 0.7, angle: -Math.PI / 2 - 0.5, thickness: 0.1 },
  ],
  engines: [
    { pos: [1.35, -0.15, -4.6], radius: 0.55, length: 3.6 },
    { pos: [-1.35, -0.15, -4.6], radius: 0.55, length: 3.6 },
  ],
  hatches: [
    { pos: [0, 1.0, -3.2], size: [0.9, 1.3], face: "top" },
    { pos: [1.9, 0.05, -1.2], size: [0.7, 1.0], face: "port", mirror: true },
  ],
  decals: [
    { kind: "chevron", pos: [4.2, 0.1, -1.6], rot: [-Math.PI / 2, 0, 0.04], size: [1.1, 1.1], mirror: true },
    { kind: "number", text: "11", pos: [1.27, 0.25, 4.0], rot: [0, Math.PI / 2, 0], size: [0.9, 0.5], mirror: true },
  ],
  palette: PALETTES.tauri,
};
