import type { LevelDef } from "@/mission/levels";
import type { Content } from "@/editor/content";
import { chainOrder, power, shipAt, type PowerRead } from "@/editor/power";
import { SHIPS } from "@/ships/registry";

/**
 * The campaign board: one card per level laid out on a canvas the designer drags around, an arrow from each
 * level to the one it requires, and act bands drawn round wherever the cards of each act sit. Dragging a card
 * into another act's band moves it there. Under the board, the power curve: every level in campaign order with
 * its estimated threat, so a spike or a flat stretch shows before anyone flies it.
 */
const NW = 236, NH = 64, PAD = 24;
const SVG = "http://www.w3.org/2000/svg";

export interface BoardOpts {
  content: Content;
  selected: () => string | null;
  select: (id: string) => void;
  /** null = the ship the chain would have handed over by then */
  shipOverride: () => string | null;
}

export function threatBand(t: number): "low" | "mid" | "high" {
  return t < 0.45 ? "low" : t < 0.9 ? "mid" : "high";
}

export function readFor(levels: readonly LevelDef[], l: LevelDef, override: string | null): PowerRead {
  return power(l, (override && SHIPS[override]) || shipAt(levels, l.id));
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (text !== undefined) e.textContent = text;
  return e;
}

export class Board {
  readonly root = document.createElement("div");
  private readonly svg = el("svg", { class: "board" });
  private readonly curve = document.createElement("div");
  private drag: { id: string; dx: number; dy: number; moved: boolean } | null = null;

  constructor(private readonly o: BoardOpts) {
    this.root.className = "board-wrap";
    this.root.append(this.svg, this.curve);
    this.curve.className = "curve";
    this.svg.addEventListener("pointerdown", (e) => this.down(e));
    this.svg.addEventListener("pointermove", (e) => this.move(e));
    this.svg.addEventListener("pointerup", (e) => this.up(e));
    this.svg.addEventListener("pointercancel", (e) => this.up(e));
  }

  /** every level gets a spot even if the json has none, so nothing is invisible on the board */
  private place(): void {
    const c = this.o.content;
    let x = 40, y = 40;
    for (const l of c.levels) {
      if (!l.board) {
        l.board = { x, y };
        y += NH + 28;
      }
      if (!l.act && c.acts[0]) l.act = c.acts[0].id;
    }
  }

  /** `exclude` leaves one card out, so the band it is being dragged from does not stretch to follow it */
  private bands(exclude: string | null = null): { id: string; title: string; y0: number; y1: number }[] {
    const c = this.o.content;
    const out = c.acts.map((a) => ({ id: a.id, title: a.title, y0: Infinity, y1: -Infinity }));
    for (const l of c.levels) {
      if (l.id === exclude) continue;
      const b = out.find((x) => x.id === l.act);
      if (!b || !l.board) continue;
      b.y0 = Math.min(b.y0, l.board.y - PAD);
      b.y1 = Math.max(b.y1, l.board.y + NH + PAD);
    }
    // an act with no levels still gets a strip below the last one so a card can be dropped into it
    let bottom = 40;
    for (const b of out) {
      if (b.y0 === Infinity) (b.y0 = bottom + 20), (b.y1 = b.y0 + NH + 2 * PAD);
      bottom = Math.max(bottom, b.y1);
    }
    return out;
  }

  render(): void {
    this.place();
    const c = this.o.content, sel = this.o.selected(), override = this.o.shipOverride();
    const svg = this.svg;
    svg.replaceChildren();
    const bands = this.bands();
    let w = 600, h = 200;
    for (const l of c.levels) if (l.board) (w = Math.max(w, l.board.x + NW + 60)), (h = Math.max(h, l.board.y + NH + 60));
    for (const b of bands) h = Math.max(h, b.y1 + 40);
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const defs = el("defs");
    const marker = el("marker", { id: "arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: "auto-start-reverse" });
    marker.append(el("path", { d: "M0 0 L10 5 L0 10 z", class: "arrowhead" }));
    defs.append(marker);
    svg.append(defs);

    for (const b of bands) {
      const g = el("g", { class: "band" });
      g.append(el("rect", { x: 8, y: b.y0, width: w - 16, height: b.y1 - b.y0, rx: 6 }));
      g.append(el("text", { x: 18, y: b.y0 + 16, class: "band-title" }, b.title));
      svg.append(g);
    }

    const byId = new Map(c.levels.map((l) => [l.id, l] as const));
    for (const l of c.levels) {
      const req = l.requires ? byId.get(l.requires) : undefined;
      if (!req?.board || !l.board) continue;
      const x0 = req.board.x + NW, y0 = req.board.y + NH / 2, x1 = l.board.x, y1 = l.board.y + NH / 2;
      const dx = Math.max(40, Math.abs(x1 - x0) * 0.5);
      const d = x1 >= x0 + 20 ? `M${x0} ${y0} C${x0 + dx} ${y0} ${x1 - dx} ${y1} ${x1} ${y1}` : `M${x0} ${y0} C${x0 + 60} ${y0 + 40} ${x1 - 60} ${y1 - 40} ${x1} ${y1}`;
      svg.append(el("path", { d, class: "edge" + (l.id === sel || req.id === sel ? " lit" : ""), "marker-end": "url(#arrow)" }));
    }

    for (const l of c.levels) {
      if (!l.board) continue;
      const r = readFor(c.levels, l, override);
      const g = el("g", { class: "node" + (l.id === sel ? " sel" : ""), transform: `translate(${l.board.x} ${l.board.y})`, "data-id": l.id });
      g.append(el("rect", { width: NW, height: NH, rx: 4 }));
      g.append(el("text", { x: 10, y: 20, class: "title" }, l.title.length > 21 ? l.title.slice(0, 20) + "…" : l.title));
      g.append(el("text", { x: 10, y: 38, class: "sub" }, `${l.type.toUpperCase()} · ${l.system}`));
      g.append(el("text", { x: 10, y: 54, class: "sub" }, l.unlocks && SHIPS[l.unlocks] ? `unlocks ${SHIPS[l.unlocks]!.def.name}` : r.ship === "f11" ? "" : `in the ${SHIPS[r.ship]?.def.name ?? r.ship}`));
      const pill = el("g", { class: `pill ${threatBand(r.threat)}`, transform: `translate(${NW - 50} 8)` });
      pill.append(el("rect", { width: 42, height: 16, rx: 8 }));
      pill.append(el("text", { x: 21, y: 12, "text-anchor": "middle" }, `${Math.round(r.threat * 100)}%`));
      g.append(pill);
      svg.append(g);
    }
    this.renderCurve();
  }

  private renderCurve(): void {
    const c = this.o.content, sel = this.o.selected(), override = this.o.shipOverride();
    const order = chainOrder(c.levels, c.acts.map((a) => a.id));
    const rows: string[] = [`<div class="curve-head"><span>POWER CURVE</span><small>estimated threat per level, campaign order; ${override ? `everything flown in the ${SHIPS[override]?.def.name ?? override}` : "each in the best hull the chain has handed over"}</small></div>`];
    let prevAct = "";
    for (const l of order) {
      const r = readFor(c.levels, l, override);
      if (l.act !== prevAct) {
        rows.push(`<div class="curve-act">${esc(c.acts.find((a) => a.id === l.act)?.title ?? "(no act)")}</div>`);
        prevAct = l.act ?? "";
      }
      const pct = Math.round(r.threat * 100);
      rows.push(`<div class="curve-row${l.id === sel ? " sel" : ""}" data-id="${esc(l.id)}"><span class="cl">${esc(l.title)}</span><span class="bar"><i class="${threatBand(r.threat)}" style="width:${Math.min(100, r.threat * 66)}%"></i></span><span class="cv">${pct}%</span><span class="cm">${r.clearMin.toFixed(1)} min</span><span class="cs">${esc(SHIPS[r.ship]?.def.name ?? r.ship)}</span></div>`);
    }
    this.curve.innerHTML = rows.join("");
    for (const row of this.curve.querySelectorAll<HTMLElement>(".curve-row")) row.onclick = () => this.o.select(row.dataset.id!);
  }

  private nodeAt(e: PointerEvent): { id: string; g: SVGGElement } | null {
    const g = (e.target as Element).closest<SVGGElement>("g.node");
    return g?.dataset.id ? { id: g.dataset.id, g } : null;
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const b = this.svg.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  }

  private down(e: PointerEvent): void {
    const n = this.nodeAt(e);
    if (!n) return;
    const l = this.o.content.level(n.id);
    if (!l?.board) return;
    const p = this.local(e);
    this.drag = { id: n.id, dx: p.x - l.board.x, dy: p.y - l.board.y, moved: false };
    this.svg.setPointerCapture(e.pointerId);
    if (this.o.selected() !== n.id) this.o.select(n.id);
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const l = this.o.content.level(d.id);
    if (!l?.board) return;
    const p = this.local(e);
    const nx = Math.max(8, Math.round(p.x - d.dx)), ny = Math.max(8, Math.round(p.y - d.dy));
    if (!d.moved) {
      if (Math.abs(nx - l.board.x) + Math.abs(ny - l.board.y) < 4) return;
      this.o.content.snapshot();
      d.moved = true;
    }
    l.board.x = nx;
    l.board.y = ny;
    this.render();
  }

  private up(e: PointerEvent): void {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (this.svg.hasPointerCapture(e.pointerId)) this.svg.releasePointerCapture(e.pointerId);
    if (!d.moved) return;
    const l = this.o.content.level(d.id);
    if (!l?.board) return;
    // land in whichever act band the card's centre is nearest
    const cy = l.board.y + NH / 2;
    let best = l.act, bestD = Infinity;
    for (const b of this.bands(l.id)) {
      const dist = cy < b.y0 ? b.y0 - cy : cy > b.y1 ? cy - b.y1 : 0;
      if (dist < bestD) (bestD = dist), (best = b.id);
    }
    if (best && best !== l.act) l.act = best;
    this.o.content.changed();
  }
}

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
