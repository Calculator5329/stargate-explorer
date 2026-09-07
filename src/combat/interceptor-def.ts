import { roleVariant } from '@/ships/sg1-geometry';
import { selectArt } from '@/ships/art-version';
import { auxiliaryRevision } from '@/ships/refinements';
/**
 * Light enemy: ~7.2 m long, ~1.5 m wide, ~2.5 m tall, excluding plume.
 * Black silhouette reads as a needle with one forward-raked dorsal blade and
 * an oversized single engine: the small quick one, without the glider's broad
 * drooping wings or the player fighter's delta. Gold spine and cheek stripes
 * make the shared gunmetal/gold/orange faction palette more conspicuous.
 * Ship-local +Z forward, +Y up, +X port; all dimensions in metres.
 */
import type { ShipDef } from "@/ships/defs";

export const INTERCEPTOR_ORIGINAL: ShipDef = {
  name: "Interceptor",
  ringVerts: 12,
  hull: [
    { z: 3.3, w: 0.06, h: 0.06, n: 3 },
    { z: 2.4, w: 0.18, h: 0.14, n: 3.5 },
    { z: 1.1, w: 0.34, h: 0.26, n: 4 },
    { z: -0.2, w: 0.46, h: 0.36, n: 4 },
    { z: -1.3, w: 0.5, h: 0.4, n: 3.5 },
    { z: -2.8, w: 0.42, h: 0.3, n: 3 },
  ],
  // Tail-to-nose cell indices; 12 vertices put the spine at segs 2 and 3.
  panels: [
    { ring: 1, seg: 1, mirror: true, depth: 0.035 },
    { ring: 2, seg: 8, mirror: true, depth: 0.025 },
  ],
  stripes: [
    { seg: 2, ringFrom: 0, ringTo: 5, mirror: true },
    { seg: 0, ringFrom: 1, ringTo: 4, mirror: true },
  ],
  wings: [],
  fins: [
    { root: [0, 0.35, -0.65], height: 1.3, rootChord: 1.8, tipChord: 0.35, sweep: -0.35, angle: Math.PI / 2, thickness: 0.12 },
  ],
  engines: [
    { pos: [0, -0.05, -1.7], radius: 0.7, length: 2.5, segments: 12 },
  ],
  plumeScale: 0.8,
  hatches: [],
  decals: [],
  palette: { body: 0x454a52, accent: 0xe0b852, dark: 0x1e2024, glow: 0xffa040, canopy: 0x3a2a10 },
};

export const INTERCEPTOR_PASS1 = auxiliaryRevision(INTERCEPTOR_ORIGINAL, 'interceptor');
export const INTERCEPTOR_REVISED = roleVariant(INTERCEPTOR_ORIGINAL, 'interceptor');
export const INTERCEPTOR = selectArt(INTERCEPTOR_ORIGINAL, INTERCEPTOR_REVISED, INTERCEPTOR_PASS1);
