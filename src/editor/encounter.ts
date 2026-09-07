import type { EnemyKind } from "@/combat/enemy-kinds";
import { ENEMY_KINDS } from "@/combat/enemy-kinds";
import type { LevelDef, Wave } from "@/mission/levels";
import { SYSTEMS } from "@/world/systems";
import { SHIPS } from "@/ships/registry";
import type { Content } from "@/editor/content";
import { COMMON, KINDS, TYPE_FIELDS, TYPE_LABEL, defaultsFor, type Field } from "@/editor/schema";
import { esc, readFor, threatBand } from "@/editor/board";

/**
 * The encounter composer: the inspector for one level. Identity and chain at the top (type, system, act,
 * requires, unlocks), then the fields the level type declares in `schema.ts`, the wave list for wave levels,
 * and the power readout at the bottom. Every edit goes through the content copy and fires a re-render.
 */
export interface EncounterOpts {
  content: Content;
  selected: () => string | null;
  select: (id: string | null) => void;
  shipOverride: () => string | null;
  setShipOverride: (id: string | null) => void;
  fly: (id: string) => void;
}

/** keys the game treats as absent when blank, so a blank box removes them instead of writing "" */
const OPTIONAL = new Set(["beltScale", "harassKinds", "escortKinds", "reinforceKinds", "escortHull", "escortName", "escortRadius", "requires", "unlocks", "kinds"]);

function h(html: string): HTMLElement {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

export class Encounter {
  readonly root = document.createElement("div");

  constructor(private readonly o: EncounterOpts) {
    this.root.className = "inspector";
  }

  private get level(): LevelDef | undefined {
    const id = this.o.selected();
    return id ? this.o.content.level(id) : undefined;
  }

  private edit(fn: (l: LevelDef) => void): void {
    const l = this.level;
    if (!l) return;
    this.o.content.snapshot();
    fn(l);
    this.o.content.changed();
  }

  render(): void {
    const c = this.o.content, l = this.level;
    this.root.replaceChildren();
    if (!l) {
      this.root.append(h(`<div class="empty"><b>NO LEVEL SELECTED</b><p>Click a card on the board, or add one.</p></div>`));
      this.root.append(this.newButton());
      return;
    }
    const head = h(`<div class="head"><div class="id">${esc(l.id)}</div></div>`);
    this.root.append(head);
    const bar = h(`<div class="actions"></div>`);
    bar.append(
      this.btn("FLY IT", "primary", () => this.o.fly(l.id)),
      this.btn("DUPLICATE", "", () => {
        const copy = structuredClone(l);
        copy.id = c.freshId(l.title + " copy");
        copy.title = l.title + " II";
        copy.requires = l.id;
        delete copy.unlocks;
        if (copy.board) copy.board = { x: copy.board.x + 60, y: copy.board.y + 90 };
        c.snapshot();
        c.levels.splice(c.levels.indexOf(l) + 1, 0, copy);
        c.changed();
        this.o.select(copy.id);
      }),
      this.btn("DELETE", "danger", () => {
        c.snapshot();
        c.levels = c.levels.filter((x) => x !== l);
        for (const x of c.levels) if (x.requires === l.id) (l.requires ? (x.requires = l.requires) : delete x.requires);
        c.changed();
        this.o.select(null);
      }),
    );
    this.root.append(bar);

    this.section("IDENTITY");
    this.selectRow("type", l.type, Object.keys(TYPE_FIELDS).map((t) => ({ value: t, label: TYPE_LABEL[t as LevelDef["type"]] })), (v) => {
      const t = v as LevelDef["type"];
      c.snapshot();
      const i = c.levels.indexOf(l);
      c.levels[i] = defaultsFor(t, l);
      c.changed();
    }, "changing the type resets the type's own numbers to a template; title, chain and board spot stay");
    this.selectRow("system", l.system, SYSTEMS.map((s) => ({ value: s.id, label: `${s.name} (${s.id})` })), (v) => this.edit((x) => (x.system = v)));
    this.selectRow("act", l.act ?? "", c.acts.map((a) => ({ value: a.id, label: a.title })), (v) => this.edit((x) => (x.act = v)));
    for (const f of COMMON) this.field(l, f);

    this.section("CHAIN");
    this.selectRow("requires", l.requires ?? "", [{ value: "", label: "(open from the start)" }, ...c.levels.filter((x) => x !== l).map((x) => ({ value: x.id, label: x.title }))], (v) => this.edit((x) => (v ? (x.requires = v) : delete x.requires)));
    this.selectRow("unlocks", l.unlocks ?? "", [{ value: "", label: "(nothing)" }, ...Object.values(SHIPS).map((s) => ({ value: s.id, label: s.def.name }))], (v) => this.edit((x) => (v ? (x.unlocks = v) : delete x.unlocks)), "the hull handed over on the win");
    const after = c.levels.filter((x) => x.requires === l.id);
    this.root.append(h(`<div class="row note"><span>opens</span><span>${after.length ? after.map((x) => esc(x.title)).join(", ") : "nothing yet"}</span></div>`));

    this.section(TYPE_LABEL[l.type]);
    if (l.type === "clear" || l.type === "protect") this.waves(l.waves);
    for (const f of TYPE_FIELDS[l.type]) this.field(l, f);

    this.section("POWER");
    const override = this.o.shipOverride();
    this.selectRow("flown in", override ?? "", [{ value: "", label: "(what the chain hands over)" }, ...Object.values(SHIPS).map((s) => ({ value: s.id, label: s.def.name }))], (v) => this.o.setShipOverride(v || null));
    const r = readFor(c.levels, l, override);
    this.root.append(h(`<div class="power">
      <div class="big ${threatBand(r.threat)}"><b>${Math.round(r.threat * 100)}%</b><span>of the ${esc(SHIPS[r.ship]?.def.name ?? r.ship)}'s hull, over the level</span></div>
      <div class="grid">
        <span>clear</span><b>${r.clearMin.toFixed(1)} min</b>
        <span>enemy hp</span><b>${Math.round(r.enemyHp)}</b>
        <span>peak dps</span><b>${r.peakDps.toFixed(1)}</b>
        <span>pressure</span><b>${r.pressure ? r.pressure.toFixed(2) : "n/a"}</b>
      </div>
      <p>${esc(r.note)}</p>
      <p class="dim">paper estimate from the same numbers the game runs on; the pressure column is how much of the clock the kills need (over 1 = the clock wins)</p>
    </div>`));
    const problems = c.problems();
    if (problems.length) this.root.append(h(`<div class="problems">${problems.map(esc).join("<br>")}</div>`));
    this.root.append(this.newButton());
  }

  private newButton(): HTMLElement {
    const c = this.o.content;
    return this.btn("+ NEW LEVEL", "wide", () => {
      const sel = this.level;
      const id = c.freshId("new sortie");
      const l = defaultsFor("clear", { id, system: sel?.system ?? "abydos", title: "NEW SORTIE", ...(sel ? { requires: sel.id, act: sel.act ?? "" } : {}) });
      if (!l.act) delete l.act;
      l.board = sel?.board ? { x: sel.board.x + 250, y: sel.board.y } : { x: 40, y: 40 };
      c.snapshot();
      c.levels.push(l);
      c.changed();
      this.o.select(id);
    });
  }

  private btn(label: string, cls: string, fn: () => void): HTMLElement {
    const b = h(`<button class="${cls}">${esc(label)}</button>`);
    b.onclick = fn;
    return b;
  }

  private section(title: string): void {
    this.root.append(h(`<div class="section">${esc(title)}</div>`));
  }

  private selectRow(label: string, value: string, options: { value: string; label: string }[], set: (v: string) => void, hint?: string): void {
    const row = h(`<div class="row"><label>${esc(label)}</label><select>${options.map((o) => `<option value="${esc(o.value)}"${o.value === value ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select>${hint ? `<small>${esc(hint)}</small>` : ""}</div>`);
    row.querySelector("select")!.onchange = (e) => set((e.target as HTMLSelectElement).value);
    this.root.append(row);
  }

  private field(l: LevelDef, f: Field): void {
    const rec = l as unknown as Record<string, unknown>;
    const v = rec[f.key];
    const write = (nv: unknown): void => this.edit((x) => {
      const r = x as unknown as Record<string, unknown>;
      if (nv === undefined || nv === "" || (Array.isArray(nv) && nv.length === 0 && OPTIONAL.has(f.key))) delete r[f.key];
      else r[f.key] = nv;
    });
    let row: HTMLElement;
    switch (f.kind) {
      case "number": {
        row = h(`<div class="row"><label>${esc(f.label)}</label><input type="number" min="${f.min ?? ""}" max="${f.max ?? ""}" step="${f.step ?? 1}" value="${v === undefined ? "" : String(v)}" placeholder="${OPTIONAL.has(f.key) ? "blank" : ""}">${f.hint ? `<small>${esc(f.hint)}</small>` : ""}</div>`);
        row.querySelector("input")!.onchange = (e) => {
          const s = (e.target as HTMLInputElement).value;
          write(s === "" ? undefined : Number(s));
        };
        break;
      }
      case "text": {
        row = h(`<div class="row"><label>${esc(f.label)}</label><input type="text" value="${esc(String(v ?? ""))}">${f.hint ? `<small>${esc(f.hint)}</small>` : ""}</div>`);
        row.querySelector("input")!.onchange = (e) => write((e.target as HTMLInputElement).value);
        break;
      }
      case "lines": {
        row = h(`<div class="row"><label>${esc(f.label)}</label><textarea rows="4">${esc((v as string[] | undefined)?.join("\n") ?? "")}</textarea>${f.hint ? `<small>${esc(f.hint)}</small>` : ""}</div>`);
        row.querySelector("textarea")!.onchange = (e) => write((e.target as HTMLTextAreaElement).value.split("\n").map((s) => s.trim()).filter(Boolean));
        break;
      }
      case "kind": {
        row = h(`<div class="row"><label>${esc(f.label)}</label><div class="chips"></div></div>`);
        row.querySelector(".chips")!.append(this.chip((v as EnemyKind) ?? "glider", (k) => write(k), null));
        break;
      }
      case "kinds": {
        row = h(`<div class="row"><label>${esc(f.label)}</label><div class="chips"></div>${OPTIONAL.has(f.key) ? `<small>empty = the level's default mix</small>` : ""}</div>`);
        const chips = row.querySelector(".chips")!;
        const arr = (v as EnemyKind[] | undefined) ?? [];
        arr.forEach((k, i) => chips.append(this.chip(k, (nk) => write(arr.map((x, j) => (j === i ? nk : x))), () => write(arr.filter((_, j) => j !== i)))));
        const add = h(`<button class="chip add">+</button>`);
        add.onclick = () => write([...arr, "glider"]);
        chips.append(add);
        break;
      }
      default:
        return;
    }
    this.root.append(row);
  }

  /** an enemy-kind pill: click cycles the kind, × removes it */
  private chip(kind: EnemyKind, set: (k: EnemyKind) => void, remove: (() => void) | null): HTMLElement {
    const c = h(`<span class="chip k-${kind}"><b>${esc(ENEMY_KINDS[kind].label)}</b>${remove ? `<i title="remove">×</i>` : ""}</span>`);
    c.querySelector("b")!.onclick = () => set(KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length]!);
    if (remove) c.querySelector("i")!.onclick = remove;
    return c;
  }

  private waves(ws: Wave[]): void {
    const wrap = h(`<div class="waves"><div class="wave-head"><span>#</span><span>ships</span><span>delay s</span><span>near m</span><span>far m</span><span></span></div></div>`);
    ws.forEach((w, i) => {
      const row = h(`<div class="wave"><span class="n">${i + 1}</span><input type="number" min="1" max="24" value="${w.count}"><input type="number" min="0" max="120" value="${w.delay}"><input type="number" min="100" max="4000" step="50" value="${w.near}"><input type="number" min="100" max="4000" step="50" value="${w.far}"><span class="tools"><button title="move up">↑</button><button title="move down">↓</button><button title="remove">×</button></span><div class="chips"></div></div>`);
      const inputs = row.querySelectorAll("input");
      const keys: (keyof Wave)[] = ["count", "delay", "near", "far"];
      inputs.forEach((inp, k) => (inp.onchange = () => this.edit(() => ((w as unknown as Record<string, number>)[keys[k]!] = Number(inp.value)))));
      const [up, down, rm] = row.querySelectorAll("button");
      up!.onclick = () => i > 0 && this.edit(() => ws.splice(i - 1, 2, ws[i]!, ws[i - 1]!));
      down!.onclick = () => i < ws.length - 1 && this.edit(() => ws.splice(i, 2, ws[i + 1]!, ws[i]!));
      rm!.onclick = () => ws.length > 1 && this.edit(() => ws.splice(i, 1));
      const chips = row.querySelector(".chips")!;
      const kinds = w.kinds ?? [];
      kinds.forEach((k, j) => chips.append(this.chip(k, (nk) => this.edit(() => (w.kinds = kinds.map((x, m) => (m === j ? nk : x)))), () => this.edit(() => {
        const rest = kinds.filter((_, m) => m !== j);
        if (rest.length) w.kinds = rest;
        else delete w.kinds;
      }))));
      const add = h(`<button class="chip add" title="add a kind; the wave cycles through its list">+</button>`);
      add.onclick = () => this.edit(() => (w.kinds = [...kinds, "glider"]));
      chips.append(add);
      if (!kinds.length) chips.append(h(`<small>gliders</small>`));
      wrap.append(row);
    });
    const add = this.btn("+ WAVE", "wide", () => this.edit(() => {
      const last = ws[ws.length - 1] ?? { count: 3, delay: 4, near: 700, far: 900 };
      ws.push({ ...last, ...(last.kinds ? { kinds: [...last.kinds] } : {}) });
    }));
    wrap.append(add);
    this.root.append(wrap);
  }
}
