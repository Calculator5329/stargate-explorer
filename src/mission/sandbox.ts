import { Mission } from "@/mission/mission";
import type { MissionCtx } from "@/mission/mission";
import type { SandboxLevel } from "@/mission/levels";

/** Free practice: no enemies, timer or win; invulnerable hull and resources between moves. */
export class SandboxMission extends Mission {
  private restockT: number;
  private lastLine = "";

  constructor(override readonly def: SandboxLevel, ctx: MissionCtx) {
    super(def, ctx);
    this.restockT = def.restockEvery;
    ctx.combat.practice = true;
    this.timer = 0;
  }

  protected begin(): void {
    this.line = this.lastLine = this.list();
    this.ctx.audio.ui();
  }

  private list(): string {
    return "SANDBOX · Invulnerable · Bar refills between moves · Esc for flight lab & trick keys";
  }

  protected run(dt: number): void {
    const d = this.def, f = this.ctx.flight;
    if (!f.move) f.boostEnergy = 1;
    if (d.restockEvery > 0 && (this.restockT -= dt) <= 0) {
      this.restockT = d.restockEvery;
      this.ctx.combat.restock();
    }
    this.phase = "wait";
    const line = f.move ? `${f.move.name.toUpperCase()}  ·  ${Math.round(100 * f.boostEnergy)}% bar` : this.list();
    if (line !== this.lastLine) this.line = this.lastLine = line;
  }
}
