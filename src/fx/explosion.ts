import * as THREE from "three";
import { noEdge } from "@/render/layers";
import { glowMaterial, toonMaterial } from "@/render/toon";

const MAX = 12;
const DEBRIS = 14;
const LIFE = 1.4;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const _obj = new THREE.Object3D();
const _v = new THREE.Vector3();

interface Burst {
  t: number;
  pos: THREE.Vector3;
  scale: number;
  vel: Float32Array;
  spin: Float32Array;
}

/**
 * Pooled destruction bursts: a hot flash disc that pops and fades, plus a
 * spray of dark faceted debris chunks that fly out, tumble and shrink. Cel
 * style: the flash is a hard-edged disc, the chunks are flat-shaded tetrahedra.
 */
export class Explosions {
  readonly group = new THREE.Group();
  private readonly bursts: Burst[] = [];
  private readonly flashes: THREE.Mesh[] = [];
  private readonly debris: THREE.InstancedMesh;
  private readonly flashMat = glowMaterial(0xfff1c0, 3.0);
  private readonly ringMat = glowMaterial(0xffa040, 2.2);

  constructor() {
    const disc = new THREE.CircleGeometry(1, 24);
    for (let i = 0; i < MAX; i++) {
      const flash = noEdge(new THREE.Mesh(disc, this.flashMat));
      const ring = noEdge(new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24), this.ringMat));
      flash.add(ring);
      flash.visible = false;
      flash.frustumCulled = false;
      this.flashes.push(flash);
      this.group.add(flash);
      this.bursts.push({ t: LIFE, pos: new THREE.Vector3(), scale: 1, vel: new Float32Array(DEBRIS * 3), spin: new Float32Array(DEBRIS) });
    }
    const chunk = new THREE.TetrahedronGeometry(0.6, 0);
    this.debris = new THREE.InstancedMesh(chunk, toonMaterial(0x2a2226), MAX * DEBRIS);
    this.debris.frustumCulled = false;
    for (let i = 0; i < MAX * DEBRIS; i++) this.debris.setMatrixAt(i, HIDDEN);
    this.group.add(this.debris);
  }

  /** `scale` ≈ ship radius in metres; `vel` is the victim's velocity, inherited by the debris. */
  spawn(pos: THREE.Vector3, vel: THREE.Vector3, scale: number): void {
    let b = this.bursts.find((x) => x.t >= LIFE);
    if (!b) b = this.bursts.reduce((a, x) => (x.t > a.t ? x : a));
    b.t = 0;
    b.pos.copy(pos);
    b.scale = scale;
    for (let i = 0; i < DEBRIS; i++) {
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar((6 + Math.random() * 16) * scale * 0.4);
      _v.add(vel);
      b.vel.set([_v.x, _v.y, _v.z], i * 3);
      b.spin[i] = Math.random() * 6.28;
    }
  }

  /** Small impact flash, no debris. */
  spark(pos: THREE.Vector3): void {
    let b = this.bursts.find((x) => x.t >= LIFE);
    if (!b) return;
    b.t = LIFE * 0.62; // start in the collapse phase: a 0.2 s pop
    b.pos.copy(pos);
    b.scale = 0.9;
    b.vel.fill(0);
  }

  update(dt: number, camPos: THREE.Vector3): void {
    for (let k = 0; k < MAX; k++) {
      const b = this.bursts[k]!;
      const flash = this.flashes[k]!;
      if (b.t >= LIFE) {
        if (flash.visible) {
          flash.visible = false;
          for (let i = 0; i < DEBRIS; i++) this.debris.setMatrixAt(k * DEBRIS + i, HIDDEN);
        }
        continue;
      }
      b.t += dt;
      const f = b.t / LIFE;
      // flash: pops to full size in 80 ms, holds, then collapses; ring keeps growing
      const pop = Math.min(1, b.t / 0.08);
      const hold = f < 0.35 ? 1 : Math.max(0, 1 - (f - 0.35) / 0.25);
      if (b.scale < 1) {
        // spark: flash only, no debris, fully gone at f = 0.6
        flash.visible = hold > 0;
        flash.position.copy(b.pos);
        flash.lookAt(camPos);
        flash.scale.setScalar(b.scale * 1.6 * hold);
        continue;
      }
      flash.visible = hold > 0;
      flash.position.copy(b.pos);
      flash.lookAt(camPos);
      flash.scale.setScalar(b.scale * 2.2 * pop * (0.6 + 0.4 * hold));
      const ring = flash.children[0]!;
      ring.scale.setScalar(1 + f * 2.5);
      for (let i = 0; i < DEBRIS; i++) {
        _obj.position.copy(b.pos).addScaledVector(_v.set(b.vel[i * 3]!, b.vel[i * 3 + 1]!, b.vel[i * 3 + 2]!), b.t);
        _obj.rotation.set(b.spin[i]! + b.t * 4, b.spin[i]! * 1.7 + b.t * 3, 0);
        _obj.scale.setScalar(b.scale * 0.35 * (1 - f) + 0.01);
        _obj.updateMatrix();
        this.debris.setMatrixAt(k * DEBRIS + i, _obj.matrix);
      }
    }
    this.debris.instanceMatrix.needsUpdate = true;
  }
}
