import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const DERELICT_KINDS = 4;

type Triple = [number, number, number];

/** Build-time wreck solids: +Z forward, +Y up, +X port; final radius is 1 m. */
export function derelictGeometry(kind: number, rnd: () => number): THREE.BufferGeometry {
  if (!Number.isInteger(kind) || kind < 0 || kind >= DERELICT_KINDS) {
    throw new RangeError(`Unknown derelict kind: ${kind}`);
  }

  const parts: THREE.BufferGeometry[] = [];
  const vary = (amount: number): number => (rnd() * 2 - 1) * amount;
  const add = (source: THREE.BufferGeometry, at: Triple, rotation: Triple = [0, 0, 0], tint = 0.72 + rnd() * 0.28): void => {
    const part = source.index === null ? source : source.toNonIndexed();
    if (part !== source) source.dispose();
    // All merge inputs have the same layout; normals are rebuilt flat after merging.
    for (const name of Object.keys(part.attributes)) {
      if (name !== "position") part.deleteAttribute(name);
    }
    part.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
    part.translate(...at);
    const colors = new Float32Array(part.getAttribute("position").count * 3);
    colors.fill(tint);
    part.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts.push(part);
  };
  const box = (size: Triple, at: Triple, rotation: Triple = [0, 0, 0], tint?: number): void => {
    add(new THREE.BoxGeometry(...size), at, rotation, tint);
  };

  switch (kind) {
    case 0: {
      // Broad spine, three solid transverse frames, and overlapping armour seams.
      const length = 3.5 + vary(0.12);
      box([1.35, 0.82, length], [0, 0, 0]);
      for (const z of [-1.08, -0.05, 0.98]) {
        box([1.65, 1.06, 0.18], [0, 0, z + vary(0.04)]);
        box([1.18, 0.12, 0.65], [0, 0.43, z + 0.12]);
      }
      // Dark severed core and bright exposed ribs make the break legible at distance.
      box([1.16, 0.67, 0.07], [0, 0, -length / 2 - 0.01], [0, 0, 0], 0.24);
      for (const x of [-0.48, 0.48]) {
        box([0.08, 0.78, 0.12], [x, 0, -length / 2 - 0.055], [0, 0, 0], 1.35);
      }
      // The aft break retains a solid core beneath bent plate ends.
      for (const x of [-0.46, 0, 0.46]) {
        box([0.43, 0.18, 0.62], [x, 0.33, -length / 2 + 0.08],
          [0.22 + vary(0.08), vary(0.12), vary(0.1)]);
        const tooth = new THREE.TetrahedronGeometry(0.32);
        tooth.scale(0.8, 0.8, 1.35);
        add(tooth, [x, -0.12, -length / 2], [vary(0.3), vary(0.3), 0]);
      }
      box([0.38, 0.3, 0.48], [0.34, 0.54, 0.48]);
      box([0.28, 0.24, 0.4], [-0.38, 0.51, 1.2]);
      box([0.95, 0.16, 1.3], [0, -0.45, 0.25]);
      break;
    }
    case 1: {
      // Box-derived trapezoid: broad root at -X, swept, narrow tip at +X.
      const slab = new THREE.BoxGeometry(2.75, 0.3, 1.95);
      const position = slab.getAttribute("position");
      const taper = 0.55 + vary(0.035);
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const t = (x + 1.375) / 2.75;
        position.setZ(i, position.getZ(i) * (1 - t * taper) - t * 0.28);
      }
      add(slab, [0, 0, 0]);
      box([0.65, 0.62, 1.7], [-1.08, -0.05, 0]);
      // Surviving identification stripe and charred wing root.
      box([0.17, 0.025, 1.25], [-0.42, 0.165, -0.04], [0, 0, 0], 1.6);
      box([0.035, 0.48, 1.43], [-1.42, -0.05, 0], [0, 0, 0], 0.28);
      // Short torn spars overlap the slab for most of their length.
      for (const z of [-0.47, 0.43]) {
        box([1.25, 0.16, 0.18], [0.98, 0.04, z - 0.2],
          [vary(0.1), (z < 0 ? 0.17 : -0.2) + vary(0.05), vary(0.09)]);
      }
      for (const x of [-0.8, -0.12, 0.56]) {
        box([0.18, 0.39, 1.3 - (x + 0.8) * 0.4], [x, 0, -0.12]);
        box([0.52, 0.1, 0.65], [x, 0.17, -0.18], [0, vary(0.07), 0]);
      }
      box([0.42, 0.16, 0.58], [-1.1, 0.31, 0.4], [0.12, 0.08, 0]);
      box([0.52, 0.14, 0.45], [-0.5, -0.2, 0.5], [0.14, -0.1, 0]);
      box([0.52, 0.12, 0.32], [0.96, 0.16, -0.35], [0.1, 0.2, 0.13]);
      break;
    }
    case 2: {
      box([2.4, 0.48, 1.95], [0, -0.38, 0]);
      for (const x of [-0.76, 0, 0.76]) {
        const length = 1.85 + vary(0.12);
        add(new THREE.CylinderGeometry(0.43, 0.46, length, 7),
          [x, 0.12, 0.05 + vary(0.06)], [Math.PI / 2, 0, 0]);
        box([0.54, 0.2, 0.75], [x, 0.48, 0.25], [0, 0, vary(0.06)]);
      }
      // Closed dark throats inside faceted nozzle collars; no collision-sized cavities.
      for (const x of [-0.76, 0, 0.76]) {
        add(new THREE.CylinderGeometry(0.47, 0.39, 0.24, 8), [x, 0.12, -1.0], [Math.PI / 2, 0, 0], 1.25);
        add(new THREE.CylinderGeometry(0.31, 0.31, 0.025, 8), [x, 0.12, -1.13], [Math.PI / 2, 0, 0], 0.16);
      }
      add(new THREE.CylinderGeometry(0.12, 0.15, 0.92, 7),
        [1.13, -0.28, -0.43], [0.36, 0, -0.35 + vary(0.08)]);
      break;
    }
    case 3: {
      box([1.9, 0.68, 1.65], [0, -0.18, -0.12]);
      box([1.4, 0.7, 1.25], [0.06, 0.35, -0.08], [0.05, 0.12, -0.06]);
      box([1.2, 0.25, 1.05], [0.03, 0.73, -0.15], [0.08, -0.08, vary(0.06)]);
      for (const side of [-1, 1]) {
        box([0.38, 0.72, 1.24], [side * 0.79, 0.05, -0.18],
          [vary(0.1), side * 0.14, side * 0.2]);
        box([0.62, 0.24, 0.72], [side * 0.53, -0.52, -0.22],
          [0.12, side * 0.16, side * 0.1]);
        // Stubby barrels stay close to the armour mass, directed forward.
        add(new THREE.CylinderGeometry(0.13, 0.18, 0.95 + vary(0.06), 7),
          [side * 0.32, 0.35, 0.94], [Math.PI / 2, side * 0.035, 0]);
      }
      box([1.05, 0.32, 0.38], [0, 0.28, 0.56], [0.06, 0, 0]);
      box([0.95, 0.4, 0.32], [-0.12, 0.08, -0.88], [0.15, 0.16, -0.12]);
      break;
    }
  }

  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (geometry === null) throw new Error("Could not merge derelict geometry");

  // Three's bounding sphere uses the AABB midpoint. Centre before measuring radius.
  geometry.center();
  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere!.radius;
  geometry.scale(1 / radius, 1 / radius, 1 / radius);
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== "position" && name !== "color") geometry.deleteAttribute(name);
  }
  geometry.clearGroups();
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
