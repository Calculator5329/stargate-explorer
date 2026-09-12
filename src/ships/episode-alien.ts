import * as THREE from 'three';
import { toonMaterial, glowMaterial } from '@/render/toon';
import { outlineShell } from '@/render/outline';

// Stylized SG-1 approximations for the episode gallery, normalized to arena units.
// +Z forward, +Y up, +X port. These dimensions are not canonical ship scales.
type Point = readonly [number, number];
type Position = readonly [number, number, number];
type Part = { material: THREE.Material; positions: number[]; outlined: boolean };

/** Merge each finish into one draw, retaining flat faces and a single welded shell. */
function assembly(name: string) {
  const group = new THREE.Group();
  group.name = name;
  const parts = new Map<THREE.Material, Part>();
  function add(geometry: THREE.BufferGeometry, material: THREE.Material, outlined = true) {
    const soup = geometry.index ? geometry.toNonIndexed() : geometry;
    let part = parts.get(material);
    if (!part) {
      part = { material, positions: [], outlined };
      parts.set(material, part);
    }
    const positions = soup.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      part.positions.push(positions.getX(i), positions.getY(i), positions.getZ(i));
    }
    if (soup !== geometry) soup.dispose();
    geometry.dispose();
  }
  function finish() {
    for (const { material, positions, outlined } of parts.values()) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = outlined;
      mesh.receiveShadow = outlined;
      group.add(mesh);
      if (outlined) group.add(outlineShell(positions));
    }
    return group;
  }
  return { add, finish };
}

function plate(points: readonly Point[], y: number, depth: number, bevel = 0) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, bevelEnabled: bevel > 0, bevelSegments: 1,
    bevelSize: bevel, bevelThickness: bevel, curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
}

function box(size: Position, position: Position, yaw = 0) {
  const geometry = new THREE.BoxGeometry(...size);
  geometry.rotateY(yaw);
  geometry.translate(...position);
  return geometry;
}

function cylinder(top: number, bottom: number, height: number, position: Position, segments = 24) {
  const geometry = new THREE.CylinderGeometry(top, bottom, height, segments, 1);
  geometry.translate(...position);
  return geometry;
}

function ovalRing(rx: number, rz: number, tube: number, y: number, z = 0) {
  const geometry = new THREE.TorusGeometry(1, tube / rx, 6, 48);
  geometry.rotateX(Math.PI / 2);
  geometry.scale(rx, rx, rz);
  geometry.translate(0, y, z);
  return geometry;
}

/** Ori warship: open horizontal oval, deep rounded bow, forked tapering stern.
 * Screen reference: https://www.gateworld.net/wiki/images/d/d7/Oriwarship.jpg
 * https://rdanderson.com/stargate/lexicon/entries/oriwarship.htm
 */
export function buildAncientWarship(): THREE.Group {
  const model = assembly('Ori warship — stylized episode concept');
  const hull = toonMaterial(0xb7b8a7);
  const ivory = toonMaterial(0xd4d2be);
  const trim = toonMaterial(0x878a7e);
  const recess = toonMaterial(0x303d40);
  const windows = glowMaterial(0xffd4a0, 1.15);
  const core = glowMaterial(0xbedfff, 2.6);
  // An almost-complete annular loft leaves a genuine opening between the rear legs.
  const sections: Position[][] = [];
  for (let i = 0; i <= 48; i++) {
    const angle = -Math.PI + 0.17 + i / 48 * (Math.PI * 2 - 0.34);
    const c = Math.cos(angle), s = Math.sin(angle);
    const forward = (c + 1) / 2;
    const top = 3 + 10 * forward;
    const bottom = -5 - 11 * forward;
    sections.push([
      [s * 28, bottom + 3, c * 46],
      [s * 30, bottom + 7, c * 48],
      [s * 29, top - 2, c * 47],
      [s * 27, top, c * 45],
      [s * 20, top - 1, c * 35 + 1],
      [s * 18, bottom + 6, c * 32 + 1],
      [s * 21, bottom + 2, c * 37],
    ]);
  }
  const shellPositions: number[] = [];
  const triangle = (a: Position, b: Position, c: Position) => shellPositions.push(...a, ...b, ...c);
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i]!, b = sections[i + 1]!;
    for (let j = 0; j < a.length; j++) {
      const k = (j + 1) % a.length;
      triangle(a[j]!, b[j]!, a[k]!);
      triangle(b[j]!, b[k]!, a[k]!);
    }
  }
  for (const end of [0, sections.length - 1]) {
    const ring = sections[end]!;
    for (let j = 1; j < ring.length - 1; j++) {
      if (end === 0) triangle(ring[0]!, ring[j]!, ring[j + 1]!);
      else triangle(ring[0]!, ring[j + 1]!, ring[j]!);
    }
  }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(shellPositions, 3));
  model.add(shell, hull);
  // Horizontal shoulder plating emphasizes the oval without filling its center.
  for (let i = 0; i < 24; i++) {
    const angle = -2.75 + i / 23 * 5.5;
    const s = Math.sin(angle), c = Math.cos(angle), top = 3 + 5 * (c + 1);
    const x = s * 28.7, z = c * 46.6;
    model.add(box([0.65, 1.3, 3.3], [x, top - 5, z], angle), recess);
    model.add(box([0.72, 0.22, 2.4], [x * 1.004, top - 4.8, z * 1.004], angle), windows, false);
    if (i % 2 === 0) model.add(box([1.0, 1.2, 4.0], [s * 24.5, top - 0.3, c * 40.5], angle), ivory);
  }
  // Generator in the well: a luminous ring and small core, never a solid glowing hull.
  model.add(ovalRing(10.5, 12, 2.1, 1.8, 3), trim);
  model.add(ovalRing(9.5, 10.8, 0.65, 3.6, 3), core, false);
  model.add(new THREE.SphereGeometry(4, 16, 8).scale(1, 0.55, 1).translate(0, 1.5, 3), core, false);
  for (const side of [-1, 1]) {
    model.add(plate([[side * 6, -44], [side * 15, -36], [side * 18, -13], [side * 10, -22]], -8, 5, 0.5), ivory);
    const thruster = new THREE.CylinderGeometry(3.2, 3.5, 13, 12);
    thruster.rotateX(Math.PI / 2);
    thruster.translate(side * 10, -6, -40);
    model.add(thruster, trim);
    const exhaust = new THREE.CircleGeometry(2.6, 16);
    exhaust.rotateY(Math.PI);
    exhaust.translate(side * 10, -6, -46.6);
    model.add(exhaust, core, false);
  }
  const emitter = new THREE.CylinderGeometry(2.4, 3.3, 1.5, 16);
  emitter.rotateX(Math.PI / 2);
  emitter.translate(0, -5, 47.6);
  model.add(emitter, trim);
  const lens = new THREE.CircleGeometry(1.5, 16).translate(0, -5, 48.4);
  model.add(lens, core, false);
  return model.finish();
}

/** O'Neill-class Asgard hull: broad faceted forebody, narrow neck, aft crescent,
 * paired dorsal/ventral fins. Reference ortho is fan reconstruction, not a scale source:
 * https://i.pinimg.com/originals/67/32/35/6732354e7a48f6024663ff931adf11a4.jpg
 */
export function buildHammerCruiser(): THREE.Group {
  const model = assembly('Asgard O’Neill-class — stylized episode concept');
  const hull = toonMaterial(0x9eafb9);
  const silver = toonMaterial(0xc0c9cc);
  const panel = toonMaterial(0x687985);
  const dark = toonMaterial(0x263842);
  const blue = glowMaterial(0x8cadff, 1.75);
  const bow: Point[] = [[-4, 50], [-20, 31], [-19, 20], [-10, 15], [10, 15], [19, 20], [20, 31], [4, 50]];
  model.add(plate(bow, -2, 3, 1.0), hull);
  model.add(plate([[-3, 47], [-13, 30], [-10, 21], [10, 21], [13, 30], [3, 47]], 1.1, 0.5), silver);
  model.add(plate([[-8, 20], [-8, -13], [-12, -27], [12, -27], [8, -13], [8, 20]], -1.6, 3.4, 0.4), hull);
  model.add(plate([[-3, 22], [-4, -20], [4, -20], [3, 22]], 2.4, 0.7), dark);
  // Two sweeping wings form the wide aft hammer. A few long planes carry the silhouette.
  for (const side of [-1, 1]) {
    const mirror = (points: readonly Point[]) => points.map(([x, z]): Point => [side * x, z]);
    model.add(plate(mirror([[8, -10], [20, -15], [33, -11], [45, -20], [49, -28], [36, -38], [19, -44], [8, -39]]), -2.5, 3.5, 0.5), hull);
    model.add(plate(mirror([[17, -19], [30, -16], [43, -23], [35, -31], [18, -35]]), 1.15, 0.7), silver);
    model.add(plate(mirror([[9, -13], [17, -18], [17, -32], [9, -37]]), 1.6, 0.6), panel);
    // Fins have swept, tapered side profiles; extrusion is across the ship.
    const fin = plate([[-4, -31], [20, -23], [23, -15], [0, -13]], -1.2, 2.4);
    fin.rotateZ(Math.PI / 2);
    fin.translate(side * 26, 1.2, 0);
    model.add(fin, silver);
    const lowerFin = plate([[0, -31], [12, -33], [12, -20], [0, -14]], -0.9, 1.8);
    lowerFin.rotateZ(-Math.PI / 2);
    lowerFin.translate(side * 26, -2.5, 0);
    model.add(lowerFin, panel);
    model.add(box([0.5, 0.6, 22], [side * 37, 1.2, -10]), panel);
    model.add(box([0.7, 0.6, 8], [side * 15, -1.5, 25], side * -0.4), blue, false);
    model.add(box([15, 0.45, 0.5], [side * 32, -1.0, -35], side * 0.43), blue, false);
  }
  model.add(new THREE.SphereGeometry(1, 20, 8).scale(13, 4.7, 14).translate(0, 1, -28), hull);
  model.add(plate([[-5, -14], [-7, -31], [-3, -38], [3, -38], [7, -31], [5, -14]], 4.6, 0.4), silver);
  for (let i = 0; i < 11; i++) {
    model.add(box([7.5, 0.5, 0.55], [0, 3.25, 15 - i * 2.5]), silver);
  }
  for (const side of [-1, 1]) {
    model.add(plate([[side * 8, 28], [side * 10, 26], [side * 13, 32], [side * 9, 36]], 1.9, 0.15), dark);
    model.add(box([6, 0.6, 0.6], [side * 6, 0, -41.8]), blue, false);
  }
  return model.finish();
}

/** Daniel Jackson / Asgard science vessel: paired hulls, separated bows, aft arches.
 * Screen still: https://www.gateworld.net/wiki/images/f/f1/Asgardsciencevessel.jpg
 * New Order provenance: https://www.rdanderson.com/stargate/lexicon/entries/jacksonthedaniel.htm
 * A stylized reconstruction from the screen silhouette, not canonical dimensions.
 */
export function buildScienceCruiser(): THREE.Group {
  const model = assembly('Daniel Jackson — Asgard science vessel study');
  const hull = toonMaterial(0x849496);
  const silver = toonMaterial(0xb1bdbb);
  const panel = toonMaterial(0x596b70);
  const dark = toonMaterial(0x293a40);
  const blue = glowMaterial(0x87bded, 1.4);
  const lobe: Point[] = [[8, 43], [18, 49], [30, 38], [25, 25], [28, 8], [36, -10],
    [36, -27], [31, -39], [22, -47], [12, -46], [7, -35], [8, -16], [10, 0], [7, 22]];
  for (const side of [-1, 1]) {
    const mirror = (points: readonly Point[]) => points.map(([x, z]): Point => [side * x, z]);
    model.add(plate(mirror(lobe), -4, 6, 1.3), hull);
    model.add(plate(mirror([[10, 38], [17, 46], [27, 37], [22, 28], [20, 18], [10, 22]]), 2.3, 1.1, 0.6), silver);
    model.add(plate(mirror([[13, 17], [22, 18], [25, 2], [32, -13], [31, -29], [25, -41], [14, -41], [12, -28], [14, -10]]), 2.4, 0.7), panel);
    // Smooth outer shoulders continue around the aft lobes, not O'Neill's separate wings.
    model.add(plate(mirror([[27, 5], [34, -11], [34, -28], [28, -39], [20, -44], [16, -42], [25, -37], [30, -26], [30, -12], [24, 3]]), 3.1, 0.8), silver);
    // Distinct rectangular paired dorsal fins and shorter ventral counterparts.
    model.add(box([3.2, 23, 10.5], [side * 23, 14, -27]), hull);
    model.add(box([3.5, 1.2, 11], [side * 23, 25.2, -27]), silver);
    model.add(box([3.2, 14, 10.5], [side * 23, -10.5, -27]), panel);
    model.add(box([3.5, 1, 11], [side * 23, -17.2, -27]), silver);
    // Recessed lateral banks and restrained instrument housings.
    for (let i = 0; i < 3; i++) {
      model.add(box([0.35, 0.5, 17], [side * 36.1, -0.3 - i * 1.2, -19]), dark);
    }
    model.add(cylinder(2.7, 3.8, 1.7, [side * 18, 4, 5], 12), hull);
    model.add(cylinder(2.3, 2.7, 0.35, [side * 18, 5.05, 5], 12), dark);
    model.add(box([2.2, 0.7, 6], [side * 11, 3.4, 29]), panel);
    model.add(box([0.55, 0.7, 1.2], [side * 10.7, 4.0, 31.8]), blue, false);
    for (const z of [-13, -5, 14]) {
      model.add(box([4, 0.65, 1.3], [side * 19, 3.6, z]), silver);
    }
    model.add(box([6, 1.0, 0.45], [side * 19, -1, -47.8]), dark);
    model.add(box([4, 0.35, 0.55], [side * 19, -1, -48]), blue, false);
  }
  // Upper and lower curved bridges preserve a visible longitudinal gap between hulls.
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-21, 3);
    shape.quadraticCurveTo(-18, 21, 0, 21);
    shape.quadraticCurveTo(18, 21, 21, 3);
    shape.lineTo(16.5, 3);
    shape.quadraticCurveTo(14, 14.5, 0, 14.5);
    shape.quadraticCurveTo(-14, 14.5, -16.5, 3);
    shape.closePath();
    const arch = new THREE.ExtrudeGeometry(shape, { depth: 7.5, bevelEnabled: false, curveSegments: 10, steps: 1 });
    if (side < 0) arch.rotateZ(Math.PI);
    arch.translate(0, side > 0 ? 0 : -2, -28);
    model.add(arch, silver);
  }
  // The central aft machinery sits within the bridge; the forebody stays open.
  model.add(box([12, 9, 14], [0, 0, -24]), panel);
  model.add(cylinder(5.5, 6.3, 1.6, [0, 5.1, -24], 16), hull);
  model.add(box([8, 1, 0.7], [0, -1.5, -31.5]), dark);
  return model.finish();
}

/** Fallen / Full Circle mothership: flat circular hull, no standard pyramid.
 * Screen reference: https://gateworld.net/wiki/images/c/cb/Anubissmothership.jpg
 * Episode distinction: https://www.stargate-sg1-solutions.com/wiki/Ha%27tak
 * The approach channel is a gameplay study, not a surveyed screen-accurate deck plan.
 */
export function buildSuperweapon(): THREE.Group {
  const model = assembly('Anubis superweapon mothership — Fallen study');
  const hull = toonMaterial(0x393d39);
  const bronze = toonMaterial(0x655535);
  const gold = toonMaterial(0x887045);
  const dark = toonMaterial(0x282d2e);
  const lights = glowMaterial(0xf4d098, 1.25);
  const disk: Point[] = [];
  for (let i = 0; i < 64; i++) {
    const angle = i / 64 * Math.PI * 2;
    const radius = 42 + 2 * Math.cos(angle * 8);
    disk.push([Math.sin(angle) * radius, Math.cos(angle) * radius]);
  }
  model.add(plate(disk, -4.5, 5, 1), hull);
  model.add(cylinder(33, 39, 4, [0, 2, 0], 48), bronze);
  model.add(cylinder(25, 29, 3.3, [0, 5.6, 0], 32), hull);
  model.add(cylinder(20, 23, 3, [0, 8.6, 0], 32), bronze);
  model.add(cylinder(14.5, 19, 3, [0, 11.3, 0], 16), hull);
  model.add(cylinder(10.5, 10.5, 0.6, [0, 13.1, 0], 24), dark);
  model.add(ovalRing(12.5, 12.5, 1.6, 13.2), bronze);
  model.add(ovalRing(7.5, 7.5, 0.6, 13.5), gold);
  // Central machinery stays low and circular: this ship lacks the Lost City pyramid.
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    model.add(box([2.4, 2.3, 5], [Math.sin(a) * 15, 12.8, Math.cos(a) * 15], a), bronze);
  }
  // Legible surface approach ending at a recessed cooling-port target.
  model.add(box([6.2, 0.35, 19], [0, 4.5, 40]), dark);
  for (const side of [-1, 1]) {
    model.add(box([1.2, 2.8, 19], [side * 4.4, 5.5, 40]), bronze);
    model.add(box([0.4, 0.4, 17], [side * 4.4, 7.1, 40]), gold);
  }
  model.add(box([5, 4, 1], [0, 5.8, 30]), dark);
  for (let i = 0; i < 5; i++) {
    model.add(box([0.32, 3.2, 0.25], [-1.6 + i * 0.8, 5.8, 30.6]), gold);
  }
  model.add(cylinder(14, 7, 3, [0, -6, 0], 16), dark);
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    const radial = (x: number, z: number): Point => [x * Math.cos(angle) + z * Math.sin(angle), z * Math.cos(angle) - x * Math.sin(angle)];
    // Deep open docking recesses between long raised paired rails.
    model.add(plate([radial(-5, 22), radial(-7, 42), radial(-4, 51), radial(4, 51), radial(7, 42), radial(5, 22)], -2, 4, 0.3), bronze);
    model.add(box([6.5, 0.6, 17], [Math.sin(angle) * 42, 2.1, Math.cos(angle) * 42], angle), dark);
    for (const side of [-1, 1]) {
      const [x, z] = radial(side * 4.0, 44);
      model.add(box([1, 2, 17], [x, 2.5, z], angle), gold);
    }
    // Follow each deck's slope; a constant-height strip visibly floats above the rim.
    const deckProfile: Point[] = [[20, 10.15], [23, 7.2], [25, 7.3], [29, 4.05], [31, 4.05]];
    for (let j = 0; j < deckProfile.length - 1; j++) {
      const [r0, y0] = deckProfile[j]!, [r1, y1] = deckProfile[j + 1]!;
      const rib = new THREE.BoxGeometry(2.4, 0.7, Math.hypot(r1 - r0, y1 - y0));
      rib.rotateX(-Math.atan2(y1 - y0, r1 - r0));
      rib.translate(0, (y0 + y1) / 2, (r0 + r1) / 2);
      rib.rotateY(angle);
      model.add(rib, gold);
    }
    for (let j = 0; j < 4; j++) {
      const [x, z] = radial(-2.4 + j * 1.6, 49.5);
      model.add(box([0.65, 0.35, 0.6], [x, 2.5, z], angle), lights, false);
    }
  }
  // Recessed deck panels and sparse warm windows imply scale without tiny meshes.
  for (let i = 0; i < 32; i++) {
    const a = (i + 0.5) / 32 * Math.PI * 2;
    model.add(box([2.0, 0.35, 4.8], [Math.sin(a) * 33, 4.25, Math.cos(a) * 33], a), dark);
    model.add(box([1.1, 0.3, 0.5], [Math.sin(a) * 22.5, 8.1, Math.cos(a) * 22.5], a), lights, false);
  }
  return model.finish();
}

/** Lost City uses a pyramid-bearing System Lord flagship, unlike Fallen's disk.
 * https://www.stargate-sg1-solutions.com/wiki/Ha%27tak#System_Lord_Flagship
 * Independent procedural silhouette study; not an exact VFX asset reconstruction.
 */
export function buildFlagship(): THREE.Group {
  const model = assembly('Anubis flagship — Lost City pyramid study');
  const hull = toonMaterial(0x393d39);
  const bronze = toonMaterial(0x655535);
  const gold = toonMaterial(0x887045);
  const dark = toonMaterial(0x252c2b);
  const lights = glowMaterial(0xf4d098, 1.15);
  const rim: Point[] = [];
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2;
    const r = 40 + 5 * Math.cos(a * 3);
    rim.push([Math.sin(a) * r, Math.cos(a) * r]);
  }
  model.add(plate(rim, -4, 5, 0.7), hull);
  model.add(cylinder(32, 36, 3, [0, 2.4, 0], 24), bronze);
  model.add(cylinder(27, 30, 2, [0, 4.2, 0], 12), dark);
  const pyramid = new THREE.ConeGeometry(27, 35, 3, 1);
  pyramid.translate(0, 22.5, 0);
  model.add(pyramid, bronze);
  const crown = new THREE.ConeGeometry(4.3, 5.6, 3, 1);
  crown.translate(0, 37.5, 0);
  model.add(crown, gold);
  // Repeated triangular ribs follow the pyramid faces, making the architecture readable.
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    const radial = (x: number, z: number): Point => [x * Math.cos(a) + z * Math.sin(a), z * Math.cos(a) - x * Math.sin(a)];
    model.add(plate([radial(-5, 27), radial(-9, 39), radial(-5, 49), radial(5, 49), radial(9, 39), radial(5, 27)], -1, 3, 0.4), bronze);
    model.add(box([6, 0.6, 15], [Math.sin(a) * 39, 2.5, Math.cos(a) * 39], a), dark);
    model.add(box([5.2, 0.3, 0.45], [Math.sin(a) * 47, 2.9, Math.cos(a) * 47], a), lights, false);
    const start = new THREE.Vector3(Math.sin(a) * 26.4, 5.3, Math.cos(a) * 26.4);
    const end = new THREE.Vector3(Math.sin(a) * 1.9, 38, Math.cos(a) * 1.9);
    const rib = new THREE.CylinderGeometry(0.38, 0.7, start.distanceTo(end), 4);
    const direction = end.clone().sub(start).normalize();
    rib.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction));
    rib.translate(...start.add(end).multiplyScalar(0.5).toArray());
    model.add(rib, gold);
  }
  for (let i = 0; i < 24; i++) {
    const a = (i + 0.5) / 24 * Math.PI * 2;
    model.add(box([2.8, 0.4, 4.3], [Math.sin(a) * 33, 4.2, Math.cos(a) * 33], a), dark);
    const windowRadius = 40 + 5 * Math.cos(a * 3) + 0.6;
    model.add(box([1.5, 0.35, 0.5], [Math.sin(a) * windowRadius, 0, Math.cos(a) * windowRadius], a), lights, false);
  }
  return model.finish();
}
