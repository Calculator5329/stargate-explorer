/**
 * Moves: scripted manoeuvres the flight model plays back from a table. A move is a list of primitive steps
 * on a timeline (Ethan, move-composer packet 2026-09-06: "a list of primitive steps, edited as numbers"),
 * paid for from the boost bar, triggered by a chord: tap the move's trigger key, then a direction inside
 * the double-tap window, or the key alone after it. Trigger keys are content, not a single bind, because
 * different move families may sit on different keys ("it doesn't necessarily just need to be the B key").
 * The table lives in `content/moves.json`; the designer's MOVES tab edits it through the same dev store.
 */
import { keyName } from "@/core/binds";
import moves from "@/content/moves.json";

export type MoveDir = "none" | "up" | "down" | "left" | "right";

/**
 * brake: forward speed pulled toward `amount` m/s at the brake rate
 * boost: forward speed pushed toward `amount` m/s at the boost rate, no bar drain, cap lifted to `amount`
 * snapPitch: pitch rate, rad/s, + nose up
 * yaw: yaw rate, rad/s, + nose right
 * roll: roll rate, rad/s, + roll right
 * hop: ship-relative sideways thrust, m/s, + starboard (roll + hop describes a helix)
 * slide / lift: sideways/up thrust in the entry attitude, m/s (vectoring independent of nose)
 * coast: hold the current velocity through rotation; amount > 0 enables it
 */
export type StepKind = "brake" | "boost" | "snapPitch" | "yaw" | "roll" | "hop" | "slide" | "lift" | "coast";

export interface MoveStep {
  kind: StepKind;
  /** seconds into the move the step begins, and how long it runs */
  start: number;
  length: number;
  amount: number;
}

export interface MoveDef {
  id: string;
  name: string;
  trigger: { key: string; dir: MoveDir };
  /** boost bar fraction spent on start (0..1); the move will not fire below it */
  cost: number;
  /** seconds; the stick is dead until it ends */
  duration: number;
  steps: MoveStep[];
}

export const STEP_KINDS: StepKind[] = ["brake", "boost", "snapPitch", "yaw", "roll", "hop", "slide", "lift", "coast"];
export const MOVE_DIRS: MoveDir[] = ["none", "up", "down", "left", "right"];

/** what each step's `amount` means, for the composer's field label */
export const STEP_UNIT: Record<StepKind, string> = { brake: "to m/s", boost: "to m/s", snapPitch: "rad/s (+ up)", yaw: "rad/s (+ right)", roll: "rad/s (+ right)", hop: "m/s (+ ship starboard)", slide: "m/s (+ entry starboard)", lift: "m/s (+ entry up)", coast: "1 = hold momentum through rotation" };

export const MOVES: MoveDef[] = moves.moves as MoveDef[];

/** every distinct trigger key in a table: the keys `Input` arms on */
export function moveKeys(table: readonly MoveDef[]): Set<string> {
  return new Set(table.map((m) => m.trigger.key));
}

export function findMove(table: readonly MoveDef[], key: string, dir: MoveDir): MoveDef | undefined {
  return table.find((m) => m.trigger.key === key && m.trigger.dir === dir);
}

const DIR_KEY: Record<MoveDir, string> = { none: "", up: "W", down: "S", left: "A", right: "D" };

/** "B + W" for the HUD and the composer; `dirKeys` maps a direction onto the bound key's code */
export function chordName(m: MoveDef, dirKeys?: Partial<Record<MoveDir, string>>): string {
  const k = keyName(m.trigger.key);
  if (m.trigger.dir === "none") return k;
  const d = dirKeys?.[m.trigger.dir];
  return `${k} + ${d ? keyName(d) : DIR_KEY[m.trigger.dir]}`;
}

/** Problems in a move table, one line each; empty when it is sound. */
export function checkMoves(table: readonly MoveDef[]): string[] {
  const out: string[] = [], ids = new Set<string>(), chords = new Set<string>();
  for (const m of table) {
    if (ids.has(m.id)) out.push(`duplicate move id ${m.id}`);
    ids.add(m.id);
    const chord = `${m.trigger.key}/${m.trigger.dir}`;
    if (chords.has(chord)) out.push(`${m.name} shares its trigger (${chordName(m)}) with another move`);
    chords.add(chord);
    if (!(m.cost >= 0 && m.cost <= 1)) out.push(`${m.name}: cost must be 0..1`);
    if (!(m.duration > 0)) out.push(`${m.name}: duration must be above 0`);
    if (m.steps.length === 0) out.push(`${m.name}: no steps`);
    for (const s of m.steps) if (s.start + s.length > m.duration + 1e-6) out.push(`${m.name}: a ${s.kind} step runs past the end`);
  }
  return out;
}

if (import.meta.env.DEV) for (const line of checkMoves(MOVES)) console.error(`moves.json: ${line}`);
