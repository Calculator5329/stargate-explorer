import * as THREE from 'three';
import { buildSuperweapon } from '@/ships/episode-alien';
import { toonMaterial, glowMaterial } from '@/render/toon';
import { outlineShell } from '@/render/outline';
import type { Solid, SolidHit } from '@/world/solid';
import { MeshSolid } from '@/world/mesh-solid';

type XYZ = readonly [number, number, number];
/** A flyable interpretation of Fallen's surface attack, not a canonical deck plan.
 * Fixed world coordinates: approach from +Z toward the cooling bulkhead at z730.
 * Collision is built from the visible solid triangles, including the original ship.
 */
export class StrikeDeck implements Solid {
  readonly group = new THREE.Group();
  readonly approach = new THREE.Vector3(0, 250, 1800);
  readonly ventPos = new THREE.Vector3(0, 250, 754);
  readonly jumpExit = new THREE.Vector3(0, 250, 1220);
  readonly escapePos = new THREE.Vector3(0, 500, 2200);
  readonly turretPositions: readonly THREE.Vector3[];

  private readonly solid: MeshSolid;

  constructor() {
    this.group.name = 'Fallen — flyable mothership deck';
    const ship = buildSuperweapon();
    ship.scale.setScalar(24);
    this.group.add(ship);

    const hull = toonMaterial(0x464b43);
    const bronze = toonMaterial(0x716039);
    const gold = toonMaterial(0xa68b50);
    const black = toonMaterial(0x202c2e);
    const inset = toonMaterial(0x4c6260);
    const amber = glowMaterial(0xffd183, 1.6);
    const cyan = glowMaterial(0x77d9d1, 1.8);
    const batches = new Map<THREE.Material, number[]>();
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
      let positions = batches.get(material);
      if (!positions) batches.set(material, positions = []);
      const soup = geometry.index ? geometry.toNonIndexed() : geometry;
      const attr = soup.getAttribute('position');
      for (let i = 0; i < attr.count; i++) positions.push(attr.getX(i), attr.getY(i), attr.getZ(i));
      if (soup !== geometry) soup.dispose();
      geometry.dispose();
    };
    const block = (size: XYZ, position: XYZ, material: THREE.Material, yaw = 0) => {
      const geometry = new THREE.BoxGeometry(...size);
      geometry.rotateY(yaw);
      geometry.translate(...position);
      add(geometry, material);
    };

    // Broad recessed floor: 280m clear width, y180 surface, z730–1340.
    // Solid sides reach down into the source hull rather than hovering above it.
    block([280, 80, 610], [0, 140, 1035], hull);
    block([260, 2, 606], [0, 181, 1035], black);
    for (const side of [-1, 1]) {
      block([60, 200, 610], [side * 170, 190, 1035], bronze);
      block([66, 12, 616], [side * 170, 296, 1035], gold);
      block([12, 3, 590], [side * 126, 184, 1037], inset);
      block([3, 1, 580], [side * 124, 186, 1038], amber);
      // Side buttresses, with dark armored slots on their inside faces.
      for (let i = 0; i < 7; i++) {
        const z = 770 + i * 85;
        block([46, 164, 26], [side * 215, 178, z], hull);
        block([12, 14, 38], [side * 226, 267, z], gold);
        block([1.2, 40, 38], [side * 139.2, 236, z], black);
        block([1.4, 4, 24], [side * 138.8, 222, z], amber);
      }
      // Entrance shoulders bracket the route without crossing its flight volume.
      block([142, 92, 100], [side * 210, 133, 1300], hull);
      block([120, 10, 92], [side * 217, 183, 1300], bronze);
      block([12, 76, 18], [side * 160, 340, 1316], gold);
      block([4, 18, 4], [side * 160, 384, 1316], amber);
    }
    // Large separated floor panels and inlaid chevrons give speed and altitude cues.
    for (let i = 0; i < 10; i++) {
      const z = 766 + i * 57;
      block([232, 1.5, 43], [0, 183, z], i % 2 ? hull : inset);
      for (const side of [-1, 1]) block([28, 0.8, 4], [side * 22, 184.3, z + 12], gold, side * -0.4);
    }
    // The target is created by the mission at ventPos, 24m ahead of this wall.
    // Its unobstructed opening faces +Z; no grille or collider is put in front of it.
    block([280, 160, 40], [0, 250, 710], hull);
    block([146, 106, 3], [0, 252, 731.5], black);
    for (const side of [-1, 1]) {
      block([24, 144, 24], [side * 92, 252, 729], bronze);
      block([4, 104, 3], [side * 93, 252, 742], cyan);
      for (let i = 0; i < 5; i++) block([30, 5, 4], [side * 122, 210 + i * 18, 732.5], gold);
    }
    block([204, 20, 24], [0, 334, 723], gold);
    block([118, 6, 5], [0, 303, 736], cyan);
    block([118, 6, 5], [0, 202, 736], cyan);

    const pads: XYZ[] = [[-286, 224, 1140], [286, 224, 1140], [-360, 248, 925],
      [360, 248, 925], [-550, 236, 690], [550, 236, 690]];
    this.turretPositions = pads.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    for (const [x, y, z] of pads) {
      const top = y - 16;
      block([160, top - 70, 160], [x, (top + 70) / 2, z], hull);
      block([168, 10, 168], [x, top - 5, z], bronze);
      const mount = new THREE.CylinderGeometry(49, 57, 8, 8);
      mount.translate(x, top + 4, z);
      add(mount, gold);
      for (const side of [-1, 1]) {
        block([5, 2, 98], [x + side * 69, top + 1.5, z], black);
        block([3, 1, 62], [x + side * 69, top + 3, z], amber);
      }
    }
    // Machine rooms and radiator banks occupy the flanks, leaving the route readable.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const x = side * (440 + i * 90), z = 350 - i * 85;
        block([68, 122, 210], [x, 131, z], hull);
        block([74, 14, 216], [x, 199, z], bronze);
        for (let j = 0; j < 6; j++) block([58, 5, 15], [x, 208.5, z - 80 + j * 31], black);
        block([4, 3, 174], [x + side * 22, 214, z], cyan);
      }
      block([74, 380, 68], [side * 430, 260, 455], bronze);
      block([82, 20, 76], [side * 430, 460, 455], gold);
      block([36, 6, 36], [side * 430, 473, 455], cyan);
    }
    for (const [material, positions] of batches) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      const solid = material instanceof THREE.MeshToonMaterial;
      mesh.castShadow = solid;
      mesh.receiveShadow = solid;
      this.group.add(mesh);
      if (solid) this.group.add(outlineShell(positions));
    }
    this.solid = new MeshSolid(this.group);
  }

  sweep(a: THREE.Vector3, b: THREE.Vector3, radius: number, hit: SolidHit): boolean {
    return this.solid.sweep(a, b, radius, hit);
  }
}
