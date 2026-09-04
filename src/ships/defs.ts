/**
 * Data-driven ship definitions consumed by `ships/builder.ts`.
 * Ship-local axes: +Z forward, +Y up, +X right. Metres.
 * Designs are original; franchise names never enter here (see DECISIONS.md).
 */

/** One hull cross-section. `n` is the superellipse exponent: 2 = ellipse, higher = boxier. */
export interface HullSection {
  z: number;
  w: number;
  h: number;
  n: number;
  yOff?: number;
}

/** A tapered slab spanning +X from `root`; mirrored automatically. Dihedral rotates about the root. */
export interface WingDef {
  root: [number, number, number];
  span: number;
  rootChord: number;
  tipChord: number;
  /** how far back (−Z) the tip sits relative to the root leading edge */
  sweep: number;
  dihedral: number;
  thickness: number;
}

/** Same slab as a wing, but `angle` sets its direction in the XY plane (π/2 = straight up). Not mirrored. */
export interface FinDef {
  root: [number, number, number];
  height: number;
  rootChord: number;
  tipChord: number;
  sweep: number;
  angle: number;
  thickness: number;
}

export interface EngineDef {
  pos: [number, number, number];
  radius: number;
  length: number;
}

export interface ShipPalette {
  body: number;
  accent: number;
  dark: number;
  glow: number;
}

export interface ShipDef {
  name: string;
  ringVerts: number;
  hull: HullSection[];
  wings: WingDef[];
  fins: FinDef[];
  engines: EngineDef[];
  palette: ShipPalette;
}

/** Tau'ri-flavoured strike fighter. ~14 m long. */
export const F11_HALBERD: ShipDef = {
  name: "F-11 Halberd",
  ringVerts: 16,
  hull: [
    { z: 8.0, w: 0.15, h: 0.15, n: 2.0 },
    { z: 6.0, w: 0.5, h: 0.5, n: 2.2 },
    { z: 3.0, w: 1.1, h: 1.0, n: 2.6 },
    { z: 0.5, w: 1.4, h: 1.3, n: 3.0, yOff: 0.1 },
    { z: -2.0, w: 1.5, h: 1.2, n: 3.2 },
    { z: -4.5, w: 1.2, h: 1.0, n: 3.0 },
    { z: -6.0, w: 0.7, h: 0.7, n: 2.4 },
  ],
  wings: [{ root: [1.1, -0.15, -1.0], span: 5.5, rootChord: 4.2, tipChord: 1.4, sweep: 2.6, dihedral: 0.06, thickness: 0.18 }],
  fins: [
    { root: [0, 0.9, -4.0], height: 1.9, rootChord: 2.4, tipChord: 0.8, sweep: 1.3, angle: Math.PI / 2, thickness: 0.12 },
    { root: [0.5, -0.7, -4.2], height: 1.1, rootChord: 1.6, tipChord: 0.6, sweep: 0.8, angle: -Math.PI / 2 - 0.55, thickness: 0.1 },
    { root: [-0.5, -0.7, -4.2], height: 1.1, rootChord: 1.6, tipChord: 0.6, sweep: 0.8, angle: -Math.PI / 2 + 0.55, thickness: 0.1 },
  ],
  engines: [
    { pos: [1.05, -0.05, -4.6], radius: 0.45, length: 3.0 },
    { pos: [-1.05, -0.05, -4.6], radius: 0.45, length: 3.0 },
  ],
  palette: { body: 0xcfc7b4, accent: 0xc9a33a, dark: 0x2b2e33, glow: 0x5ff0ff },
};
