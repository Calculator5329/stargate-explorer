import { ACTS, LEVELS, checkLevels, type Act, type LevelDef } from "@/mission/levels";

/**
 * The editor's working copy of `content/campaign.json`: acts and levels, an undo stack of snapshots,
 * and a save that posts the whole file to the dev server's content store. The game keeps running on
 * the module it loaded; a save triggers Vite's reload and the edit is live after it.
 */
export type SaveResult = "saved" | "no-store" | "invalid";

export class Content {
  acts: Act[];
  levels: LevelDef[];
  dirty = false;
  private readonly history: string[] = [];
  onChange: (() => void) | null = null;

  constructor() {
    this.acts = structuredClone(ACTS);
    this.levels = structuredClone(LEVELS);
  }

  level(id: string): LevelDef | undefined {
    return this.levels.find((l) => l.id === id);
  }

  /** call before a change so undo can return to it */
  snapshot(): void {
    this.history.push(JSON.stringify({ acts: this.acts, levels: this.levels }));
    if (this.history.length > 60) this.history.shift();
  }

  changed(): void {
    this.dirty = true;
    this.onChange?.();
  }

  undo(): boolean {
    const s = this.history.pop();
    if (!s) return false;
    const j = JSON.parse(s) as { acts: Act[]; levels: LevelDef[] };
    this.acts = j.acts;
    this.levels = j.levels;
    this.changed();
    return true;
  }

  problems(): string[] {
    const out = checkLevels(this.levels);
    for (const l of this.levels) if (l.act && !this.acts.some((a) => a.id === l.act)) out.push(`${l.id} sits in unknown act ${l.act}`);
    return out;
  }

  toJSON(): { acts: Act[]; levels: LevelDef[] } {
    return { acts: this.acts, levels: this.levels };
  }

  async save(file = "src/content/campaign.json"): Promise<SaveResult> {
    if (this.problems().length) return "invalid";
    try {
      const r = await fetch("/__content/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ file, data: this.toJSON() }) });
      if (!r.ok) return "no-store";
      this.dirty = false;
      this.onChange?.();
      return "saved";
    } catch {
      return "no-store";
    }
  }

  /** a fresh id from a title, unique in the list */
  freshId(title: string): string {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sortie";
    let id = base, n = 2;
    while (this.levels.some((l) => l.id === id)) id = `${base}-${n++}`;
    return id;
  }
}
