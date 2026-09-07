import type { EnemyKind } from "@/combat/enemy-kinds";
import { ENEMY_KINDS } from "@/combat/enemy-kinds";
import type { LevelDef, Wave } from "@/mission/levels";
import { SYSTEMS } from "@/world/systems";
import { SHIPS } from "@/ships/registry";
import type { Content } from "@/editor/content";
import { COMMON, KINDS, TYPE_FIELDS, TYPE_HELP, TYPE_LABEL, defaultsFor, type Field } from "@/editor/schema";
import { esc, readFor, threatBand } from "@/editor/board";
import { WAVE_PACKS } from "@/editor/packs";
import { openWizard } from "@/editor/wizard";
import { scriptSvg } from "@/ui/glyphs";

/**
 * The encounter composer: the inspector for one level, in the order a designer thinks about it. What it is
 * (title, type, act), where it happens, where it sits in the chain, the fight itself, the story text, and how
 * hard the model thinks it is. Every section opens with one line saying what the fields below do. Every edit
 * goes through the content copy and fires a re-render.
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

const KIND_WORD: Record<EnemyKind, string> = { glider: "glider", interceptor: "interceptor", gunboat: "gunboat", bomber: "bomber", ace: "ace" };

function h(html: string): HTMLElement {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

/** the mix a wave really spawns: the game walks the kinds list round and round */
function resolved(count: number, kinds: EnemyKind[] | undefined): string {
  if (!kinds?.length) return `${count} glider${count === 1 ? "" : "s"}`;
  const tally = new Map<EnemyKind, number>();
  for (let i = 0; i < count; i++) tally.set(kinds[i % kinds.length]!, (tally.get(kinds[i % kinds.length]!) ?? 0) + 1);
  return [...tally].map(([k, n]) => `${n} ${KIND_WORD[k]}${n === 1 ? "" : "s"}`).join(", ");
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
      this.root.append(h(`<div class="empty"><b>NOTHING SELECTED</b>
        <p>Click a card on the board to open it here. Drag cards to lay the campaign out; drop one in a different band to move it to that act. The arrow into a card is the level you have to finish first.</p>
        <p>The coloured pill on a card is how hard the model thinks it is for the ship you would have by then: green is comfortable, gold is a real fight, red kills a player who is not flying well.</p>
        <p>Nothing is written to disk until you press SAVE.</p></div>`));
      this.root.append(this.newButton());
      return;
    }
    this.root.append(h(`<div class="head"><div class="ttl">${esc(l.title)}</div><div class="id">${esc(l.id)} · ${esc(TYPE_LABEL[l.type].split(" (")[0]!)} in ${esc(SYSTEMS.find((s) => s.id === l.system)?.name ?? l.system)}</div></div>`));
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

    this.section("WHAT IT IS", "The kind of level decides everything below. Switching it swaps the fight's numbers for a fresh template; title, chain and board spot stay.");
    this.field(l, COMMON[0]!);
    this.selectRow("type", l.type, Object.keys(TYPE_FIELDS).map((t) => ({ value: t, label: TYPE_LABEL[t as LevelDef["type"]] })), (v) => {
      const t = v as LevelDef["type"];
      c.snapshot();
      const i = c.levels.indexOf(l);
      c.levels[i] = defaultsFor(t, l);
      c.changed();
    });
    this.root.append(h(`<div class="help">${esc(TYPE_HELP[l.type])}</div>`));
    this.selectRow("act", l.act ?? "", c.acts.map((a) => ({ value: a.id, label: a.title })), (v) => this.edit((x) => (x.act = v)));

    this.section("WHERE", "The star system sets the sky, the planet and the rock belt. Belt scale thins or thickens the rocks for this level only.");
    this.selectRow("system", l.system, SYSTEMS.map((s) => ({ value: s.id, label: `${s.name} (${s.id})` })), (v) => this.edit((x) => (x.system = v)));
    this.field(l, COMMON[3]!);

    this.section("PLACE IN THE CAMPAIGN", "A level opens when the one it requires is won. A win can hand over a new hull.");
    this.selectRow("requires", l.requires ?? "", [{ value: "", label: "(open from the start)" }, ...c.levels.filter((x) => x !== l).map((x) => ({ value: x.id, label: x.title }))], (v) => this.edit((x) => (v ? (x.requires = v) : delete x.requires)));
    this.selectRow("unlocks", l.unlocks ?? "", [{ value: "", label: "(nothing)" }, ...Object.values(SHIPS).map((s) => ({ value: s.id, label: s.def.name }))], (v) => this.edit((x) => (v ? (x.unlocks = v) : delete x.unlocks)));
    const after = c.levels.filter((x) => x.requires === l.id);
    this.root.append(h(`<div class="row note"><span>opens</span><span>${after.length ? after.map((x) => esc(x.title)).join(", ") : "nothing yet"}</span></div>`));

    this.section("THE FIGHT", this.fightHelp(l));
    if (l.type === "clear" || l.type === "protect") this.waves(l.waves);
    for (const f of TYPE_FIELDS[l.type]) this.field(l, f);

    this.section("STORY", "The blurb sits on the mission card in the hub. The intro lines are read out one by one before the fight starts.");
    this.field(l, COMMON[1]!);
    this.field(l, COMMON[2]!);
    this.root.append(h(`<div class="preview"><div class="pv-head">AS THE PLAYER SEES IT</div>
      <div class="m">${scriptSvg(l.title)}<b>${esc(l.title)}</b><small>${esc(l.blurb)}</small><i>NEW${l.unlocks && SHIPS[l.unlocks] ? ` · unlocks ${esc(SHIPS[l.unlocks]!.def.name)}` : ""}</i></div>
      <div class="hudline">${esc(l.title)}<span class="obj">${esc(l.intro.join("  "))}  ·  kills 0</span></div>
    </div>`));

    this.section("HOW HARD", "An estimate from the same numbers the game runs on, not a measurement. Use it to compare levels, not to tune one to a decimal.");
    const override = this.o.shipOverride();
    this.selectRow("flown in", override ?? "", [{ value: "", label: "(the best hull the chain has handed over)" }, ...Object.values(SHIPS).map((s) => ({ value: s.id, label: s.def.name }))], (v) => this.o.setShipOverride(v || null));
    const r = readFor(c.levels, l, override);
    const band = threatBand(r.threat);
    const verdict = band === "low" ? "comfortable" : band === "mid" ? "a real fight" : "lethal unless flown well";
    this.root.append(h(`<div class="power">
      <div class="big ${band}"><b>${Math.round(r.threat * 100)}%</b><span>of the ${esc(SHIPS[r.ship]?.def.name ?? r.ship)}'s hull lost over the level: <em>${verdict}</em></span></div>
      <div class="grid">
        <span>takes about</span><b>${r.clearMin.toFixed(1)} min</b>
        <span>enemy hull to chew</span><b>${Math.round(r.enemyHp)}</b>
        <span>peak enemy dps</span><b>${r.peakDps.toFixed(1)}</b>
        <span>clock pressure</span><b>${r.pressure ? r.pressure.toFixed(2) : "none"}</b>
      </div>
      <p>${esc(r.note)}</p>
      <p class="dim">green under 45%, gold to 90%, red above. Clock pressure is how much of the time limit the kills or the course need; over 1 the clock wins.</p>
    </div>`));
    const problems = c.problems();
    if (problems.length) this.root.append(h(`<div class="problems">${problems.map(esc).join("<br>")}</div>`));
    this.root.append(this.newButton());
  }

  /** what the fight section's numbers mean for this type, in one line */
  private fightHelp(l: LevelDef): string {
    switch (l.type) {
      case "clear":
      case "protect":
        return "Each wave spawns its ships at once, between near and far metres out, the given seconds after the previous wave is dead. The mix cycles through the kinds you list.";
      case "run":
      case "race":
      case "hunt":
        return "Gates in a chain, spaced and wandering sideways. Chasers join at the gate you name (99 = never).";
      case "hold":
        return "Groups arrive on the interval and grow by the growth figure every minute; max alive caps the crowd.";
      case "intercept":
        return "Every group is runners plus escorts. Runners fly straight at the relay; each one through is a leak.";
      case "strike":
        return "Escorts are up at the start; reinforcements arrive each time a shield node dies. Mines ring the hull.";
      case "duel":
        return "One opponent, first to the round count. Separation is the start distance for every round.";
      case "sandbox":
        return "Nothing spawns. Missiles restock on the interval so the guns can be tried alongside the moves.";
    }
  }

  private newButton(): HTMLElement {
    const c = this.o.content;
    return this.btn("+ NEW LEVEL", "wide", () => {
      const sel = this.level;
      openWizard({ content: c, after: sel?.id ?? null, done: (pick) => {
        const id = c.freshId(pick.title);
        const req = pick.after ? c.level(pick.after) : undefined;
        const l = defaultsFor(pick.type, { id, system: pick.system, title: pick.title, ...(req ? { requires: req.id } : {}), ...(req?.act ? { act: req.act } : c.acts[0] ? { act: c.acts[0].id } : {}) });
        if (pick.type === "clear" || pick.type === "protect") {
          const pk = WAVE_PACKS.find((p) => p.id === pick.pack);
          if (pk && (l.type === "clear" || l.type === "protect")) l.waves = structuredClone(pk.waves);
        }
        // sit just right of the level it follows, or at the top left
        l.board = req?.board ? { x: req.board.x + 270, y: req.board.y } : { x: 40, y: 40 };
        while (c.levels.some((x) => x.board && x.board.x === l.board!.x && Math.abs(x.board.y - l.board!.y) < 70)) l.board.y += 92;
        c.snapshot();
        c.levels.push(l);
        c.changed();
        this.o.select(id);
      } });
    });
  }

  private btn(label: string, cls: string, fn: () => void): HTMLElement {
    const b = h(`<button class="${cls}">${esc(label)}</button>`);
    b.onclick = fn;
    return b;
  }

  private section(title: string, help: string): void {
    this.root.append(h(`<div class="section"><b>${esc(title)}</b><p>${esc(help)}</p></div>`));
  }

  private selectRow(label: string, value: string, options: { value: string; label: string }[], set: (v: string) => void): void {
    const row = h(`<div class="row"><label>${esc(label)}</label><select>${options.map((o) => `<option value="${esc(o.value)}"${o.value === value ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select></div>`);
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
    const hint = f.hint ? `<small>${esc(f.hint)}</small>` : "";
    let row: HTMLElement;
    switch (f.kind) {
      case "number": {
        row = h(`<div class="row"><label>${esc(f.label)}</label><input type="number" min="${f.min ?? ""}" max="${f.max ?? ""}" step="${f.step ?? 1}" value="${v === undefined ? "" : String(v)}" placeholder="${OPTIONAL.has(f.key) ? "blank" : ""}">${hint}</div>`);
        row.querySelector("input")!.onchange = (e) => {
          const s = (e.target as HTMLInputElement).value;
          write(s === "" ? undefined : Number(s));
        };
        break;
      }
      case "text": {
        row = h(`<div class="row"><label>${esc(f.label)}</label><input type="text" value="${esc(String(v ?? ""))}">${hint}</div>`);
        row.querySelector("input")!.onchange = (e) => write((e.target as HTMLInputElement).value);
        break;
      }
      case "lines": {
        row = h(`<div class="row"><label>${esc(f.label)}</label><textarea rows="4">${esc((v as string[] | undefined)?.join("\n") ?? "")}</textarea>${hint}</div>`);
        row.querySelector("textarea")!.onchange = (e) => write((e.target as HTMLTextAreaElement).value.split("\n").map((s) => s.trim()).filter(Boolean));
        break;
      }
      case "kind": {
        row = h(`<div class="row"><label>${esc(f.label)}</label><div class="chips"></div><small>click the chip to change the kind</small></div>`);
        row.querySelector(".chips")!.append(this.chip((v as EnemyKind) ?? "glider", (k) => write(k), null));
        break;
      }
      case "kinds": {
        row = h(`<div class="row"><label>${esc(f.label)}</label><div class="chips"></div><small>${OPTIONAL.has(f.key) ? "empty = the level's default mix; " : ""}click a chip to change it, × removes, + adds</small></div>`);
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
    const wrap = h(`<div class="waves"></div>`);
    ws.forEach((w, i) => {
      const card = h(`<div class="wave">
        <div class="wave-top"><b>WAVE ${i + 1}</b><span class="sum">${esc(resolved(w.count, w.kinds))}</span><span class="tools"><button title="move up">↑</button><button title="move down">↓</button><button title="remove">×</button></span></div>
        <div class="wave-grid">
          <label>ships<input type="number" min="1" max="24" value="${w.count}"></label>
          <label>seconds after the last wave<input type="number" min="0" max="120" value="${w.delay}"></label>
          <label>spawn from (m)<input type="number" min="100" max="4000" step="50" value="${w.near}"></label>
          <label>to (m)<input type="number" min="100" max="4000" step="50" value="${w.far}"></label>
        </div>
        <div class="wave-mix"><span>mix</span><div class="chips"></div></div>
      </div>`);
      const inputs = card.querySelectorAll("input");
      const keys: (keyof Wave)[] = ["count", "delay", "near", "far"];
      inputs.forEach((inp, k) => (inp.onchange = () => this.edit(() => ((w as unknown as Record<string, number>)[keys[k]!] = Number(inp.value)))));
      const [up, down, rm] = card.querySelectorAll(".tools button");
      (up as HTMLButtonElement).onclick = () => i > 0 && this.edit(() => ws.splice(i - 1, 2, ws[i]!, ws[i - 1]!));
      (down as HTMLButtonElement).onclick = () => i < ws.length - 1 && this.edit(() => ws.splice(i, 2, ws[i + 1]!, ws[i]!));
      (rm as HTMLButtonElement).onclick = () => ws.length > 1 && this.edit(() => ws.splice(i, 1));
      const chips = card.querySelector(".chips")!;
      const kinds = w.kinds ?? [];
      kinds.forEach((k, j) => chips.append(this.chip(k, (nk) => this.edit(() => (w.kinds = kinds.map((x, m) => (m === j ? nk : x)))), () => this.edit(() => {
        const rest = kinds.filter((_, m) => m !== j);
        if (rest.length) w.kinds = rest;
        else delete w.kinds;
      }))));
      const add = h(`<button class="chip add" title="add a kind to the list">+</button>`);
      add.onclick = () => this.edit(() => (w.kinds = [...kinds, "glider"]));
      chips.append(add);
      if (!kinds.length) chips.append(h(`<small>all gliders; add a kind to change the mix</small>`));
      wrap.append(card);
    });
    const add = this.btn("+ WAVE", "wide", () => this.edit(() => {
      const last = ws[ws.length - 1] ?? { count: 3, delay: 4, near: 700, far: 900 };
      ws.push({ ...last, ...(last.kinds ? { kinds: [...last.kinds] } : {}) });
    }));
    wrap.append(add);
    // the shelf: prebuilt fights, appended as waves, then edited like any other
    const shelf = h(`<div class="packs"><div class="packs-head">OR DROP IN A PREBUILT PACK</div></div>`);
    for (const pk of WAVE_PACKS) {
      const row = h(`<div class="pack"><div><b>${esc(pk.name)}</b><span>${pk.waves.length} wave${pk.waves.length === 1 ? "" : "s"}: ${pk.waves.map((w) => resolved(w.count, w.kinds)).join(" · ")}</span><small>${esc(pk.blurb)}</small></div><button>ADD</button></div>`);
      row.querySelector("button")!.onclick = () => this.edit(() => ws.push(...structuredClone(pk.waves)));
      shelf.append(row);
    }
    wrap.append(shelf);
    this.root.append(wrap);
  }
}
