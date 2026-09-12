import * as THREE from "three";
import { T } from "@/core/tunables";
import { noEdge } from "@/render/layers";

/** Who fired: player shots hit enemies, enemy shots hit the player. */
export type Side = "player" | "enemy" | "ally";

export interface Shot {
  alive: boolean;
  side: Side;
  pos: THREE.Vector3;
  /** where it was last tick; render lerps prevPos→pos so a tracer moves every frame, not every tick */
  prevPos: THREE.Vector3;
  vel: THREE.Vector3;
  ttl: number;
  /** damage multiplier on the side's base round (enemy kinds differ) */
  dmg: number;
}

const _dir = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _obj = new THREE.Object3D();
const _up = new THREE.Vector3(0, 1, 0);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Pooled tracer rounds. One InstancedMesh per side (player: warm, enemy: hot
 * orange); each tracer is a thin box stretched along its velocity. Motion is
 * simulated in `tick`; hits are resolved by whoever owns the targets
 * (`combat/combat.ts`), which calls `kill()`.
 */
export class Projectiles {
  readonly group = new THREE.Group();
  readonly shots: Shot[] = [];
  private readonly meshes: Record<Side, THREE.InstancedMesh>;

  constructor(capacity = 256) {
    const geo = new THREE.BoxGeometry(0.4, 0.4, 1);
    const mat = (c: number, k: number) => {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
      m.toneMapped = false;
      return m;
    };
    this.meshes = {
      player: noEdge(new THREE.InstancedMesh(geo, mat(0xbfe6ff, 2.6), capacity)),
      enemy: noEdge(new THREE.InstancedMesh(geo, mat(0xffa040, 2.6), capacity)),
      ally: noEdge(new THREE.InstancedMesh(geo, mat(0x73e4dc, 2.0), capacity)),
    };
    for (const side of ["player", "enemy", "ally"] as const) {
      const m = this.meshes[side];
      m.frustumCulled = false;
      for (let i = 0; i < capacity; i++) m.setMatrixAt(i, HIDDEN);
      this.group.add(m);
    }
    for (let i = 0; i < capacity * 3; i++) {
      this.shots.push({ alive: false, side: i < capacity ? "player" : i < capacity * 2 ? "enemy" : "ally", pos: new THREE.Vector3(), prevPos: new THREE.Vector3(), vel: new THREE.Vector3(), ttl: 0, dmg: 1 });
    }
  }

  /** Spawn a round at `pos` travelling along `dir` at the side's muzzle speed plus the shooter's velocity. */
  fire(side: Side, pos: THREE.Vector3, dir: THREE.Vector3, shooterVel: THREE.Vector3, dmg = 1): Shot | null {
    const w = T.weapons;
    const speed = side === "enemy" ? w.enemyMuzzleSpeed : w.muzzleSpeed;
    return this.spawn(side, pos, _dir.copy(dir).multiplyScalar(speed).add(shooterVel), w.range / speed, dmg);
  }

  /** Place a round with an explicit world velocity and lifetime (the kill replay re-emits recorded rounds this way). */
  spawn(side: Side, pos: THREE.Vector3, vel: THREE.Vector3, ttl: number, dmg = 1): Shot | null {
    const s = this.shots.find((x) => !x.alive && x.side === side);
    if (!s) return null;
    s.alive = true;
    s.dmg = dmg;
    s.pos.copy(pos);
    s.prevPos.copy(pos);
    s.vel.copy(vel);
    s.ttl = ttl;
    return s;
  }

  /** Drop every live round (replay teardown). */
  clear(): void {
    for (const s of this.shots) s.alive = false;
  }

  kill(s: Shot): void {
    s.alive = false;
  }

  tick(dt: number): void {
    for (const s of this.shots) {
      if (!s.alive) continue;
      s.ttl -= dt;
      if (s.ttl <= 0) s.alive = false;
      else {
        s.prevPos.copy(s.pos);
        s.pos.addScaledVector(s.vel, dt);
      }
    }
  }

  /** Rebuild instance matrices: length follows speed so a tracer is a streak, not a dot. `alpha` interpolates between ticks. */
  update(alpha = 1): void {
    let pi = 0, ei = 0, ai = 0;
    const cap = this.meshes.player.count;
    for (const s of this.shots) {
      if (!s.alive) continue;
      const m = this.meshes[s.side];
      const i = s.side === "player" ? pi++ : s.side === "enemy" ? ei++ : ai++;
      if (i >= cap) continue;
      const len = Math.max(6, s.vel.length() * T.weapons.tracerSec);
      _obj.position.copy(alpha < 1 ? _pos.lerpVectors(s.prevPos, s.pos, alpha) : s.pos).addScaledVector(_dir.copy(s.vel).normalize(), -len / 2);
      _obj.quaternion.setFromUnitVectors(_up.set(0, 0, 1), _dir);
      _obj.scale.set(1, 1, len);
      _obj.updateMatrix();
      m.setMatrixAt(i, _obj.matrix);
    }
    for (let i = pi; i < cap; i++) this.meshes.player.setMatrixAt(i, HIDDEN);
    for (let i = ei; i < cap; i++) this.meshes.enemy.setMatrixAt(i, HIDDEN);
    for (let i = ai; i < cap; i++) this.meshes.ally.setMatrixAt(i, HIDDEN);
    this.meshes.player.instanceMatrix.needsUpdate = true;
    this.meshes.enemy.instanceMatrix.needsUpdate = true;
    this.meshes.ally.instanceMatrix.needsUpdate = true;
  }
}
