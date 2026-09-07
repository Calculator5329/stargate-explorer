import type { LevelDef } from "@/mission/levels";
import { SYSTEMS } from "@/world/systems";
import type { Content } from "@/editor/content";
import { TYPE_HELP, TYPE_LABEL } from "@/editor/schema";
import { WAVE_PACKS } from "@/editor/packs";
import { esc } from "@/editor/board";

/**
 * The new-level wizard: three questions instead of a bare template. What kind of level, where it happens,
 * and which level it follows; wave levels also pick an opening pack. Every choice shows its one-line
 * explanation while it is being made. Escape or the backdrop closes it without creating anything.
 */
export interface WizardPick {
  type: LevelDef["type"];
  system: string;
  after: string | null;
  title: string;
  pack: string | null;
}

export interface WizardOpts {
  content: Content;
  /** the level the new one follows by default (the selection), or null */
  after: string | null;
  done: (pick: WizardPick) => void;
}

const TYPES = Object.keys(TYPE_HELP) as LevelDef["type"][];

export function openWizard(o: WizardOpts): void {
  const pick: WizardPick = { type: "clear", system: o.after ? o.content.level(o.after)?.system ?? "abydos" : "abydos", after: o.after, title: "", pack: "glider-swarm" };
  const back = document.createElement("div");
  back.className = "wizard-back";
  const box = document.createElement("div");
  box.className = "wizard";
  back.append(box);
  document.getElementById("editor")!.append(back);
  const close = (): void => back.remove();
  back.addEventListener("pointerdown", (e) => e.target === back && close());
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") (close(), window.removeEventListener("keydown", onKey));
  };
  window.addEventListener("keydown", onKey);

  const render = (): void => {
    const sys = SYSTEMS.find((s) => s.id === pick.system);
    const wave = pick.type === "clear" || pick.type === "protect";
    box.innerHTML = `
      <div class="wz-head"><b>NEW LEVEL</b><span>three choices, then it is on the board and open in the inspector</span></div>
      <div class="wz-step"><b>1 · WHAT KIND OF LEVEL</b>
        <div class="wz-cards">${TYPES.map((t) => `<button class="wz-card${t === pick.type ? " on" : ""}" data-type="${t}"><b>${esc(TYPE_LABEL[t].split(" (")[0]!)}</b><span>${esc(TYPE_HELP[t])}</span></button>`).join("")}</div>
      </div>
      ${wave ? `<div class="wz-step"><b>2 · OPENING FIGHT</b><span class="wz-sub">a prebuilt wave pack to start from; every wave stays editable</span>
        <div class="wz-cards small">${WAVE_PACKS.map((p) => `<button class="wz-card${p.id === pick.pack ? " on" : ""}" data-pack="${p.id}"><b>${esc(p.name)}</b><span>${esc(p.blurb)}</span></button>`).join("")}<button class="wz-card${pick.pack === null ? " on" : ""}" data-pack=""><b>Blank</b><span>One wave of three gliders; build it yourself.</span></button></div>
      </div>` : ""}
      <div class="wz-step"><b>${wave ? 3 : 2} · WHERE</b>
        <div class="wz-row"><select class="wz-system">${SYSTEMS.map((s) => `<option value="${s.id}"${s.id === pick.system ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select><span class="wz-sub">${esc(sys?.blurb ?? "")}</span></div>
      </div>
      <div class="wz-step"><b>${wave ? 4 : 3} · AFTER WHICH LEVEL</b>
        <div class="wz-row"><select class="wz-after"><option value=""${pick.after ? "" : " selected"}>(open from the start)</option>${o.content.levels.map((l) => `<option value="${esc(l.id)}"${l.id === pick.after ? " selected" : ""}>${esc(l.title)}</option>`).join("")}</select><span class="wz-sub">the player has to win that one first; the new card lands just right of it, in the same act</span></div>
      </div>
      <div class="wz-step"><b>TITLE</b><div class="wz-row"><input class="wz-title" placeholder="e.g. THE NETU PICKET" value="${esc(pick.title)}"></div></div>
      <div class="wz-foot"><button class="wz-cancel">CANCEL</button><button class="wz-go primary"${pick.title.trim() ? "" : " disabled"}>CREATE</button></div>`;
    for (const b of box.querySelectorAll<HTMLButtonElement>("[data-type]")) b.onclick = () => ((pick.type = b.dataset.type as LevelDef["type"]), render());
    for (const b of box.querySelectorAll<HTMLButtonElement>("[data-pack]")) b.onclick = () => ((pick.pack = b.dataset.pack || null), render());
    box.querySelector<HTMLSelectElement>(".wz-system")!.onchange = (e) => ((pick.system = (e.target as HTMLSelectElement).value), render());
    box.querySelector<HTMLSelectElement>(".wz-after")!.onchange = (e) => ((pick.after = (e.target as HTMLSelectElement).value || null), render());
    const title = box.querySelector<HTMLInputElement>(".wz-title")!;
    title.oninput = () => {
      pick.title = title.value.toUpperCase();
      box.querySelector<HTMLButtonElement>(".wz-go")!.disabled = !pick.title.trim();
    };
    title.onkeydown = (e) => e.key === "Enter" && pick.title.trim() && go();
    box.querySelector<HTMLButtonElement>(".wz-cancel")!.onclick = close;
    box.querySelector<HTMLButtonElement>(".wz-go")!.onclick = go;
    title.focus();
  };
  const go = (): void => {
    window.removeEventListener("keydown", onKey);
    close();
    o.done({ ...pick, title: pick.title.trim().toUpperCase() });
  };
  render();
}
