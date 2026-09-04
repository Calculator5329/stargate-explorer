import type { ShipDef } from "@/ships/defs";
import { F11_HALBERD } from "@/ships/defs";
import { PROMETHEUS } from "@/ships/prometheus-def";
import { PLAYER_HULL } from "@/ships/variants";
import { GLIDER } from "@/combat/glider-def";
import { INTERCEPTOR } from "@/combat/interceptor-def";
import { GUNBOAT } from "@/combat/gunboat-def";

/**
 * Every hull def by key, player and enemy alike, so `?view=side&hull=<key>`
 * can inspect any of them. Enemy hulls register here as they are added.
 */
export const HULLS: Record<string, ShipDef> = { f11: PLAYER_HULL, original: F11_HALBERD, prometheus: PROMETHEUS, glider: GLIDER, interceptor: INTERCEPTOR, gunboat: GUNBOAT };
