import type { ShipDef } from "@/ships/defs";
import { T } from "@/core/tunables";
import { GLIDER } from "@/combat/glider-def";
import { INTERCEPTOR } from "@/combat/interceptor-def";
import { GUNBOAT } from "@/combat/gunboat-def";

export type EnemyKind = "glider" | "interceptor" | "gunboat";

/** Every number the brain reads for one kind; each table lives in `T` so the tuning panel binds it. */
export type EnemyStats = typeof T.enemy;

/**
 * The enemy roster: hull + stats per kind. Stats are references into `T`, not
 * copies, so live tuning reaches enemies already in the air. Missions pick
 * kinds per wave (`Wave.kinds`); anything unspecified is a glider.
 */
export const ENEMY_KINDS: Record<EnemyKind, { def: ShipDef; stats: EnemyStats; label: string }> = {
  glider: { def: GLIDER, stats: T.enemy, label: "GLIDER" },
  interceptor: { def: INTERCEPTOR, stats: T.interceptor, label: "INTERCEPTOR" },
  gunboat: { def: GUNBOAT, stats: T.gunboat, label: "GUNBOAT" },
};
