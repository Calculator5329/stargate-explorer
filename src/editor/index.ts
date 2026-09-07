import { Content } from "@/editor/content";
import { Board } from "@/editor/board";
import { Encounter } from "@/editor/encounter";
import { chainOrder } from "@/editor/power";
import { SHIPS } from "@/ships/registry";

/**
 * The game designer (`?edit=1`, dev server only): a full-screen overlay over the running game with the
 * campaign board on the left and the encounter composer on the right. Saving writes `content/campaign.json`
 * through the dev server; Vite reloads the page and the game runs the new campaign. "FLY IT" hides the overlay
 * and hands the pointer to the game; releasing the pointer brings the designer back. Code-split: the game
 * never loads this module unless the flag is on.
 */
export interface EditorOpts {
  currentLevelId: string;
  currentShipId: string;
  /** lock the pointer and let the sim run on the level already loaded */
  flyHere: () => void;
  /** reload into another level (and hull) with the designer parked */
  flyOther: (levelId: string, shipId: string) => void;
}

export interface EditorHandle {
  /** true while the overlay is up: the sim holds and the menu stays out of the way */
  active: boolean;
  show(): void;
  hide(): void;
  readonly content: Content;
  select(id: string | null): void;
  readonly selected: string | null;
}

const CSS = `
body.editing #hud,body.editing #dial,body.editing #hub,body.editing #menu{display:none!important}
#editor{position:fixed;inset:0;z-index:40;display:grid;grid-template-rows:44px 1fr;grid-template-columns:1fr 460px;background:#0b0d16;color:#cfe9ff;font:13px/1.35 ui-monospace,Menlo,Consolas,monospace;user-select:none}
#editor[hidden]{display:none}
#editor *{box-sizing:border-box}
#editor .top{grid-column:1/3;display:flex;align-items:center;gap:14px;padding:0 14px;border-bottom:1px solid rgba(255,217,168,.25)}
#editor .top b{color:#ffd9a8;letter-spacing:.12em}
#editor .top .tab{background:none;border:1px solid transparent;color:#8fb3d9;padding:5px 10px;cursor:pointer;font:inherit;letter-spacing:.08em}
#editor .top .tab.on{color:#ffd9a8;border-color:rgba(255,217,168,.5)}
#editor .top .spacer{flex:1}
#editor .top .status{color:#8fb3d9}
#editor .top .status.dirty{color:#ffd9a8}
#editor .top .status.err{color:#ff8a8a}
#editor button{font:inherit;background:rgba(207,233,255,.06);border:1px solid rgba(207,233,255,.3);color:#cfe9ff;padding:5px 10px;cursor:pointer;letter-spacing:.06em}
#editor button:hover{border-color:#ffd9a8;color:#ffd9a8}
#editor button.primary{border-color:#ffd9a8;color:#ffd9a8;background:rgba(255,217,168,.08)}
#editor button.danger:hover{border-color:#ff8a8a;color:#ff8a8a}
#editor button.wide{display:block;width:100%;margin:10px 0}
#editor .main{overflow:auto;position:relative}
#editor .board-wrap{min-width:100%}
#editor svg.board{display:block}
#editor .band rect{fill:rgba(207,233,255,.035);stroke:rgba(207,233,255,.14);stroke-dasharray:4 4}
#editor .band-title{fill:#8fb3d9;font-size:11px;letter-spacing:.14em}
#editor .edge{fill:none;stroke:rgba(207,233,255,.35);stroke-width:1.5}
#editor .edge.lit{stroke:#ffd9a8;stroke-width:2}
#editor .arrowhead{fill:rgba(207,233,255,.6)}
#editor .node{cursor:grab}
#editor .node rect{fill:rgba(20,26,44,.96);stroke:rgba(207,233,255,.35);stroke-width:1}
#editor .node.sel rect{stroke:#ffd9a8;stroke-width:2}
#editor .node .title{fill:#ffd9a8;font-size:13px;font-weight:700;letter-spacing:.04em;pointer-events:none}
#editor .node .sub{fill:#8fb3d9;font-size:11px;pointer-events:none}
#editor .pill rect{stroke:none}
#editor .pill text{font-size:10px;font-weight:700;fill:#0b0d16;pointer-events:none}
#editor .pill.low rect{fill:#7fd58a}
#editor .pill.mid rect{fill:#ffd9a8}
#editor .pill.high rect{fill:#ff8a8a}
#editor .curve{padding:14px 18px 30px;border-top:1px solid rgba(255,217,168,.2)}
#editor .curve-head{display:flex;gap:12px;align-items:baseline;margin-bottom:8px}
#editor .curve-head span{color:#ffd9a8;letter-spacing:.12em}
#editor .curve-head small{color:#8fb3d9}
#editor .curve-act{color:#8fb3d9;letter-spacing:.14em;font-size:11px;margin:10px 0 4px}
#editor .curve-row{display:grid;grid-template-columns:220px 1fr 50px 70px 150px;gap:10px;align-items:center;padding:2px 6px;cursor:pointer;border:1px solid transparent}
#editor .curve-row:hover{border-color:rgba(207,233,255,.25)}
#editor .curve-row.sel{border-color:#ffd9a8}
#editor .curve-row .cl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#editor .curve-row .bar{height:10px;background:rgba(207,233,255,.08);position:relative}
#editor .curve-row .bar i{position:absolute;inset:0 auto 0 0;display:block}
#editor .curve-row .bar i.low{background:#7fd58a}
#editor .curve-row .bar i.mid{background:#ffd9a8}
#editor .curve-row .bar i.high{background:#ff8a8a}
#editor .curve-row .cv{text-align:right}
#editor .curve-row .cm,#editor .curve-row .cs{color:#8fb3d9}
#editor .inspector{overflow:auto;border-left:1px solid rgba(255,217,168,.25);padding:12px 14px 40px}
#editor .inspector .head .ttl{color:#ffd9a8;font-size:16px;font-weight:700;letter-spacing:.06em}
#editor .inspector .head .id{color:#5f7d9c;font-size:11px;letter-spacing:.08em;margin-top:2px}
#editor .inspector .actions{display:flex;gap:6px;margin:10px 0 4px}
#editor .inspector .section{margin:22px 0 8px;padding-bottom:4px;border-bottom:1px solid rgba(255,217,168,.25)}
#editor .inspector .section b{display:block;color:#ffd9a8;letter-spacing:.14em;font-size:11px}
#editor .inspector .section p{margin:3px 0 0;color:#8fb3d9;font-size:12px;line-height:1.4}
#editor .help{margin:2px 0 8px;padding:6px 8px;border-left:2px solid rgba(255,217,168,.5);color:#cfe9ff;font-size:12px;line-height:1.4}
#editor .row{display:grid;grid-template-columns:130px 1fr;gap:4px 10px;align-items:center;margin:5px 0}
#editor .row label,#editor .row.note>span:first-child{color:#8fb3d9;font-size:12px}
#editor .row small{grid-column:2;color:#5f7d9c;font-size:11px}
#editor .row input,#editor .row select,#editor .row textarea{font:inherit;background:rgba(0,0,0,.35);border:1px solid rgba(207,233,255,.25);color:#cfe9ff;padding:3px 6px;width:100%;min-width:0}
#editor .row textarea{resize:vertical}
#editor .row input:focus,#editor .row select:focus,#editor .row textarea:focus{outline:none;border-color:#ffd9a8}
#editor .chips{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
#editor .chip{display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(207,233,255,.3);padding:1px 6px;font-size:11px;cursor:pointer;background:rgba(0,0,0,.3)}
#editor .chip b{font-weight:600}
#editor .chip i{font-style:normal;color:#8fb3d9;padding-left:2px}
#editor .chip i:hover{color:#ff8a8a}
#editor .chip.k-glider{border-color:#8fb3d9}
#editor .chip.k-interceptor{border-color:#7fd58a}
#editor .chip.k-gunboat{border-color:#ffd9a8}
#editor .chip.k-bomber{border-color:#ff8a8a}
#editor .chip.k-ace{border-color:#ffd9a8;color:#ffd9a8}
#editor button.chip.add{padding:1px 8px}
#editor .waves .wave{border:1px solid rgba(207,233,255,.2);padding:8px 10px;margin:8px 0;background:rgba(207,233,255,.03)}
#editor .waves .wave-top{display:flex;align-items:center;gap:10px}
#editor .waves .wave-top b{color:#ffd9a8;letter-spacing:.1em;font-size:11px}
#editor .waves .wave-top .sum{flex:1;color:#cfe9ff}
#editor .waves .tools{display:flex;gap:2px}
#editor .waves .tools button{padding:1px 5px}
#editor .waves .wave-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;margin-top:8px}
#editor .waves .wave-grid label{display:flex;flex-direction:column;gap:2px;color:#8fb3d9;font-size:11px}
#editor .waves .wave-grid input{font:inherit;background:rgba(0,0,0,.35);border:1px solid rgba(207,233,255,.25);color:#cfe9ff;padding:3px 6px;width:100%;min-width:0}
#editor .waves .wave-mix{display:flex;gap:10px;align-items:center;margin-top:8px}
#editor .waves .wave-mix>span{color:#8fb3d9;font-size:11px;width:24px}
#editor .waves .wave-mix small{color:#5f7d9c}
#editor .power .big{display:flex;align-items:baseline;gap:10px;margin:6px 0}
#editor .power .big b{font-size:28px}
#editor .power .big.low b{color:#7fd58a}
#editor .power .big.mid b{color:#ffd9a8}
#editor .power .big.high b{color:#ff8a8a}
#editor .power .big span{color:#8fb3d9;font-size:12px}
#editor .power .big em{font-style:normal;color:#cfe9ff}
#editor .power .grid{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:2px 10px}
#editor .power .grid span{color:#8fb3d9}
#editor .power p{margin:8px 0 0;color:#cfe9ff}
#editor .power p.dim{color:#5f7d9c;font-size:11px}
#editor .problems{margin-top:12px;padding:8px;border:1px solid #ff8a8a;color:#ff8a8a}
#editor .empty{color:#8fb3d9;margin-top:20px;line-height:1.45}
#editor .empty b{color:#ffd9a8;letter-spacing:.12em}
#editor .empty p{margin:8px 0}
#editor .guide{max-width:760px;padding:24px 28px;line-height:1.5}
#editor .guide h2{color:#ffd9a8;letter-spacing:.14em;font-size:12px;margin:22px 0 6px}
#editor .guide h2:first-child{margin-top:0}
#editor .guide p{margin:4px 0;color:#cfe9ff}
#editor .guide p b{color:#ffd9a8;font-weight:600}
#editor .acts{padding:18px}
#editor .acts .act{display:grid;grid-template-columns:90px 260px 1fr auto;gap:10px;align-items:center;margin:6px 0}
#editor .acts input{font:inherit;background:rgba(0,0,0,.35);border:1px solid rgba(207,233,255,.25);color:#cfe9ff;padding:4px 6px;width:100%}
#editor .acts .hint{color:#5f7d9c;margin:14px 0}
`;

export function mountEditor(o: EditorOpts): EditorHandle {
  const content = new Content();
  let selected: string | null = content.level(o.currentLevelId) ? o.currentLevelId : null;
  let shipOverride: string | null = null;
  let tab: "board" | "acts" | "help" = "board";
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);

  const root = document.createElement("div");
  root.id = "editor";
  root.innerHTML = `<div class="top"><b>GAME DESIGNER</b><button class="tab on" data-tab="board">BOARD</button><button class="tab" data-tab="acts">ACTS</button><button class="tab" data-tab="help">HOW THIS WORKS</button><span class="spacer"></span><span class="status"></span><button class="undo">UNDO</button><button class="save primary">SAVE</button><button class="close">FLY (ESC)</button></div><div class="main"></div>`;
  document.body.append(root);
  document.body.classList.add("editing");
  const main = root.querySelector<HTMLElement>(".main")!, status = root.querySelector<HTMLElement>(".status")!;

  const handle: EditorHandle = {
    active: true,
    content,
    get selected() {
      return selected;
    },
    select,
    show() {
      handle.active = true;
      root.hidden = false;
      document.body.classList.add("editing");
      render();
    },
    hide() {
      handle.active = false;
      root.hidden = true;
      document.body.classList.remove("editing");
    },
  };

  const board = new Board({ content, selected: () => selected, select, shipOverride: () => shipOverride });
  const inspector = new Encounter({
    content,
    selected: () => selected,
    select,
    shipOverride: () => shipOverride,
    setShipOverride: (id) => ((shipOverride = id), render()),
    fly: (id) => {
      const ship = shipOverride ?? (id === o.currentLevelId ? o.currentShipId : bestShipBefore(id));
      if (id === o.currentLevelId && !content.dirty && ship === o.currentShipId) (handle.hide(), o.flyHere());
      else void content.save().then((r) => (r === "invalid" ? setStatus("fix the problems listed under the level first", "err") : o.flyOther(id, ship)));
    },
  });
  root.append(inspector.root);

  function bestShipBefore(id: string): string {
    const order = chainOrder(content.levels, content.acts.map((a) => a.id));
    let best = "f11";
    for (const l of order) {
      if (l.id === id) break;
      if (l.unlocks && SHIPS[l.unlocks] && SHIPS[l.unlocks]!.stats.hull * SHIPS[l.unlocks]!.stats.guns > SHIPS[best]!.stats.hull * SHIPS[best]!.stats.guns) best = l.unlocks;
    }
    return best;
  }

  function select(id: string | null): void {
    selected = id;
    render();
  }

  function setStatus(text: string, cls = ""): void {
    status.textContent = text;
    status.className = "status " + cls;
  }

  function renderActs(): void {
    const wrap = document.createElement("div");
    wrap.className = "acts";
    wrap.innerHTML = `<div class="hint">Acts are the bands on the board. Order here is campaign order; a level's act is set by where its card sits, or from its inspector.</div>`;
    content.acts.forEach((a, i) => {
      const row = document.createElement("div");
      row.className = "act";
      row.innerHTML = `<span>${a.id}</span><input class="t" value="${a.title.replace(/"/g, "&quot;")}"><input class="b" value="${a.blurb.replace(/"/g, "&quot;")}"><span><button class="up">↑</button> <button class="dn">↓</button> <button class="rm">×</button></span>`;
      row.querySelector<HTMLInputElement>(".t")!.onchange = (e) => ((content.snapshot(), (a.title = (e.target as HTMLInputElement).value)), content.changed());
      row.querySelector<HTMLInputElement>(".b")!.onchange = (e) => ((content.snapshot(), (a.blurb = (e.target as HTMLInputElement).value)), content.changed());
      row.querySelector<HTMLButtonElement>(".up")!.onclick = () => i > 0 && (content.snapshot(), content.acts.splice(i - 1, 2, a, content.acts[i - 1]!), content.changed());
      row.querySelector<HTMLButtonElement>(".dn")!.onclick = () => i < content.acts.length - 1 && (content.snapshot(), content.acts.splice(i, 2, content.acts[i + 1]!, a), content.changed());
      row.querySelector<HTMLButtonElement>(".rm")!.onclick = () => {
        if (content.levels.some((l) => l.act === a.id)) return setStatus("that act still has levels in it", "err");
        content.snapshot();
        content.acts.splice(i, 1);
        content.changed();
      };
      wrap.append(row);
    });
    const add = document.createElement("button");
    add.className = "wide";
    add.textContent = "+ ACT";
    add.onclick = () => {
      let n = content.acts.length + 1;
      while (content.acts.some((a) => a.id === `act${n}`)) n++;
      content.snapshot();
      content.acts.push({ id: `act${n}`, title: `ACT ${n}`, blurb: "" });
      content.changed();
    };
    wrap.append(add);
    main.replaceChildren(wrap);
  }

  function renderHelp(): void {
    const g = document.createElement("div");
    g.className = "guide";
    g.innerHTML = `
<h2>THE BOARD</h2>
<p>Every card is one level. Drag them anywhere; the layout is saved with the campaign. The arrow into a card comes from the level that has to be won first. The dashed bands are the acts: drop a card inside another band and it moves to that act. Acts are only grouping and order, the game does not gate on them yet.</p>
<h2>THE PILLS AND THE POWER CURVE</h2>
<p>The pill on a card is the estimated share of the hull a player loses flying that level in the ship the chain has handed over by then. <b>Green</b> under 45% is comfortable, <b>gold</b> up to 90% is a real fight, <b>red</b> above that kills anyone not flying well. The power curve under the board lists the same numbers in campaign order, so a spike or a flat stretch shows at a glance. It is a model from the game's own tables, not a measurement; trust the shape, not the decimals.</p>
<h2>THE INSPECTOR</h2>
<p>Click a card and it opens on the right, top to bottom in the order you would think about it: what the level is, where it happens, where it sits in the chain, the fight itself, the story text, and how hard it comes out. Every section opens with a line saying what the fields do. Number boxes commit when you leave them or press Enter.</p>
<h2>WAVES AND KINDS</h2>
<p>Wave levels spawn one wave at a time, each a set number of seconds after the previous one is dead. A wave's <b>mix</b> is a list of kinds the game cycles through: four ships with GUNBOAT, GLIDER gives gunboat, glider, gunboat, glider. Click a chip to change its kind, × to drop it, + to add one. No chips means all gliders.</p>
<h2>SAVING AND FLYING</h2>
<p><b>SAVE</b> (Ctrl+S) writes the campaign file in the repo and the page reloads on it; until then nothing touches disk and <b>UNDO</b> (Ctrl+Z) steps back. <b>FLY IT</b> runs the selected level right now: the designer hides, the pointer locks, and releasing the pointer (Esc) brings the designer back. Flying a different level than the one loaded saves first and reloads into it.</p>
<h2>WHAT IS NOT HERE YET</h2>
<p>Ships and enemy kinds are still numbers in code (the stat sheet is next after this). Moves and combos have no editor yet. The threat model's three feel constants are guesses until a real flight calibrates them.</p>`;
    main.replaceChildren(g);
  }

  function render(): void {
    if (!handle.active) return;
    for (const b of root.querySelectorAll<HTMLElement>(".tab")) b.classList.toggle("on", b.dataset.tab === tab);
    if (tab === "board") {
      if (board.root.parentElement !== main) main.replaceChildren(board.root);
      board.render();
    } else if (tab === "help") renderHelp();
    else renderActs();
    inspector.render();
    const problems = content.problems();
    if (problems.length) setStatus(`${problems.length} problem${problems.length > 1 ? "s" : ""}: ${problems[0]}`, "err");
    else setStatus(content.dirty ? "unsaved changes" : "saved", content.dirty ? "dirty" : "");
  }

  content.onChange = render;
  for (const b of root.querySelectorAll<HTMLElement>(".tab")) b.onclick = () => ((tab = b.dataset.tab as typeof tab), render());
  root.querySelector<HTMLButtonElement>(".undo")!.onclick = () => content.undo() || setStatus("nothing to undo");
  root.querySelector<HTMLButtonElement>(".save")!.onclick = () => {
    setStatus("saving...");
    void content.save().then((r) => {
      if (r === "saved") setStatus("saved; the page reloads with the new campaign");
      else if (r === "invalid") setStatus("not saved: fix the problems first", "err");
      else setStatus("no content store: run the dev server (npm run dev), the built game cannot save", "err");
    });
  };
  root.querySelector<HTMLButtonElement>(".close")!.onclick = () => (handle.hide(), o.flyHere());
  window.addEventListener("keydown", (e) => {
    if (!handle.active) return;
    if ((e.ctrlKey || e.metaKey) && e.key === "z") (e.preventDefault(), content.undo());
    if ((e.ctrlKey || e.metaKey) && e.key === "s") (e.preventDefault(), root.querySelector<HTMLButtonElement>(".save")!.click());
  });
  render();
  return handle;
}
