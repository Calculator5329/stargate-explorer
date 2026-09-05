import * as THREE from "three";
import { ClearMission } from "@/mission/clear";
import type { MissionCtx } from "@/mission/mission";
import type { ProtectLevel } from "@/mission/levels";
import type { Lockable } from "@/combat/targets";
import { ShipRig } from "@/ships/rig";
import { PROMETHEUS } from "@/ships/prometheus-def";

const _n = new THREE.Vector3();

/**
 * "Cover the Prometheus": the same wave machine as the clear mission, but two
 * thirds of the gliders go for the escort, whose hull is the thing that must
 * survive. The escort crawls toward the gate under sublight.
 */
export class ProtectMission extends ClearMission<ProtectLevel> {
  private readonly escort: Lockable & { hp: number; rig: ShipRig; sinceHit: number };
  private readonly mats: THREE.MeshToonMaterial[] = [];
  private readonly maxHp: number;
  /** the parent's objective line and what we last showed, so the hull suffix is composed once, not appended every tick (2026-09-05 bug: the HUD filled with "Prometheus hull 100%") */
  private baseLine = "";
  private shownLine = "";

  constructor(override readonly def: ProtectLevel, ctx: MissionCtx) {
    super(def, ctx);
    this.winTitle = "PROMETHEUS SAFE";
    this.maxHp = def.escortHp;
    const rig = new ShipRig(PROMETHEUS);
    rig.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) this.mats.push(o.material);
    });
    const f = ctx.flight;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(f.quat);
    const pos = f.pos.clone().addScaledVector(fwd, 260).add(new THREE.Vector3(60, -40, 0));
    rig.root.position.copy(pos);
    rig.root.quaternion.copy(f.quat);
    this.group.add(rig.root);
    const self = this;
    this.escort = {
      rig, hp: def.escortHp, sinceHit: 99, pos: rig.root.position, vel: fwd.clone().multiplyScalar(def.escortSpeed), alive: true, radius: 30,
      damage(amount) {
        if (!this.alive) return false;
        this.hp -= amount;
        this.sinceHit = 0;
        if (this.hp > 0) return false;
        this.alive = false;
        self.ctx.combat.burst(this.pos, this.vel, 14, 1);
        rig.root.visible = false;
        return true;
      },
    };
    ctx.combat.friendlies.push(this.escort);
    ctx.combat.enemies.targets.push(this.escort, this.escort);
  }

  protected override begin(): void {
    super.begin();
    this.marker = this.escort;
  }

  protected override run(dt: number): void {
    const e = this.escort;
    e.sinceHit += dt;
    e.pos.addScaledVector(e.vel, dt);
    // keep the escort off the rocks: slide around anything it is about to hit
    const R = this.ctx.rocks;
    for (let i = 0; i < R.count; i++) {
      const r = R.radii[i]! + e.radius + 40;
      _n.set(e.pos.x - R.centers[i * 3]!, e.pos.y - R.centers[i * 3 + 1]!, e.pos.z - R.centers[i * 3 + 2]!);
      const d = _n.length();
      if (d < r) e.pos.addScaledVector(_n.normalize(), (r - d) * Math.min(1, dt * 3));
    }
    if (!e.alive) {
      this.fail("The Prometheus broke up over the belt.", "PROMETHEUS LOST");
      return;
    }
    super.run(dt);
    if (this.done) return;
    this.marker = this.ctx.combat.enemies.aliveCount > 0 ? null : e;
    if (this.line !== this.shownLine) this.baseLine = this.line; // the wave machine wrote a new line
    this.line = this.shownLine = `${this.baseLine}  ·  Prometheus hull ${Math.round((100 * e.hp) / this.maxHp)}%`;
  }

  override render(dt: number): void {
    const e = this.escort;
    e.rig.update(dt, 0.35, false);
    const flash = e.sinceHit < 0.09 ? 1 : 0;
    for (const m of this.mats) {
      if (m.emissiveIntensity === flash) continue;
      m.emissive.setScalar(1);
      m.emissiveIntensity = flash;
    }
  }

  override summary(): string {
    return `${super.summary()}\nPrometheus hull ${Math.round((100 * this.escort.hp) / this.maxHp)}%`;
  }
}
