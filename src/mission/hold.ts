import { Mission, fmt } from "@/mission/mission";
import type { MissionCtx } from "@/mission/mission";
import type { HoldLevel } from "@/mission/levels";

/**
 * "Hold the line": no waves to clear, a clock to outlast. Groups spawn on a
 * fixed interval and grow with the clock; the mission is won when the timer
 * runs out with the player still flying. Missiles restock every `restockEvery`
 * seconds so the magazine is a pacing tool, not a hard cap.
 */
export class HoldMission extends Mission {
  private spawnT: number;
  private restockT: number;
  private groups = 0;
  private spawnedTotal = 0;

  constructor(override readonly def: HoldLevel, ctx: MissionCtx) {
    super(def, ctx);
    this.winTitle = "LINE HELD";
    this.spawnT = def.firstDelay;
    this.restockT = def.restockEvery;
  }

  protected begin(): void {
    this.line = `Hold for ${fmt(this.def.duration)}.`;
    this.ctx.audio.ui();
  }

  protected run(dt: number): void {
    const d = this.def;
    if (this.clock >= d.duration) {
      this.win();
      return;
    }
    this.spawnT -= dt;
    this.restockT -= dt;
    if (this.restockT <= 0) {
      this.restockT = d.restockEvery;
      this.ctx.combat.restock();
    }
    const alive = this.ctx.combat.enemies.aliveCount;
    if (this.spawnT <= 0) {
      this.spawnT = d.interval;
      const want = d.groupStart + Math.floor((this.clock / 60) * d.groupGrow);
      const n = Math.min(want, Math.max(0, d.maxAlive - alive));
      if (n > 0) {
        // cycle the kind list across groups, not just within one, so late groups see the heavy end of it
        const kinds = d.kinds.map((_, i) => d.kinds[(this.spawnedTotal + i) % d.kinds.length]!);
        this.spawnCone(n, d.near, d.far, 0.6, kinds);
        this.spawnedTotal += n;
        this.groups++;
        this.ctx.audio.ui();
      }
    }
    const left = Math.max(0, d.duration - this.clock);
    const hostiles = this.ctx.combat.enemies.aliveCount;
    this.phase = hostiles > 0 ? "wave" : "wait";
    this.line = left < 20 ? `${d.finaleLine}  ·  ${fmt(left)}` : `Hold ${fmt(left)}  ·  ${hostiles} hostile${hostiles === 1 ? "" : "s"} up`;
  }

  protected override deathLine(): string {
    return `Held ${fmt(this.clock)} of ${fmt(this.def.duration)}. ${this.ctx.combat.player.kills} down before the line broke.`;
  }

  override summary(): string {
    return `${super.summary()}\nheld ${fmt(this.def.duration)} · ${this.spawnedTotal} came through`;
  }
}
