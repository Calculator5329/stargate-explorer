import * as THREE from "three";
import { T } from "@/core/tunables";
import type { Tracked } from "@/combat/targets";
import { noEdge } from "@/render/layers";
import { glowMaterial, toonMaterial } from "@/render/toon";

export interface Missile {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  target: Tracked | null;
  ttl: number;
}

const MAX = 8;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const _obj = new THREE.Object3D();
const _want = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qw = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const ZERO = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Lock-on missiles (the fighter's in-canon secondary): a pooled instanced body
 * with a glowing exhaust flare, homing on an `Enemy` by rotating the velocity
 * toward it at `turnRate`. Hit resolution (proximity fuse) lives in `Combat`.
 */
export class Missiles {
  readonly group = new THREE.Group();
  readonly list: Missile[] = [];
  private readonly body: THREE.InstancedMesh;
  private readonly flare: THREE.InstancedMesh;

  constructor() {
    for (let i = 0; i < MAX; i++) this.list.push({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), target: null, ttl: 0 });
    const geo = new THREE.CylinderGeometry(0.16, 0.22, 2.2, 8);
    geo.rotateX(Math.PI / 2);
    this.body = new THREE.InstancedMesh(geo, toonMaterial(0xd8d2c0), MAX);
    const fl = new THREE.ConeGeometry(0.3, 1.6, 8);
    fl.rotateX(Math.PI / 2);
    fl.translate(0, 0, -1.9);
    this.flare = noEdge(new THREE.InstancedMesh(fl, glowMaterial(0xffc97a, 2.6), MAX));
    for (const im of [this.body, this.flare]) {
      im.frustumCulled = false;
      for (let i = 0; i < MAX; i++) im.setMatrixAt(i, HIDDEN);
      this.group.add(im);
    }
  }

  fire(pos: THREE.Vector3, dir: THREE.Vector3, shooterVel: THREE.Vector3, target: Tracked): boolean {
    const m = this.list.find((x) => !x.alive);
    if (!m) return false;
    m.alive = true;
    m.pos.copy(pos);
    m.vel.copy(dir).multiplyScalar(T.missile.speed * 0.5).add(shooterVel);
    m.target = target;
    m.ttl = T.missile.life;
    return true;
  }

  tick(dt: number): void {
    const M = T.missile;
    for (const m of this.list) {
      if (!m.alive) continue;
      m.ttl -= dt;
      if (m.ttl <= 0) {
        m.alive = false;
        continue;
      }
      const speed = m.vel.length();
      _dir.copy(m.vel).divideScalar(speed || 1);
      if (m.target && m.target.alive) {
        // lead a little: aim where the target will be in the time it takes to get there
        const tof = m.pos.distanceTo(m.target.pos) / Math.max(120, speed);
        _want.copy(m.target.pos).addScaledVector(m.target.vel, tof * 0.8).sub(m.pos).normalize();
        _q.setFromUnitVectors(_dir, _want);
        _qw.identity().rotateTowards(_q, M.turnRate * dt);
        _dir.applyQuaternion(_qw);
      } else m.target = null;
      const s = Math.min(M.speed, speed + M.accel * dt);
      m.vel.copy(_dir).multiplyScalar(s);
      m.pos.addScaledVector(m.vel, dt);
    }
  }

  update(): void {
    this.list.forEach((m, i) => {
      if (!m.alive) {
        this.body.setMatrixAt(i, HIDDEN);
        this.flare.setMatrixAt(i, HIDDEN);
        return;
      }
      _m.lookAt(m.vel, ZERO, UP);
      _obj.quaternion.setFromRotationMatrix(_m);
      _obj.position.copy(m.pos);
      _obj.scale.setScalar(1);
      _obj.updateMatrix();
      this.body.setMatrixAt(i, _obj.matrix);
      this.flare.setMatrixAt(i, _obj.matrix);
    });
    this.body.instanceMatrix.needsUpdate = true;
    this.flare.instanceMatrix.needsUpdate = true;
  }
}
