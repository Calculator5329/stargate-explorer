import type { ArmorDef, EngineDef, ShipDef } from "@/ships/defs";
import { PALETTES } from "@/ships/palettes";

/**
 * Player carrier, ~62 m long and ~29 m span: the show's deep-space carrier at
 * arena scale. Pass 5 (Ethan, 2026-09-05): break the slab into a raised foredeck,
 * stepped bridge, recessed flank hangars and a low flight deck between separate
 * stern machinery blocks. Hard facets and three steel tones, no insignia.
 * Ship-local +Z forward, +Y up, +X port. Engine anchors stay fixed for the rig.
 */
const FLIGHT_DECK = 2.4;
const FOREDECK = 4.8;

/** Clipped rectangular footprint; the builder bevels its upper perimeter. */
function plate(x: number, z: number, w: number, l: number, y: number, thickness: number, slot: ArmorDef["slot"] = "body"): ArmorDef {
  const c = Math.min(w, l) * 0.16;
  return {
    points: [[x - w / 2 + c, z - l / 2], [x + w / 2 - c, z - l / 2],
      [x + w / 2, z - l / 2 + c], [x + w / 2, z + l / 2 - c],
      [x + w / 2 - c, z + l / 2], [x - w / 2 + c, z + l / 2],
      [x - w / 2, z + l / 2 - c], [x - w / 2, z - l / 2 + c]],
    y, thickness, slot,
  };
}

const turrets: EngineDef[] = [];
const deckPlates: ArmorDef[] = [];
for (const side of [-1, 1]) {
  for (const [z, y] of [[20, FOREDECK], [1.5, FOREDECK], [-14, FLIGHT_DECK]] as const) {
    const x = side * 7.4;
    deckPlates.push(plate(x, z, 3.4, 4, y, 0.35, "accent"));
    turrets.push({ pos: [x, y + 0.85, z], radius: 1.15, length: 2.5, aspect: [1, 0.65], boxiness: 5 });
    for (const dx of [-0.38, 0.38]) {
      turrets.push({ pos: [x + dx, y + 1.05, z + 2.1], radius: 0.17, length: 3.2 });
    }
  }
  for (const z of [4, 10, 16]) deckPlates.push(plate(side * 9, z, 3.2, 5.1, FOREDECK - 0.8, 0.9, "canopy"));
  for (const z of [-18, -11, -4]) deckPlates.push(plate(side * 3.5, z, 2.8, 5.8, FLIGHT_DECK - 0.4, 0.6, "canopy"));
  for (const z of [-28, -24]) deckPlates.push(plate(side * 9.2, z, 6.6, 3.2, 4.05, 0.3, "canopy"));
}

export const PROMETHEUS: ShipDef = {
  name: "Prometheus",
  ringVerts: 16,
  hull: [
    // Narrow stern leaves daylight between the core and the two engine blocks.
    { z: -28, w: 3.8, h: 1.8, n: 4, yOff: -0.3 },
    { z: -21, w: 6.0, h: 2.4, n: 4, yOff: -0.3 },
    { z: -16, w: 14, h: 2.9, n: 4.5, yOff: -0.5 },
    { z: -8, w: 14, h: 2.9, n: 4.5, yOff: -0.5 },
    { z: -1, w: 14, h: 2.9, n: 4.5, yOff: -0.5 },
    { z: 1, w: 13.6, h: 4.1, n: 4.5, yOff: 0.7 },
    { z: 11, w: 12.8, h: 4.1, n: 4.5, yOff: 0.7 },
    { z: 21, w: 11.8, h: 4.1, n: 4.5, yOff: 0.7 },
    { z: 26, w: 10.6, h: 2.6, n: 4, yOff: 0.1 },
    { z: 30, w: 7.4, h: 0.65, n: 4, yOff: -0.3 },
  ],
  panels: [
    // Inset upper beam cells form real cavities; doors sit behind the rim.
    { ring: 2, seg: 0, depth: 1.8, mirror: true },
    { ring: 3, seg: 0, depth: 1.8, mirror: true },
    { ring: 2, seg: 15, depth: 0.65, mirror: true },
    { ring: 3, seg: 15, depth: 0.65, mirror: true },
    { ring: 5, seg: 0, depth: 0.3, mirror: true },
    { ring: 6, seg: 0, depth: 0.3, mirror: true },
    { ring: 5, seg: 12, depth: 0.2 },
    { ring: 6, seg: 12, depth: 0.2 },
  ],
  stripes: [
    { seg: 1, ringFrom: 0, ringTo: 9, mirror: true },
    { seg: 2, ringFrom: 0, ringTo: 9, mirror: true },
  ],
  wings: [],
  fins: [
    { root: [0, 12.1, 5], height: 3.4, rootChord: 2.2, tipChord: 0.65, sweep: 0.8, angle: Math.PI / 2, thickness: 0.4 },
    { root: [2.1, 11.8, 4.4], height: 1.8, rootChord: 1.3, tipChord: 0.35, sweep: 0.6, angle: Math.PI / 2, thickness: 0.22 },
    { root: [-2.1, 11.8, 4.4], height: 1.8, rootChord: 1.3, tipChord: 0.35, sweep: 0.6, angle: Math.PI / 2, thickness: 0.22 },
    { root: [11.2, 4.2, -26], height: 2.2, rootChord: 3.8, tipChord: 1.1, sweep: 1.2, angle: Math.PI / 2, thickness: 0.3 },
    { root: [-11.2, 4.2, -26], height: 2.2, rootChord: 3.8, tipChord: 1.1, sweep: 1.2, angle: Math.PI / 2, thickness: 0.3 },
  ],
  plumeScale: 3.5,
  engines: [
    { pos: [11.9, 0.3, -31.5], radius: 1.15, length: 4.0 },
    { pos: [9.2, 0.3, -31.5], radius: 1.15, length: 4.0 },
    { pos: [6.5, 0.3, -31.5], radius: 1.15, length: 4.0 },
    { pos: [-11.9, 0.3, -31.5], radius: 1.15, length: 4.0 },
    { pos: [-9.2, 0.3, -31.5], radius: 1.15, length: 4.0 },
    { pos: [-6.5, 0.3, -31.5], radius: 1.15, length: 4.0 },
  ],
  pods: [
    { pos: [9.2, 0.3, -26], radius: 3.6, length: 10, aspect: [1.2, 1.08], boxiness: 6, segments: 16 },
    { pos: [-9.2, 0.3, -26], radius: 3.6, length: 10, aspect: [1.2, 1.08], boxiness: 6, segments: 16 },
    ...turrets,
  ],
  armor: [
    ...deckPlates,
    // Layered command island: broad foundation, narrow neck, overhanging bridge.
    plate(0, 7.4, 11, 16, FOREDECK - 0.3, 1.1, "accent"),
    plate(0, 7.4, 8.6, 12.5, 5.6, 2.5),
    plate(0, 6.5, 5.4, 8.6, 8.1, 1.6),
    plate(0, 7.4, 7.5, 9.6, 9.7, 1.25, "accent"),
    plate(0, 7.4, 7.8, 9.9, 10.95, 0.55, "canopy"),
    plate(0, 5.4, 4.2, 4.3, 11.5, 0.6),
    // Raised central foredeck plates and the aft elevator coaming.
    plate(0, 18.8, 8.2, 6.5, FOREDECK - 0.12, 0.32, "canopy"),
    plate(0, -7, 4, 7, FLIGHT_DECK, 0.18, "accent"),
  ],
  hatches: [
    { pos: [0, FLIGHT_DECK + 0.21, -7], size: [3.3, 5.8], face: "top" },
    { pos: [12.3, 0.05, -12], size: [1.05, 5.8], face: "port", mirror: true },
    { pos: [12.3, 0.05, -4.5], size: [1.05, 5.0], face: "port", mirror: true },
    { pos: [0, -3.45, 6], size: [4, 5], face: "bottom" },
  ],
  decals: [
    // Stripe textures fill 3/8 of their plane height; size includes that padding.
    { kind: "stripe", pos: [0, 10.45, 12.02], rot: [0, 0, 0], size: [5.8, 1.2], slot: "glow" },
    { kind: "stripe", pos: [3.59, 10.45, 7.4], rot: [0, Math.PI / 2, 0], size: [6.8, 1.2], mirror: true, slot: "glow" },
    // Guidance lights inside each hangar, inset from the 14 m beam.
    { kind: "stripe", pos: [12.34, 0.42, -12], rot: [0, Math.PI / 2, 0], size: [5.8, 0.7], mirror: true, slot: "glow" },
    { kind: "stripe", pos: [12.34, 0.42, -4.5], rot: [0, Math.PI / 2, 0], size: [4.9, 0.7], mirror: true, slot: "glow" },
    { kind: "stripe", pos: [1, FLIGHT_DECK + 0.04, -17], rot: [-Math.PI / 2, 0, 0], size: [0.18, 18], mirror: true, slot: "glow" },
  ],
  // Local palette only: pale plating uses the spare canopy slot; other ships
  // retain their faction palette and the builder remains unchanged.
  palette: { ...PALETTES.tauri, body: 0x828d99, accent: 0x424d5c, canopy: 0xb6c1ca },
};
