import type { Flight } from "@/sim/flight";
import type { Input } from "@/core/input";
import { T } from "@/core/tunables";
import type { Camera, Vector3 } from "three";
import { Vector3 as V3 } from "three";
import type { Combat } from "@/combat/combat";
import type { Mission } from "@/mission/mission";
import type { Tracked } from "@/combat/targets";

const HINTS = {
  arcade: "click to fly · mouse steers · W pull up / S dive · A/D roll (double-tap: barrel roll) · Shift boost · Space brake · LMB fire · C classic · X flight assist · ` tuning",
  classic: "click to fly · mouse steers · W/S throttle · A/D roll (double-tap: barrel roll) · Space drift · Shift boost · LMB fire · C arcade · X flight assist · ` tuning",
};

/** DOM HUD: speed readout, throttle/speed bar, hint per control scheme, arena warning, hit flash. */
export class Hud {
  private readonly speedEl: HTMLElement;
  private readonly barEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private readonly warnEl: HTMLElement;
  private readonly flashEl: HTMLElement;
  private readonly schemeEl: HTMLElement;
  private readonly boostEl: HTMLElement;
  private readonly hpEl: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly objEl: HTMLElement;
  private readonly tgtEl: HTMLElement;
  private readonly tgtLabel: HTMLElement;
  private readonly leadEl: HTMLElement;
  private readonly arrowEl: HTMLElement;
  private readonly cardEl: HTMLElement;
  private readonly cardH: HTMLElement;
  private readonly cardP: HTMLElement;
  private lastObj = "";
  private lastAmmo = -1;
  private readonly ammoEl: HTMLElement;
  private readonly againEl: HTMLElement;
  private cardShown = "";
  private lastSpeed = -1;
  private lastBar = -1;
  private replaying = false;
  private lastAgain = "";
  private lastScheme = "";
  private lastAssist = true;

  constructor(private readonly root: HTMLElement) {
    this.speedEl = must(root.querySelector<HTMLElement>(".speed .v"));
    this.barEl = must(root.querySelector<HTMLElement>(".throttle > i"));
    this.hintEl = must(root.querySelector<HTMLElement>(".hint"));
    this.warnEl = must(root.querySelector<HTMLElement>(".warn"));
    this.flashEl = must(root.querySelector<HTMLElement>(".flash"));
    this.schemeEl = must(root.querySelector<HTMLElement>(".scheme"));
    this.boostEl = must(root.querySelector<HTMLElement>(".boost > i"));
    this.hpEl = must(root.querySelector<HTMLElement>(".hp > i"));
    this.titleEl = must(root.querySelector<HTMLElement>(".mission .title"));
    this.objEl = must(root.querySelector<HTMLElement>(".mission .obj"));
    this.tgtEl = must(root.querySelector<HTMLElement>(".tgt"));
    this.tgtLabel = must(root.querySelector<HTMLElement>(".tgt small"));
    this.leadEl = must(root.querySelector<HTMLElement>(".lead"));
    this.arrowEl = must(root.querySelector<HTMLElement>(".arrow"));
    this.cardEl = must(root.querySelector<HTMLElement>(".card"));
    this.cardH = must(root.querySelector<HTMLElement>(".card h1"));
    this.cardP = must(root.querySelector<HTMLElement>(".card p"));
    this.ammoEl = must(root.querySelector<HTMLElement>(".ammo"));
    this.againEl = must(root.querySelector<HTMLElement>(".card .again"));
  }

  /** Inspect views: no flight HUD at all. */
  hideAll(): void {
    for (const el of this.root.querySelectorAll<HTMLElement>(":scope > *:not(.perf)")) el.style.display = "none";
  }

  hideHint(): void {
    this.hintEl.classList.add("hidden");
  }

  update(flight: Flight, input: Input, outside: boolean): void {
    const scheme = input.scheme;
    if (scheme.name !== this.lastScheme || scheme.assist !== this.lastAssist) {
      this.lastScheme = scheme.name;
      this.lastAssist = scheme.assist;
      this.hintEl.textContent = HINTS[scheme.name];
      this.schemeEl.textContent = `${scheme.name.toUpperCase()} CONTROLS${scheme.assist ? "" : " · ASSIST OFF"}`;
    }
    this.schemeEl.style.opacity = String(Math.max(0, Math.min(1, 2.5 - scheme.sinceSwitch)));
    this.warnEl.classList.toggle("hidden", !outside);
    this.flashEl.style.opacity = String(Math.max(0, 0.55 - flight.sinceHit * 1.6));
    const s = Math.round(flight.speed);
    if (s !== this.lastSpeed) {
      this.speedEl.textContent = String(s);
      this.lastSpeed = s;
    }
    // classic: throttle setting; arcade: speed as a fraction of boost
    const bar = scheme.arcade ? flight.speed / flight.topSpeed : flight.throttle;
    if (bar !== this.lastBar) {
      this.barEl.style.width = `${(Math.min(1, bar) * 100).toFixed(1)}%`;
      this.lastBar = bar;
    }
    this.boostEl.style.width = `${(flight.boostEnergy * 100).toFixed(1)}%`;
    this.boostEl.classList.toggle("low", flight.boostEnergy < T.flight.boostMinEngage && !flight.boosting);
    this.hintEl.classList.toggle("hidden", input.locked);
  }

  /** Combat layer: HP, mission line, target box + lead, off-screen arrow, end cards. */
  /** Replay mode: everything but the REPLAY tag hides. */
  setReplay(on: boolean): void {
    if (on === this.replaying) return;
    this.replaying = on;
    this.root.classList.toggle("replaying", on);
  }

  updateCombat(combat: Combat, mission: Mission, cam: Camera, playerVel: Vector3, hasReplay = false, gateUp = false): void {
    const P = combat.player;
    this.hpEl.style.width = `${((P.hp / combat.maxHp) * 100).toFixed(1)}%`;
    this.hpEl.classList.toggle("hurt", P.hp < combat.maxHp * 0.35);
    const obj = `${mission.line}  ·  kills ${P.kills}`;
    if (obj !== this.lastObj) {
      this.lastObj = obj;
      this.titleEl.textContent = mission.def.title;
      this.objEl.textContent = obj;
    }
    this.target(combat, mission, cam, playerVel);
    this.cards(mission);
    const again = `${gateUp ? "FLY THE GATE HOME      G · MISSIONS      " : ""}R · FLY AGAIN${hasReplay ? "      V · REPLAY THE KILL" : ""}`;
    if (again !== this.lastAgain) {
      this.lastAgain = again;
      this.againEl.textContent = again;
    }
    if (combat.ammo !== this.lastAmmo) {
      this.lastAmmo = combat.ammo;
      this.ammoEl.textContent = "▲".repeat(combat.ammo) + "△".repeat(Math.max(0, combat.maxAmmo - combat.ammo));
    }
  }

  private target(combat: Combat, mission: Mission, cam: Camera, playerVel: Vector3): void {
    // the lock candidate if there is one, else the nearest live enemy, else the mission's marker
    let best: Tracked | null = combat.target, bd = Infinity;
    if (best) bd = best.pos.distanceToSquared(combat.player.pos);
    else
      for (const e of combat.enemies.list) {
        if (!e.alive) continue;
        const d = e.pos.distanceToSquared(combat.player.pos);
        if (d < bd) (bd = d), (best = e);
      }
    const isMarker = !best && mission.marker !== null;
    if (!best && mission.marker) (best = mission.marker), (bd = best.pos.distanceToSquared(combat.player.pos));
    this.tgtEl.classList.toggle("marker", isMarker);
    if (!best) {
      this.tgtEl.classList.remove("on");
      this.leadEl.classList.remove("on");
      this.arrowEl.classList.remove("on");
      return;
    }
    const w = window.innerWidth, h = window.innerHeight;
    _s.copy(best.pos).project(cam);
    const onScreen = _s.z < 1 && Math.abs(_s.x) < 1 && Math.abs(_s.y) < 1;
    this.tgtEl.classList.toggle("on", onScreen);
    this.arrowEl.classList.toggle("on", !onScreen);
    if (onScreen) {
      const dist = Math.sqrt(bd);
      this.tgtEl.style.left = `${((_s.x + 1) * 0.5 * w).toFixed(0)}px`;
      this.tgtEl.style.top = `${((1 - _s.y) * 0.5 * h).toFixed(0)}px`;
      const locking = combat.target === best && !isMarker;
      this.tgtEl.classList.toggle("locked", locking && combat.lock >= 1);
      this.tgtEl.classList.toggle("locking", locking && combat.lock < 1);
      // the box shrinks onto the target as the lock builds
      const size = locking ? 44 + 40 * (1 - combat.lock) : 44;
      this.tgtEl.style.width = this.tgtEl.style.height = `${size.toFixed(0)}px`;
      this.tgtEl.style.margin = `${(-size / 2).toFixed(0)}px 0 0 ${(-size / 2).toFixed(0)}px`;
      this.tgtLabel.textContent = locking && combat.lock >= 1 ? `LOCK · ${Math.round(dist)} m` : `${Math.round(dist)} m`;
      // lead: where a round fired now meets the target (first-order)
      const closing = Math.max(120, T.weapons.muzzleSpeed);
      const t = dist / closing;
      _l.copy(best.pos).addScaledVector(best.vel, t).addScaledVector(playerVel, -t).project(cam);
      const leadOn = !isMarker && _l.z < 1 && Math.abs(_l.x) < 1 && Math.abs(_l.y) < 1;
      this.leadEl.classList.toggle("on", leadOn);
      if (leadOn) {
        this.leadEl.style.left = `${((_l.x + 1) * 0.5 * w).toFixed(0)}px`;
        this.leadEl.style.top = `${((1 - _l.y) * 0.5 * h).toFixed(0)}px`;
      }
    } else {
      this.leadEl.classList.remove("on");
      // behind or off the edge: arrow on a ring around the reticle, pointing the way
      let x = _s.x, y = _s.y;
      if (_s.z >= 1) (x = -x), (y = -y);
      const a = Math.atan2(x, y);
      const R = Math.min(w, h) * 0.22;
      this.arrowEl.style.transform = `translate(${(Math.sin(a) * R).toFixed(0)}px, ${(-Math.cos(a) * R).toFixed(0)}px) rotate(${a.toFixed(3)}rad)`;
    }
  }

  private cards(mission: Mission): void {
    const key = mission.done ? mission.phase : "";
    if (key === this.cardShown) return;
    this.cardShown = key;
    this.cardEl.classList.toggle("on", key !== "");
    if (key === "") return;
    this.cardH.classList.toggle("lost", key === "lost");
    if (key === "lost") {
      this.cardH.textContent = mission.loseTitle;
      this.cardP.textContent = mission.loseLine;
    } else {
      this.cardH.textContent = mission.winTitle;
      this.cardP.textContent = mission.summary();
    }
  }
}

const _s = new V3();
const _l = new V3();

function must<T>(v: T | null): T {
  if (v === null) throw new Error("HUD element missing from index.html");
  return v;
}
