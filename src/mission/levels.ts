/**
 * Level data: everything a designer tunes lives here, not in the runners.
 * Story beats lean on the show (a Ha'tak over the belt, the Prometheus limping
 * home) but franchise names stay in strings, never in identifiers.
 */
export interface Wave {
  count: number;
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

export interface RunLevel extends BaseLevel {
  type: "run";
  rings: number;
  /** distance between gates (m) and how far sideways the chain may turn per gate (m) */
  spacing: number;
  wander: number;
  ringRadius: number;
  timeLimit: number;
  /** gliders that join the chase at this ring index (0 = none) */
  harassAt: number;
  harass: number;
  /** proximity mines laid just outside each gate's rim */
  minesPerGate: number;
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
  /** proximity mines in a ring around the hull */
  mines: number;
}

export type LevelDef = ClearLevel | RunLevel | ProtectLevel | StrikeLevel;

export const LEVELS: LevelDef[] = [
  {
    id: "belt-clear",
    type: "clear",
    title: "CLEAR THE FIELD",
    blurb: "Three waves of death gliders in the belt. Learn the guns, learn the missiles.",
    intro: ["Gliders inbound through the belt.", "Clear them before they reach the gate."],
    waves: [
      { count: 2, delay: 4, near: 700, far: 900 },
      { count: 3, delay: 5, near: 800, far: 1000 },
      { count: 5, delay: 5, near: 800, far: 1100 },
    ],
    finaleLine: "Last wave. All of them.",
  },
  {
    id: "gauntlet",
    type: "run",
    title: "THE GAUNTLET",
    blurb: "Ten gates threaded through the thickest rock in the belt, either way through. Mines on the rims; gliders join the chase halfway.",
    intro: ["The window closes in two minutes.", "The gates sit in the rock. Fly them, either way through."],
    requires: "belt-clear",
    rings: 10,
    spacing: 620,
    wander: 380,
    ringRadius: 34,
    timeLimit: 120,
    harassAt: 4,
    harass: 2,
    minesPerGate: 2,
  },
  {
    id: "escort",
    type: "protect",
    title: "COVER THE PROMETHEUS",
    blurb: "The Prometheus is limping to the gate with her shields down. Keep the gliders off her hull.",
    intro: ["Prometheus reports shields down, sublight only.", "Nothing reaches her. Nothing."],
    requires: "gauntlet",
    waves: [
      { count: 3, delay: 5, near: 900, far: 1100 },
      { count: 4, delay: 6, near: 900, far: 1200 },
      { count: 6, delay: 6, near: 1000, far: 1300 },
    ],
    finaleLine: "Last wave. They are going for the engines.",
    escortHp: 600,
    escortSpeed: 26,
  },
  {
    id: "hatak",
    type: "strike",
    title: "BRING DOWN THE HA'TAK",
    blurb: "A Goa'uld mothership is parked over the belt behind a minefield. Ring guns first, then the three shield nodes, then the hull.",
    intro: ["Ha'tak in orbit, shields up, gliders launching.", "Kill the ring guns, drop the shield nodes, then burn the pyramid."],
    requires: "escort",
    unlocks: "prometheus",
    distance: 1700,
    escorts: 2,
    reinforce: 2,
    mines: 14,
  },
];

export function parseLevel(v: string | null | undefined): LevelDef {
  return LEVELS.find((l) => l.id === v) ?? LEVELS[0]!;
}
