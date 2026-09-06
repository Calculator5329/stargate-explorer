import { Mission, fmt } from "@/mission/mission";
import type { MissionCtx } from "@/mission/mission";
import type { DuelLevel } from "@/mission/levels";
import { ENEMY_KINDS, type EnemyKind } from "@/combat/enemy-kinds";

/**
 * "The duel": free play against one enemy kind. Each round spawns the foe
 * `distance` ahead, nose on; a kill is a round to the player, and the hull and
 * missiles come back between rounds. First to `rounds` wins; dying loses.
 * `?foe=<kind>` picks the opponent, so every table in `T.<kind>` can be felt
 * on its own (this is the tuning bench as much as a mission).
 */
export class DuelMission extends Mission {
  readonly foe: EnemyKind;
  private round = 0;
  private wins = 0;
  private pauseT = 0;
  private roundClock = 0;
  private readonly times: number[] = [];

  constructor(override readonly def: DuelLevel, ctx: MissionCtx) {
    super(def, ctx);
    const want = new URLSearchParams(location.search).get("foe") ?? "";
    this.foe = want in ENEMY_KINDS ? (want as EnemyKind) : def.foe;
    this.winTitle = "DUEL WON";
    this.line = `${def.intro.join("  ")}  ·  ${ENEMY_KINDS[this.foe].label}`;
  }

  protected begin(): void {
    this.startRound();
  }

  private startRound(): void {
    const C = this.ctx.combat;
    this.round++;
    this.roundClock = 0;
    C.restock();
    C.player.hp = C.maxHp;
    this.spawnCone(1, this.def.distance, this.def.distance, 0.02, [this.foe]);
    this.line = `Round ${this.round}  ·  first to ${this.def.rounds}  ·  ${this.wins} : ${this.round - 1 - this.wins}`;
    this.phase = "wave";
    this.ctx.audio.ui();
  }

  protected run(dt: number): void {
    if (this.pauseT > 0) {
      this.pauseT -= dt;
      if (this.pauseT <= 0) this.startRound();
      return;
    }
    this.roundClock += dt;
    if (this.ctx.combat.enemies.aliveCount === 0) {
      this.wins++;
      this.times.push(this.roundClock);
      if (this.wins >= this.def.rounds) {
        this.win();
        return;
      }
      this.pauseT = this.def.pause;
      this.phase = "wait";
      this.line = `Round ${this.round} to you in ${fmt(this.roundClock)}. Next one in ${this.def.pause} s.`;
      this.ctx.audio.ui();
    }
  }

  override summary(): string {
    return `${super.summary()}\nrounds ${this.wins}/${this.def.rounds} vs ${ENEMY_KINDS[this.foe].label.toLowerCase()}\nfastest round ${fmt(Math.min(...this.times))}`;
  }

  protected override deathLine(): string {
    return `Round ${this.round}, ${this.wins} : ${this.round - 1 - this.wins}. The ${ENEMY_KINDS[this.foe].label.toLowerCase()} had you.`;
  }
}
