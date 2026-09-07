import { roleVariant } from '@/ships/sg1-geometry';
import { selectArt } from '@/ships/art-version';
import { auxiliaryRevision } from '@/ships/refinements';
import type { ShipDef } from "@/ships/defs";
import { PALETTES } from "@/ships/palettes";

/**
 * Light interceptor sibling to FACET: ~12 m long, ~9 m span. A needle nose,
 * a single oversized engine, short forward-swept wings and a tall single fin.
 * The glass-cannon hull: the black silhouette is one long spike with a pair of
 * small blades, nothing like the fighter's delta or the Broadsword's slab.
 * Ship-local +Z forward, +Y up, +X port; metres, angles in radians.
 */
export const DART_ORIGINAL: ShipDef = {
  name: "F-19 Dart",
  ringVerts: 14,
  hull: [
    { z: 6.2, w: 0.12, h: 0.1, n: 3.2 },
    { z: 5.0, w: 0.34, h: 0.24, n: 3.6 },
    { z: 3.4, w: 0.62, h: 0.42, n: 4.0 },
    { z: 1.6, w: 0.86, h: 0.58, n: 4.2 },
    { z: -0.4, w: 0.98, h: 0.66, n: 4.2 },
    { z: -2.6, w: 0.96, h: 0.66, n: 4.0 },
    { z: -4.4, w: 0.84, h: 0.6, n: 3.8 },
    { z: -5.8, w: 0.7, h: 0.5, n: 3.6 },
  ],
  panels: [
    { ring: 2, seg: 1, depth: 0.05, mirror: true },
    { ring: 4, seg: 1, depth: 0.05, mirror: true },
    { ring: 3, seg: 10, depth: 0.04, mirror: true },
  ],
  stripes: [
    { seg: 0, ringFrom: 1, ringTo: 5, mirror: true },
  ],
  canopy: {
    sections: [
      { z: 2.6, w: 0.2, h: 0.08, n: 3.0, yOff: 0.52 },
      { z: 1.8, w: 0.4, h: 0.3, n: 3.4, yOff: 0.58 },
      { z: 0.6, w: 0.46, h: 0.36, n: 3.6, yOff: 0.62 },
      { z: -0.6, w: 0.4, h: 0.3, n: 3.6, yOff: 0.64 },
      { z: -1.4, w: 0.26, h: 0.1, n: 3.4, yOff: 0.64 },
    ],
    frameBands: [1, 3],
  },
  wings: [
    // Forward-swept blades: the tip leading edge sits ahead of the root.
    { root: [0.9, -0.05, -2.2], span: 3.6, rootChord: 4.2, tipChord: 1.4, sweep: -1.6, dihedral: -0.08, thickness: 0.22 },
  ],
  fins: [
    { root: [0, 0.6, -3.6], height: 1.9, rootChord: 2.6, tipChord: 0.7, sweep: 1.4, angle: Math.PI / 2, thickness: 0.14 },
  ],
  engines: [
    { pos: [0, -0.05, -4.2], radius: 0.85, length: 4.6, intake: false, boxiness: 2.6, segments: 14 },
  ],
  plumeScale: 1.15,
  pods: [
    // Two chin guns.
    { pos: [0.55, -0.42, 2.2], radius: 0.16, length: 2.4, intake: true, segments: 8 },
    { pos: [-0.55, -0.42, 2.2], radius: 0.16, length: 2.4, intake: true, segments: 8 },
  ],
  hatches: [
    { pos: [0, 0.66, -3.2], size: [0.6, 1.0], face: "top" },
  ],
  decals: [
    { kind: "stripe", pos: [0, 2.3, -3.9], rot: [Math.PI / 2, Math.PI / 2, Math.PI / 2], size: [1.2, 0.4], slot: "accent" },
  ],
  // Cold white-blue ID flashes: the fast one.
  palette: { ...PALETTES.tauri, accent: 0xd8e6f2, glow: 0x9fd0ff },
};

export const DART_PASS1 = auxiliaryRevision(DART_ORIGINAL, 'dart');
export const DART_REVISED = roleVariant(DART_ORIGINAL, 'dart');
export const DART = selectArt(DART_ORIGINAL, DART_REVISED, DART_PASS1);
