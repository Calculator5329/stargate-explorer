import type { ShipDef } from "@/ships/defs";
import { T } from "@/core/tunables";
import { GLIDER } from "@/combat/glider-def";
import { INTERCEPTOR } from "@/combat/interceptor-def";
import { GUNBOAT } from "@/combat/gunboat-def";
import { BOMBER } from "@/combat/bomber-def";

export type EnemyKind = "glider" | "interceptor" | "gunboat" | "bomber" | "ace";

/** Every number the brain reads for one kind; each table lives in `T` so the tuning panel binds it. */
export type EnemyStats = typeof T.enemy;

/** The ace flies a glider hull with gold trim and a white glow so a veteran reads at a glance (a system faction palette still recolours it). */
export const ACE: ShipDef = { ...GLIDER, name: "Ace", palette: { body: 0x6e6a5a, accent: 0xf2d264, dark: 0x2a2820, glow: 0xfff0c0, canopy: 0x3a2a12 } };

/**
 * The enemy roster: hull + stats per kind. Stats are references into `T`, not
 * copies, so live tuning reaches enemies already in the air. Missions pick
 * kinds per wave (`Wave.kinds`); anything unspecified is a glider.
 */
export const ENEMY_KINDS: Record<EnemyKind, { def: ShipDef; stats: EnemyStats; label: string }> = {
  glider: { def: GLIDER, stats: T.enemy, label: "GLIDER" },
  interceptor: { def: INTERCEPTOR, stats: T.interceptor, label: "INTERCEPTOR" },
  gunboat: { def: GUNBOAT, stats: T.gunboat, label: "GUNBOAT" },
  bomber: { def: BOMBER, stats: T.bomber, label: "BOMBER" },
  ace: { def: ACE, stats: T.ace, label: "ACE" },
};
