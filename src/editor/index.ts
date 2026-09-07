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
#editor{position:fixed;inset:0;z-index:40;display:grid;grid-template-rows:44px 1fr;grid-template-columns:1fr 400px;background:rgba(8,10,20,.93);color:#cfe9ff;font:13px/1.35 ui-monospace,Menlo,Consolas,monospace;user-select:none}
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
#editor .inspector .head .id{color:#8fb3d9;font-size:11px;letter-spacing:.1em}
#editor .inspector .actions{display:flex;gap:6px;margin:8px 0 4px}
#editor .inspector .section{color:#ffd9a8;letter-spacing:.14em;font-size:11px;margin:16px 0 6px;padding-bottom:3px;border-bottom:1px solid rgba(255,217,168,.2)}
#editor .row{display:grid;grid-template-columns:120px 1fr;gap:4px 10px;align-items:center;margin:4px 0}
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
#editor .waves .wave-head,#editor .waves .wave{display:grid;grid-template-columns:18px 1fr 1fr 1fr 1fr 66px;gap:4px;align-items:center;margin:3px 0}
#editor .waves .wave-head span{color:#5f7d9c;font-size:10px;letter-spacing:.08em}
#editor .waves .wave input{font:inherit;background:rgba(0,0,0,.35);border:1px solid rgba(207,233,255,.25);color:#cfe9ff;padding:2px 4px;width:100%;min-width:0}
#editor .waves .wave .n{color:#8fb3d9}
#editor .waves .wave .tools{display:flex;gap:2px}
#editor .waves .wave .tools button{padding:1px 5px}
#editor .waves .wave .chips{grid-column:2/7;margin-bottom:6px}
#editor .waves .wave .chips small{color:#5f7d9c}
#editor .power .big{display:flex;align-items:baseline;gap:10px;margin:6px 0}
#editor .power .big b{font-size:28px}
#editor .power .big.low b{color:#7fd58a}
#editor .power .big.mid b{color:#ffd9a8}
#editor .power .big.high b{color:#ff8a8a}
#editor .power .big span{color:#8fb3d9;font-size:12px}
#editor .power .grid{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:2px 10px}
#editor .power .grid span{color:#8fb3d9}
#editor .power p{margin:8px 0 0;color:#cfe9ff}
#editor .power p.dim{color:#5f7d9c;font-size:11px}
#editor .problems{margin-top:12px;padding:8px;border:1px solid #ff8a8a;color:#ff8a8a}
#editor .empty{color:#8fb3d9;margin-top:20px}
#editor .empty b{color:#ffd9a8;letter-spacing:.12em}
#editor .acts{padding:18px}
#editor .acts .act{display:grid;grid-template-columns:90px 260px 1fr auto;gap:10px;align-items:center;margin:6px 0}
#editor .acts input{font:inherit;background:rgba(0,0,0,.35);border:1px solid rgba(207,233,255,.25);color:#cfe9ff;padding:4px 6px;width:100%}
#editor .acts .hint{color:#5f7d9c;margin:14px 0}
`;

export function mountEditor(o: EditorOpts): EditorHandle {
  const content = new Content();
  let selected: string | null = content.level(o.currentLevelId) ? o.currentLevelId : null;
  let shipOverride: string | null = null;
  let tab: "board" | "acts" = "board";
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);

  const root = document.createElement("div");
  root.id = "editor";
  root.innerHTML = `<div class="top"><b>GAME DESIGNER</b><button class="tab on" data-tab="board">BOARD</button><button class="tab" data-tab="acts">ACTS</button><span class="spacer"></span><span class="status"></span><button class="undo">UNDO</button><button class="save primary">SAVE</button><button class="close">FLY (ESC)</button></div><div class="main"></div>`;
  document.body.append(root);
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
      render();
    },
    hide() {
      handle.active = false;
      root.hidden = true;
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

  function render(): void {
    if (!handle.active) return;
    for (const b of root.querySelectorAll<HTMLElement>(".tab")) b.classList.toggle("on", b.dataset.tab === tab);
    if (tab === "board") {
      if (board.root.parentElement !== main) main.replaceChildren(board.root);
      board.render();
    } else renderActs();
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
