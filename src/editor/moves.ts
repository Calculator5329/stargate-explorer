import type { Content } from "@/editor/content";
import { esc } from "@/editor/board";
import { MOVE_DIRS, STEP_KINDS, STEP_UNIT, chordName, type MoveDef, type MoveDir, type MoveStep, type StepKind } from "@/sim/moves";
import { keyName } from "@/core/binds";

/**
 * The move composer: a shelf of every move on the left, the selected one on the right as a trigger row,
 * a timeline and one card per step with number fields (Ethan, 2026-09-06: "step cards with number fields
 * and a TRY IT button"). TRY IT hands the working table to the game and fires the move where the ship is;
 * PROVING GROUND flies the sandbox level. Every edit goes through the content's snapshot/changed pair so
 * UNDO and SAVE cover moves exactly as they cover levels.
 */
export interface MovesOpts {
  content: Content;
  tryMove: (id: string) => void;
  flySandbox: () => void;
}

/** keys a move may sit on: unbound in DEFAULT_BINDS and free of the end card (R V G), the debug toggle and Esc */
export const TRIGGER_KEYS = ["KeyB", "KeyF", "KeyT", "KeyY", "KeyH", "KeyN", "KeyM", "KeyZ", "Digit1", "Digit2", "Digit3", "Digit4", "Tab", "CapsLock"];

const DIR_LABEL: Record<MoveDir, string> = { none: "(the key alone, after the window)", up: "then W (pull up)", down: "then S (dive)", left: "then A (roll left)", right: "then D (roll right)" };
const STEP_HELP: Record<StepKind, string> = {
  brake: "pulls forward speed toward the amount at the brake rate",
  boost: "pushes forward speed toward the amount at the boost rate; no bar drain, the cap lifts to match",
  snapPitch: "adds a pitch rate on top of nothing (the stick is dead): + is nose up",
  yaw: "adds a yaw rate: + is nose right",
  roll: "adds a roll rate: + is roll right; 2π over the step is one full roll",
  hop: "thrust along the spinning hull’s right axis; combine with roll for a corkscrew",
  slide: "thrust along the entry right axis; independent of the ship’s current spin",
  lift: "thrust along the entry up axis; independent of the ship’s current spin",
  coast: "amount above zero holds momentum while the hull rotates; boost steps resume thrust",
};

function h(html: string): HTMLElement {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

export class MovesPanel {
  readonly root = document.createElement("div");
  private selected: string | null = null;

  constructor(private readonly o: MovesOpts) {
    this.root.className = "moves";
  }

  get move(): MoveDef | undefined {
    return this.selected ? this.o.content.move(this.selected) : undefined;
  }

  render(): void {
    const c = this.o.content;
    if (!this.move) this.selected = c.moves[0]?.id ?? null;
    const m = this.move;
    this.root.innerHTML = `<div class="shelf">${c.moves.map((x) => `<button class="mv${x.id === this.selected ? " on" : ""}" data-id="${esc(x.id)}"><b>${esc(x.name)}</b><small>${esc(chordName(x))} · ${x.duration.toFixed(2)} s · ${Math.round(x.cost * 100)}% bar</small></button>`).join("")}<button class="wide new">+ NEW MOVE</button><button class="wide sandbox">PROVING GROUND ▸</button></div><div class="sheet"></div>`;
    for (const b of this.root.querySelectorAll<HTMLButtonElement>(".shelf .mv")) b.onclick = () => ((this.selected = b.dataset.id ?? null), this.render());
    this.root.querySelector<HTMLButtonElement>(".new")!.onclick = () => this.create();
    this.root.querySelector<HTMLButtonElement>(".sandbox")!.onclick = this.o.flySandbox;
    const sheet = this.root.querySelector<HTMLElement>(".sheet")!;
    if (!m) {
      sheet.append(h(`<div class="help">No moves yet. NEW MOVE starts one with a single step.</div>`));
      return;
    }
    sheet.append(h(`<div class="ttl">${esc(m.name.toUpperCase())}</div><div class="sub">${esc(m.id)} · ${esc(chordName(m))}</div>`));
    const actions = h(`<div class="actions"><button class="try primary">TRY IT</button><button class="dup">DUPLICATE</button><button class="del danger">DELETE</button></div>`);
    actions.querySelector<HTMLButtonElement>(".try")!.onclick = () => this.o.tryMove(m.id);
    actions.querySelector<HTMLButtonElement>(".dup")!.onclick = () => this.duplicate(m);
    actions.querySelector<HTMLButtonElement>(".del")!.onclick = () => this.remove(m);
    sheet.append(actions);

    this.textRow(sheet, "name", m.name, (v) => this.edit(m, (x) => (x.name = v)));
    this.selectRow(sheet, "trigger key", m.trigger.key, TRIGGER_KEYS.map((k) => ({ value: k, label: keyName(k) })), (v) => this.edit(m, (x) => (x.trigger.key = v)));
    this.selectRow(sheet, "then", m.trigger.dir, MOVE_DIRS.map((d) => ({ value: d, label: DIR_LABEL[d] })), (v) => this.edit(m, (x) => (x.trigger.dir = v as MoveDir)));
    this.numberRow(sheet, "cost (bar fraction)", m.cost, 0, 1, 0.05, (v) => this.edit(m, (x) => (x.cost = v)));
    this.numberRow(sheet, "duration (s)", m.duration, 0.1, 5, 0.05, (v) => this.edit(m, (x) => (x.duration = v)));
    sheet.append(h(`<div class="help">The stick is dead for the whole duration; steps overlap freely and add up. The bar must hold the cost or the chord does nothing.</div>`));
    sheet.append(this.timeline(m));

    const steps = h(`<div class="steps"></div>`);
    m.steps.forEach((s, i) => steps.append(this.stepCard(m, s, i)));
    sheet.append(steps);
    const add = h(`<button class="wide addstep">+ ADD STEP</button>`);
    add.onclick = () => this.edit(m, (x) => x.steps.push({ kind: "snapPitch", start: 0, length: Math.min(0.4, x.duration), amount: 2 }));
    sheet.append(add);
    const problems = c.problems().filter((p) => p.includes(m.name) || p.includes(m.id));
    if (problems.length) sheet.append(h(`<div class="problems">${problems.map(esc).join("<br>")}</div>`));
  }

  private timeline(m: MoveDef): HTMLElement {
    const W = 700, L = 90, R = 10, rowH = 18, H = 24 + m.steps.length * rowH + 6;
    const x = (t: number): number => L + ((W - L - R) * t) / Math.max(m.duration, 1e-3);
    const ticks: string[] = [];
    for (let t = 0; t <= m.duration + 1e-6; t += m.duration > 2 ? 0.5 : 0.25) ticks.push(`<line x1="${x(t)}" y1="14" x2="${x(t)}" y2="${H - 4}"/><text class="t" x="${x(t)}" y="10" text-anchor="middle">${t.toFixed(2)}</text>`);
    const bars = m.steps.map((s, i) => {
      const y = 20 + i * rowH;
      return `<text x="${L - 6}" y="${y + 12}" text-anchor="end">${esc(s.kind)} ${s.amount}</text><rect class="bar" x="${x(s.start)}" y="${y + 2}" width="${Math.max(2, x(Math.min(s.start + s.length, m.duration)) - x(s.start))}" height="${rowH - 6}"/>`;
    });
    return h(`<div class="timeline"><svg viewBox="0 0 ${W} ${H}">${ticks.join("")}${bars.join("")}</svg></div>`);
  }

  private stepCard(m: MoveDef, s: MoveStep, i: number): HTMLElement {
    const card = h(`<div class="step" data-i="${i}"><div class="sh"><b>STEP ${i + 1}</b><button class="rm" title="remove this step">×</button></div></div>`);
    card.querySelector<HTMLButtonElement>(".rm")!.onclick = () => this.edit(m, (x) => x.steps.splice(i, 1));
    const kind = h(`<div class="f"><span>kind</span><select>${STEP_KINDS.map((k) => `<option value="${k}"${k === s.kind ? " selected" : ""}>${k}</option>`).join("")}</select></div>`);
    kind.querySelector("select")!.onchange = (e) => this.edit(m, (x) => (x.steps[i]!.kind = (e.target as HTMLSelectElement).value as StepKind));
    card.append(kind);
    const f = (label: string, key: "start" | "length" | "amount", min: number, max: number, step: number): void => {
      const row = h(`<div class="f"><span>${label}</span><input type="number" min="${min}" max="${max}" step="${step}" value="${s[key]}"></div>`);
      const inp = row.querySelector("input")!;
      inp.onchange = () => {
        const v = Number(inp.value);
        if (Number.isFinite(v)) this.edit(m, (x) => (x.steps[i]![key] = v));
      };
      card.append(row);
    };
    f("start (s)", "start", 0, 5, 0.05);
    f("length (s)", "length", 0.05, 5, 0.05);
    f("amount", "amount", -1000, 1000, s.kind === "brake" || s.kind === "boost" || s.kind === "hop" ? 5 : 0.1);
    card.append(h(`<div class="unit">${esc(STEP_UNIT[s.kind])} · ${esc(STEP_HELP[s.kind])}</div>`));
    return card;
  }

  private edit(m: MoveDef, fn: (m: MoveDef) => void): void {
    this.o.content.snapshot();
    fn(m);
    this.o.content.changed();
  }

  private create(): void {
    const c = this.o.content;
    const id = c.freshId("new move", (x) => c.moves.some((mv) => mv.id === x), "move");
    c.snapshot();
    c.moves.push({ id, name: "New move", trigger: { key: "KeyB", dir: "down" }, cost: 0.25, duration: 0.8, steps: [{ kind: "snapPitch", start: 0, length: 0.4, amount: -2.5 }] });
    this.selected = id;
    c.changed();
  }

  private duplicate(m: MoveDef): void {
    const c = this.o.content;
    const copy = structuredClone(m);
    copy.id = c.freshId(`${m.name} copy`, (x) => c.moves.some((mv) => mv.id === x), "move");
    copy.name = `${m.name} copy`;
    c.snapshot();
    c.moves.splice(c.moves.indexOf(m) + 1, 0, copy);
    this.selected = copy.id;
    c.changed();
  }

  private remove(m: MoveDef): void {
    const c = this.o.content;
    c.snapshot();
    c.moves.splice(c.moves.indexOf(m), 1);
    this.selected = null;
    c.changed();
  }

  private textRow(into: HTMLElement, label: string, value: string, set: (v: string) => void): void {
    const row = h(`<div class="row"><span>${esc(label)}</span><input value="${esc(value)}"></div>`);
    const inp = row.querySelector("input")!;
    inp.onchange = () => set(inp.value);
    into.append(row);
  }

  private numberRow(into: HTMLElement, label: string, value: number, min: number, max: number, step: number, set: (v: number) => void): void {
    const row = h(`<div class="row"><span>${esc(label)}</span><input type="number" min="${min}" max="${max}" step="${step}" value="${value}"></div>`);
    const inp = row.querySelector("input")!;
    inp.onchange = () => {
      const v = Number(inp.value);
      if (Number.isFinite(v)) set(v);
    };
    into.append(row);
  }

  private selectRow(into: HTMLElement, label: string, value: string, options: { value: string; label: string }[], set: (v: string) => void): void {
    const row = h(`<div class="row"><span>${esc(label)}</span><select>${options.map((o) => `<option value="${esc(o.value)}"${o.value === value ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select></div>`);
    row.querySelector("select")!.onchange = (e) => set((e.target as HTMLSelectElement).value);
    into.append(row);
  }
}
