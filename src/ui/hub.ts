import type { Save } from "@/core/save";
import { writeSave } from "@/core/save";
import { LEVELS, type LevelDef } from "@/mission/levels";
import { SHIPS, unlockedBy } from "@/ships/registry";
import { fmt } from "@/mission/mission";
import { SYSTEMS } from "@/world/systems";
import { addressMarkup, scriptSvg, systemAddress } from "@/ui/glyphs";

/** Address console. Selection is separate from permission to launch a sortie. */
export class Hub {
  private mission: string;
  private system: string;
  private ship: string;
  private shownSystem = "";
  private readonly el: HTMLElement;

  constructor(root: HTMLElement, private readonly save: Save, current: LevelDef, onBack: () => void, private readonly onLaunch: (level: LevelDef, ship: string) => void) {
    this.el = root;
    this.mission = current.id;
    this.system = current.system;
    this.ship = save.progress.ship;
    root.querySelector("h1")!.innerHTML = `${scriptSvg("Gate control")}<span>GATE CONTROL</span>`;
    root.querySelector(".back")!.addEventListener("click", () => (this.hide(), onBack()));
    root.querySelector(".go")!.addEventListener("click", () => this.launch());
    this.build();
  }

  /** The page now runs a different sortie (gate travel swapped it in). */
  setCurrent(level: LevelDef): void {
    this.mission = level.id;
    this.system = level.system;
    this.ship = this.save.progress.ship;
  }

  show(): void {
    this.shownSystem = "";
    this.build();
    this.el.classList.add("on");
  }

  hide(): void { this.el.classList.remove("on"); }

  get active(): boolean { return this.el.classList.contains("on"); }

  private cleared(id: string): boolean {
    return (this.save.progress.missions[id]?.completions ?? 0) > 0;
  }

  private unlocked(l: LevelDef): boolean { return !l.requires || this.cleared(l.requires); }

  private build(): void {
    const focus = (document.activeElement as HTMLElement | null)?.dataset.focus;
    const P = this.save.progress;
    const systems = this.el.querySelector<HTMLElement>(".systems")!;
    systems.textContent = "";
    for (const [i, sys] of SYSTEMS.entries()) {
      const levels = LEVELS.filter((l) => l.system === sys.id);
      if (!levels.length) continue;
      const anyOpen = levels.some((l) => this.unlocked(l));
      const b = document.createElement("button");
      b.className = `system${anyOpen ? "" : " locked"}${sys.id === this.system ? " sel" : ""}`;
      b.dataset.focus = sys.id;
      b.setAttribute("aria-pressed", String(sys.id === this.system));
      b.innerHTML = `<span class="system-label"><b>${String(i + 1).padStart(2, "0")} / ${sys.name}</b><small>${anyOpen ? "AVAILABLE" : "LOCKED"}</small></span><span class="address">${addressMarkup(systemAddress(sys.id))}</span>`;
      b.addEventListener("click", () => {
        if (this.system !== sys.id) {
          this.system = sys.id;
          this.mission = (levels.find((l) => this.unlocked(l)) ?? levels[0]!).id;
        }
        this.build();
      });
      systems.appendChild(b);
    }
    const sys = SYSTEMS.find((s) => s.id === this.system)!;
    this.el.querySelector<HTMLElement>(".destination")!.innerHTML = `${scriptSvg(sys.name)}<span>${sys.name}</span>`;
    this.el.querySelector<HTMLElement>(".system-blurb")!.textContent = sys.blurb;
    const address = this.el.querySelector<HTMLElement>(".selected-address")!;
    address.className = `selected-address address ${this.shownSystem === this.system ? "encoded" : "sequence"}`;
    address.innerHTML = addressMarkup(systemAddress(this.system));
    this.shownSystem = this.system;

    const ms = this.el.querySelector<HTMLElement>(".missions")!;
    ms.textContent = "";
    for (const l of LEVELS.filter((level) => level.system === this.system)) {
      const open = this.unlocked(l), rec = P.missions[l.id];
      const b = document.createElement("button");
      b.className = `m${open ? "" : " locked"}${l.id === this.mission ? " sel" : ""}`;
      b.disabled = !open;
      b.dataset.focus = l.id;
      b.setAttribute("aria-pressed", String(l.id === this.mission));
      const status = !open ? `LOCKED · clear ${LEVELS.find((x) => x.id === l.requires)?.title ?? "?"}` : rec ? `CLEARED ×${rec.completions} · best ${fmt(rec.bestTime)}` : "NEW";
      b.innerHTML = `<b>${scriptSvg(l.title)}<span>${l.title}</span></b><small>${l.blurb}</small><i>${status}${l.unlocks && open && !rec ? ` · unlocks ${SHIPS[l.unlocks]?.def.name ?? l.unlocks}` : ""}</i>`;
      b.addEventListener("click", () => { this.mission = l.id; this.build(); });
      ms.appendChild(b);
    }
    const ss = this.el.querySelector<HTMLElement>(".ships")!;
    ss.textContent = "";
    for (const s of Object.values(SHIPS)) {
      const open = P.unlocked.includes(s.id);
      const b = document.createElement("button");
      b.className = `s${open ? "" : " locked"}${s.id === this.ship ? " sel" : ""}`;
      b.disabled = !open;
      b.dataset.focus = s.id;
      b.setAttribute("aria-pressed", String(s.id === this.ship));
      const st = s.stats;
      b.innerHTML = `<b>${s.def.name}</b><small>${open ? s.blurb : `LOCKED · ${unlockedBy(s.id, LEVELS) ?? "no mission hands this one over yet"}`}</small><div class="stats"><span>speed ${pct(st.speed)}</span><span>agility ${pct(st.agility)}</span><span>hull ${pct(st.hull)}</span><span>guns ${pct(st.guns)}</span><span>missiles ${st.missiles}</span></div>`;
      b.addEventListener("click", () => { this.ship = s.id; this.build(); });
      ss.appendChild(b);
    }
    const level = LEVELS.find((l) => l.id === this.mission)!;
    const go = this.el.querySelector<HTMLButtonElement>(".go")!;
    go.disabled = !this.unlocked(level) || !P.unlocked.includes(this.ship);
    this.el.querySelector<HTMLElement>(".launch-summary")!.textContent = go.disabled ? "ADDRESS LOCKED · COMPLETE THE PRECEDING SORTIE" : `${level.title} / ${SHIPS[this.ship]?.def.name ?? this.ship}`;
    if (focus) this.el.querySelector<HTMLElement>(`[data-focus="${focus}"]`)?.focus({ preventScroll: true });
  }

  private launch(): void {
    const level = LEVELS.find((l) => l.id === this.mission);
    if (!level || !this.unlocked(level) || !this.save.progress.unlocked.includes(this.ship)) return;
    this.save.progress.ship = this.ship;
    writeSave(this.save);
    this.hide();
    this.onLaunch(level, this.ship);
  }
}

function pct(x: number): string { return `${Math.round(x * 100)}%`; }
