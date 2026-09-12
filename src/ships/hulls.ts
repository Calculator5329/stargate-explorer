import type { ShipDef } from "@/ships/defs";
import { F11_HALBERD } from "@/ships/defs";
import { PROMETHEUS, PROMETHEUS_ORIGINAL } from "@/ships/prometheus-def";
import { PLAYER_HULL, PLAYER_ORIGINAL } from "@/ships/variants";
import { GLIDER, GLIDER_ORIGINAL } from "@/combat/glider-def";
import { INTERCEPTOR, INTERCEPTOR_ORIGINAL } from "@/combat/interceptor-def";
import { GUNBOAT, GUNBOAT_ORIGINAL } from "@/combat/gunboat-def";
import { RACER, RACER_ORIGINAL } from "@/ships/racer-def";
import { HEAVY, HEAVY_ORIGINAL } from "@/ships/heavy-def";
import { DART, DART_ORIGINAL } from "@/ships/dart-def";
import { LANCER, LANCER_ORIGINAL } from "@/ships/lancer-def";
import { BOMBER, BOMBER_ORIGINAL } from "@/combat/bomber-def";
import { ACE } from "@/combat/enemy-kinds";
import { CARGO_SHIP, CARRIER_SHIP, RACE_TRANSPORT_SHIP } from "@/ships/episode-earth";

/**
 * Every hull def by key, player and enemy alike, so `?view=side&hull=<key>`
 * can inspect any of them. Enemy hulls register here as they are added.
 */
export const HULLS: Record<string, ShipDef> = { f11: PLAYER_HULL, original: F11_HALBERD, prometheus: PROMETHEUS, glider: GLIDER, interceptor: INTERCEPTOR, gunboat: GUNBOAT, racer: RACER, heavy: HEAVY, dart: DART, lancer: LANCER, bomber: BOMBER, ace: ACE };
Object.assign(HULLS, { cargo: CARGO_SHIP, carrier: CARRIER_SHIP, civilian: RACE_TRANSPORT_SHIP });

/** Preserved, inspectable pre-refinement designs. */
export const ORIGINAL_HULLS: Record<string, ShipDef> = {f11:PLAYER_ORIGINAL,prometheus:PROMETHEUS_ORIGINAL,glider:GLIDER_ORIGINAL,bomber:BOMBER_ORIGINAL,heavy:HEAVY_ORIGINAL,dart:DART_ORIGINAL,lancer:LANCER_ORIGINAL,racer:RACER_ORIGINAL,interceptor:INTERCEPTOR_ORIGINAL,gunboat:GUNBOAT_ORIGINAL,ace:{...GLIDER_ORIGINAL,name:'Ace',palette:ACE.palette}};
for (const [key, def] of Object.entries(ORIGINAL_HULLS)) HULLS[`old-${key}`] = def;
