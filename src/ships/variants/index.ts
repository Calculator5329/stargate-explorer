/**
 * Alternative looks for the player fighter, each a deliberate direction, all
 * expressed with the existing builder vocabulary (no builder changes). Loaded
 * with `?variant=a|b|c`; the default def is untouched. Captures and the pick
 * gallery live in docs/shots/variants and docs/design/ship-variants.html.
 * Ship-local axes: +Z forward, +Y up, +X port. Metres.
 */
import type { ShipDef } from "@/ships/defs";
import { F11_HALBERD } from "@/ships/defs";
import { PALETTES } from "@/ships/palettes";

const UP = Math.PI / 2;

/**
 * A — "Facet": the sharper F-302 read. Boxier hull sections (n 4–5) so the
 * fuselage carries hard chines instead of a rounded loft; darker chine stripes
 * along the shoulder; recessed panels on the flanks and the belly; a lower,
 * longer tandem canopy with three frame bands; open gun ports half-buried in
 * the cheeks; boxy intake nacelles with crisp corners; small canted tails on the
 * nacelles plus the wingtip plates. Same gunmetal paint.
 */
const FACET: ShipDef = {
  name: "F-11 Halberd (facet)",
  ringVerts: 16,
  hull: [
    { z: 8.6, w: 0.16, h: 0.12, n: 3.0, yOff: -0.12 },
    { z: 7.2, w: 0.46, h: 0.32, n: 3.6, yOff: -0.08 },
    { z: 5.8, w: 0.84, h: 0.56, n: 4.2, yOff: -0.02 },
    { z: 4.2, w: 1.08, h: 0.74, n: 4.6 },
    { z: 2.4, w: 1.24, h: 0.84, n: 4.8 },
    { z: 0.2, w: 1.34, h: 0.9, n: 5.0 },
    { z: -2.6, w: 1.36, h: 0.92, n: 5.0 },
    { z: -4.8, w: 1.3, h: 0.86, n: 4.6 },
    { z: -6.4, w: 1.12, h: 0.72, n: 4.2 },
    { z: -7.8, w: 0.86, h: 0.54, n: 3.8 },
  ],
  // rings 0 = tail … 9 = nose tip; seg 0 port beam, 4 top, 12 belly
  panels: [
    { ring: 1, seg: 0, mirror: true, depth: 0.08 },
    { ring: 3, seg: 0, mirror: true, depth: 0.08 },
    { ring: 5, seg: 0, mirror: true, depth: 0.08 },
    { ring: 4, seg: 1, mirror: true },
    { ring: 6, seg: 1, mirror: true },
    { ring: 2, seg: 3, mirror: true },
    { ring: 3, seg: 3, mirror: true },
    { ring: 1, seg: 11, mirror: true, depth: 0.08 },
    { ring: 2, seg: 11, mirror: true, depth: 0.08 },
    { ring: 5, seg: 11, mirror: true, depth: 0.08 },
    { ring: 6, seg: 11, mirror: true, depth: 0.08 },
  ],
  // darker chine line along the shoulder (accent is the dark gray in this palette)
  stripes: [{ seg: 1, ringFrom: 2, ringTo: 8, mirror: true }],
  canopy: {
    sections: [
      { z: 6.1, w: 0.26, h: 0.1, n: 3.0, yOff: 0.46 },
      { z: 5.3, w: 0.5, h: 0.34, n: 3.2, yOff: 0.56 },
      { z: 4.3, w: 0.6, h: 0.44, n: 3.4, yOff: 0.66 },
      { z: 3.2, w: 0.58, h: 0.4, n: 3.4, yOff: 0.74 },
      { z: 2.2, w: 0.44, h: 0.2, n: 3.4, yOff: 0.84 },
    ],
    frameBands: [1, 2, 3],
  },
  wings: [{ root: [1.05, -0.2, -2.0], span: 6.05, rootChord: 10.0, tipChord: 1.5, sweep: 8.5, dihedral: 0.0, thickness: 0.14 }],
  fins: [
    { root: [7.05, -0.2, -6.35], height: 0.95, rootChord: 1.5, tipChord: 0.7, sweep: 0.6, angle: UP - 0.25, thickness: 0.08 },
    { root: [-7.05, -0.2, -6.35], height: 0.95, rootChord: 1.5, tipChord: 0.7, sweep: 0.6, angle: UP + 0.25, thickness: 0.08 },
    { root: [1.95, 1.1, -6.0], height: 1.3, rootChord: 1.8, tipChord: 0.8, sweep: 0.8, angle: UP - 0.35, thickness: 0.08 },
    { root: [-1.95, 1.1, -6.0], height: 1.3, rootChord: 1.8, tipChord: 0.8, sweep: 0.8, angle: UP + 0.35, thickness: 0.08 },
  ],
  engines: [
    { pos: [1.95, 0.42, -3.9], radius: 0.72, length: 6.4, intake: true, aspect: [1.05, 0.92], boxiness: 4.5, segments: 16 },
    { pos: [-1.95, 0.42, -3.9], radius: 0.72, length: 6.4, intake: true, aspect: [1.05, 0.92], boxiness: 4.5, segments: 16 },
  ],
  // gun ports: open-mouthed barrels half-buried in the cheeks
  pods: [
    { pos: [0.62, -0.16, 6.4], radius: 0.11, length: 2.2, intake: true, segments: 8 },
    { pos: [-0.62, -0.16, 6.4], radius: 0.11, length: 2.2, intake: true, segments: 8 },
  ],
  hatches: [
    { pos: [0, 0.9, -1.0], size: [0.7, 1.2], face: "top" },
    { pos: [0, -0.88, 1.0], size: [0.9, 2.0], face: "bottom" },
    { pos: [0.55, -0.84, -3.5], size: [0.5, 1.4], face: "bottom", mirror: true },
  ],
  decals: [
    { kind: "number", text: "11", pos: [0.7, 0.02, 6.2], rot: [0, UP, 0], size: [0.5, 0.26], mirror: true },
    { kind: "stripe", pos: [4.2, -0.11, -4.6], rot: [-UP, 0, 0], size: [1.4, 0.3], mirror: true, slot: "dark" },
  ],
  palette: PALETTES.tauri,
};

/**
 * B — "Brawler": the chunky toon-hero read from the first reference frame.
 * Fat short fuselage, big round intake nacelles snug against the flanks, a
 * bubble canopy, a broad thick wing, tall canted twin tails on the nacelles, a
 * chin cannon pod. Cream hull with a red racing stripe down the spine, red
 * cheek flashes, red leading edges and red chevrons; plumes 35 % longer.
 */
const BRAWLER: ShipDef = {
  name: "F-11 Halberd (brawler)",
  ringVerts: 16,
  hull: [
    { z: 7.4, w: 0.34, h: 0.28, n: 2.6, yOff: -0.12 },
    { z: 6.2, w: 0.9, h: 0.64, n: 3.0, yOff: -0.06 },
    { z: 4.6, w: 1.4, h: 0.98, n: 3.4 },
    { z: 2.4, w: 1.7, h: 1.2, n: 3.6 },
    { z: -0.4, w: 1.84, h: 1.28, n: 3.6 },
    { z: -3.2, w: 1.8, h: 1.24, n: 3.6 },
    { z: -5.4, w: 1.56, h: 1.06, n: 3.4 },
    { z: -6.8, w: 1.2, h: 0.82, n: 3.2 },
  ],
  panels: [
    { ring: 3, seg: 0, mirror: true, depth: 0.08 },
    { ring: 4, seg: 11, mirror: true, depth: 0.08 },
    { ring: 2, seg: 11, mirror: true, depth: 0.08 },
  ],
  stripes: [
    { seg: 3, ringFrom: 0, ringTo: 5, mirror: true }, // red spine
    { seg: 15, ringFrom: 4, ringTo: 6, mirror: true }, // red cheek flash
  ],
  canopy: {
    sections: [
      { z: 5.4, w: 0.44, h: 0.2, n: 2.4, yOff: 0.7 },
      { z: 4.4, w: 0.9, h: 0.7, n: 2.6, yOff: 0.86 },
      { z: 3.2, w: 1.0, h: 0.84, n: 2.6, yOff: 0.98 },
      { z: 1.8, w: 0.9, h: 0.7, n: 2.8, yOff: 1.1 },
      { z: 0.6, w: 0.6, h: 0.3, n: 2.8, yOff: 1.22 },
    ],
    frameBands: [1, 3],
  },
  wings: [{ root: [1.5, -0.3, -2.0], span: 4.6, rootChord: 8.0, tipChord: 2.6, sweep: 5.4, dihedral: 0.08, thickness: 0.34 }],
  fins: [
    { root: [2.4, 1.45, -5.4], height: 2.0, rootChord: 2.4, tipChord: 1.0, sweep: 1.2, angle: UP - 0.4, thickness: 0.12 },
    { root: [-2.4, 1.45, -5.4], height: 2.0, rootChord: 2.4, tipChord: 1.0, sweep: 1.2, angle: UP + 0.4, thickness: 0.12 },
  ],
  engines: [
    { pos: [2.4, 0.5, -3.6], radius: 1.0, length: 6.6, intake: true },
    { pos: [-2.4, 0.5, -3.6], radius: 1.0, length: 6.6, intake: true },
  ],
  plumeScale: 1.35,
  pods: [{ pos: [0, -0.92, 5.0], radius: 0.22, length: 3.0 }],
  hatches: [{ pos: [0, 1.28, -1.8], size: [0.9, 1.4], face: "top" }],
  decals: [
    { kind: "number", text: "11", pos: [1.06, 0.1, 5.6], rot: [0, UP, 0], size: [0.7, 0.36], mirror: true, slot: "accent" },
    { kind: "chevron", pos: [4.2, 0.1, -2.6], rot: [-UP, 0, Math.PI], size: [1.4, 1.4], mirror: true },
  ],
  palette: { body: 0xe9e3d4, accent: 0xd63b2f, dark: 0x2a2d33, glow: 0x4fa3ff, canopy: 0x143a4c },
};

/**
 * C — "Lance": the sleek interceptor read. Nineteen-metre needle nose, a slim
 * rounder fuselage, a high-sweep delta with tall wingtip plates and a slight
 * anhedral, small canards, a ventral strake, thin long round nacelles, missile
 * pods under the wings. Graphite paint with an amber spine stripe and amber
 * leading edges; canopy low and long with a single frame.
 */
const LANCE: ShipDef = {
  name: "F-11 Halberd (lance)",
  ringVerts: 16,
  hull: [
    { z: 10.4, w: 0.12, h: 0.1, n: 2.4, yOff: -0.14 },
    { z: 8.8, w: 0.36, h: 0.26, n: 2.8, yOff: -0.1 },
    { z: 7.0, w: 0.64, h: 0.44, n: 3.0, yOff: -0.04 },
    { z: 4.8, w: 0.86, h: 0.6, n: 3.2 },
    { z: 2.2, w: 1.0, h: 0.7, n: 3.4 },
    { z: -0.8, w: 1.06, h: 0.74, n: 3.4 },
    { z: -3.8, w: 1.02, h: 0.7, n: 3.2 },
    { z: -6.2, w: 0.9, h: 0.6, n: 3.0 },
    { z: -8.0, w: 0.7, h: 0.46, n: 2.8 },
  ],
  panels: [
    { ring: 4, seg: 0, mirror: true },
    { ring: 2, seg: 11, mirror: true },
    { ring: 5, seg: 3, mirror: true },
  ],
  stripes: [{ seg: 3, ringFrom: 1, ringTo: 7, mirror: true }], // amber spine, full length
  canopy: {
    sections: [
      { z: 7.2, w: 0.22, h: 0.1, n: 2.6, yOff: 0.36 },
      { z: 6.2, w: 0.44, h: 0.3, n: 2.8, yOff: 0.46 },
      { z: 5.0, w: 0.52, h: 0.38, n: 2.8, yOff: 0.56 },
      { z: 3.6, w: 0.48, h: 0.32, n: 2.8, yOff: 0.64 },
      { z: 2.4, w: 0.34, h: 0.14, n: 2.8, yOff: 0.7 },
    ],
    frameBands: [2],
  },
  wings: [
    { root: [0.9, -0.16, -3.0], span: 7.0, rootChord: 9.0, tipChord: 1.2, sweep: 7.8, dihedral: -0.04, thickness: 0.12 },
    { root: [0.6, 0.1, 6.0], span: 1.7, rootChord: 1.8, tipChord: 0.6, sweep: 1.2, dihedral: 0.0, thickness: 0.08 }, // canards
  ],
  fins: [
    { root: [7.9, -0.44, -6.9], height: 1.5, rootChord: 1.4, tipChord: 0.6, sweep: 0.7, angle: UP - 0.15, thickness: 0.08 },
    { root: [-7.9, -0.44, -6.9], height: 1.5, rootChord: 1.4, tipChord: 0.6, sweep: 0.7, angle: UP + 0.15, thickness: 0.08 },
    { root: [0, -0.46, -6.8], height: 0.9, rootChord: 2.2, tipChord: 1.0, sweep: 1.0, angle: -UP, thickness: 0.08 }, // ventral strake
  ],
  engines: [
    { pos: [1.55, 0.28, -4.4], radius: 0.5, length: 7.6, intake: true, segments: 12 },
    { pos: [-1.55, 0.28, -4.4], radius: 0.5, length: 7.6, intake: true, segments: 12 },
  ],
  pods: [
    { pos: [3.4, -0.42, -3.4], radius: 0.16, length: 3.2 },
    { pos: [-3.4, -0.42, -3.4], radius: 0.16, length: 3.2 },
  ],
  hatches: [{ pos: [0, 0.72, -2.0], size: [0.5, 1.6], face: "top" }],
  decals: [
    { kind: "number", text: "11", pos: [0.56, 0.0, 7.6], rot: [0, UP, 0], size: [0.5, 0.26], mirror: true },
    { kind: "stripe", pos: [4.0, -0.1, -4.8], rot: [-UP, 0, 0], size: [2.0, 0.4], mirror: true },
  ],
  palette: { body: 0x3f444c, accent: 0xf2b134, dark: 0x1a1c20, glow: 0x8fd8ff, canopy: 0x0e1c2c },
};

export const VARIANTS: Record<string, ShipDef> = { a: FACET, b: BRAWLER, c: LANCE };

/** `?variant=a|b|c` swaps the player fighter's def; other hulls and unknown keys pass through. */
export function pickVariant(def: ShipDef, params: URLSearchParams): ShipDef {
  if (def !== F11_HALBERD) return def;
  return VARIANTS[params.get("variant") ?? ""] ?? def;
}
