import * as THREE from "three";
import { Mission } from "@/mission/mission";
import type { MissionCtx } from "@/mission/mission";
import type { StrikeLevel } from "@/mission/levels";
import type { Lockable } from "@/combat/targets";
import { Capital, type Turret } from "@/combat/capital";
import { T } from "@/core/tunables";
import { D } from "@/core/difficulty";
import { Mines } from "@/mission/mines";

const ZERO = new THREE.Vector3();
const _to = new THREE.Vector3();
const _m = new THREE.Vector3();
const _n = new THREE.Vector3();
const TURRET_RANGE = 1000;
const TURRET_CD = 1.6;

/**
 * "Bring down the Ha'tak": ring turrets first (they shoot back), then the three
 * shield nodes, then the hull takes damage until the staged death plays out.
 * Gliders launch at the start and each time a node falls.
 */
export class StrikeMission extends Mission {
  private readonly cap = new Capital();
  private readonly turrets: Lockable[] = [];
  private readonly nodes: Lockable[] = [];
  private readonly core: Lockable;
  private readonly cds: number[] = [];
  private stage: "guns" | "nodes" | "hull" = "guns";
  /** seconds left on the "hull shielded" HUD cue after a round hits the shielded pyramid */
  private shieldT = 0;
  private readonly mines: Mines;

  constructor(override readonly def: StrikeLevel, ctx: MissionCtx) {
    super(def, ctx);
    this.winTitle = "HA'TAK DOWN";
    const f = ctx.flight;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(f.quat);
    const pos = f.pos.clone().addScaledVector(fwd, def.distance);
    // face the player: local +Z is the hangar face
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd.clone().negate());
    this.cap.setPose(pos, q);
    this.cap.update(0);
    this.group.add(this.cap.group);
    const self = this;
    const wrap = (t: Turret, kind: "gun" | "node"): Lockable => ({
      pos: t.pos, vel: ZERO, radius: t.radius,
      get alive() { return t.alive; },
      set alive(_v: boolean) { /* owned by the capital */ },
      damage(amount) {
        // guns and torpedoes both bite on every ring gun and shield node from the start; only the pyramid itself
        // is shielded (Ethan, 2026-09-05: "if I hit with my normal guns it does nothing")
        if (!self.cap.damagePart(t, amount)) return false;
        self.ctx.combat.burst(t.pos, ZERO, kind === "gun" ? 4 : 6, 0.9);
        if (kind === "node") self.spawnCone(self.def.reinforce, 700, 900, 1.0, self.def.reinforceKinds);
        self.advance();
        return true;
      },
    });
    for (const t of this.cap.turrets) (this.turrets.push(wrap(t, "gun")), this.cds.push(1 + Math.random() * 2));
    for (const t of this.cap.weakPoints) this.nodes.push(wrap(t, "node"));
    this.core = {
      pos: this.cap.group.position, vel: ZERO, radius: this.cap.radius * 0.72, alive: true,
      // the hull's real shape, so rounds reach the nodes on the collar and the ring guns from any side
      hits: (a, b) => this.cap.hitBy(a, b),
      damage(amount) {
        if (!self.cap.alive) return false;
        if (self.stage !== "hull") {
          self.shieldT = 1.2;
          return false;
        }
        self.cap.hp -= amount;
        if (self.cap.hp > 0) return false;
        this.alive = false;
        self.phase = "dying";
        self.line = "She is coming apart. Clear the blast.";
        self.marker = null;
        return true;
      },
    };
    ctx.combat.extras.push(...this.turrets, ...this.nodes, this.core);
    // a ring of mines in the hull's plane, well outside the turrets' reach of the ring
    this.mines = new Mines(ctx);
    this.group.add(this.mines.group);
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    for (let i = 0; i < def.mines; i++) {
      const a = (i / def.mines) * Math.PI * 2 + Math.random() * 0.2, rr = this.cap.radius * 2.1 + Math.random() * 60;
      _m.copy(pos).addScaledVector(side, Math.cos(a) * rr).addScaledVector(fwd, Math.sin(a) * rr).addScaledVector(up, (Math.random() - 0.5) * 80);
      this.mines.add(_m);
    }
  }

  protected begin(): void {
    this.phase = "run";
    this.spawnCone(this.def.escorts, 600, 800, 0.8, this.def.escortKinds);
    this.line = `Ring guns: ${this.aliveGuns()} of ${this.turrets.length} · shield nodes: ${this.nodes.length}. Guns and torpedoes both bite.`;
    this.marker = this.nearest(this.turrets);
    this.ctx.audio.ui();
  }

  private aliveGuns(): number {
    return this.turrets.filter((t) => t.alive).length;
  }

  private nearest(list: Lockable[]): Lockable | null {
    let best: Lockable | null = null, bd = Infinity;
    for (const x of list) {
      if (!x.alive) continue;
      const d = x.pos.distanceToSquared(this.ctx.flight.pos);
      if (d < bd) (bd = d), (best = x);
    }
    return best;
  }

  /** Called when a part dies: move the stage on and the HUD line with it. */
  private advance(): void {
    if (this.stage === "hull") return;
    const g = this.aliveGuns(), n = this.aliveNodes();
    if (n === 0) {
      this.stage = "hull";
      this.line = "Shields down. Burn the pyramid.";
      this.ctx.audio.ui();
      return;
    }
    if (n < this.nodes.length && this.stage === "guns" && g > 0) this.line = `Ring guns: ${g} of ${this.turrets.length} · shield nodes: ${n} of ${this.nodes.length}.`;
    else if (g === 0) {
      if (this.stage === "guns") (this.stage = "nodes"), this.ctx.audio.ui();
      this.line = `Ring guns silent. Shield nodes: ${n} of ${this.nodes.length}. Gliders launching.`;
    } else this.line = `Ring guns: ${g} of ${this.turrets.length} · shield nodes: ${n} of ${this.nodes.length}.`;
  }

  private aliveNodes(): number {
    return this.nodes.filter((x) => x.alive).length;
  }

  protected run(dt: number): void {
    const f = this.ctx.flight, C = this.ctx.combat;
    this.mines.tick();
    if (this.phase === "dying") {
      this.cap.update(dt);
      if (this.cap.die(dt, (p, s) => C.burst(p, ZERO, s * 3, 1))) this.win();
      return;
    }
    this.cap.aimAt(f.pos, dt);
    this.cap.update(dt);
    // ring guns fire when the player is in range and roughly down the barrel
    for (let i = 0; i < this.cap.turrets.length; i++) {
      const t = this.cap.turrets[i]!;
      this.cds[i] = (this.cds[i] ?? 0) - dt;
      if (!t.alive || this.cds[i]! > 0) continue;
      _to.subVectors(f.pos, t.pos);
      const d = _to.length();
      if (d > TURRET_RANGE || _to.dot(t.dir) / d < 0.94) continue;
      this.cds[i] = TURRET_CD / D.enemyFireRate;
      const tof = d / T.weapons.enemyMuzzleSpeed;
      _to.copy(f.pos).addScaledVector(C.player.vel, tof).sub(t.pos).normalize();
      _to.add(_n.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(T.weapons.enemySpread * D.enemySpread * 2)).normalize();
      C.shots.fire("enemy", _m.copy(t.pos).addScaledVector(t.dir, 12), _to, ZERO);
    }
    // the hull is solid: push the ship out along the nearest face and take the crash like a rock
    if (this.cap.pushOut(f.pos, T.arena.shipRadius * f.stats.size + 3, _n)) f.bounce(_n);
    if (this.stage === "hull") this.line = `Hull ${Math.max(0, Math.round((100 * this.cap.hp) / 600))}%`;
    else if (this.shieldT > 0) {
      this.shieldT -= dt;
      this.line = `Pyramid shielded. Kill the ${this.aliveNodes()} shield node${this.aliveNodes() === 1 ? "" : "s"} first.`;
      if (this.shieldT <= 0) this.advance();
    }
    this.marker = this.stage === "guns" ? this.nearest(this.turrets) : this.stage === "nodes" ? this.nearest(this.nodes) : this.core;
  }

  override render(dt: number): void {
    this.mines.render(dt);
  }

  override summary(): string {
    // what the player actually destroyed, not the array lengths: killing only the nodes and the core used to
    // print "ring guns 6" on the win card while all six guns were still turning
    return `${super.summary()}\nring guns ${this.turrets.length - this.aliveGuns()} of ${this.turrets.length}  ·  shield nodes ${this.nodes.length - this.aliveNodes()} of ${this.nodes.length}`;
  }

  protected override deathLine(): string {
    return `Ring guns left: ${this.aliveGuns()}. The Ha'tak is still up there.`;
  }
}
