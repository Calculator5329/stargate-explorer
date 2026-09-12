import * as THREE from 'three';
import type { Solid, SolidHit } from '@/world/solid';

interface Surface {
  triangle: THREE.Triangle;
  normal: THREE.Vector3;
  bounds: THREE.Box3;
  center: THREE.Vector3;
}
interface Branch {
  bounds: THREE.Box3;
  start: number;
  count: number;
  left: number;
  right: number;
}

/** Continuous sphere collision against static, rendered toon geometry.
 * Child transforms are baked in the supplied root's LOCAL coordinate frame.
 * Transform queries into that frame when moving/scaling the root after construction.
 * Outlines and emissive MeshBasicMaterial helpers have no physical volume.
 */
export class MeshSolid implements Solid {
  private readonly surfaces: Surface[] = [];
  private readonly tree: Branch[] = [];
  private readonly stack: number[] = [];
  private readonly delta = new THREE.Vector3();
  private readonly closest = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly edge = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();
  private readonly perpendicular = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private best = 1;
  private found = false;

  constructor(root: THREE.Object3D) {
    root.updateWorldMatrix(true, true);
    this.collectSurfaces(root);
    if (this.surfaces.length) this.buildTree(0, this.surfaces.length);
  }

  /** First continuous sphere contact with the actual deck, including edges and corners. */
  sweep(a: THREE.Vector3, b: THREE.Vector3, radius: number, hit: SolidHit): boolean {
    if (!this.tree.length) return false;
    this.delta.subVectors(b, a);
    this.best = 1;
    this.found = false;
    this.stack.length = 0;
    this.stack.push(0);
    const r = Math.max(0, radius);
    while (this.stack.length) {
      const node = this.tree[this.stack.pop()!]!;
      if (!this.crossesBox(a, node.bounds, r)) continue;
      if (node.count) {
        for (let i = node.start; i < node.start + node.count; i++) {
          const surface = this.surfaces[i]!;
          if (this.crossesBox(a, surface.bounds, r)) this.sweepTriangle(a, r, surface, hit);
        }
      } else {
        this.stack.push(node.left, node.right);
      }
    }
    return this.found;
  }

  private collectSurfaces(root: THREE.Object3D): void {
    const inverseRoot = root.matrixWorld.clone().invert();
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshToonMaterial)) return;
      const transform = new THREE.Matrix4().multiplyMatrices(inverseRoot, object.matrixWorld);
      const attr = object.geometry.getAttribute('position'), index = object.geometry.index;
      const count = index?.count ?? attr.count;
      for (let i = 0; i < count; i += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(attr, index ? index.getX(i) : i).applyMatrix4(transform);
        const b = new THREE.Vector3().fromBufferAttribute(attr, index ? index.getX(i + 1) : i + 1).applyMatrix4(transform);
        const c = new THREE.Vector3().fromBufferAttribute(attr, index ? index.getX(i + 2) : i + 2).applyMatrix4(transform);
        const triangle = new THREE.Triangle(a, b, c);
        if (triangle.getArea() < 1e-7) continue;
        const bounds = new THREE.Box3().setFromPoints([a, b, c]);
        this.surfaces.push({ triangle, normal: triangle.getNormal(new THREE.Vector3()), bounds,
          center: bounds.getCenter(new THREE.Vector3()) });
      }
    });
  }

  private buildTree(start: number, count: number): number {
    const bounds = new THREE.Box3();
    for (let i = start; i < start + count; i++) bounds.union(this.surfaces[i]!.bounds);
    const index = this.tree.length;
    const node: Branch = { bounds, start, count, left: -1, right: -1 };
    this.tree.push(node);
    if (count <= 12) return index;
    const size = bounds.getSize(new THREE.Vector3());
    const axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
    const sorted = this.surfaces.slice(start, start + count).sort((a, b) => a.center[axis] - b.center[axis]);
    for (let i = 0; i < count; i++) this.surfaces[start + i] = sorted[i]!;
    const half = Math.floor(count / 2);
    node.count = 0;
    node.left = this.buildTree(start, half);
    node.right = this.buildTree(start + half, count - half);
    return index;
  }

  private crossesBox(a: THREE.Vector3, box: THREE.Box3, radius: number): boolean {
    let near = 0, far = this.best;
    for (let axis = 0; axis < 3; axis++) {
      const start = a.getComponent(axis), direction = this.delta.getComponent(axis);
      const min = box.min.getComponent(axis) - radius, max = box.max.getComponent(axis) + radius;
      if (Math.abs(direction) < 1e-10) {
        if (start < min || start > max) return false;
      } else {
        const x = (min - start) / direction, y = (max - start) / direction;
        near = Math.max(near, Math.min(x, y));
        far = Math.min(far, Math.max(x, y));
        if (near > far) return false;
      }
    }
    return true;
  }

  private contact(a: THREE.Vector3, t: number, normal: THREE.Vector3, hit: SolidHit): void {
    if (t < 0 || t > this.best) return;
    this.best = t;
    this.found = true;
    hit.fraction = t;
    hit.point.copy(a).addScaledVector(this.delta, t);
    hit.normal.copy(normal).normalize();
  }

  private sweepTriangle(a: THREE.Vector3, radius: number, surface: Surface, hit: SolidHit): void {
    const triangle = surface.triangle, normal = surface.normal;
    const distance = this.offset.subVectors(a, triangle.a).dot(normal);
    const speed = this.delta.dot(normal);
    if (radius > 0) {
      triangle.closestPointToPoint(a, this.closest);
      this.projected.subVectors(a, this.closest);
      const separation = this.projected.length();
      if (separation < radius - 1e-7 || (separation <= radius + 1e-7 && this.projected.dot(this.delta) < 0)) {
        if (separation < 1e-9) this.projected.copy(normal);
        this.contact(a, 0, this.projected, hit);
        return;
      }
    }
    if (Math.abs(speed) > 1e-10) {
      const sign = speed < 0 ? 1 : -1;
      const t = (sign * radius - distance) / speed;
      if (t >= 0 && t <= this.best) {
        this.projected.copy(a).addScaledVector(this.delta, t).addScaledVector(normal, -sign * radius);
        if (triangle.containsPoint(this.projected)) {
          this.projected.copy(normal).multiplyScalar(sign);
          this.contact(a, t, this.projected, hit);
        }
      }
    }
    if (radius === 0) return;
    this.sweepEdge(a, radius, triangle.a, triangle.b, hit);
    this.sweepEdge(a, radius, triangle.b, triangle.c, hit);
    this.sweepEdge(a, radius, triangle.c, triangle.a, hit);
  }

  private sweepEdge(a: THREE.Vector3, radius: number, v0: THREE.Vector3, v1: THREE.Vector3, hit: SolidHit): void {
    this.edge.subVectors(v1, v0);
    this.offset.subVectors(a, v0);
    const lengthSq = this.edge.lengthSq();
    const along = this.offset.dot(this.edge) / lengthSq;
    const travel = this.delta.dot(this.edge) / lengthSq;
    this.perpendicular.copy(this.offset).addScaledVector(this.edge, -along);
    this.velocity.copy(this.delta).addScaledVector(this.edge, -travel);
    const aa = this.velocity.lengthSq(), bb = 2 * this.perpendicular.dot(this.velocity);
    const cc = this.perpendicular.lengthSq() - radius * radius;
    const discriminant = bb * bb - 4 * aa * cc;
    if (aa > 1e-10 && discriminant >= 0) {
      const t = (-bb - Math.sqrt(discriminant)) / (2 * aa), edgeFraction = along + t * travel;
      if (t >= 0 && t <= this.best && edgeFraction >= 0 && edgeFraction <= 1) {
        this.center.copy(a).addScaledVector(this.delta, t);
        this.closest.copy(v0).addScaledVector(this.edge, edgeFraction);
        this.projected.subVectors(this.center, this.closest);
        this.contact(a, t, this.projected, hit);
      }
    }
    // Each triangle vertex is tested once, together with its outgoing edge.
    const speedSq = this.delta.lengthSq(), sphereB = 2 * this.offset.dot(this.delta);
    const sphereC = this.offset.lengthSq() - radius * radius;
    const sphereD = sphereB * sphereB - 4 * speedSq * sphereC;
    if (speedSq > 1e-10 && sphereD >= 0) {
      const t = (-sphereB - Math.sqrt(sphereD)) / (2 * speedSq);
      if (t >= 0 && t <= this.best) {
        this.projected.copy(a).addScaledVector(this.delta, t).sub(v0);
        this.contact(a, t, this.projected, hit);
      }
    }
  }
}
