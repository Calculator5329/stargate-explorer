import * as THREE from 'three';
import { glowMaterial } from '@/render/toon';
import { noEdge } from '@/render/layers';
import { T } from '@/core/tunables';

export interface DroneTarget {
  pos: THREE.Vector3;
  strike(): void;
}
interface Drone {
  start: THREE.Vector3;
  bend: THREE.Vector3;
  end: THREE.Vector3;
  target: DroneTarget;
  delay: number;
  duration: number;
  arrived: boolean;
}

/** Pooled luminous drones follow distinct arcing paths; impact owns the target destruction event. */
export class DroneSalvo {
  readonly group = new THREE.Group();
  private readonly cores: THREE.InstancedMesh;
  private readonly trails: THREE.InstancedMesh;
  private readonly drones: Drone[] = [];
  private clock = -1;
  private previous = -1;
  private readonly origin: THREE.Vector3;
  readonly capacity = 48;

  constructor(origin: THREE.Vector3) {
    this.origin = origin.clone();
    this.cores = noEdge(new THREE.InstancedMesh(new THREE.SphereGeometry(2.4, 6, 4), glowMaterial(0xffe5a7, 3), this.capacity));
    this.trails = noEdge(new THREE.InstancedMesh(new THREE.CylinderGeometry(.8, 1.8, 1, 5), glowMaterial(0xffb63e, 1.5), this.capacity * 8));
    this.cores.frustumCulled = this.trails.frustumCulled = false;
    for (let i = 0; i < this.capacity; i++) this.cores.setMatrixAt(i, HIDDEN);
    for (let i = 0; i < this.capacity * 8; i++) this.trails.setMatrixAt(i, HIDDEN);
    this.group.add(this.cores, this.trails);
  }

  launch(targets: readonly DroneTarget[]): void {
    if (this.clock >= 0 || targets.length === 0) return;
    for (let i = 0; i < this.capacity; i++) {
      const target = targets[i % targets.length]!;
      const end = target.pos.clone();
      const bend = this.origin.clone().lerp(end, .4);
      bend.y += 380 + i % 5 * 65;
      bend.x += Math.sin(i * 2.4) * 350;
      const start = this.origin.clone();
      start.x += Math.sin(i * 1.3) * 6;
      this.drones.push({ start, bend, end, target, delay: i * .16, duration: Math.max(1.5, start.distanceTo(end) / T.episode.droneSpeed), arrived: false });
    }
    this.clock = this.previous = 0;
  }

  get complete(): boolean { return this.clock >= 0 && this.drones.every(d => d.arrived); }

  tick(dt: number): void {
    if (this.clock < 0) return;
    this.previous = this.clock;
    this.clock += dt;
    for (const d of this.drones) {
      if (d.arrived || this.clock < d.delay + d.duration) continue;
      d.arrived = true;
      d.target.strike();
    }
  }

  render(alpha: number): void {
    if (this.clock < 0) return;
    const clock = this.previous + (this.clock - this.previous) * alpha;
    for (let i = 0; i < this.capacity; i++) {
      const d = this.drones[i];
      const t = d ? (clock - d.delay) / d.duration : -1;
      if (!d || t < 0 || t >= 1) {
        this.cores.setMatrixAt(i, HIDDEN);
        for (let j = 0; j < 8; j++) this.trails.setMatrixAt(i * 8 + j, HIDDEN);
        continue;
      }
      point(d, t, _p);
      _obj.position.copy(_p); _obj.quaternion.identity(); _obj.scale.set(1, 1, 1); _obj.updateMatrix();
      this.cores.setMatrixAt(i, _obj.matrix);
      for (let j = 0; j < 8; j++) {
        point(d, Math.max(0, t - (j + 1) * .007), _q);
        _dir.subVectors(_p, _q);
        _obj.position.copy(_p).add(_q).multiplyScalar(.5);
        _obj.quaternion.setFromUnitVectors(UP, _dir.normalize());
        _obj.scale.set(1 - j * .09, _p.distanceTo(_q), 1 - j * .09);
        _obj.updateMatrix(); this.trails.setMatrixAt(i * 8 + j, _obj.matrix);
        _p.copy(_q);
      }
    }
    this.cores.instanceMatrix.needsUpdate = this.trails.instanceMatrix.needsUpdate = true;
  }
}

function point(d: Drone, t: number, out: THREE.Vector3): void {
  const s = 1 - t;
  out.copy(d.start).multiplyScalar(s * s).addScaledVector(d.bend, 2 * s * t).addScaledVector(d.end, t * t);
}
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _dir = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const _obj = new THREE.Object3D(), HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
