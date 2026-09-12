import * as THREE from 'three';
import { mulberry32 } from '@/core/random';
import { toonMaterial } from '@/render/toon';
import type { Solid, SolidHit } from '@/world/solid';

const CELLS = 160;
const HALF = 8000;
const STEP = HALF * 2 / CELLS;
const FLOOR = -4000;
const EPS = 1e-8;

function smooth(a: number, b: number, v: number): number {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Finite, closed Antarctic heightfield. Meshes stay at identity: positions,
 * heights and sweep contacts are all in world metres. The outpost floor is
 * -180 m; outside the square heightAt returns -Infinity, never a clamped ledge.
 * Every rendered surface (including the outer ice walls) is also swept.
 */
export class PolarTerrain implements Solid {
  readonly group = new THREE.Group();
  private readonly heights = new Float32Array((CELLS + 1) ** 2);
  private readonly boundary: Float32Array;
  private readonly tri = new THREE.Triangle();
  private readonly normal = new THREE.Vector3();
  private readonly edge = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();
  private readonly closest = new THREE.Vector3();
  private readonly contact = new THREE.Vector3();
  private readonly delta = new THREE.Vector3();
  private readonly start = new THREE.Vector3();
  private readonly bestPoint = new THREE.Vector3();
  private readonly bestNormal = new THREE.Vector3();
  private readonly recoveryStart = new THREE.Vector3();
  private readonly recoveryEnd = new THREE.Vector3();
  private best = Infinity;
  private radius = 0;
  private minY = 0;
  private maxY = 0;

  constructor(seed = 0x504f4c41) {
    this.group.name = 'Antarctic ice shelf';
    const random = mulberry32(seed);
    const noiseGrid = Float32Array.from({ length: 128 * 128 }, () => random() * 2 - 1);
    const noise = (x: number, z: number, scale: number): number => {
      const u = x / scale + 64, v = z / scale + 64;
      const ix = Math.floor(u), iz = Math.floor(v);
      const fx = smooth(0, 1, u - ix), fz = smooth(0, 1, v - iz);
      const at = (dx: number, dz: number): number => noiseGrid[((iz + dz) & 127) * 128 + ((ix + dx) & 127)]!;
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(0, 0), at(1, 0), fx),
        THREE.MathUtils.lerp(at(0, 1), at(1, 1), fx), fz);
    };
    for (let iz = 0; iz <= CELLS; iz++) {
      for (let ix = 0; ix <= CELLS; ix++) {
        const x = ix * STEP - HALF, z = iz * STEP - HALF;
        const east = (x - 3200 - 430 * Math.sin(z / 1150)) / 850;
        const west = (x + 3450 - 550 * Math.sin(z / 1350)) / 1050;
        const north = (z - 3600 - 510 * Math.sin(x / 1300)) / 950;
        const peaks = 0.74 + 0.25 * noise(x, z, 600) + 0.19 * noise(x, z, 270);
        let h = -180 + 48 * noise(x, z, 730) + 22 * noise(x, z, 240) + 9 * noise(x, z, 110);
        h += peaks * (1900 * Math.exp(-east * east) + 1650 * Math.exp(-west * west) + 2050 * Math.exp(-north * north));
        // Low parallel pressure ridges bring the mountain system into the battlefield.
        h += 380 * Math.exp(-(((x - 1220 - 140 * Math.sin(z / 680)) / 360) ** 2) - ((z - 850) / 1800) ** 2);
        h += 230 * Math.exp(-(((x + 1420 - 210 * Math.sin(z / 850)) / 390) ** 2) - ((z + 500) / 2200) ** 2);
        // Meandering cuts expose blue ice; these are depressions in the same grid,
        // not dark decorations that a ship could pass through.
        const cut1 = (x + 710 - 120 * Math.sin(z / 390)) / 125;
        const cut2 = (x - 1770 - 170 * Math.sin(z / 510)) / 145;
        h -= 170 * Math.exp(-cut1 * cut1) * (1 - smooth(1600, 2600, Math.abs(z - 150)));
        h -= 225 * Math.exp(-cut2 * cut2) * (1 - smooth(2100, 3400, Math.abs(z)));
        // A wide, gently rolling southern approach ends at a truly flat landing pad.
        const approach = (1 - smooth(300, 650, Math.abs(x))) * (1 - smooth(1900, 2550, -z)) * (1 - smooth(0, 450, z));
        h = THREE.MathUtils.lerp(h, -180 + 7 * noise(x, z, 400), approach);
        h = THREE.MathUtils.lerp(-180, h, smooth(260, 650, Math.max(Math.abs(x), Math.abs(z))));
        this.heights[iz * (CELLS + 1) + ix] = h;
      }
    }

    const material = toonMaterial(0xffffff, { emissive: 0x11232e, emissiveIntensity: 0.22 });
    material.vertexColors = true;
    const sideTriangles: number[] = [];
    // Sixteen independently culled chunks, all sharing one material.
    for (let cz = 0; cz < 4; cz++) {
      for (let cx = 0; cx < 4; cx++) {
        const vertices: number[] = [], colors: number[] = [];
        const emit = (boundary = false): void => {
          const { a, b, c } = this.tri;
          this.tri.getNormal(this.normal);
          const height = (a.y + b.y + c.y) / 3;
          const x = (a.x + b.x + c.x) / 3, z = (a.z + b.z + c.z) / 3;
          const slope = 1 - Math.max(0, this.normal.y);
          const band = Math.sin(height / 27 + x / 430 + z / 800);
          const exposed = Math.min(1, slope * 2.8 + (height < -235 ? 0.32 : 0));
          const shade = 0.96 + 0.04 * noise(x, z, 210);
          const iceBand = exposed > 0.35 && band > 0.42 ? 0.78 : 1;
          const r = THREE.MathUtils.lerp(0.69, 0.23, exposed) * shade * iceBand;
          const g = THREE.MathUtils.lerp(0.81, 0.49, exposed) * shade * iceBand;
          const bColor = THREE.MathUtils.lerp(0.86, 0.63, exposed) * shade * iceBand;
          for (const v of [a, b, c]) {
            vertices.push(v.x, v.y, v.z);
            colors.push(r, g, bColor);
            if (boundary) sideTriangles.push(v.x, v.y, v.z);
          }
        };
        const wall = (ax: number, az: number, bx: number, bz: number): void => {
          const ay = this.heightAt(ax, az), by = this.heightAt(bx, bz);
          this.tri.a.set(ax, ay, az); this.tri.b.set(bx, FLOOR, bz); this.tri.c.set(bx, by, bz);
          emit(true);
          this.tri.b.set(ax, FLOOR, az); this.tri.c.set(bx, FLOOR, bz);
          emit(true);
        };
        for (let iz = cz * 40; iz < (cz + 1) * 40; iz++) {
          for (let ix = cx * 40; ix < (cx + 1) * 40; ix++) {
            this.cellTriangle(ix, iz, false); emit();
            this.cellTriangle(ix, iz, true); emit();
            const x = ix * STEP - HALF, z = iz * STEP - HALF;
            if (ix === 0) wall(x, z, x, z + STEP);
            if (ix === CELLS - 1) wall(x + STEP, z + STEP, x + STEP, z);
            if (iz === 0) wall(x + STEP, z, x, z);
            if (iz === CELLS - 1) wall(x, z + STEP, x + STEP, z + STEP);
          }
        }
        if (cx === 0 && cz === 0) {
          this.tri.a.set(-HALF, FLOOR, -HALF); this.tri.b.set(HALF, FLOOR, -HALF); this.tri.c.set(HALF, FLOOR, HALF); emit(true);
          this.tri.b.set(HALF, FLOOR, HALF); this.tri.c.set(-HALF, FLOOR, HALF); emit(true);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `Ice shelf ${cx},${cz}`;
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        this.group.add(mesh);
      }
    }
    this.boundary = new Float32Array(sideTriangles);
  }

  /** Exact barycentric height on the same diagonal and Float32 vertices as the mesh. */
  heightAt(x: number, z: number): number {
    if (x < -HALF || x > HALF || z < -HALF || z > HALF || !Number.isFinite(x + z)) return -Infinity;
    const gx = (x + HALF) / STEP, gz = (z + HALF) / STEP;
    const ix = Math.min(CELLS - 1, Math.floor(gx)), iz = Math.min(CELLS - 1, Math.floor(gz));
    const u = gx - ix, v = gz - iz, i = iz * (CELLS + 1) + ix;
    const h00 = this.heights[i]!, h10 = this.heights[i + 1]!;
    const h01 = this.heights[i + CELLS + 1]!, h11 = this.heights[i + CELLS + 2]!;
    return u + v <= 1 ? h00 + u * (h10 - h00) + v * (h01 - h00)
      : h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11);
  }

  private cellTriangle(ix: number, iz: number, upper: boolean): void {
    const x = ix * STEP - HALF, z = iz * STEP - HALF, i = iz * (CELLS + 1) + ix;
    if (!upper) {
      this.tri.a.set(x, this.heights[i]!, z);
      this.tri.b.set(x, this.heights[i + CELLS + 1]!, z + STEP);
      this.tri.c.set(x + STEP, this.heights[i + 1]!, z);
    } else {
      this.tri.a.set(x + STEP, this.heights[i + CELLS + 2]!, z + STEP);
      this.tri.b.set(x + STEP, this.heights[i + 1]!, z);
      this.tri.c.set(x, this.heights[i + CELLS + 1]!, z + STEP);
    }
  }

  /** Continuous sphere/triangle face, edge and vertex contacts: no distance stepping. */
  sweep(a: THREE.Vector3, b: THREE.Vector3, radius: number, hit: SolidHit): boolean {
    if (!(radius >= 0) || !Number.isFinite(radius + a.x + a.y + a.z + b.x + b.y + b.z)) return false;
    this.start.copy(a); this.delta.subVectors(b, a); this.radius = radius; this.best = Infinity;
    this.minY = Math.min(a.y, b.y) - radius; this.maxY = Math.max(a.y, b.y) + radius;
    const minX = Math.min(a.x, b.x) - radius, maxX = Math.max(a.x, b.x) + radius;
    const minZ = Math.min(a.z, b.z) - radius, maxZ = Math.max(a.z, b.z) + radius;
    if (maxX < -HALF || minX > HALF || maxZ < -HALF || minZ > HALF || this.maxY < FLOOR) return false;

    const floorHeight = this.heightAt(a.x, a.z);
    if (a.y <= floorHeight && a.y >= FLOOR) {
      return this.recover(a, radius, hit);
    }

    const x0 = Math.max(0, Math.floor((minX + HALF) / STEP));
    const x1 = Math.min(CELLS - 1, Math.floor((maxX + HALF) / STEP));
    const z0 = Math.max(0, Math.floor((minZ + HALF) / STEP));
    const z1 = Math.min(CELLS - 1, Math.floor((maxZ + HALF) / STEP));
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        this.cellTriangle(ix, iz, false); this.testTriangle();
        this.cellTriangle(ix, iz, true); this.testTriangle();
      }
    }
    if (minX <= -HALF || maxX >= HALF || minZ <= -HALF || maxZ >= HALF || this.minY <= FLOOR) {
      for (let i = 0; i < this.boundary.length; i += 9) {
        this.tri.a.fromArray(this.boundary, i); this.tri.b.fromArray(this.boundary, i + 3); this.tri.c.fromArray(this.boundary, i + 6);
        if (Math.max(this.tri.a.x, this.tri.b.x, this.tri.c.x) < minX || Math.min(this.tri.a.x, this.tri.b.x, this.tri.c.x) > maxX
          || Math.max(this.tri.a.z, this.tri.b.z, this.tri.c.z) < minZ || Math.min(this.tri.a.z, this.tri.b.z, this.tri.c.z) > maxZ) continue;
        this.testTriangle();
      }
    }
    if (this.best > 1) return false;
    if (this.best === 0 && floorHeight > -Infinity && a.y >= FLOOR) return this.recover(a, radius, hit);
    hit.fraction = this.best; hit.point.copy(this.bestPoint); hit.normal.copy(this.bestNormal);
    return true;
  }

  /** Start above every nearby vertex, then descend to the actual sphere contact.
   * This resolves penetration without snapping to a coarse cell's highest corner.
   * The recovery start is strictly outside, so this re-entry cannot recurse again.
   */
  private recover(a: THREE.Vector3, radius: number, hit: SolidHit): boolean {
    const x0 = Math.max(0, Math.floor((a.x - radius + HALF) / STEP));
    const x1 = Math.min(CELLS, Math.ceil((a.x + radius + HALF) / STEP));
    const z0 = Math.max(0, Math.floor((a.z - radius + HALF) / STEP));
    const z1 = Math.min(CELLS, Math.ceil((a.z + radius + HALF) / STEP));
    let safeY = a.y + radius + 1;
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      safeY = Math.max(safeY, this.heights[z * (CELLS + 1) + x]! + radius + 1);
    }
    this.recoveryEnd.copy(a);
    this.recoveryStart.set(a.x, safeY, a.z);
    const found = this.sweep(this.recoveryStart, this.recoveryEnd, radius, hit);
    if (found) hit.fraction = 0;
    return found;
  }

  private testTriangle(): void {
    const { a, b, c } = this.tri;
    if (Math.min(a.y, b.y, c.y) > this.maxY || Math.max(a.y, b.y, c.y) < this.minY) return;
    this.tri.getNormal(this.normal);
    this.tri.closestPointToPoint(this.start, this.closest);
    this.offset.subVectors(this.start, this.closest);
    const distanceSq = this.offset.lengthSq();
    if (distanceSq <= this.radius * this.radius + EPS) {
      if (this.best === 0) return;
      this.best = 0;
      if (distanceSq > EPS) this.bestNormal.copy(this.offset).normalize();
      else this.bestNormal.copy(this.normal);
      this.bestPoint.copy(this.closest).addScaledVector(this.bestNormal, this.radius + 0.001);
      return;
    }
    this.offset.subVectors(this.start, a);
    const distance = this.offset.dot(this.normal), velocity = this.delta.dot(this.normal);
    if (velocity < -EPS) {
      const t = (this.radius - distance) / velocity;
      if (t >= 0 && t <= 1 && t < this.best) {
        this.contact.copy(this.start).addScaledVector(this.delta, t).addScaledVector(this.normal, -this.radius);
        if (this.tri.containsPoint(this.contact)) this.record(t, this.normal);
      }
    }
    if (this.radius > 0) {
      this.testEdge(a, b); this.testEdge(b, c); this.testEdge(c, a);
      this.testVertex(a); this.testVertex(b); this.testVertex(c);
    }
  }

  private record(t: number, normal: THREE.Vector3): void {
    this.best = t; this.bestNormal.copy(normal);
    this.bestPoint.copy(this.start).addScaledVector(this.delta, t);
  }

  /** Moving point against the cylindrical part of a triangle edge's capsule. */
  private testEdge(a: THREE.Vector3, b: THREE.Vector3): void {
    this.edge.subVectors(b, a); this.offset.subVectors(this.start, a);
    const ee = this.edge.lengthSq(), ev = this.edge.dot(this.delta), eo = this.edge.dot(this.offset);
    const aa = this.delta.lengthSq() - ev * ev / ee;
    const bb = this.offset.dot(this.delta) - eo * ev / ee;
    const cc = this.offset.lengthSq() - eo * eo / ee - this.radius * this.radius;
    const discriminant = bb * bb - aa * cc;
    if (aa < EPS || discriminant < 0) return;
    const t = (-bb - Math.sqrt(discriminant)) / aa;
    const along = (eo + t * ev) / ee;
    if (t < 0 || t > 1 || t >= this.best || along < 0 || along > 1) return;
    this.contact.copy(a).addScaledVector(this.edge, along);
    this.offset.copy(this.start).addScaledVector(this.delta, t).sub(this.contact).normalize();
    this.record(t, this.offset);
  }

  private testVertex(vertex: THREE.Vector3): void {
    this.offset.subVectors(this.start, vertex);
    const aa = this.delta.lengthSq(), bb = this.offset.dot(this.delta);
    const cc = this.offset.lengthSq() - this.radius * this.radius;
    const discriminant = bb * bb - aa * cc;
    if (aa < EPS || discriminant < 0) return;
    const t = (-bb - Math.sqrt(discriminant)) / aa;
    if (t < 0 || t > 1 || t >= this.best) return;
    this.offset.copy(this.start).addScaledVector(this.delta, t).sub(vertex).normalize();
    this.record(t, this.offset);
  }
}
