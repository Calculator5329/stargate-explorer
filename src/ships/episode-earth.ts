import type { ArmorDef, EngineDef, HatchDef, ShipDef } from '@/ships/defs';

/** Convex clipped deck plate; all parts stay in the existing material batches. */
function deck(x: number, z: number, width: number, length: number, y: number,
  thickness: number, slot: ArmorDef['slot'] = 'body', topScale?: number): ArmorDef {
  const a = width / 2, b = length / 2, c = Math.min(width, length) * 0.12;
  return {
    points: [[x - a + c, z - b], [x + a - c, z - b], [x + a, z - b + c],
      [x + a, z + b - c], [x + a - c, z + b], [x - a + c, z + b],
      [x - a, z + b - c], [x - a, z - b + c]],
    y, thickness, slot, ...(topScale === undefined ? {} : { topScale }),
  };
}

const carrierArmor: ArmorDef[] = [
  // Broad aft flight deck and the much narrower, long forward body are separate masses.
  deck(0, -19, 29, 34, 1.8, 1.3),
  deck(0, -19, 25, 30, 3.1, 0.8, 'accent'),
  deck(0, 15, 17, 39, 1.5, 0.8),
  deck(0, 17, 13, 31, 2.3, 0.4, 'accent'),
  deck(0, 17, 10.5, 28, 2.7, 0.3),
  // Flat wedge cheeks leave a central inset prow ahead of the raised forward deck.
  { points: [[3.2, 24], [8.4, 24], [8.4, 33], [5.8, 39], [3.2, 39]],
    y: -0.7, thickness: 2.4, slot: 'body', mirror: true, topScale: 0.91 },
  deck(0, 35, 5.6, 7, -0.5, 1.1, 'dark'),
  // Low stern island, deliberately a broad tiered bridge rather than a tall tower.
  deck(0, -22, 14, 17, 3.9, 1.1),
  deck(0, -23, 10.5, 12, 5, 1.15, 'accent'),
  deck(0, -24, 8.2, 8.8, 6.15, 0.9),
  deck(0, -22.6, 8.6, 4.6, 7.05, 0.35, 'canopy'),
  deck(0, -22.6, 9.0, 5.0, 7.4, 0.4),
  deck(0, -30, 3, 3, 5, 1, 'dark'),
  // Stern cross-member connects all engine clusters to the main structure.
  deck(0, -35.7, 42, 4, -2.1, 3.1, 'accent'),
];
const carrierHatches: HatchDef[] = [];
const carrierPods: EngineDef[] = [];
for (const side of [-1, 1]) {
  const x = side * 18.7;
  carrierPods.push({ pos: [x, -0.4, -18], radius: 4.8, length: 33,
    aspect: [1, 0.56], boxiness: 8, segments: 16, intake: true });
  carrierArmor.push(deck(x, -18, 9.6, 30, 2.0, 0.55));
  // Structural arms tying each long hangar to the carrier deck.
  for (const z of [-29, -15, -5]) carrierArmor.push(deck(side * 13.2, z, 7, 3, 0, 1.8, 'accent'));
  for (const z of [-30, -23, -16, -9]) {
    carrierArmor.push(deck(x, z, 7.6, 5.1, 2.55, 0.24, 'accent'));
    carrierHatches.push({ pos: [side * 23.5, -0.3, z], size: [1.0, 4.2], face: side > 0 ? 'port' : 'starboard' });
    carrierHatches.push({ pos: [x, 2.81, z], size: [4.7, 0.45], face: 'top' });
  }
  // Foredeck missile cells and long exposed machinery strips.
  for (const z of [3, 9, 15, 21, 27]) {
    carrierArmor.push(deck(side * 3, z, 3.8, 3.8, 3.0, 0.25, 'accent'));
    carrierHatches.push({ pos: [side * 3, 3.27, z], size: [2.6, 2.4], face: 'top' });
    carrierHatches.push({ pos: [side * 8.4, 0.1, z], size: [0.65, 3.4], face: side > 0 ? 'port' : 'starboard' });
  }
  for (const z of [-29, -22, -15, -8]) {
    carrierArmor.push(deck(side * 10.4, z, 3.2, 4.4, 3.9, 0.35));
    carrierHatches.push({ pos: [side * 10.4, 4.27, z], size: [1.9, 2.7], face: 'top' });
  }
  // Twin-barrel rail mounts: compact rectangular housings keep the scale legible.
  for (const z of [17, -10, -29]) {
    const gunX = side * (z > 0 ? 6.5 : 7.5);
    const gunY = z > 0 ? 2.7 : 4;
    carrierArmor.push(deck(gunX, z, 2.0, 2.9, gunY, 0.7, 'dark'));
    for (const dx of [-0.38, 0.38]) carrierPods.push({ pos: [gunX + dx, gunY + 0.65, z + 1.7], radius: 0.14, length: 3.1, boxiness: 5 });
  }
}

/**
 * BC-304 at arena scale (~80 m). Silhouette reference: RJB/Mallacore orthographic
 * sheet https://socel.net/@RJB_Mallacore/110089828342836702 (visually inspected).
 * Long narrow foredeck, broad aft deck, recessed forward-facing flank hangars,
 * shallow stern bridge and four blue engine bays distinguish it from the X-303.
 */
export const CARRIER_SHIP: ShipDef = {
  name: 'BC-304',
  ringVerts: 16,
  hull: [
    { z: -37, w: 12, h: 1.8, n: 6 },
    { z: -32, w: 14.5, h: 2.5, n: 7 },
    { z: -8, w: 14.5, h: 2.2, n: 7 },
    { z: -1, w: 8.5, h: 1.7, n: 6 },
    { z: 22, w: 8.5, h: 1.6, n: 6 },
    { z: 33, w: 6.4, h: 1.25, n: 6 },
    { z: 38, w: 3.1, h: 0.7, n: 5 },
  ],
  panels: [{ ring: 1, seg: 0, depth: 0.3, mirror: true }, { ring: 3, seg: 0, depth: 0.2, mirror: true }],
  stripes: [], wings: [],
  fins: [
    { root: [0, 7.8, -24], height: 3.0, rootChord: 0.35, tipChord: 0.08, sweep: 0, angle: Math.PI / 2, thickness: 0.1 },
    { root: [2.5, 6.1, -19], height: 3.7, rootChord: 0.3, tipChord: 0.08, sweep: 0, angle: Math.PI / 2, thickness: 0.1 },
    { root: [-2.5, 6.1, -19], height: 3.7, rootChord: 0.3, tipChord: 0.08, sweep: 0, angle: Math.PI / 2, thickness: 0.1 },
  ],
  engines: [-18.7, -5.1, 5.1, 18.7].map((x): EngineDef => ({
    pos: [x, -0.6, -36.7], radius: 1.8, length: 4.2, aspect: [1.45, 0.95], boxiness: 7, segments: 16,
  })),
  plumeScale: 3.8,
  pods: carrierPods, armor: carrierArmor, hatches: carrierHatches, decals: [],
  canopyGlow: 0.06,
  palette: { body: 0x70777b, accent: 0x4c565d, dark: 0x20292e, glow: 0x47b7ff, canopy: 0x254553 },
};

/**
 * Compact cargo/scout craft (~15 m). GateWorld screen reference, visually inspected:
 * https://www.gateworld.net/wiki/Tel%27tak . A blunt swept roof over a flat belly,
 * flared aft shoulders and quiet copper detailing; no invented weapons or glyphs.
 */
export const CARGO_SHIP: ShipDef = {
  name: "Tel'tak",
  ringVerts: 12,
  hull: [
    { z: -6.6, w: 3.2, h: 0.35, yOff: -0.6, n: 5 },
    { z: -4.6, w: 4.3, h: 0.65, yOff: -0.3, n: 5 },
    { z: 0, w: 3.9, h: 0.65, yOff: -0.3, n: 5 },
    { z: 5.4, w: 2.65, h: 0.45, yOff: -0.5, n: 5 },
    { z: 7.1, w: 1.4, h: 0.25, yOff: -0.7, n: 4 },
  ],
  panels: [], stripes: [], wings: [], fins: [],
  armor: [
    // The broad swept roof is a tapered solid, with a continuous flat cargo floor.
    { points: [[-3.8, -5.7], [3.8, -5.7], [4.1, -1.7], [2.9, 5.4], [1.4, 7.1], [-1.4, 7.1], [-2.9, 5.4], [-4.1, -1.7]],
      y: -0.3, thickness: 3.9, slot: 'body', topScale: 0.15 },
    // Long shoulder panels flare outward behind the nose, ending in swept heels.
    { points: [[2.6, 3.6], [3.8, 2.3], [6.1, -3.5], [5.6, -6.3], [3.5, -6.1]],
      y: -0.65, thickness: 1.35, slot: 'accent', mirror: true, topScale: 0.79 },
    { points: [[3.65, 0.6], [4.55, -0.6], [5.4, -3.6], [5.1, -5.3], [3.85, -4.5]],
      y: 0.7, thickness: 0.22, slot: 'body', mirror: true, topScale: 0.89 },
    // Roof details must follow the slope: the review caught a floating ridge
    // and buried glass. These shallow ribs sit above the forward roof plane.
    deck(0, 5.8, 1.55, 0.10, 0.72, 0.07, 'dark'),
    deck(0, 4.95, 1.1, 0.10, 1.35, 0.07, 'dark'),
    deck(0, 1.0, 0.45, 1.25, 3.6, 0.05, 'accent'),
    deck(0, -1.5, 4.6, 5.1, -1.02, 0.18, 'dark'),
  ],
  canopy: {
    sections: [
      { z: 4.5, w: 0.5, h: 0.1, yOff: 1.83, n: 4 },
      { z: 3.5, w: 0.86, h: 0.1, yOff: 2.62, n: 4 },
      { z: 2.5, w: 0.57, h: 0.1, yOff: 3.4, n: 4 },
    ],
    frameBands: [0, 2],
  },
  engines: [
    { pos: [4.8, -0.1, -5.4], radius: 0.6, length: 2.4, aspect: [1.3, 0.65], boxiness: 4, segments: 12 },
    { pos: [-4.8, -0.1, -5.4], radius: 0.6, length: 2.4, aspect: [1.3, 0.65], boxiness: 4, segments: 12 },
  ],
  plumeScale: 0.8,
  hatches: [{ pos: [0, -1.07, -1.3], size: [2.4, 3.1], face: 'bottom' }],
  decals: [], canopyGlow: 0.015,
  palette: { body: 0x8e8776, accent: 0x837963, dark: 0x302e2a, glow: 0xf2b859, canopy: 0x252b2d },
};

const raceArmor: ArmorDef[] = [
  deck(0, 1.5, 6.2, 17.5, 1.05, 0.6),
  deck(0, -7.3, 6.5, 4.3, 0.65, 0.4),
  // Exposed machinery along the rear spine between the flight deck and exhausts.
  deck(0, -5.4, 3.4, 6, 1.7, 0.22, 'dark'),
  deck(0, 3.5, 2.7, 5.3, 1.65, 0.48, 'accent'),
  deck(0, 5.1, 2.9, 1.1, 2.13, 0.35, 'canopy'),
  deck(0, 5.0, 3.15, 1.3, 2.48, 0.15),
  deck(0, -9.7, 8.7, 3, -0.9, 1.7, 'accent'),
];
const raceHatches: HatchDef[] = [];
for (const z of [-7.8, -6.5, -5.2, -3.9]) {
  raceArmor.push(deck(0, z, 3.65, 0.23, 1.95, 0.38, 'accent'));
}
for (const side of [-1, 1]) {
  // Broad shoulder panels and pale exposed actuators reaching the tip plates.
  raceArmor.push({ points: [[side * 2.8, -3.8], [side * 11.8, 0.9], [side * 12.6, 2.9], [side * 3, 6.9]],
    y: 0.15, thickness: 0.24, slot: 'body', topScale: 0.97 });
  raceArmor.push({ points: [[side * 3.1, 3.45], [side * 12.75, 2.2], [side * 12.75, 2.65], [side * 3.1, 4.1]],
    y: 0.55, thickness: 0.22, slot: 'accent', topScale: 0.97 });
  raceArmor.push(deck(side * 3.4, 3.65, 1.1, 1.75, 0.5, 0.6, 'accent'));
  for (const z of [7.6, 3, -1.6]) {
    raceHatches.push({ pos: [side * 2, 1.69, z], size: [0.9, 1.3], face: 'top' });
  }
}

/**
 * Seberus, the transport refitted for "Space Race", at a chosen ~25 m game scale.
 * Visually checked against James Robbins' production drawing (March 7, 2003):
 * https://josephmallozzi.com/2023/03/20/march-20-2023-stargate-sg-1-concept-art-and-episodic-insights/
 * and the episode image at https://www.rdanderson.com/stargate/lexicon/entries/seberus.htm .
 * The screen image confirms the green broad-wing hull and three blue stern
 * exhausts. Surface parts are stylized; this is not an exact production mesh.
 */
export const RACE_TRANSPORT_SHIP: ShipDef = {
  name: 'Seberus', ringVerts: 16,
  hull: [
    { z: -10.2, w: 3.8, h: 0.9, n: 5 },
    { z: -7.4, w: 3.2, h: 1.1, n: 5 },
    { z: 0, w: 3.25, h: 1.5, n: 5 },
    { z: 7.3, w: 3.45, h: 1.55, n: 5 },
    { z: 10.3, w: 2.9, h: 1.2, n: 4 },
    { z: 11.7, w: 1.9, h: 0.7, n: 3.5 },
  ],
  panels: [{ ring: 2, seg: 0, depth: 0.17, mirror: true }, { ring: 3, seg: 0, depth: 0.17, mirror: true }],
  stripes: [],
  wings: [{ root: [2.8, 0.05, 1.5], span: 10.3, rootChord: 12,
    tipChord: 2.7, sweep: 4, dihedral: 0.025, thickness: 0.48 }],
  fins: [
    // Tall end plates on the narrow wing tips are the reference's strongest side cue.
    { root: [13.1, 0.35, 2.1], height: 2.2, rootChord: 3.6, tipChord: 2.7, sweep: 0.25, angle: Math.PI / 2 - 0.22, thickness: 0.15 },
    { root: [-13.1, 0.35, 2.1], height: 2.2, rootChord: 3.6, tipChord: 2.7, sweep: 0.25, angle: Math.PI / 2 + 0.22, thickness: 0.15 },
  ],
  engines: [-2.8, 0, 2.8].map((x): EngineDef => ({
    pos: [x, 0.0, -10.9], radius: 1.28, length: 2.8, aspect: [1, 0.92], boxiness: 3.2, segments: 16,
  })),
  pods: [
    { pos: [2.8, -0.6, 7.7], radius: 0.44, length: 2.1, boxiness: 3.5, intake: true },
    { pos: [-2.8, -0.6, 7.7], radius: 0.44, length: 2.1, boxiness: 3.5, intake: true },
  ],
  plumeScale: 1.7, armor: raceArmor, hatches: raceHatches, decals: [], canopyGlow: 0.015,
  palette: { body: 0x626e59, accent: 0x9aa698, dark: 0x252d29, glow: 0x7ecbff, canopy: 0x2e4349 },
};
