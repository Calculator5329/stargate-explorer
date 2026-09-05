import type { ShipDef } from "@/ships/defs";
import { PALETTES } from "@/ships/palettes";

/**
 * Heavy strike sibling to FACET: ~21 m long, ~17 m span, with a broad chined
 * forebody, recessed tandem cockpit and two stacked pairs of tail engines.
 * Ship-local +Z forward, +Y up, +X port; metres, angles in radians.
 */
export const HEAVY: ShipDef = {
  name: "F-21 Broadsword",
  ringVerts: 16,
  hull: [
    { z: 10.1, w: 0.38, h: 0.12, n: 3.6, yOff: -0.12 },
    { z: 8.5, w: 1.0, h: 0.32, n: 4.4, yOff: -0.08 },
    { z: 6.4, w: 1.9, h: 0.55, n: 5.0, yOff: -0.04 },
    { z: 4.2, w: 2.55, h: 0.7, n: 5.4 },
    { z: 1.8, w: 2.9, h: 0.8, n: 5.6 },
    { z: -1.0, w: 3.05, h: 0.84, n: 5.6 },
    { z: -3.8, w: 3.0, h: 0.82, n: 5.4 },
    { z: -6.3, w: 2.85, h: 0.74, n: 5.2 },
    { z: -8.4, w: 2.65, h: 0.62, n: 5.0 },
    { z: -9.8, w: 2.4, h: 0.5, n: 4.8 },
  ],
  // Builder cell indices run tail → nose, despite the nose → tail data order.
  panels: [
    { ring: 2, seg: 0, depth: 0.08, mirror: true },
    { ring: 4, seg: 0, depth: 0.08, mirror: true },
    { ring: 6, seg: 1, depth: 0.06, mirror: true },
    { ring: 2, seg: 3, depth: 0.05, mirror: true },
    { ring: 4, seg: 2, depth: 0.05, mirror: true },
    { ring: 6, seg: 3, depth: 0.05, mirror: true },
    { ring: 3, seg: 11, depth: 0.06, mirror: true },
    { ring: 5, seg: 11, depth: 0.06, mirror: true },
  ],
  stripes: [],
  canopy: {
    sections: [
      { z: 3.9, w: 0.36, h: 0.12, n: 3.0, yOff: 0.7 },
      { z: 3.0, w: 0.65, h: 0.38, n: 3.4, yOff: 0.76 },
      { z: 1.6, w: 0.74, h: 0.48, n: 3.6, yOff: 0.8 },
      { z: 0.1, w: 0.69, h: 0.44, n: 3.6, yOff: 0.84 },
      { z: -1.2, w: 0.46, h: 0.16, n: 3.4, yOff: 0.84 },
    ],
    frameBands: [1, 2, 3],
  },
  wings: [
    // Cropped trailing edge at z -8.6; ~1.15 m tip droop, thick load-bearing roots.
    { root: [2.5, -0.18, -2.6], span: 6.1, rootChord: 12.0, tipChord: 3.6, sweep: 8.4, dihedral: -0.19, thickness: 0.68 },
  ],
  fins: [
    // Outward-canted tails seated in the upper nacelles, clear of the exhausts.
    { root: [2.9, 1.55, -7.0], height: 2.3, rootChord: 3.5, tipChord: 1.5, sweep: 1.8, angle: Math.PI / 2 - 0.38, thickness: 0.2 },
    { root: [-2.9, 1.55, -7.0], height: 2.3, rootChord: 3.5, tipChord: 1.5, sweep: 1.8, angle: Math.PI / 2 + 0.38, thickness: 0.2 },
  ],
  engines: [
    // Two vertical pairs. Nozzle rims finish at z -10.56 with a gap between tiers.
    { pos: [2.9, 1.05, -6.8], radius: 0.8, length: 6.4, intake: true, aspect: [1.1, 0.9], boxiness: 4.8, segments: 16 },
    { pos: [2.9, -1.05, -6.8], radius: 0.8, length: 6.4, intake: true, aspect: [1.1, 0.9], boxiness: 4.8, segments: 16 },
    { pos: [-2.9, 1.05, -6.8], radius: 0.8, length: 6.4, intake: true, aspect: [1.1, 0.9], boxiness: 4.8, segments: 16 },
    { pos: [-2.9, -1.05, -6.8], radius: 0.8, length: 6.4, intake: true, aspect: [1.1, 0.9], boxiness: 4.8, segments: 16 },
  ],
  pods: [
    // Heavy weapon housings: open forward muzzles; their crowns intersect the wing undersides.
    { pos: [5.1, -1.22, -3.8], radius: 0.62, length: 5.6, intake: true, aspect: [1.05, 0.85], boxiness: 5.0, segments: 12 },
    { pos: [-5.1, -1.22, -3.8], radius: 0.62, length: 5.6, intake: true, aspect: [1.05, 0.85], boxiness: 5.0, segments: 12 },
  ],
  hatches: [
    { pos: [0, 0.84, -3.0], size: [1.1, 1.6], face: "top" },
    { pos: [0, -0.84, -0.4], size: [1.3, 2.0], face: "bottom" },
  ],
  decals: [
    // Planes follow the outer fin faces: chord runs along local decal X.
    { kind: "stripe", pos: [3.414, 2.6, -7.35], rot: [Math.PI / 2, Math.PI / 2 - 0.38, Math.PI / 2], size: [1.7, 0.65], mirror: true, slot: "accent" },
    { kind: "stripe", pos: [2.55, 0.71, 1.0], rot: [-Math.PI / 2, 0, 0], size: [0.22, 4.0], mirror: true, slot: "dark" },
  ],
  // Warm ID flashes also colour the builder's narrow leading edges and fin tips.
  palette: { ...PALETTES.tauri, accent: 0xb87543 },
};
