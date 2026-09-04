import type { Save } from "@/core/save";
import { writeSave } from "@/core/save";
import { LEVELS, type LevelDef } from "@/mission/levels";
import { SHIPS } from "@/ships/registry";
import { fmt } from "@/mission/mission";
import { SYSTEMS } from "@/world/systems";

/**
 * Mission select. Cards for every level (locked until its `requires` is
 * cleared, best time shown once cleared) and a ship row (locked until
 * unlocked by a mission). LAUNCH reloads with `?mission=&ship=`; the ship
 * choice also persists so a plain reload keeps it. Missions are grouped by
 * the system they happen in; LAUNCH hands the level to `onLaunch` (the gate).
 */
export class Hub {
  private mission: string;
  private ship: string;
  private readonly el: HTMLElement;

  constructor(root: HTMLElement, private readonly save: Save, current: LevelDef, onBack: () => void, private readonly onLaunch: (level: LevelDef, ship: string) => void) {
    this.el = root;
    this.mission = current.id;
    this.ship = save.progress.ship;
    root.querySelector(".back")!.addEventListener("click", () => (this.hide(), onBack()));
    root.querySelector(".go")!.addEventListener("click", () => this.launch());
    this.build();
  }

  show(): void {
    this.build();
    this.el.classList.add("on");
  }

  hide(): void {
    this.el.classList.remove("on");
  }

  private cleared(id: string): boolean {
    return (this.save.progress.missions[id]?.completions ?? 0) > 0;
  }

  private unlocked(l: LevelDef): boolean {
    return !l.requires || this.cleared(l.requires);
  }

  private build(): void {
    const P = this.save.progress;
    const ms = this.el.querySelector<HTMLElement>(".missions")!;
    ms.textContent = "";
    for (const sys of SYSTEMS) {
      const levels = LEVELS.filter((l) => l.system === sys.id);
      if (levels.length === 0) continue;
      const h = document.createElement("h3");
      const anyOpen = levels.some((l) => this.unlocked(l));
      h.className = anyOpen ? "" : "locked";
      h.innerHTML = `<b>${sys.name}</b><small>${anyOpen ? sys.blurb : "NO GATE ADDRESS YET"}</small>`;
      ms.appendChild(h);
      for (const l of levels) {
      const open = this.unlocked(l), rec = P.missions[l.id];
      const b = document.createElement("button");
      b.className = `m${open ? "" : " locked"}${l.id === this.mission ? " sel" : ""}`;
      const status = !open ? `LOCKED · clear ${LEVELS.find((x) => x.id === l.requires)?.title ?? "?"}` : rec ? `CLEARED ×${rec.completions} · best ${fmt(rec.bestTime)}` : "NEW";
      b.innerHTML = `<b>${l.title}</b><small>${l.blurb}</small><i>${status}${l.unlocks && open && !rec ? ` · unlocks ${SHIPS[l.unlocks]?.def.name ?? l.unlocks}` : ""}</i>`;
        if (open) b.addEventListener("click", () => ((this.mission = l.id), this.build()));
        ms.appendChild(b);
      }
    }
    const ss = this.el.querySelector<HTMLElement>(".ships")!;
    ss.textContent = "";
    for (const s of Object.values(SHIPS)) {
      const open = P.unlocked.includes(s.id);
      const b = document.createElement("button");
      b.className = `s${open ? "" : " locked"}${s.id === this.ship ? " sel" : ""}`;
      const st = s.stats;
      b.innerHTML = `<b>${s.def.name}</b><small>${open ? s.blurb : "LOCKED · bring down the Ha'tak"}</small><div class="stats"><span>speed ${pct(st.speed)}</span><span>agility ${pct(st.agility)}</span><span>hull ${pct(st.hull)}</span><span>guns ${pct(st.guns)}</span><span>missiles ${st.missiles}</span></div>`;
      if (open) b.addEventListener("click", () => ((this.ship = s.id), this.build()));
      ss.appendChild(b);
    }
  }

  private launch(): void {
    this.save.progress.ship = this.ship;
    writeSave(this.save);
    this.hide();
    this.onLaunch(LEVELS.find((l) => l.id === this.mission) ?? LEVELS[0]!, this.ship);
  }
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
