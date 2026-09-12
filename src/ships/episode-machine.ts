import * as THREE from 'three';
import { mulberry32 } from '@/core/random';
import { toonMaterial } from '@/render/toon';

// Procedural Replicator-inspired studies, not exact episode/VFX reconstructions.
// Story reference: https://www.rdanderson.com/stargate/lexicon/entries/replicator.htm
// https://www.rdanderson.com/stargate/episodes/episodes/08-01neworder.htm
// +Z forward, +Y up, +X port; these gallery dimensions are not canonical metres.
type Cell = readonly [number, number, number];
const adjacent: readonly Cell[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** Union overlapping block volumes, then omit cubes completely hidden inside them. */
function blockVolume(step: number) {
  const cells = new Map<string, Cell>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  function ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) {
    for (let x = Math.floor((cx - rx) / step); x <= Math.ceil((cx + rx) / step); x++) {
      for (let y = Math.floor((cy - ry) / step); y <= Math.ceil((cy + ry) / step); y++) {
        for (let z = Math.floor((cz - rz) / step); z <= Math.ceil((cz + rz) / step); z++) {
          const distance = ((x * step - cx) / rx) ** 2 + ((y * step - cy) / ry) ** 2 + ((z * step - cz) / rz) ** 2;
          if (distance <= 1) cells.set(key(x, y, z), [x, y, z]);
        }
      }
    }
  }
  function finish(name: string, seed: number): THREE.Group {
    const random = mulberry32(seed);
    const surface = [...cells.values()].filter(([x, y, z]) =>
      adjacent.some(([dx, dy, dz]) => !cells.has(key(x + dx, y + dy, z + dz))),
    );
    const group = new THREE.Group();
    group.name = name;
    const geometry = new THREE.BoxGeometry(step * 0.96, step * 0.96, step * 0.96);
    const material = toonMaterial(0xffffff);
    const blocks = new THREE.InstancedMesh(geometry, material, surface.length);
    blocks.name = 'Machine block surface';
    blocks.castShadow = true;
    blocks.receiveShadow = true;
    // The small gaps are dark engraved joints; no huge glow or engine flame.
    const jointGeometry = new THREE.BoxGeometry(step * 0.995, step * 0.995, step * 0.995);
    const joints = new THREE.InstancedMesh(jointGeometry,
      new THREE.MeshBasicMaterial({ color: 0x172029, side: THREE.BackSide }), surface.length);
    joints.name = 'Inverted block silhouettes';
    const frame = new THREE.Object3D();
    const palette = [0x46535c, 0x61717b, 0x76828a, 0x899298, 0x526773].map(color => new THREE.Color(color));
    const seams: { position: Cell; axis: number }[] = [];
    for (let i = 0; i < surface.length; i++) {
      const [x, y, z] = surface[i]!;
      frame.position.set(x * step, y * step, z * step);
      frame.rotation.set(0, 0, 0);
      frame.scale.setScalar(1);
      frame.updateMatrix();
      blocks.setMatrixAt(i, frame.matrix);
      blocks.setColorAt(i, palette[Math.floor(random() * palette.length)]!);
      // Geometric back-face shells keep outlines narrow relative to tiny blocks.
      joints.setMatrixAt(i, frame.matrix);
      if (random() < 0.055) {
        const axis = adjacent.findIndex(([dx, dy, dz]) => !cells.has(key(x + dx, y + dy, z + dz)));
        seams.push({ position: [x * step, y * step, z * step], axis });
      }
    }
    blocks.instanceMatrix.needsUpdate = true;
    if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;
    joints.instanceMatrix.needsUpdate = true;
    blocks.computeBoundingBox(); blocks.computeBoundingSphere();
    joints.computeBoundingBox(); joints.computeBoundingSphere();
    group.add(joints, blocks);
    if (seams.length) {
      const seamGeometry = new THREE.BoxGeometry(step * 0.58, step * 0.075, step * 0.035);
      const seamMaterial = toonMaterial(0x658896, { emissive: 0x334f60, emissiveIntensity: 0.2 });
      const lights = new THREE.InstancedMesh(seamGeometry, seamMaterial, seams.length);
      lights.name = 'Sparse cool machine seams';
      for (let i = 0; i < seams.length; i++) {
        const { position, axis } = seams[i]!;
        const [dx, dy, dz] = adjacent[axis]!;
        frame.position.set(position[0] + dx * step * 0.485, position[1] + dy * step * 0.485, position[2] + dz * step * 0.485);
        frame.scale.setScalar(1);
        frame.rotation.set(dy ? Math.PI / 2 : 0, dx ? Math.PI / 2 : 0, 0);
        frame.updateMatrix();
        lights.setMatrixAt(i, frame.matrix);
      }
      lights.instanceMatrix.needsUpdate = true;
      lights.computeBoundingBox(); lights.computeBoundingSphere();
      group.add(lights);
    }
    group.userData.referenceStatus = 'Stylized Replicator-inspired study; exact episode geometry unverified';
    return group;
  }
  return { ellipsoid, finish };
}

/** Dense machine core with uneven radial protrusions; roughly 100 gallery units. */
export function buildMachineShip(): THREE.Group {
  const model = blockVolume(1.55);
  const random = mulberry32(0x7265706c);
  model.ellipsoid(0, 0, 0, 16, 12, 19);
  model.ellipsoid(-8, 4, 3, 11, 10, 12);
  model.ellipsoid(7, -3, -6, 11, 10, 14);
  // Unequal tapered arms preserve a machine starburst, avoiding a regular starfish.
  for (let arm = 0; arm < 11; arm++) {
    const angle = arm / 11 * Math.PI * 2 + (random() - 0.5) * 0.2;
    const length = 31 + random() * 21;
    const rise = (random() - 0.5) * 0.72;
    const direction = new THREE.Vector3(Math.sin(angle), rise, Math.cos(angle)).normalize();
    const bend = (random() - 0.5) * 5;
    for (let r = 10; r < length; r += 1.2) {
      const t = (r - 10) / (length - 10);
      const width = 4.7 * (1 - t) ** 1.15 + 0.85;
      model.ellipsoid(direction.x * r + Math.cos(angle) * bend * t * t,
        direction.y * r, direction.z * r - Math.sin(angle) * bend * t * t,
        width, width * 0.82, width);
    }
  }
  // Short upper/lower spikes keep side inspection from becoming a flat disk.
  for (const [x, y, z] of [[5, 1, -4], [-4, -1, 7], [-7, 1, 5]] as const) {
    for (let r = 6; r < 24; r += 1.2) {
      const width = 4.2 * (1 - r / 26) + 0.8;
      model.ellipsoid(x + r * 0.18, y * r, z - r * 0.12, width, width, width);
    }
  }
  return model.finish('Replicator-inspired machine spacecraft', 0x6d616368);
}

/** Low-profile infestation centered around the origin; parent places it on a hull. */
export function buildInfestation(): THREE.Group {
  const model = blockVolume(0.65);
  const random = mulberry32(0x70617463);
  for (let patch = 0; patch < 7; patch++) {
    const x = (random() - 0.5) * 13, z = (random() - 0.5) * 16;
    const radius = 1.8 + random() * 2.3;
    model.ellipsoid(x, 0, z, radius, 0.8 + random() * 1.1, radius * 0.8);
    for (let segment = 1; segment < 8; segment++) {
      model.ellipsoid(x + segment * 0.62, 0, z + segment * 0.45, 0.65, 0.65, 0.65);
    }
  }
  return model.finish('Replicator-inspired surface infestation', 0x6a6f696e);
}
