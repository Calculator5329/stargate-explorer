import * as THREE from "three";
import { RunMission } from "@/mission/run";
import { fmt } from "@/mission/mission";
import type { MissionCtx } from "@/mission/mission";
import type { HuntLevel } from "@/mission/levels";
import type { Enemy } from "@/combat/enemies";

const _to = new THREE.Vector3();
const _rel = new THREE.Vector3();

/**
 * "Run it down": the gate chain with the quarry flying it instead of you. The
 * quarry is a normal enemy (guns, missiles and replays all work on it) whose
 * brain is replaced by scripted steering along the rings; inside `fightDist`
 * it lets the brain back in for `fightT` seconds, then runs again. It escapes
 * through the last gate. Pursuit is the playstyle: boost is the only way to
 * close on something faster than your cruise.
 */
export class HuntMission extends RunMission {
  private quarry: Enemy | null = null;
  private qNext = 0;
  private fightT = 0;
  private fightCd = 0;
  private left2: number;
  private kills0 = 0;

  constructor(override readonly def: HuntLevel, ctx: MissionCtx) {
    super(def, ctx);
    this.winTitle = "QUARRY DOWN";
    this.left2 = def.timeLimit;
  }

  protected override begin(): void {
    this.phase = "run";
    const r0 = this.rings[0]!;
    // the quarry starts at the first gate already flying the chain; the intro gave it its head start
    this.quarry = this.ctx.combat.enemies.spawn(_to.copy(r0.pos).addScaledVector(r0.normal, -40), this.rings[1]?.pos ?? r0.pos, this.def.quarry);
    this.quarry.steer = new THREE.Vector3().copy(r0.normal);
    this.quarry.steerSpeed = this.def.quarrySpeed;
    this.fightCd = this.def.fightCd * 1.5; // the head start: it runs first, whatever the range
    this.kills0 = this.ctx.combat.player.kills;
    this.marker = null;
    this.ctx.audio.ui();
  }

  protected override run(dt: number): void {
    const q = this.quarry;
    if (!q) return;
    this.mines.tick();
    this.left2 -= dt;
    if (!q.alive) {
      if (this.ctx.combat.player.kills === this.kills0) this.line = "It flew into the rock. That counts.";
      this.win();
      return;
    }
    if (this.left2 <= 0) {
      this.fail("It made the far gate with time to spare.", "QUARRY ESCAPED");
      return;
    }
    // quarry gate progress
    const ring = this.rings[this.qNext];
    if (ring) {
      _rel.copy(q.pos).sub(ring.pos);
      if (_rel.lengthSq() < ring.radius * ring.radius * 2.5) {
        for (const m of ring.parts) m.material = this.passed;
        this.qNext++;
        this.ctx.audio.ring();
        if (this.qNext >= this.rings.length) {
          q.alive = false;
          q.rig.root.visible = false;
          this.fail(`It went through gate ${this.rings.length} and was gone.`, "QUARRY ESCAPED");
          return;
        }
        for (const m of this.rings[this.qNext]!.parts) m.material = this.active;
      }
    }
    // fight or run
    const f = this.ctx.flight;
    const dist = _to.subVectors(f.pos, q.pos).length();
    this.fightCd -= dt;
    if (this.fightT > 0) {
      this.fightT -= dt;
      if (this.fightT <= 0) this.fightCd = this.def.fightCd;
    } else if (dist < this.def.fightDist && this.fightCd <= 0) {
      this.fightT = this.def.fightT;
      this.ctx.audio.ui();
    }
    if (this.fightT > 0) q.steer = null;
    else {
      const target = this.rings[this.qNext]!;
      if (!q.steer) q.steer = new THREE.Vector3();
      q.steer.copy(target.pos).sub(q.pos).normalize();
      q.steerSpeed = this.def.quarrySpeed;
    }
    this.line = `${this.fightT > 0 ? "It turned to fight" : "Running"}  ·  gate ${Math.min(this.qNext + 1, this.rings.length)} of ${this.rings.length}  ·  ${Math.round(dist)} m  ·  ${fmt(this.left2)} left`;
  }

  override summary(): string {
    return `time ${fmt(this.clock)}\ncaught at gate ${Math.min(this.qNext + 1, this.rings.length)} of ${this.rings.length}\nkills ${this.ctx.combat.player.kills}${this.rocksLine()}`;
  }

  protected override deathLine(): string {
    return `Gate ${Math.min(this.qNext + 1, this.rings.length)} of ${this.rings.length}. The quarry is still out there.`;
  }
}
