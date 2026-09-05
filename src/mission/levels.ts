/**
 * Level data: everything a designer tunes lives here, not in the runners.
 * Story beats lean on the show (a Ha'tak over the belt, the Prometheus limping
 * home) but franchise names stay in strings, never in identifiers.
 */
import type { EnemyKind } from "@/combat/enemy-kinds";

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

export type LevelDef = ClearLevel | RunLevel | ProtectLevel | StrikeLevel | RaceLevel;

export const LEVELS: LevelDef[] = [
  {
    id: "belt-clear",
    type: "clear",
    system: "abydos",
    title: "CLEAR THE FIELD",
    blurb: "Three waves of death gliders in the belt. Learn the guns, learn the missiles.",
    intro: ["Gliders inbound through the belt.", "Clear them before they reach the gate."],
    waves: [
      { count: 2, delay: 4, near: 700, far: 900 },
      { count: 3, delay: 5, near: 800, far: 1000 },
      { count: 5, delay: 5, near: 800, far: 1100, kinds: ["glider", "interceptor", "glider", "interceptor", "glider"] },
    ],
    finaleLine: "Last wave. Interceptors with them, the quick ones.",
  },
  {
    id: "gauntlet",
    type: "run",
    system: "abydos",
    title: "THE GAUNTLET",
    blurb: "Ten gates threaded through the thickest rock in the belt, either way through. Mines on the rims; interceptors join the chase halfway.",
    intro: ["The window closes in two minutes.", "The gates sit in the rock. Fly them, either way through."],
    requires: "belt-clear",
    rings: 10,
    spacing: 620,
    wander: 380,
    ringRadius: 34,
    timeLimit: 120,
    harassAt: 4,
    harass: 2,
    harassKinds: ["interceptor"],
    minesPerGate: 2,
  },
  {
    id: "ring-race",
    type: "race",
    system: "tollana",
    title: "THE TOLLAN RING",
    blurb: "Eight gates around a gas giant against four racers. Any finish counts; the podium is the point.",
    intro: ["Grid is set. Eight gates, four rivals, no guns.", "Boost is your only edge. Spend it where the rock is thin."],
    requires: "gauntlet",
    rings: 8,
    spacing: 700,
    wander: 420,
    ringRadius: 38,
    timeLimit: 900,
    harassAt: 0,
    harass: 0,
    minesPerGate: 0,
    racers: 4,
    racerSpeed: 165,
    racerVar: 0.08,
    racerAccel: 60,
    racerTurn: 2.0,
  },
  {
    id: "escort",
    type: "protect",
    system: "chulak",
    title: "COVER THE PROMETHEUS",
    blurb: "The Prometheus is limping to the gate with her shields down. Keep the gliders off her hull; gunboats come for the engines.",
    intro: ["Prometheus reports shields down, sublight only.", "Nothing reaches her. Nothing."],
    requires: "gauntlet",
    waves: [
      { count: 3, delay: 5, near: 900, far: 1100 },
      { count: 4, delay: 6, near: 900, far: 1200, kinds: ["gunboat", "glider", "glider", "glider"] },
      { count: 6, delay: 6, near: 1000, far: 1300, kinds: ["gunboat", "glider", "interceptor", "gunboat", "glider", "interceptor"] },
    ],
    finaleLine: "Last wave. Two gunboats, and they are going for the engines.",
    escortHp: 600,
    escortSpeed: 26,
  },
  {
    id: "blockade",
    type: "clear",
    system: "netu",
    title: "BREAK THE BLOCKADE",
    blurb: "Gunboats hold the lane out of Netu's belt with interceptors screening. Kill the heavies; the screen dies with them.",
    intro: ["Blockade line ahead, gunboats anchoring it.", "Missiles for the heavies. Guns for the rest."],
    requires: "escort",
    waves: [
      { count: 4, delay: 4, near: 900, far: 1100, kinds: ["gunboat", "interceptor", "interceptor", "glider"] },
      { count: 5, delay: 6, near: 900, far: 1200, kinds: ["gunboat", "gunboat", "interceptor", "glider", "interceptor"] },
      { count: 6, delay: 6, near: 1000, far: 1300, kinds: ["gunboat", "gunboat", "gunboat", "interceptor", "interceptor", "glider"] },
    ],
    finaleLine: "Three gunboats. Missiles first, then get behind them.",
  },
  {
    id: "hatak",
    type: "strike",
    system: "p3x774",
    title: "BRING DOWN THE HA'TAK",
    blurb: "A Goa'uld mothership is parked over the belt behind a minefield. Ring guns first, then the three shield nodes, then the hull.",
    intro: ["Ha'tak in orbit, shields up, gliders launching.", "Kill the ring guns, drop the shield nodes, then burn the pyramid."],
    requires: "escort",
    unlocks: "prometheus",
    distance: 1700,
    escorts: 2,
    reinforce: 2,
    escortKinds: ["interceptor"],
    reinforceKinds: ["glider", "gunboat"],
    mines: 14,
  },
];

export function parseLevel(v: string | null | undefined): LevelDef {
  return LEVELS.find((l) => l.id === v) ?? LEVELS[0]!;
}
