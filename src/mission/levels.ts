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

export type LevelDef = ClearLevel | RunLevel | ProtectLevel | StrikeLevel | RaceLevel | HoldLevel | DuelLevel | HuntLevel | InterceptLevel;

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
    id: "duel",
    type: "duel",
    system: "tollana",
    title: "THE DUEL",
    blurb: "Free play. One ace, open space over the gas giant, nose to nose at 900 m, first to three. Add ?foe=glider|interceptor|gunboat|bomber to the address for a different opponent.",
    intro: ["One ship, one pilot, nothing in the way.", "First to three. Do not take the head-on pass."],
    requires: "belt-clear",
    beltScale: 0.06,
    foe: "ace",
    rounds: 3,
    distance: 900,
    pause: 3,
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
    id: "hunt",
    type: "hunt",
    system: "chulak",
    title: "RUN IT DOWN",
    blurb: "An ace is running the gate chain out of Chulak and will escape through the last gate. Catch it before then; it only turns to fight when you are close.",
    intro: ["Courier glider on the chain, running for the far gate.", "It is faster than your cruise and it knows the rock. Boost is how you catch it."],
    requires: "gauntlet",
    rings: 9,
    spacing: 640,
    wander: 360,
    ringRadius: 40,
    timeLimit: 170,
    harassAt: 0,
    harass: 0,
    minesPerGate: 0,
    quarry: "ace",
    quarrySpeed: 168,
    fightDist: 260,
    fightT: 7,
    fightCd: 6,
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
    id: "wreck-race",
    type: "race",
    system: "graveyard",
    title: "RACE THROUGH THE WRECKS",
    blurb: "Ten gates threaded through the hulks against six racers who know the field. Tight, dark, and the walls are ships.",
    intro: ["Grid is set inside the Graveyard. Ten gates, six rivals.", "They know where the gaps are. Learn fast."],
    requires: "ring-race",
    rings: 10,
    spacing: 560,
    wander: 360,
    ringRadius: 34,
    timeLimit: 900,
    harassAt: 0,
    harass: 0,
    minesPerGate: 0,
    racers: 6,
    racerSpeed: 178,
    racerVar: 0.1,
    racerAccel: 66,
    racerTurn: 2.2,
  },
  {
    id: "shard-run",
    type: "run",
    title: "THE SHARD RUN",
    blurb: "Twelve tight gates through the Kheb ice field. No mines, no escorts, nothing to shoot. Just the gaps.",
    system: "kheb",
    intro: ["Kheb. Ice, all of it long and sharp.", "Twelve gates, close together, in the thick of the shards.", "Nothing is shooting at you. The field is the enemy."],
    requires: "ring-race",
    rings: 12,
    spacing: 460,
    wander: 300,
    ringRadius: 30,
    timeLimit: 110,
    harassAt: 99,
    harass: 0,
    minesPerGate: 0,
  },
  {
    id: "descent",
    type: "run",
    system: "p3x774",
    title: "THE DESCENT",
    blurb: "Fourteen gates down through the belt over P3X-774 with three mines on every rim. Aces pick up the chase at gate five.",
    intro: ["The belt tilts here; the chain goes down through it.", "Fourteen gates, mines on all of them, and someone good is waiting at the fifth."],
    requires: "shard-run",
    rings: 14,
    spacing: 520,
    wander: 340,
    ringRadius: 32,
    timeLimit: 150,
    harassAt: 5,
    harass: 2,
    harassKinds: ["ace"],
    minesPerGate: 3,
  },
  {
    id: "graveyard-ambush",
    type: "clear",
    title: "AMBUSH IN THE GRAVEYARD",
    blurb: "Interceptors hunting through the wreck of the last fleet. Use the hulks; they cannot turn inside them.",
    system: "graveyard",
    intro: ["The Graveyard. Nothing here is whole.", "Interceptors, a lot of them, using the wrecks the way you should.", "Get behind a hull plate before they get behind you."],
    requires: "shard-run",
    waves: [
      { count: 3, kinds: ["interceptor"], delay: 2, near: 500, far: 750 },
      { count: 5, kinds: ["interceptor", "interceptor", "glider"], delay: 4, near: 500, far: 800 },
      { count: 6, kinds: ["interceptor", "gunboat", "interceptor", "interceptor"], delay: 5, near: 550, far: 850 },
    ],
    finaleLine: "Last wave. A gunboat is in there with them. Wrecks first, then the guns.",
  },
  {
    id: "chulak-aces",
    type: "clear",
    system: "chulak",
    title: "THE ACES OF CHULAK",
    blurb: "Their best pilots, in gold-trimmed gliders, over their own staging belt. They will not take the head-on pass. Neither should you.",
    intro: ["Chulak. Gold trim on the gliders coming up: aces.", "They flinch early and they saddle late. Make them turn until they cannot."],
    requires: "graveyard-ambush",
    unlocks: "glider",
    waves: [
      { count: 2, kinds: ["ace"], delay: 3, near: 650, far: 850 },
      { count: 4, kinds: ["ace", "glider", "ace", "interceptor"], delay: 5, near: 700, far: 950 },
      { count: 5, kinds: ["ace", "ace", "interceptor", "ace", "glider"], delay: 5, near: 750, far: 1000 },
    ],
    finaleLine: "Last wave. Three aces. Salvage says one glider comes home in pieces if you leave one whole enough.",
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
    id: "bomber-line",
    type: "intercept",
    system: "p3x774",
    title: "THE BOMBER LINE",
    blurb: "Bombers on a straight line to the relay behind you, gliders riding with them. Every bomber that reaches the relay is a leak; three leaks and it is gone. Two and a half minutes.",
    intro: ["Bombers inbound on the relay, and they will not turn for you.", "Kill the bombers. The gliders are there to make you forget that."],
    requires: "escort",
    duration: 150,
    firstDelay: 4,
    interval: 16,
    groupStart: 1,
    groupGrow: 1,
    maxAlive: 6,
    runner: "bomber",
    runnerSpeed: 105,
    escortsPer: 2,
    escortKinds: ["glider", "interceptor"],
    near: 1100,
    far: 1400,
    lineBehind: 1300,
    maxLeaks: 3,
    restockEvery: 30,
    finaleLine: "Last bombers on the line. Nothing reaches the relay.",
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
    unlocks: "heavy",
  },
  {
    id: "netu-convoy",
    type: "protect",
    system: "netu",
    title: "BRING THE TENDER HOME",
    blurb: "A captured tender is crawling out of Netu with a Lancer in its hold. Bombers want it. Bombers are slow, so kill them early or lose the ship.",
    intro: ["Tender is under way, thirty metres a second and no faster.", "Bombers inbound. They do not turn, they do not stop. Meet them out front."],
    requires: "blockade",
    unlocks: "lancer",
    waves: [
      { count: 3, delay: 5, near: 1000, far: 1200, kinds: ["bomber", "glider", "glider"] },
      { count: 5, delay: 6, near: 1000, far: 1300, kinds: ["bomber", "bomber", "interceptor", "glider", "interceptor"] },
      { count: 6, delay: 6, near: 1100, far: 1400, kinds: ["bomber", "bomber", "bomber", "ace", "interceptor", "glider"] },
    ],
    finaleLine: "Three bombers, and they are lined up on the tender. Torpedoes on the bombers; the rest can wait.",
    escortHp: 420,
    escortSpeed: 30,
    escortHull: "gunboat",
    escortName: "Tender",
    escortPalette: "tauri",
    escortRadius: 16,
  },
  {
    id: "hold-the-gate",
    type: "hold",
    system: "abydos",
    title: "HOLD THE GATE",
    blurb: "Three minutes over the home gate against everything they have. Nothing to clear, only a clock to beat. Missiles restock every half minute.",
    intro: ["They are coming through in numbers and they will keep coming.", "Three minutes until the gate is ours again. Stay alive."],
    requires: "blockade",
    unlocks: "dart",
    duration: 180,
    firstDelay: 3,
    interval: 9,
    groupStart: 2,
    groupGrow: 2,
    maxAlive: 8,
    kinds: ["glider", "glider", "interceptor", "glider", "gunboat", "ace", "interceptor", "bomber"],
    near: 700,
    far: 1000,
    restockEvery: 30,
    finaleLine: "Last seconds. Whatever is left, keep it off you.",
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
  {
    id: "tollana-siege",
    type: "strike",
    system: "tollana",
    title: "THE SECOND MOTHERSHIP",
    blurb: "Another Ha'tak, over Tollana this time, with aces on the ring and bombers in the hangar. Twice the mines. Same pyramid, same order: guns, nodes, hull.",
    intro: ["Second Ha'tak, and this one launched its best when we came through.", "Same drill. Ring guns, shield nodes, hull. Watch the bombers when a node goes."],
    requires: "hatak",
    distance: 2100,
    escorts: 3,
    reinforce: 3,
    escortKinds: ["ace", "interceptor", "ace"],
    reinforceKinds: ["bomber", "glider", "ace"],
    mines: 22,
  },
];

export function parseLevel(v: string | null | undefined): LevelDef {
  return LEVELS.find((l) => l.id === v) ?? LEVELS[0]!;
}
