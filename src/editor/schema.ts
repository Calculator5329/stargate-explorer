import type { EnemyKind } from "@/combat/enemy-kinds";
import type { LevelDef } from "@/mission/levels";

/**
 * What the inspector shows for each level type: one field list per type, plus the fields every level has.
 * The composer renders these generically (a number box, a text box, a chip row of enemy kinds), so a new
 * level field is one line here, not a new panel. Wave lists (`clear`, `protect`) get their own editor.
 */
export type FieldKind = "number" | "text" | "lines" | "kinds" | "kind" | "select" | "check";

export interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  min?: number;
  max?: number;
  step?: number;
  /** for `select` */
  options?: () => { value: string; label: string }[];
  hint?: string;
}

export const KINDS: EnemyKind[] = ["glider", "interceptor", "gunboat", "bomber", "ace"];

const n = (key: string, label: string, min: number, max: number, step = 1, hint?: string): Field => (hint ? { key, label, kind: "number", min, max, step, hint } : { key, label, kind: "number", min, max, step });

export const COMMON: Field[] = [
  { key: "title", label: "title", kind: "text" },
  { key: "blurb", label: "card blurb", kind: "text" },
  { key: "intro", label: "intro lines", kind: "lines", hint: "one line per row, read out before the fight" },
  n("beltScale", "belt scale", 0, 3, 0.02, "multiplies the system's rock count; blank = the system's own belt"),
];

const COURSE: Field[] = [
  n("rings", "gates", 1, 30),
  n("spacing", "gate spacing (m)", 200, 1500, 10),
  n("wander", "sideways wander (m)", 0, 800, 10),
  n("ringRadius", "gate radius (m)", 10, 80),
  n("timeLimit", "time limit (s)", 20, 1200, 5),
  n("harassAt", "chasers join at gate", 0, 99, 1, "0 = from the start, 99 = never"),
  n("harass", "chasers", 0, 12),
  { key: "harassKinds", label: "chaser kinds", kind: "kinds" },
  n("minesPerGate", "mines per gate", 0, 8),
];

export const TYPE_FIELDS: Record<LevelDef["type"], Field[]> = {
  clear: [{ key: "finaleLine", label: "finale line", kind: "text" }],
  protect: [
    { key: "finaleLine", label: "finale line", kind: "text" },
    n("escortHp", "escort hull", 50, 5000, 10),
    n("escortSpeed", "escort speed (m/s)", 5, 120),
    { key: "escortHull", label: "escort hull key", kind: "text", hint: "a key in ships/hulls.ts; blank = the Prometheus" },
    { key: "escortName", label: "escort name", kind: "text" },
    n("escortRadius", "escort hit radius (m)", 4, 80),
  ],
  run: COURSE,
  race: [
    ...COURSE,
    n("racers", "rivals", 1, 12),
    n("racerSpeed", "rival speed (m/s)", 60, 320, 2),
    n("racerVar", "rival skill spread", 0, 0.5, 0.01),
    n("racerAccel", "rival accel", 10, 200, 2),
    n("racerTurn", "rival turn rate", 0.5, 5, 0.1),
  ],
  hunt: [
    ...COURSE,
    { key: "quarry", label: "quarry", kind: "kind" },
    n("quarrySpeed", "quarry speed (m/s)", 60, 320, 2),
    n("fightDist", "turns to fight inside (m)", 50, 1000, 10),
    n("fightT", "fights for (s)", 1, 60),
    n("fightCd", "runs again after (s)", 0, 60),
  ],
  hold: [
    n("duration", "survive (s)", 30, 900, 5),
    n("firstDelay", "first group after (s)", 0, 60),
    n("interval", "group interval (s)", 2, 120),
    n("groupStart", "group size", 1, 12),
    n("groupGrow", "growth per minute", 0, 8),
    n("maxAlive", "max alive", 1, 24),
    { key: "kinds", label: "kinds (cycled)", kind: "kinds" },
    n("near", "spawn near (m)", 100, 3000, 50),
    n("far", "spawn far (m)", 100, 3000, 50),
    n("restockEvery", "missiles restock (s)", 0, 300, 5),
    { key: "finaleLine", label: "finale line", kind: "text" },
  ],
  intercept: [
    n("duration", "hold the line (s)", 30, 900, 5),
    n("firstDelay", "first group after (s)", 0, 60),
    n("interval", "group interval (s)", 2, 120),
    n("groupStart", "runners per group", 1, 12),
    n("groupGrow", "growth per minute", 0, 8),
    n("maxAlive", "max alive", 1, 24),
    { key: "runner", label: "runner", kind: "kind" },
    n("runnerSpeed", "runner speed (m/s)", 30, 300, 5),
    n("escortsPer", "escorts per group", 0, 8),
    { key: "escortKinds", label: "escort kinds", kind: "kinds" },
    n("near", "spawn near (m)", 100, 3000, 50),
    n("far", "spawn far (m)", 100, 3000, 50),
    n("lineBehind", "relay behind start (m)", 200, 3000, 50),
    n("maxLeaks", "leaks allowed", 1, 20),
    n("restockEvery", "missiles restock (s)", 0, 300, 5),
    { key: "finaleLine", label: "finale line", kind: "text" },
  ],
  strike: [
    n("distance", "mothership ahead (m)", 500, 4000, 50),
    n("escorts", "escorts at start", 0, 12),
    { key: "escortKinds", label: "escort kinds", kind: "kinds" },
    n("reinforce", "reinforcements per node", 0, 12),
    { key: "reinforceKinds", label: "reinforcement kinds", kind: "kinds" },
    n("mines", "mines round the hull", 0, 60),
  ],
  duel: [
    { key: "foe", label: "opponent", kind: "kind" },
    n("rounds", "first to", 1, 9),
    n("distance", "start separation (m)", 200, 3000, 50),
    n("pause", "pause between rounds (s)", 0, 20),
  ],
};

export const TYPE_LABEL: Record<LevelDef["type"], string> = {
  clear: "CLEAR (waves)",
  protect: "PROTECT (escort + waves)",
  run: "RUN (gate chain)",
  race: "RACE (gate chain, rivals)",
  hunt: "HUNT (chase a quarry)",
  hold: "HOLD (outlast the clock)",
  intercept: "INTERCEPT (bombers on a line)",
  strike: "STRIKE (mothership)",
  duel: "DUEL (one on one)",
};

/** one plain sentence per type: what the player does, how it is won, how it is lost */
export const TYPE_HELP: Record<LevelDef["type"], string> = {
  clear: "Waves of enemies spawn round you, one after another. Win when the last wave is dead; lose when your hull is gone.",
  protect: "A big friendly ship crawls toward the gate while waves come in. Win when the waves are done and the escort lives; lose if it dies or you do.",
  run: "Fly a chain of gates before the clock runs out. Chasers can join at a chosen gate and mines can sit on the gates.",
  race: "The gate chain again, against rival racers. Win by crossing the last gate first.",
  hunt: "One fast quarry runs the gate chain ahead of you and turns to fight when you get close. Kill it before the clock.",
  hold: "Survive at the gate for a set time while groups keep coming. Win when the clock hits zero.",
  intercept: "Bombers run a line toward a relay behind you, with escorts. Kill them before they cross; too many leaks and you lose.",
  strike: "A mothership ahead: shoot its ring guns, then the three shield nodes, then the core, with escorts and reinforcements on you.",
  duel: "One enemy, open space, best of N rounds. Hull is restored between rounds.",
};

/** A fresh level of the given type with sensible middle-of-the-road numbers; the base fields are kept from `from`. */
export function defaultsFor(type: LevelDef["type"], from: Partial<LevelDef> & { id: string; system: string }): LevelDef {
  const base = { id: from.id, system: from.system, title: from.title ?? "NEW SORTIE", blurb: from.blurb ?? "", intro: from.intro ?? ["Briefing goes here."], ...(from.requires ? { requires: from.requires } : {}), ...(from.unlocks ? { unlocks: from.unlocks } : {}), ...(from.act ? { act: from.act } : {}), ...(from.board ? { board: from.board } : {}) };
  const course = { rings: 8, spacing: 600, wander: 350, ringRadius: 34, timeLimit: 120, harassAt: 99, harass: 0, minesPerGate: 0 };
  switch (type) {
    case "clear":
      return { ...base, type, waves: [{ count: 3, delay: 4, near: 700, far: 900 }], finaleLine: "Last wave." };
    case "protect":
      return { ...base, type, waves: [{ count: 3, delay: 5, near: 900, far: 1100 }], finaleLine: "Last wave.", escortHp: 600, escortSpeed: 26 };
    case "run":
      return { ...base, type, ...course };
    case "race":
      return { ...base, type, ...course, timeLimit: 900, racers: 4, racerSpeed: 165, racerVar: 0.08, racerAccel: 60, racerTurn: 2 };
    case "hunt":
      return { ...base, type, ...course, timeLimit: 170, quarry: "ace", quarrySpeed: 168, fightDist: 260, fightT: 7, fightCd: 6 };
    case "hold":
      return { ...base, type, duration: 120, firstDelay: 3, interval: 10, groupStart: 2, groupGrow: 1, maxAlive: 6, kinds: ["glider", "interceptor"], near: 700, far: 1000, restockEvery: 30, finaleLine: "Last seconds." };
    case "intercept":
      return { ...base, type, duration: 120, firstDelay: 4, interval: 16, groupStart: 1, groupGrow: 1, maxAlive: 6, runner: "bomber", runnerSpeed: 105, escortsPer: 2, near: 1100, far: 1400, lineBehind: 1300, maxLeaks: 3, restockEvery: 30, finaleLine: "Last bombers on the line." };
    case "strike":
      return { ...base, type, distance: 1700, escorts: 2, reinforce: 2, mines: 12 };
    case "duel":
      return { ...base, type, beltScale: 0.06, foe: "ace", rounds: 3, distance: 900, pause: 3 };
  }
}
