import { selectArt } from '@/ships/art-version';
import { carrierRevision } from '@/ships/refinements';
import type { ArmorDef, EngineDef, FinDef, HatchDef, ShipDef } from "@/ships/defs";
import { PALETTES } from "@/ships/palettes";

/**
 * Player carrier, ~68 m long and ~30 m across the hangars: the show's deep-space
 * carrier at arena scale. Pass 6 (Ethan, 2026-09-06, four reference images,
 * described in docs/refs/prometheus-references-2026-09-06.md): a long flat
 * rectangular hull in one gunmetal grey; two big open hangar boxes riding the
 * bow flanks with their mouths facing forward; a low raised deck amidships
 * carrying a tall stepped command tower just aft of centre, antenna masts on
 * top; angular plating with dark greeble strips along every flank; and a wide
 * blocky engine wall across the stern with four rectangular exhausts.
 * Ship-local +Z forward, +Y up, +X port.
 */
const DECK = 3.5;

/** Clipped rectangular footprint; the builder bevels its upper perimeter. */
function plate(x: number, z: number, w: number, l: number, y: number, thickness: number, slot: ArmorDef["slot"] = "body", mirror = false): ArmorDef {
  const c = Math.min(w, l) * 0.14;
  return {
    points: [[x - w / 2 + c, z - l / 2], [x + w / 2 - c, z - l / 2],
      [x + w / 2, z - l / 2 + c], [x + w / 2, z + l / 2 - c],
      [x + w / 2 - c, z + l / 2], [x - w / 2 + c, z + l / 2],
      [x - w / 2, z + l / 2 - c], [x - w / 2, z - l / 2 + c]],
    y, thickness, slot, mirror,
  };
}

/** Thin dark strip on a flank or deck: the greebling the references are covered in. */
function strip(pos: [number, number, number], size: [number, number], face: HatchDef["face"], mirror = true): HatchDef {
  return { pos, size, face, mirror };
}

const HULL_W = 6.4; // half-beam of the central hull
const HANGAR_X = 10.2; // hangar box centreline
const HANGAR_R = 4.6; // hangar half-width (aspect makes it lower than wide)

// ── deck guns: four twin rail mounts on the raised deck, two ahead of the tower and two aft ──
const guns: EngineDef[] = [];
for (const side of [-1, 1]) {
  for (const z of [11, -16]) {
    const x = side * 3.6;
    guns.push({ pos: [x, DECK + 0.7, z], radius: 0.95, length: 2.2, aspect: [1, 0.6], boxiness: 6 });
    for (const dx of [-0.32, 0.32]) guns.push({ pos: [x + dx, DECK + 0.9, z + 1.9], radius: 0.14, length: 2.8 });
  }
}

// ── flank greebles: dark strips along the hull sides, the hangar outer walls and the deck edges ──
const strips: HatchDef[] = [];
for (const z of [-25, -19, -13, -7, -1]) strips.push(strip([HULL_W + 0.02, 0.9, z], [1.1, 4.2], "port"));
for (const z of [-24, -16, -8]) strips.push(strip([HULL_W + 0.02, -1.4, z], [0.6, 5.5], "port"));
for (const z of [6, 12, 18, 24]) strips.push(strip([HANGAR_X + HANGAR_R * 1.0 + 0.02, 1.6, z], [0.7, 4.0], "port"));
for (const z of [8, 16, 22]) strips.push(strip([HANGAR_X + HANGAR_R * 1.0 + 0.02, -1.3, z], [0.9, 4.6], "port"));
for (const z of [-26, -20, -14, -8, -2, 4]) strips.push(strip([HULL_W - 0.9, DECK + 0.02, z], [1.2, 3.6], "top"));
for (const z of [-3, 3, 9, 15, 21]) strips.push(strip([HANGAR_X - 0.6, HANGAR_R * 0.72 + 0.32, z], [3.2, 2.6], "top"));
for (const z of [-24, -14, -4, 8, 18]) strips.push(strip([2.2, -3.42, z], [2.4, 5.5], "bottom"));

// ── the tower: a stepped island just aft of centre, bridge on top, masts above it ──
const TZ = -4;
const tower: ArmorDef[] = [
  plate(0, TZ + 2, 9.4, 15, DECK, 1.3),
  plate(0, TZ + 1, 7.2, 11, DECK + 1.3, 1.6, "accent"),
  plate(0, TZ, 5.6, 8.2, DECK + 2.9, 1.7),
  plate(0, TZ + 0.5, 4.2, 6.2, DECK + 4.6, 1.5, "accent"),
  plate(0, TZ + 1.4, 5.2, 4.4, DECK + 6.1, 1.3),
  plate(0, TZ + 1.4, 5.5, 4.7, DECK + 7.4, 0.4, "canopy"),
  plate(0, TZ - 2.6, 2.2, 2.2, DECK + 6.1, 0.9, "accent"),
];
const masts: FinDef[] = [
  { root: [0, DECK + 7.8, TZ + 0.6], height: 5.2, rootChord: 0.5, tipChord: 0.12, sweep: 0.1, angle: Math.PI / 2, thickness: 0.16 },
  { root: [1.4, DECK + 7.8, TZ + 2.4], height: 3.0, rootChord: 0.4, tipChord: 0.1, sweep: 0.05, angle: Math.PI / 2, thickness: 0.14 },
  { root: [-1.4, DECK + 7.8, TZ + 2.4], height: 3.0, rootChord: 0.4, tipChord: 0.1, sweep: 0.05, angle: Math.PI / 2, thickness: 0.14 },
  { root: [0, DECK + 7.0, TZ - 2.6], height: 3.6, rootChord: 0.45, tipChord: 0.1, sweep: 0.05, angle: Math.PI / 2, thickness: 0.14 },
  // sensor vanes off the bridge sides
  { root: [2.7, DECK + 6.8, TZ + 1.4], height: 1.6, rootChord: 1.6, tipChord: 0.5, sweep: 0.4, angle: 0, thickness: 0.18 },
  { root: [-2.7, DECK + 6.8, TZ + 1.4], height: 1.6, rootChord: 1.6, tipChord: 0.5, sweep: 0.4, angle: Math.PI, thickness: 0.18 },
];

export const PROMETHEUS_ORIGINAL: ShipDef = {
  name: "Prometheus",
  ringVerts: 16,
  hull: [
    // one long box: flat top and bottom, near-vertical sides, a short blunt prow
    { z: -33, w: 5.2, h: 2.6, n: 7, yOff: -0.2 },
    { z: -31.5, w: HULL_W, h: 3.2, n: 7, yOff: 0 },
    { z: -20, w: HULL_W, h: 3.4, n: 7, yOff: 0 },
    { z: -6, w: HULL_W, h: 3.5, n: 7, yOff: 0 },
    { z: 10, w: HULL_W - 0.2, h: 3.4, n: 7, yOff: 0 },
    { z: 24, w: HULL_W - 0.8, h: 3.0, n: 6.5, yOff: 0 },
    { z: 31, w: 4.6, h: 2.3, n: 6, yOff: -0.1 },
    { z: 34.5, w: 3.0, h: 1.3, n: 5, yOff: -0.3 },
  ],
  panels: [
    // recessed bands on the flanks behind the hangars and a shallow keel channel
    { ring: 2, seg: 0, depth: 0.35, mirror: true },
    { ring: 3, seg: 0, depth: 0.35, mirror: true },
    { ring: 2, seg: 12, depth: 0.25 },
    { ring: 3, seg: 12, depth: 0.25 },
  ],
  stripes: [
    // darker chamfer bands along the upper and lower edges, the length of the hull
    { seg: 2, ringFrom: 1, ringTo: 6, mirror: true },
    { seg: 14, ringFrom: 1, ringTo: 6, mirror: true },
  ],
  wings: [],
  fins: masts,
  plumeScale: 3.5,
  engines: [
    // four rectangular exhausts through the stern wall
    { pos: [9.4, 0.0, -35.4], radius: 1.55, length: 3.6, aspect: [1.5, 1], boxiness: 7, segments: 16 },
    { pos: [3.4, 0.0, -35.4], radius: 1.55, length: 3.6, aspect: [1.5, 1], boxiness: 7, segments: 16 },
    { pos: [-3.4, 0.0, -35.4], radius: 1.55, length: 3.6, aspect: [1.5, 1], boxiness: 7, segments: 16 },
    { pos: [-9.4, 0.0, -35.4], radius: 1.55, length: 3.6, aspect: [1.5, 1], boxiness: 7, segments: 16 },
  ],
  pods: [
    // the two hangar boxes on the bow flanks, mouths open forward
    { pos: [HANGAR_X, 0.3, 14], radius: HANGAR_R, length: 24, aspect: [1, 0.72], boxiness: 8, segments: 16, intake: true },
    { pos: [-HANGAR_X, 0.3, 14], radius: HANGAR_R, length: 24, aspect: [1, 0.72], boxiness: 8, segments: 16, intake: true },
    // the stern engine wall: one wide block the full beam, the exhausts punch through it
    { pos: [0, 0, -31], radius: 3.4, length: 7, aspect: [3.75, 0.95], boxiness: 8, segments: 24 },
    // sponsons under the hangars, where they meet the hull
    { pos: [7.2, -2.2, 12], radius: 1.6, length: 20, aspect: [1.4, 0.7], boxiness: 7, segments: 12 },
    { pos: [-7.2, -2.2, 12], radius: 1.6, length: 20, aspect: [1.4, 0.7], boxiness: 7, segments: 12 },
    ...guns,
  ],
  armor: [
    // the raised deck: a long low plate over the middle of the hull, with a pale walkway down the spine
    plate(0, -6, 11.4, 46, DECK - 0.35, 0.55, "body"),
    plate(0, 18, 3.2, 12, DECK + 0.2, 0.22, "accent"),
    plate(0, -22, 3.2, 12, DECK + 0.2, 0.22, "accent"),
    // angular side plates on the hull flanks aft of the hangars
    plate(HULL_W - 0.6, -14, 1.2, 22, 1.4, 0.5, "accent", true),
    plate(HULL_W - 0.6, -14, 1.2, 22, -2.6, 0.5, "accent", true),
    // hangar roofs and forward lips
    plate(HANGAR_X, 13, 8.2, 22, HANGAR_R * 0.72 + 0.3, 0.3, "body", true),
    plate(HANGAR_X, 25.5, 9.6, 1.6, HANGAR_R * 0.72 + 0.3, 0.55, "accent", true),
    // prow plating
    plate(0, 28, 7.6, 6, 2.6, 0.5, "accent"),
    ...tower,
  ],
  hatches: [
    ...strips,
    // dark vents on the stern wall between the exhausts
    { pos: [6.4, 1.9, -34.52], size: [1.8, 0.7], face: "top", mirror: true },
  ],
  decals: [
    // hangar guidance lights just inside each mouth, and running lights along the deck edge
    { kind: "stripe", pos: [HANGAR_X, 0.3, 25.0], rot: [0, 0, 0], size: [7.0, 0.6], mirror: true, slot: "glow" },
    { kind: "stripe", pos: [0, DECK + 7.82, TZ + 1.4], rot: [-Math.PI / 2, 0, 0], size: [4.6, 0.5], slot: "glow" },
  ],
  // Local palette only: one gunmetal grey, a darker slate for the accent and a paler grey on the canopy slot.
  palette: { ...PALETTES.tauri, body: 0x7f8792, accent: 0x454d57, canopy: 0x9aa2ab },
};

export const PROMETHEUS_REVISED = carrierRevision(PROMETHEUS_ORIGINAL);
export const PROMETHEUS = selectArt(PROMETHEUS_ORIGINAL, PROMETHEUS_REVISED);
