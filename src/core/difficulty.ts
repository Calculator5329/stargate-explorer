/**
 * Difficulty presets: multipliers on the enemy side of `T` only. The player's
 * ship never changes with difficulty (that is what ship stats are for), so a
 * setting change is felt as "they are faster / hit harder", nothing else.
 * `D` is the live preset; enemies.ts and combat.ts read it at use time.
 */
export type DifficultyName = "easy" | "normal" | "hard";

export interface Difficulty {
  enemySpeed: number;
  enemyHp: number;
  enemyFireRate: number;
  enemyDamage: number;
  /** enemy aim spread multiplier (higher = sloppier) */
  enemySpread: number;
}

export const DIFFICULTIES: Record<DifficultyName, Difficulty> = {
  easy: { enemySpeed: 0.8, enemyHp: 0.85, enemyFireRate: 0.7, enemyDamage: 0.6, enemySpread: 1.6 },
  normal: { enemySpeed: 1, enemyHp: 1, enemyFireRate: 1, enemyDamage: 1, enemySpread: 1 },
  hard: { enemySpeed: 1.15, enemyHp: 1.25, enemyFireRate: 1.35, enemyDamage: 1.4, enemySpread: 0.7 },
};

export const D: Difficulty = { ...DIFFICULTIES.normal };
export let difficultyName: DifficultyName = "normal";

export function setDifficulty(name: DifficultyName): void {
  difficultyName = name;
  Object.assign(D, DIFFICULTIES[name]);
}

export function parseDifficulty(v: string | null | undefined): DifficultyName {
  return v === "easy" || v === "hard" ? v : "normal";
}
