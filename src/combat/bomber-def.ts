import { selectArt } from '@/ships/art-version';
import { bomberRevision } from '@/ships/refinements';
/**
 * Heavy bomber: ~19 m long, ~21 m span, ~3.6 m tall, excluding plumes.
 * Black silhouette reads as a flat, broad arrowhead with a squat raised bridge
 * amidships and two fat engines set wide in the trailing edge: wider than it is
 * long, unlike the glider's drooping crescent, the gunboat's slab or the
 * interceptor's needle. Dark bronze with a copper spine and amber exhaust.
 * Ship-local +Z forward, +Y up, +X port; all dimensions in metres.
 */
import type { ShipDef } from "@/ships/defs";

export const BOMBER_ORIGINAL: ShipDef = {
  name: "Bomber",
  ringVerts: 16,
  hull: [
    { z: 9.6, w: 0.9, h: 0.4, n: 4.5 },
    { z: 7.0, w: 2.6, h: 0.75, n: 5 },
    { z: 4.0, w: 4.2, h: 1.0, n: 5.2 },
    { z: 0.5, w: 5.2, h: 1.15, n: 5.4 },
    { z: -3.0, w: 5.6, h: 1.1, n: 5.4 },
    { z: -6.0, w: 5.2, h: 0.95, n: 5 },
    { z: -8.4, w: 4.4, h: 0.7, n: 4.5 },
    { z: -9.6, w: 3.6, h: 0.5, n: 4 },
  ],
  panels: [
    { ring: 1, seg: 1, mirror: true, depth: 0.1 },
    { ring: 3, seg: 1, mirror: true, depth: 0.1 },
    { ring: 5, seg: 2, mirror: true, depth: 0.08 },
    { ring: 2, seg: 0, mirror: true, depth: 0.1 },
    { ring: 4, seg: 0, mirror: true, depth: 0.1 },
    { ring: 3, seg: 11, mirror: true, depth: 0.08 },
  ],
  stripes: [
    { seg: 0, ringFrom: 1, ringTo: 6, mirror: true },
  ],
  // Squat bridge block set back from the nose.
  canopy: {
    sections: [
      { z: 3.2, w: 1.2, h: 0.6, n: 5, yOff: 1.35 },
      { z: 2.4, w: 1.6, h: 0.9, n: 5, yOff: 1.45 },
      { z: -0.6, w: 1.6, h: 0.9, n: 5, yOff: 1.45 },
      { z: -1.4, w: 1.2, h: 0.6, n: 5, yOff: 1.3 },
    ],
    frameBands: [1],
  },
  wings: [
    // Broad delta blended into the hull, thick at the root, cropped tips slightly drooped.
    // root.z is the chord centre in this builder: chord spans z 3.5..-7.5, tip leading edge at -3.0.
    { root: [4.6, -0.1, -2.0], span: 6.2, rootChord: 11.0, tipChord: 3.2, sweep: 6.5, dihedral: -0.12, thickness: 0.7 },
  ],
  fins: [],
  engines: [
    { pos: [6.2, -0.1, -6.6], radius: 1.25, length: 5.8, boxiness: 3.5, segments: 10 },
    { pos: [-6.2, -0.1, -6.6], radius: 1.25, length: 5.8, boxiness: 3.5, segments: 10 },
  ],
  plumeScale: 1.1,
  // Two forward gun mouths under the chin.
  pods: [
    { pos: [1.6, -0.75, 8.0], radius: 0.45, length: 3.6, intake: true, boxiness: 4, segments: 8 },
    { pos: [-1.6, -0.75, 8.0], radius: 0.45, length: 3.6, intake: true, boxiness: 4, segments: 8 },
  ],
  hatches: [
    { pos: [3.2, 1.1, -3.6], size: [1.6, 2.2], face: "top", mirror: true },
    { pos: [0, -1.12, -1.0], size: [2.2, 3.4], face: "bottom" },
  ],
  decals: [],
  palette: { body: 0x5c4a30, accent: 0xc98a3c, dark: 0x22190f, glow: 0xffa040, canopy: 0x3a2a12 },
};

export const BOMBER_REVISED = bomberRevision(BOMBER_ORIGINAL);
export const BOMBER = selectArt(BOMBER_ORIGINAL, BOMBER_REVISED);
