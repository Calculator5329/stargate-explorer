import { selectArt } from '@/ships/art-version';
import { auxiliaryRevision } from '@/ships/refinements';
import type { ShipDef } from "@/ships/defs";
import { PALETTES } from "@/ships/palettes";

/**
 * Torpedo boat: ~19 m long, ~15 m span. A deep boxy forebody, a raised tandem
 * cockpit, two stubby wings, and two long torpedo pods slung under them that
 * run nearly the whole length. Two engines high on the tail. The silhouette is
 * a fat hull with two big tubes hanging under it; nothing else in the hangar
 * carries its load outside. Ship-local +Z forward, +Y up, +X port; metres.
 */
export const LANCER_ORIGINAL: ShipDef = {
  name: "F-24 Lancer",
  ringVerts: 16,
  hull: [
    { z: 9.4, w: 0.5, h: 0.3, n: 4.0 },
    { z: 7.6, w: 1.2, h: 0.62, n: 4.6 },
    { z: 5.4, w: 1.8, h: 0.9, n: 5.0 },
    { z: 3.0, w: 2.2, h: 1.05, n: 5.4 },
    { z: 0.4, w: 2.35, h: 1.1, n: 5.6 },
    { z: -2.4, w: 2.3, h: 1.08, n: 5.6 },
    { z: -5.0, w: 2.15, h: 0.98, n: 5.4 },
    { z: -7.2, w: 1.9, h: 0.84, n: 5.0 },
    { z: -8.8, w: 1.6, h: 0.66, n: 4.6 },
  ],
  panels: [
    { ring: 2, seg: 0, depth: 0.08, mirror: true },
    { ring: 4, seg: 0, depth: 0.08, mirror: true },
    { ring: 6, seg: 1, depth: 0.06, mirror: true },
    { ring: 3, seg: 2, depth: 0.05, mirror: true },
    { ring: 5, seg: 11, depth: 0.06, mirror: true },
  ],
  stripes: [
    { seg: 1, ringFrom: 2, ringTo: 6, mirror: true },
  ],
  canopy: {
    sections: [
      { z: 4.6, w: 0.34, h: 0.12, n: 3.0, yOff: 1.0 },
      { z: 3.8, w: 0.62, h: 0.42, n: 3.4, yOff: 1.06 },
      { z: 2.2, w: 0.72, h: 0.52, n: 3.6, yOff: 1.1 },
      { z: 0.6, w: 0.68, h: 0.48, n: 3.6, yOff: 1.12 },
      { z: -0.6, w: 0.44, h: 0.16, n: 3.4, yOff: 1.12 },
    ],
    frameBands: [1, 2, 3],
  },
  wings: [
    { root: [2.1, -0.3, -1.0], span: 5.2, rootChord: 7.4, tipChord: 2.8, sweep: 3.6, dihedral: 0.06, thickness: 0.5 },
  ],
  fins: [
    { root: [1.4, 1.0, -6.6], height: 2.0, rootChord: 3.0, tipChord: 1.2, sweep: 1.6, angle: Math.PI / 2 - 0.5, thickness: 0.18 },
    { root: [-1.4, 1.0, -6.6], height: 2.0, rootChord: 3.0, tipChord: 1.2, sweep: 1.6, angle: Math.PI / 2 + 0.5, thickness: 0.18 },
  ],
  engines: [
    { pos: [1.5, 0.55, -6.4], radius: 0.78, length: 5.6, intake: true, aspect: [1.0, 1.0], boxiness: 4.2, segments: 14 },
    { pos: [-1.5, 0.55, -6.4], radius: 0.78, length: 5.6, intake: true, aspect: [1.0, 1.0], boxiness: 4.2, segments: 14 },
  ],
  pods: [
    // The torpedo tubes: long, under the wing roots, open mouths forward.
    { pos: [4.0, -1.35, 0.6], radius: 0.78, length: 12.0, intake: true, aspect: [1.0, 1.0], boxiness: 3.4, segments: 12 },
    { pos: [-4.0, -1.35, 0.6], radius: 0.78, length: 12.0, intake: true, aspect: [1.0, 1.0], boxiness: 3.4, segments: 12 },
  ],
  hatches: [
    { pos: [0, 1.1, -3.4], size: [1.2, 1.8], face: "top" },
    { pos: [0, -1.1, 1.6], size: [1.4, 3.2], face: "bottom" },
  ],
  decals: [
    { kind: "stripe", pos: [2.32, -0.2, 6.0], rot: [0, Math.PI / 2, 0], size: [0.3, 2.4], mirror: true, slot: "accent" },
  ],
  // Warning-orange ID flashes on the tubes' carrier.
  palette: { ...PALETTES.tauri, accent: 0xd9822b },
};

export const LANCER_REVISED = auxiliaryRevision(LANCER_ORIGINAL, 'lancer');
export const LANCER = selectArt(LANCER_ORIGINAL, LANCER_REVISED);
