import { Mission } from "@/mission/mission";
import type { MissionCtx } from "@/mission/mission";
import type { SandboxLevel } from "@/mission/levels";
import { chordName } from "@/sim/moves";

/**
 * The proving ground (Ethan, 2026-09-06: "some type of sandbox mode where I can test all these different
 * moves out"): no enemies, no clock, no win. The HUD line lists every move with its chord, and names the
 * one running. The mission only ends if the belt kills you.
 */
export class SandboxMission extends Mission {
  private restockT: number;
  private lastLine = "";

  constructor(override readonly def: SandboxLevel, ctx: MissionCtx) {
    super(def, ctx);
    this.restockT = def.restockEvery;
  }

  protected begin(): void {
    this.line = this.lastLine = this.list();
    this.ctx.audio.ui();
  }

  private list(): string {
    return this.ctx.flight.moves.map((m) => `${chordName(m)} ${m.name}`).join("  ·  ");
  }

  protected run(dt: number): void {
    const d = this.def, f = this.ctx.flight;
    if (d.restockEvery > 0 && (this.restockT -= dt) <= 0) {
      this.restockT = d.restockEvery;
      this.ctx.combat.restock();
    }
    this.phase = "wait";
    const line = f.move ? `${f.move.name.toUpperCase()}  ·  ${Math.round(100 * f.boostEnergy)}% bar` : this.list();
    if (line !== this.lastLine) this.line = this.lastLine = line;
  }

  protected override deathLine(): string {
    return "The proving ground has rocks too.";
  }
}
