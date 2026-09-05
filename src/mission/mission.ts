import * as THREE from "three";
import type { Combat } from "@/combat/combat";
import type { Audio } from "@/audio/audio";
import type { RockSpheres } from "@/combat/enemies";
import type { EnemyKind } from "@/combat/enemy-kinds";
import type { Flight } from "@/sim/flight";
import type { Tracked } from "@/combat/targets";
import type { LevelDef, Wave } from "@/mission/levels";
import { T } from "@/core/tunables";

export type Phase = "intro" | "wait" | "wave" | "run" | "dying" | "complete" | "lost";

export interface MissionCtx {
  combat: Combat;
  rocks: RockSpheres;
  audio: Audio;
  flight: Flight;
}

const _dir = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Base mission: intro → `begin()` → `run()` every tick until `win()` or
 * `fail()`; lost automatically when the player dies. Subclasses own their
 * objects under `group` (rings, an escort, a cruiser) and the mission-specific
 * lockables they register with `combat.extras` / `combat.friendlies`.
 */
export abstract class Mission {
  phase: Phase = "intro";
  timer = 4;
  /** mission clock, seconds since the intro ended */
  clock = 0;
  /** one-line status for the HUD */
  line = "";
  readonly group = new THREE.Group();
  winTitle = "MISSION COMPLETE";
  loseTitle = "SHIP LOST";
  loseLine = "";
  /** where the HUD points when no enemy is boxed (next ring, the escort, the hull) */
  marker: Tracked | null = null;
  /** true once the outcome is recorded by the game layer */
  recorded = false;

  constructor(readonly def: LevelDef, protected readonly ctx: MissionCtx) {
    this.line = def.intro.join("  ");
  }

  get done(): boolean {
    return this.phase === "complete" || this.phase === "lost";
  }

  tick(dt: number): void {
    if (this.done) return;
    const P = this.ctx.combat.player;
    if (!P.alive) {
      this.fail(this.deathLine(), "SHIP LOST");
      return;
    }
    this.timer -= dt;
    if (this.phase === "intro") {
      if (this.timer <= 0) {
        this.phase = "wait";
        this.begin();
      }
      return;
    }
    this.clock += dt;
    this.run(dt);
  }

  /** Per render frame, for visuals only; `alpha` is the sim interpolation for anything the mission moves per tick. */
  render(_dt: number, _alpha = 1): void {}

  /** Card body on completion. */
  summary(): string {
    const P = this.ctx.combat.player;
    const acc = P.fired ? Math.round((100 * P.hits) / P.fired) : 0;
    return `time ${fmt(this.clock)}\nkills ${P.kills}\naccuracy ${acc}%\nhull ${Math.round((100 * P.hp) / this.ctx.combat.maxHp)}%`;
  }

  protected deathLine(): string {
    return `${this.ctx.combat.player.kills} gliders down before the belt took you.`;
  }

  protected abstract begin(): void;
  protected abstract run(dt: number): void;

  /** Subclasses call this from `begin()`-like places; also lets the HUD box the first objective during the intro. */
  protected win(): void {
    this.phase = "complete";
    this.line = "";
    this.marker = null;
    this.ctx.audio.win();
  }

  protected fail(line: string, title = "MISSION FAILED"): void {
    this.phase = "lost";
    this.line = "";
    this.marker = null;
    this.loseTitle = title;
    this.loseLine = line;
    this.ctx.audio.lose();
  }

  /** True when no rock sphere (padded by the avoid distance) contains `p`. */
  protected clear(p: THREE.Vector3, pad = T.enemy.avoidDist * 0.5): boolean {
    const R = this.ctx.rocks;
    for (let i = 0; i < R.count; i++) {
      const dx = p.x - R.centers[i * 3]!, dy = p.y - R.centers[i * 3 + 1]!, dz = p.z - R.centers[i * 3 + 2]!;
      const r = R.radii[i]! + pad;
      if (dx * dx + dy * dy + dz * dz < r * r) return false;
    }
    return true;
  }

  /** Spawn `count` enemies in a ~50° cone ahead of the player, `near..far` out, off the rocks; `kinds` cycles per spawn, default gliders. */
  protected spawnCone(count: number, near: number, far: number, halfAngle = 0.45, kinds?: EnemyKind[]): void {
    const f = this.ctx.flight;
    _fwd.set(0, 0, 1).applyQuaternion(f.quat);
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 8; tries++) {
        _q.setFromAxisAngle(_dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), (Math.random() * 2 - 1) * halfAngle * 2);
        _dir.copy(_fwd).applyQuaternion(_q).normalize();
        _pos.copy(f.pos).addScaledVector(_dir, near + Math.random() * (far - near));
        if (this.clear(_pos)) break;
      }
      this.ctx.combat.enemies.spawn(_pos, f.pos, kinds?.[i % kinds.length] ?? "glider");
    }
  }
}

/** Wave sequencing shared by the clear and protect missions: wait `delay`, spawn, wait for zero alive, repeat. */
export class Waves {
  index = 0;
  timer: number;
  /** "wait" between waves, "wave" while one is up */
  state: "wait" | "wave" = "wait";

  constructor(private readonly waves: Wave[], private readonly m: Mission, private readonly spawn: (w: Wave) => void, private readonly restock: () => void) {
    this.timer = waves[0]?.delay ?? 0;
  }

  get total(): number {
    return this.waves.length;
  }

  get isLast(): boolean {
    return this.index >= this.waves.length;
  }

  /** Returns true the tick the last wave is cleared. */
  tick(dt: number, aliveCount: number): boolean {
    if (this.state === "wait") {
      this.timer -= dt;
      if (this.timer > 0) return false;
      const w = this.waves[this.index]!;
      this.index++;
      this.state = "wave";
      this.restock();
      this.spawn(w);
      this.m.phase = "wave";
      return false;
    }
    if (aliveCount > 0) return false;
    if (this.index >= this.waves.length) return true;
    this.state = "wait";
    this.timer = this.waves[this.index]!.delay;
    this.m.phase = "wait";
    return false;
  }
}

export function fmt(sec: number): string {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60), t = Math.floor((sec % 1) * 10);
  return `${m}:${String(s).padStart(2, "0")}.${t}`;
}
