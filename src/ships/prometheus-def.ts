import type { ShipDef } from "@/ships/defs";
import { PALETTES } from "@/ships/palettes";

/**
 * Player carrier, ~62 m long, ~29 m span, modelled on the show's BC-303-class
 * deep-space carrier scaled to a third so it flies in this arena. What the
 * reference shows: a long boxy slab with a broad flat upper deck, angular
 * chamfered sides that lean in below the deck line, a blunt chisel bow, a
 * stepped command tower forward of centre, hangar bays cut into both flanks
 * amidships, two big rectangular engine blocks on the
 * stern corners each carrying three round main thrusters, and rail-gun
 * turrets dotted along the deck. Gunmetal throughout.
 *
 * Axes: +Z forward, +Y up, +X port. Metres.
 */

const DECK = 3.95; // top of the mid-body sections (h 4.0 at n 5 puts the flat deck at ~0.97 h)

export const PROMETHEUS: ShipDef = {
  name: "Prometheus",
  ringVerts: 16,
  // tail → nose; superellipse n ~6.5 gives a broad flat deck and belly with two chamfer facets per side;
  // the bow keeps its beam while h collapses, which is the chisel
  hull: [
    { z: -28.0, w: 13.4, h: 3.4, n: 6.5 },
    { z: -22.0, w: 13.9, h: 3.9, n: 6.5 },
    { z: -14.0, w: 14.0, h: 4.0, n: 6.5 },
    { z: -6.0, w: 14.0, h: 4.0, n: 6.5 },
    { z: 2.0, w: 14.0, h: 4.0, n: 6.5 },
    { z: 10.0, w: 13.8, h: 3.8, n: 6.0 },
    { z: 17.0, w: 13.2, h: 3.2, n: 5.5 },
    { z: 23.0, w: 12.6, h: 2.3, n: 5.0 },
    { z: 27.0, w: 11.2, h: 1.4, n: 4.5 },
    { z: 30.0, w: 8.6, h: 0.45, n: 4.0 },
  ],
  panels: [
    // hangar bays: both beam facets cut deep over two section bands amidships, each side
    { ring: 2, seg: 0, depth: 1.5, mirror: true },
    { ring: 3, seg: 0, depth: 1.5, mirror: true },
    { ring: 2, seg: 15, depth: 1.5, mirror: true },
    { ring: 3, seg: 15, depth: 1.5, mirror: true },
    // deck plating breaks
    { ring: 1, seg: 4, depth: 0.1 },
    { ring: 5, seg: 3, depth: 0.1, mirror: true },
    { ring: 6, seg: 4, depth: 0.1 },
    { ring: 7, seg: 3, depth: 0.08, mirror: true },
    // belly plating
    { ring: 2, seg: 12, depth: 0.12 },
    { ring: 4, seg: 12, depth: 0.12 },
    { ring: 6, seg: 12, depth: 0.1 },
    { ring: 3, seg: 13, depth: 0.1, mirror: true },
  ],
  // darker upper chamfer along the whole flank: the faceted side read
  stripes: [{ seg: 2, ringFrom: 0, ringTo: 9, mirror: true }],
  wings: [],
  fins: [
    // sensor mast on the bridge
    { root: [0, DECK + 7.4, 6.0], height: 3.0, rootChord: 1.4, tipChord: 0.5, sweep: 0.5, angle: Math.PI / 2, thickness: 0.3 },
  ],
  engines: [
    // three round mains per stern block, exhausts a metre proud of the block face
    { pos: [11.9, 0.3, -31.5], radius: 1.15, length: 4.0 },
    { pos: [9.2, 0.3, -31.5], radius: 1.15, length: 4.0 },
    { pos: [6.5, 0.3, -31.5], radius: 1.15, length: 4.0 },
    { pos: [-11.9, 0.3, -31.5], radius: 1.15, length: 4.0 },
    { pos: [-9.2, 0.3, -31.5], radius: 1.15, length: 4.0 },
    { pos: [-6.5, 0.3, -31.5], radius: 1.15, length: 4.0 },
  ],
  pods: [
    // stern engine blocks: rectangular housings on the aft corners, six metres proud of the hull
    { pos: [9.2, 0.3, -26.0], radius: 3.6, length: 12.0, aspect: [1.15, 0.9], boxiness: 8, segments: 16 },
    { pos: [-9.2, 0.3, -26.0], radius: 3.6, length: 12.0, aspect: [1.15, 0.9], boxiness: 8, segments: 16 },
    // command tower: superstructure block forward of centre, bridge block stepped on top
    { pos: [0, DECK + 2.2, 8.0], radius: 3.4, length: 15.0, aspect: [1.5, 0.85], boxiness: 8, segments: 16 },
    { pos: [0, DECK + 6.2, 9.0], radius: 1.9, length: 8.0, aspect: [1.5, 0.7], boxiness: 7, segments: 16 },
    // rail-gun turrets: dome bodies on the deck with a barrel each; two forward, two aft, two belly
    { pos: [5.5, DECK + 0.2, 20.0], radius: 1.0, length: 2.2, aspect: [1.1, 0.65], boxiness: 5 },
    { pos: [-5.5, DECK + 0.2, 20.0], radius: 1.0, length: 2.2, aspect: [1.1, 0.65], boxiness: 5 },
    { pos: [5.5, DECK + 0.55, 22.4], radius: 0.18, length: 3.4 },
    { pos: [-5.5, DECK + 0.55, 22.4], radius: 0.18, length: 3.4 },
    { pos: [7.5, DECK + 0.4, -16.0], radius: 1.0, length: 2.2, aspect: [1.1, 0.65], boxiness: 5 },
    { pos: [-7.5, DECK + 0.4, -16.0], radius: 1.0, length: 2.2, aspect: [1.1, 0.65], boxiness: 5 },
    { pos: [7.5, DECK + 0.75, -13.6], radius: 0.18, length: 3.4 },
    { pos: [-7.5, DECK + 0.75, -13.6], radius: 0.18, length: 3.4 },
    { pos: [4.0, -DECK - 0.4, 12.0], radius: 1.0, length: 2.2, aspect: [1.1, 0.65], boxiness: 5 },
    { pos: [-4.0, -DECK - 0.4, 12.0], radius: 1.0, length: 2.2, aspect: [1.1, 0.65], boxiness: 5 },
  ],
  hatches: [
    // flight-deck elevator and aft deck hatch
    { pos: [0, DECK + 0.02, -8.0], size: [6.0, 8.0], face: "top" },
    { pos: [0, DECK + 0.02, -21.0], size: [4.0, 3.0], face: "top" },
    // hangar bay doors set into the recess floor on each flank
    { pos: [12.6, 0.0, -10.0], size: [3.0, 5.0], face: "port", mirror: true },
    { pos: [12.6, 0.0, -2.0], size: [3.0, 5.0], face: "port", mirror: true },
    // belly docking hatch
    { pos: [0, -DECK - 0.02, 0.0], size: [4.0, 5.0], face: "bottom" },
  ],
  decals: [
    // bridge window band across the tower front and along its flanks
    { kind: "stripe", pos: [0, DECK + 6.5, 13.05], rot: [0, 0, 0], size: [4.6, 0.5], slot: "dark" },
    { kind: "stripe", pos: [2.88, DECK + 6.5, 9.5], rot: [0, Math.PI / 2, 0], size: [5.6, 0.5], mirror: true, slot: "dark" },
    // flight-deck centreline markings
    { kind: "stripe", pos: [0, DECK + 0.03, 18.0], rot: [-Math.PI / 2, 0, 0], size: [1.0, 8.0], slot: "accent" },
  ],
  palette: PALETTES.tauri,
};
