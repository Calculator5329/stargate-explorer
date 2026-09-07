import { ACTS, LEVELS, checkLevels, type Act, type LevelDef } from "@/mission/levels";
import { MOVES, checkMoves, type MoveDef } from "@/sim/moves";

/**
 * The editor's working copy of `content/campaign.json` (acts and levels) and `content/moves.json` (moves),
 * an undo stack of snapshots, and a save that posts each file to the dev server's content store. The game keeps running on
 * the module it loaded; a save triggers Vite's reload and the edit is live after it.
 */
export type SaveResult = "saved" | "no-store" | "invalid";

export class Content {
  acts: Act[];
  levels: LevelDef[];
  moves: MoveDef[];
  dirty = false;
  private readonly history: string[] = [];
  onChange: (() => void) | null = null;

  constructor() {
    this.acts = structuredClone(ACTS);
    this.levels = structuredClone(LEVELS);
    this.moves = structuredClone(MOVES);
  }

  move(id: string): MoveDef | undefined {
    return this.moves.find((m) => m.id === id);
  }

  level(id: string): LevelDef | undefined {
    return this.levels.find((l) => l.id === id);
  }

  /** call before a change so undo can return to it */
  snapshot(): void {
    this.history.push(JSON.stringify({ acts: this.acts, levels: this.levels, moves: this.moves }));
    if (this.history.length > 60) this.history.shift();
  }

  changed(): void {
    this.dirty = true;
    this.onChange?.();
  }

  undo(): boolean {
    const s = this.history.pop();
    if (!s) return false;
    const j = JSON.parse(s) as { acts: Act[]; levels: LevelDef[]; moves: MoveDef[] };
    this.acts = j.acts;
    this.levels = j.levels;
    this.moves = j.moves;
    this.changed();
    return true;
  }

  problems(): string[] {
    const out = checkLevels(this.levels);
    for (const l of this.levels) if (l.act && !this.acts.some((a) => a.id === l.act)) out.push(`${l.id} sits in unknown act ${l.act}`);
    out.push(...checkMoves(this.moves));
    return out;
  }

  toJSON(): { acts: Act[]; levels: LevelDef[] } {
    return { acts: this.acts, levels: this.levels };
  }

  /** both files, campaign then moves; the first failure is the answer */
  async save(): Promise<SaveResult> {
    if (this.problems().length) return "invalid";
    const a = await this.post("src/content/campaign.json", this.toJSON());
    if (a !== "saved") return a;
    const b = await this.post("src/content/moves.json", { moves: this.moves });
    if (b !== "saved") return b;
    this.dirty = false;
    this.onChange?.();
    return "saved";
  }

  /** one file to the dev store; the editor test uses it with a scratch name */
  async post(file: string, data: unknown): Promise<SaveResult> {
    try {
      const r = await fetch("/__content/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ file, data }) });
      return r.ok ? "saved" : "no-store";
    } catch {
      return "no-store";
    }
  }

  /** a fresh id from a title, unique in the list */
  freshId(title: string, taken: (id: string) => boolean = (id) => this.levels.some((l) => l.id === id), fallback = "sortie"): string {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;
    let id = base, n = 2;
    while (taken(id)) id = `${base}-${n++}`;
    return id;
  }
}
