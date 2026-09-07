import { roleVariant } from '@/ships/sg1-geometry';
import { selectArt } from '@/ships/art-version';
import { auxiliaryRevision } from '@/ships/refinements';
/**
 * Neutral civilian racer: ~11 m long, ~8 m span, ~3.4 m tall, excluding plumes.
 * Two oversized engine nacelles on short straight outriggers flank a slim
 * fuselage, leaving open gaps ahead of and behind the struts. A midship bubble
 * canopy and one tall swept tail fin complete the side profile; no weapons.
 * The separated engine pair supplies the signature, without a delta, crescent
 * wing, needle silhouette or armoured slab. Off-white with teal racing trim,
 * charcoal intakes and cyan-white exhaust; race number 27 tops both engines.
 * Ship-local +Z forward, +Y up, +X port; all dimensions in metres.
 */
import type { ShipDef } from "@/ships/defs";

export const RACER_ORIGINAL: ShipDef = {
  name: "Racer",
  ringVerts: 12,
  hull: [
    { z: 5.2, w: 0.12, h: 0.1, n: 2.4 },
    { z: 4.0, w: 0.34, h: 0.24, n: 2.6 },
    { z: 2.0, w: 0.52, h: 0.36, n: 2.8 },
    { z: 0.5, w: 0.62, h: 0.42, n: 2.8 },
    { z: -1.0, w: 0.62, h: 0.42, n: 2.8 },
    { z: -2.8, w: 0.48, h: 0.34, n: 2.6 },
    { z: -4.2, w: 0.32, h: 0.24, n: 2.4 },
    { z: -5.1, w: 0.16, h: 0.12, n: 2.2 },
  ],
  // Tail-to-nose cells; paired shoulder stripes leave the cream spine visible.
  panels: [
    { ring: 2, seg: 0, mirror: true, depth: 0.025 },
    { ring: 4, seg: 8, mirror: true, depth: 0.025 },
  ],
  stripes: [
    { seg: 1, ringFrom: 0, ringTo: 7, mirror: true },
  ],
  canopy: {
    sections: [
      { z: 1.6, w: 0.22, h: 0.12, n: 2, yOff: 0.35 },
      { z: 0.9, w: 0.47, h: 0.5, n: 2, yOff: 0.44 },
      { z: 0.0, w: 0.52, h: 0.66, n: 2, yOff: 0.46 },
      { z: -0.9, w: 0.44, h: 0.48, n: 2, yOff: 0.43 },
      { z: -1.6, w: 0.2, h: 0.1, n: 2, yOff: 0.37 },
    ],
    frameBands: [1],
  },
  wings: [
    // Narrow transverse struts: roots bury in the hull, tips bury in the pods.
    { root: [0.48, -0.12, -0.6], span: 2.45, rootChord: 1.15, tipChord: 0.95, sweep: 0.1, dihedral: 0, thickness: 0.24 },
  ],
  fins: [
    { root: [0, 0.24, -3.7], height: 2.0, rootChord: 2.2, tipChord: 0.65, sweep: 1.25, angle: Math.PI / 2, thickness: 0.14 },
  ],
  // Eight-sided nacelles keep the paired intake/nozzle stacks inexpensive.
  // Nozzle rings reach 1.08 × radius, giving a total span of exactly 8 m.
  engines: [
    { pos: [2.92, -0.12, 0.0], radius: 1.0, length: 7.6, intake: true, boxiness: 2.4, segments: 8 },
    { pos: [-2.92, -0.12, 0.0], radius: 1.0, length: 7.6, intake: true, boxiness: 2.4, segments: 8 },
  ],
  plumeScale: 0.85,
  hatches: [],
  decals: [
    { kind: "number", text: "27", pos: [2.92, 0.9, 0.8], rot: [-Math.PI / 2, 0, 0], size: [0.7, 0.9], mirror: true, slot: "accent" },
  ],
  palette: { body: 0xeee9dc, accent: 0x00b99c, dark: 0x202b30, glow: 0xb5f8ff, canopy: 0x173e49 },
};

export const RACER_PASS1 = auxiliaryRevision(RACER_ORIGINAL, 'racer');
export const RACER_REVISED = roleVariant(RACER_ORIGINAL, 'racer');
export const RACER = selectArt(RACER_ORIGINAL, RACER_REVISED, RACER_PASS1);
