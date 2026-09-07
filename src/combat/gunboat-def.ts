import { selectArt } from '@/ships/art-version';
import { auxiliaryRevision } from '@/ships/refinements';
/**
 * Heavy enemy: ~22.5 m long, 18 m span, ~4.4 m tall, excluding plumes.
 * Black silhouette reads as a broad armoured slab with a blunt bow, four gun
 * barrels, a raised rectangular bridge and three heavy stern engines. The
 * thick level shoulders distinguish it from the glider's drooping crescent
 * and the player's thin delta; the bridge supplies a stepped side profile.
 * Dark gunmetal, bronze trim and red exhaust mark the heavy faction member.
 * Ship-local +Z forward, +Y up, +X port; all dimensions in metres.
 */
import type { ShipDef } from "@/ships/defs";

export const GUNBOAT_ORIGINAL: ShipDef = {
  name: "Gunboat",
  ringVerts: 16,
  hull: [
    { z: 10.4, w: 4.8, h: 0.55, n: 4.5 },
    { z: 8.0, w: 7.6, h: 0.8, n: 5 },
    { z: 4.5, w: 9.0, h: 0.95, n: 5 },
    { z: 1.0, w: 9.0, h: 1.0, n: 5 },
    { z: -2.5, w: 8.6, h: 1.0, n: 5 },
    { z: -5.5, w: 7.8, h: 0.95, n: 5 },
    { z: -8.0, w: 7.2, h: 0.85, n: 4.5 },
    { z: -10.4, w: 6.6, h: 0.65, n: 4 },
  ],
  // Sixteen recessed cells across the shoulders, flanks and underside.
  panels: [
    { ring: 1, seg: 1, mirror: true, depth: 0.1 },
    { ring: 2, seg: 2, mirror: true, depth: 0.08 },
    { ring: 3, seg: 1, mirror: true, depth: 0.1 },
    { ring: 4, seg: 2, mirror: true, depth: 0.08 },
    { ring: 5, seg: 1, mirror: true, depth: 0.1 },
    { ring: 2, seg: 0, mirror: true, depth: 0.1 },
    { ring: 4, seg: 0, mirror: true, depth: 0.1 },
    { ring: 3, seg: 11, mirror: true, depth: 0.08 },
  ],
  stripes: [
    { seg: 0, ringFrom: 5, ringTo: 7, mirror: true },
    { seg: 1, ringFrom: 1, ringTo: 5, mirror: true },
  ],
  // Boxy canopy sections form a bridge block embedded into the upper deck.
  canopy: {
    sections: [
      { z: 1.8, w: 1.5, h: 1.0, n: 5, yOff: 1.65 },
      { z: 1.1, w: 1.8, h: 1.3, n: 5, yOff: 1.8 },
      { z: -2.8, w: 1.8, h: 1.3, n: 5, yOff: 1.8 },
      { z: -3.5, w: 1.5, h: 1.0, n: 5, yOff: 1.65 },
    ],
    frameBands: [1],
  },
  wings: [],
  fins: [],
  // Eight-sided engine bodies keep the heavy silhouette within the tri budget.
  engines: [
    { pos: [5.6, -0.05, -8.0], radius: 1.1, length: 5.6, boxiness: 4, segments: 8 },
    { pos: [0, -0.05, -8.0], radius: 1.1, length: 5.6, boxiness: 4, segments: 8 },
    { pos: [-5.6, -0.05, -8.0], radius: 1.1, length: 5.6, boxiness: 4, segments: 8 },
  ],
  plumeScale: 1.0,
  // Open +Z mouths read as gun barrels; pods produce no exhaust or glow discs.
  pods: [
    { pos: [3.0, 0.55, 9.0], radius: 0.5, length: 4.2, intake: true, boxiness: 4, segments: 8 },
    { pos: [-3.0, 0.55, 9.0], radius: 0.5, length: 4.2, intake: true, boxiness: 4, segments: 8 },
    { pos: [6.0, 0.55, 8.4], radius: 0.5, length: 4.2, intake: true, boxiness: 4, segments: 8 },
    { pos: [-6.0, 0.55, 8.4], radius: 0.5, length: 4.2, intake: true, boxiness: 4, segments: 8 },
  ],
  hatches: [
    { pos: [3.5, 0.995, -1.0], size: [1.4, 2.0], face: "top", mirror: true },
  ],
  decals: [],
  palette: { body: 0x2e3239, accent: 0xa8793e, dark: 0x15171c, glow: 0xff3828, canopy: 0x30251e },
};

export const GUNBOAT_REVISED = auxiliaryRevision(GUNBOAT_ORIGINAL, 'gunboat');
export const GUNBOAT = selectArt(GUNBOAT_ORIGINAL, GUNBOAT_REVISED);
