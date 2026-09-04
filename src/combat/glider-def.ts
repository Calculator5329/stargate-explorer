import type { ShipDef } from "@/ships/defs";

/**
 * Enemy fighter in the spirit of the show's death glider: a stubby central pod
 * with a domed cockpit and two long, drooping crescent wings swept forward at
 * the root and back at the tip, dark gunmetal with gold trim and hot orange
 * exhaust. ~9 m long, ~13 m span. Lives here rather than ships/defs.ts so the
 * enemy roster can grow independently of the player hulls.
 */
export const GLIDER: ShipDef = {
  name: "Glider",
  ringVerts: 12,
  hull: [
    { z: 4.6, w: 0.16, h: 0.12, n: 2.2 },
    { z: 3.4, w: 0.7, h: 0.5, n: 2.4 },
    { z: 1.8, w: 1.1, h: 0.8, n: 2.6 },
    { z: 0.0, w: 1.2, h: 0.85, n: 2.8 },
    { z: -2.0, w: 1.0, h: 0.7, n: 2.8 },
    { z: -3.6, w: 0.7, h: 0.5, n: 2.6 },
    { z: -4.4, w: 0.45, h: 0.35, n: 2.4 },
  ],
  panels: [{ ring: 3, seg: 2, mirror: true }, { ring: 2, seg: 9, mirror: true }],
  stripes: [{ seg: 0, ringFrom: 1, ringTo: 4, mirror: true }],
  canopy: {
    sections: [
      { z: 2.6, w: 0.3, h: 0.12, n: 2.2, yOff: 0.55 },
      { z: 1.6, w: 0.55, h: 0.45, n: 2.2, yOff: 0.6 },
      { z: 0.4, w: 0.5, h: 0.3, n: 2.2, yOff: 0.72 },
    ],
    frameBands: [1],
  },
  wings: [
    // inner crescent: broad, swept forward, drooping
    { root: [1.0, -0.2, 2.2], span: 3.2, rootChord: 5.0, tipChord: 2.6, sweep: -1.2, dihedral: -0.45, thickness: 0.22 },
    // outer blade: swept back hard, tip well below the pod
    { root: [3.9, -1.55, 1.1], span: 2.8, rootChord: 2.6, tipChord: 0.7, sweep: 2.4, dihedral: -0.55, thickness: 0.14 },
  ],
  fins: [],
  engines: [
    { pos: [0.55, -0.1, -3.2], radius: 0.42, length: 2.4 },
    { pos: [-0.55, -0.1, -3.2], radius: 0.42, length: 2.4 },
  ],
  hatches: [],
  decals: [],
  palette: { body: 0x454a52, accent: 0xc9a24a, dark: 0x1e2024, glow: 0xffa040, canopy: 0x3a2a10 },
};
