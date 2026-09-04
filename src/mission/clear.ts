import { Mission, Waves } from "@/mission/mission";
import type { MissionCtx } from "@/mission/mission";
import type { ClearLevel, ProtectLevel, Wave } from "@/mission/levels";

/** "Clear the field": waves of gliders until none are left. */
export class ClearMission<L extends ClearLevel | ProtectLevel = ClearLevel> extends Mission {
  protected waves: Waves;

  constructor(override readonly def: L, ctx: MissionCtx) {
    super(def, ctx);
    this.winTitle = "FIELD CLEAR";
    this.waves = new Waves(def.waves, this, (w) => this.onWave(w), () => ctx.combat.restock());
  }

  protected begin(): void {
    this.line = "Contact soon.";
    this.ctx.audio.ui();
  }

  protected onWave(w: Wave): void {
    this.spawnCone(w.count, w.near, w.far, 0.45, w.kinds);
    this.line = this.waves.isLast ? this.def.finaleLine : `Wave ${this.waves.index} of ${this.waves.total}: ${w.count} ${w.kinds && w.kinds.some((k) => k !== "glider") ? "hostiles" : "gliders"}.`;
    this.ctx.audio.ui();
  }

  protected run(dt: number): void {
    const was = this.waves.state;
    if (this.waves.tick(dt, this.ctx.combat.enemies.aliveCount)) {
      this.win();
      return;
    }
    if (was === "wave" && this.waves.state === "wait") {
      this.line = `Wave ${this.waves.index} clear. ${this.waves.total - this.waves.index} to go.`;
      this.ctx.audio.ui();
    }
  }
}
