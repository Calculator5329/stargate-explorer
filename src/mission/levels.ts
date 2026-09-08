/**
 * Level data: everything a designer tunes lives here, not in the runners.
 * Story beats lean on the show (a Ha'tak over the belt, the Prometheus limping
 * home) but franchise names stay in strings, never in identifiers.
 */
import { ENEMY_KINDS, type EnemyKind } from "@/combat/enemy-kinds";

export interface Wave {
  count: number;
  /** enemy kinds, cycled per spawn; omitted = all gliders */
  kinds?: EnemyKind[];
  /** seconds after the previous wave clears (or after the intro) */
  delay: number;
  /** spawn distance band from the player (m) */
  near: number;
  far: number;
}

interface BaseLevel {
  id: string;
  /** campaign act (content/campaign.json `acts`) and the level's spot on the campaign board */
  act?: string;
  board?: { x: number; y: number };
  title: string;
  /** one line for the mission-select card */
  blurb: string;
  /** SystemDef id this mission happens in */
  system: string;
  intro: string[];
  /** mission id that must be completed first */
  requires?: string;
  /** ship id unlocked on first completion */
  unlocks?: string;
  /** multiply the system's rock count (0.06 = a few reference rocks in open space) */
  beltScale?: number;
}

export interface ClearLevel extends BaseLevel {
  type: "clear";
  waves: Wave[];
  finaleLine: string;
}

/** A gate chain through the belt: shared by the gauntlet and the race. */
interface CourseFields {
  rings: number;
  /** distance between gates (m) and how far sideways the chain may turn per gate (m) */
  spacing: number;
  wander: number;
  ringRadius: number;
  timeLimit: number;
  /** gliders that join the chase at this ring index (0 = none) */
  harassAt: number;
  harass: number;
  harassKinds?: EnemyKind[];
  /** proximity mines laid just outside each gate's rim */
  minesPerGate: number;
}

export interface RunLevel extends BaseLevel, CourseFields {
  type: "run";
}

export interface RaceLevel extends BaseLevel, CourseFields {
  type: "race";
  /** AI rivals on the grid, their base speed (m/s), per-racer skill spread (±fraction), accel and turn rate */
  racers: number;
  racerSpeed: number;
  racerVar: number;
  racerAccel: number;
  racerTurn: number;
}

export interface ProtectLevel extends BaseLevel {
  type: "protect";
  waves: Wave[];
  finaleLine: string;
  escortHp: number;
  escortSpeed: number;
  /** hull key in `ships/hulls.ts` (default the Prometheus) and the name the HUD uses for it */
  escortHull?: string;
  escortName?: string;
  /** recolour the escort hull with a faction palette (an enemy hull flown as a friendly) */
  escortPalette?: "tauri" | "cream";
  /** hit radius of the escort (m) */
  escortRadius?: number;
}

/** Outlast the clock: groups keep coming on an interval and grow with time. */
export interface HoldLevel extends BaseLevel {
  type: "hold";
  /** seconds to survive */
  duration: number;
  /** seconds before the first group, then between groups */
  firstDelay: number;
  interval: number;
  /** group size at the start and how many more per minute of clock */
  groupStart: number;
  groupGrow: number;
  /** never more than this many alive */
  maxAlive: number;
  /** cycled across every spawn, so the tail of the list arrives later in the fight */
  kinds: EnemyKind[];
  near: number;
  far: number;
  /** missiles come back this often (s) */
  restockEvery: number;
  finaleLine: string;
}

export interface StrikeLevel extends BaseLevel {
  type: "strike";
  /** how far ahead the cruiser sits at the start (m) */
  distance: number;
  /** escort gliders at the start, and per shield node lost */
  escorts: number;
  reinforce: number;
  escortKinds?: EnemyKind[];
  reinforceKinds?: EnemyKind[];
  /** proximity mines in a ring around the hull */
  mines: number;
}

/** Free play against one enemy kind, nose to nose, first to `rounds`. `?foe=<kind>` overrides the kind. */
export interface DuelLevel extends BaseLevel {
  type: "duel";
  foe: EnemyKind;
  rounds: number;
  /** starting separation (m) */
  distance: number;
  /** seconds between rounds */
  pause: number;
}

/** Pursuit: a quarry flies the gate chain and escapes through the last gate; it only turns to fight inside `fightDist`. */
export interface HuntLevel extends BaseLevel, CourseFields {
  type: "hunt";
  quarry: EnemyKind;
  /** m/s while running the chain */
  quarrySpeed: number;
  /** inside this range it stops running and fights for `fightT` seconds, then runs again after `fightCd` */
  fightDist: number;
  fightT: number;
  fightCd: number;
}

/** Bombers on a line to a point behind the player; each one that reaches it is a leak. Outlast `duration` with fewer than `maxLeaks`. */
export interface InterceptLevel extends BaseLevel {
  type: "intercept";
  duration: number;
  firstDelay: number;
  interval: number;
  groupStart: number;
  groupGrow: number;
  maxAlive: number;
  runner: EnemyKind;
  runnerSpeed: number;
  /** fighters that come with each group, normal brains */
  escortsPer: number;
  escortKinds?: EnemyKind[];
  near: number;
  far: number;
  /** the point they are flying for sits this far behind the player's start (m) */
  lineBehind: number;
  maxLeaks: number;
  restockEvery: number;
  finaleLine: string;
}

/** A proving ground: nothing to shoot, nothing to win, the move list on the HUD. For trying moves out. */
export interface SandboxLevel extends BaseLevel {
  type: "sandbox";
  /** missiles come back this often (s), so the guns can be tried too; 0 = never */
  restockEvery: number;
}

export type LevelDef = ClearLevel | RunLevel | ProtectLevel | StrikeLevel | RaceLevel | HoldLevel | DuelLevel | HuntLevel | InterceptLevel | SandboxLevel;

/**
 * The campaign lives in `content/campaign.json` (acts + levels); the in-game editor (`?edit=1`, `src/editor/`)
 * writes that file through the dev server. The types above are the contract the JSON must satisfy; `checkLevels`
 * catches the mistakes a hand edit can make (duplicate id, dangling requires) before a mission tries to run.
 */
import campaign from "@/content/campaign.json";

export interface Act {
  id: string;
  title: string;
  blurb: string;
}

export const ACTS: Act[] = campaign.acts;
export const LEVELS: LevelDef[] = campaign.levels as unknown as LevelDef[];

/** Problems in a level list, one line each; empty when the list is sound. */
export function checkLevels(levels: readonly LevelDef[]): string[] {
  const out: string[] = [], ids = new Set<string>();
  for (const l of levels) {
    if (ids.has(l.id)) out.push(`duplicate id ${l.id}`);
    ids.add(l.id);
  }
  for (const l of levels) if (l.requires && !ids.has(l.requires)) out.push(`${l.id} requires unknown ${l.requires}`);
  // a cycle in requires locks every level on it forever
  for (const l of levels) {
    const seen = new Set<string>();
    let cur: LevelDef | undefined = l;
    while (cur?.requires) {
      if (seen.has(cur.id)) { out.push(`requires cycle through ${l.id}`); break; }
      seen.add(cur.id);
      const next: string = cur.requires;
      cur = levels.find((x) => x.id === next);
    }
  }
  return out;
}

export function parseLevel(v: string | null | undefined): LevelDef {
  return LEVELS.find((l) => l.id === v) ?? LEVELS[0]!;
}

if (import.meta.env.DEV) for (const line of checkLevels(LEVELS)) console.error(`campaign.json: ${line}`);

/**
 * The most of each enemy kind a level can have alive at once, for `Enemies.prewarm`: wave counts by cycled kind
 * (waves wait for zero alive, so the max over waves is the pool depth), plus two of every kind a scripted
 * spawn names (`foe`, `quarry`, `runner`, escorts, reinforcements, harassers).
 */
export function enemyKindsOf(def: LevelDef): Map<EnemyKind, number> {
  const out = new Map<EnemyKind, number>();
  const bump = (k: EnemyKind, n: number) => out.set(k, Math.max(out.get(k) ?? 0, n));
  const isKind = (v: unknown): v is EnemyKind => typeof v === "string" && v in ENEMY_KINDS;
  const walk = (v: unknown, key: string): void => {
    if (Array.isArray(v)) {
      if (key === "waves") {
        for (const w of v as Wave[]) {
          const kinds = w.kinds?.length ? w.kinds : (["glider"] as EnemyKind[]);
          const per = new Map<EnemyKind, number>();
          for (let i = 0; i < w.count; i++) {
            const k = kinds[i % kinds.length]!;
            per.set(k, (per.get(k) ?? 0) + 1);
          }
          for (const [k, n] of per) bump(k, n);
        }
      } else for (const x of v) walk(x, key);
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) walk(x, k);
    } else if (isKind(v) && /kind|foe|quarry|runner/i.test(key)) bump(v, 2);
  };
  walk(def, "");
  return out;
}
