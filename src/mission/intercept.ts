import * as THREE from "three";
import { Mission, fmt } from "@/mission/mission";
import type { MissionCtx } from "@/mission/mission";
import type { InterceptLevel } from "@/mission/levels";
import type { Enemy } from "@/combat/enemies";
import type { Tracked } from "@/combat/targets";
import { glowMaterial } from "@/render/toon";
import { noEdge } from "@/render/layers";

const ZERO = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _q = new THREE.Quaternion();
const LEAK_R = 90;

/**
 * "The bomber line": runners fly a straight line to the relay behind the
 * player's start and ignore everything else; each one that gets there is a
 * leak. Escorts come with every group and fly normal brains. Target priority
 * is the whole lesson: the fighters shooting at you are not the mission.
 */
export class InterceptMission extends Mission {
  private readonly relay: Tracked;
  /** Every bomber this mission has put on the line. A **Set**, not an array, because `Enemies.spawn` hands
   * back pooled objects: a dead runner is reused for the next one, so pushing on every spawn stored the same
   * object several times. Both readers count `alive` entries, so the HUD claimed 10 bombers where 2 were
   * flying, and `maxAlive - alive` went negative and stopped spawning for ~116 s of a 3-minute mission. */
  private readonly runners = new Set<Enemy>();
  private spawnT: number;
  private restockT: number;
  private leaks = 0;
  private sent = 0;
  private pulse = 0;
  private readonly mesh: THREE.Group;

  constructor(override readonly def: InterceptLevel, ctx: MissionCtx) {
    super(def, ctx);
    this.winTitle = "LINE HELD";
    this.spawnT = def.firstDelay;
    this.restockT = def.restockEvery;
    const f = ctx.flight;
    _fwd.set(0, 0, 1).applyQuaternion(f.quat);
    const pos = f.pos.clone().addScaledVector(_fwd, -def.lineBehind);
    for (let tries = 0; tries < 16 && !this.clear(pos, 120); tries++) pos.add(_dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(160));
    // the relay: a glowing ring with a core, big enough to read from the start line
    this.mesh = new THREE.Group();
    const mat = glowMaterial(0x7fd6ff, 2.2);
    this.mesh.add(noEdge(new THREE.Mesh(new THREE.TorusGeometry(34, 2.2, 8, 30), mat)));
    this.mesh.add(noEdge(new THREE.Mesh(new THREE.OctahedronGeometry(11, 0), mat)));
    this.mesh.position.copy(pos);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _fwd);
    this.group.add(this.mesh);
    this.relay = { pos: this.mesh.position, vel: ZERO, alive: true, radius: 40 };
  }

  protected begin(): void {
    this.line = `Hold the relay for ${fmt(this.def.duration)}.`;
    this.marker = this.relay;
    this.ctx.audio.ui();
  }

  private spawnGroup(n: number): void {
    const d = this.def, f = this.ctx.flight, E = this.ctx.combat.enemies;
    _fwd.set(0, 0, 1).applyQuaternion(f.quat);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 8; tries++) {
        _q.setFromAxisAngle(_dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), (Math.random() * 2 - 1) * 0.9);
        _dir.copy(_fwd).applyQuaternion(_q).normalize();
        _pos.copy(f.pos).addScaledVector(_dir, d.near + Math.random() * (d.far - d.near));
        if (this.clear(_pos)) break;
      }
      const e = E.spawn(_pos, this.relay.pos, d.runner);
      e.steer = new THREE.Vector3();
      e.steerSpeed = d.runnerSpeed;
      this.runners.add(e);
      this.sent++;
    }
    if (d.escortsPer > 0) this.spawnCone(d.escortsPer, d.near - 200, d.far - 200, 0.9, d.escortKinds);
  }

  protected run(dt: number): void {
    const d = this.def;
    if (this.clock >= d.duration) {
      this.win();
      return;
    }
    this.spawnT -= dt;
    this.restockT -= dt;
    if (this.restockT <= 0) (this.restockT = d.restockEvery), this.ctx.combat.restock();
    if (this.spawnT <= 0) {
      this.spawnT = d.interval;
      const alive = countAlive(this.runners);
      const want = d.groupStart + Math.floor((this.clock / 60) * d.groupGrow);
      const n = Math.min(want, Math.max(0, d.maxAlive - alive));
      if (n > 0) (this.spawnGroup(n), this.ctx.audio.ui());
    }
    // steer every live runner at the relay; a runner at the relay is a leak (gone, no credit)
    for (const e of this.runners) {
      if (!e.alive) continue;
      _dir.subVectors(this.relay.pos, e.pos);
      const dist = _dir.length();
      if (dist < LEAK_R) {
        e.alive = false;
        e.rig.root.visible = false;
        this.leaks++;
        this.ctx.combat.burst(this.relay.pos, ZERO, 8, 1.1);
        this.ctx.audio.lose();
        if (this.leaks >= d.maxLeaks) {
          this.fail(`${this.leaks} bombers reached the relay. It is gone.`, "RELAY LOST");
          return;
        }
        continue;
      }
      e.steer!.copy(_dir).multiplyScalar(1 / dist);
    }
    const left = d.duration - this.clock;
    const live = countAlive(this.runners);
    this.phase = this.ctx.combat.enemies.aliveCount > 0 ? "wave" : "wait";
    this.line = left < 20 ? `${d.finaleLine}  ·  ${fmt(left)}` : `Relay ${fmt(left)}  ·  ${live} bomber${live === 1 ? "" : "s"} on the line  ·  leaks ${this.leaks}/${d.maxLeaks}`;
  }

  override render(dt: number): void {
    this.pulse += dt;
    this.mesh.rotation.z += dt * 0.4;
    this.mesh.scale.setScalar(1 + 0.04 * Math.sin(this.pulse * 3));
  }

  override summary(): string {
    return `${super.summary()}\nleaks ${this.leaks}/${this.def.maxLeaks} of ${this.sent} bombers`;
  }

  protected override deathLine(): string {
    return `Held ${fmt(this.clock)} of ${fmt(this.def.duration)} with ${this.leaks} leak${this.leaks === 1 ? "" : "s"}.`;
  }
}

function countAlive(set: Set<Enemy>): number {
  let n = 0;
  for (const e of set) if (e.alive) n++;
  return n;
}
