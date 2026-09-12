import type { Flight } from "@/sim/flight";
import type { Input } from "@/core/input";
import { T } from "@/core/tunables";
import type { Camera, Vector3 } from "three";
import { Vector3 as V3 } from "three";
import type { Combat } from "@/combat/combat";
import type { Mission } from "@/mission/mission";
import type { Tracked } from "@/combat/targets";
import { keyName, type Binds } from "@/core/binds";
import type { SchemeName } from "@/core/scheme";

const PAD_HINT = "gamepad · left stick steers · right stick roll / throttle · RT fire · LT missile · A boost · B brake · bumpers barrel roll";

function hint(name: SchemeName, b: Binds): string {
  const k = keyName;
  const roll = `${k(b.rollLeft)}/${k(b.rollRight)} roll (double-tap: barrel roll) · ${k(b.strafeLeft)}/${k(b.strafeRight)} strafe`;
  return name === "arcade"
    ? `click to fly · mouse steers · ${k(b.pullUp)} pull up / ${k(b.dive)} dive · ${roll} · ${k(b.boost)} boost · ${k(b.brake)} brake · LMB fire · V last kill · Esc menu · \` tuning`
    : `click to fly · mouse steers · ${k(b.pullUp)}/${k(b.dive)} throttle · ${roll} · ${k(b.brake)} brake · ${k(b.boost)} boost · LMB fire · V last kill · Esc menu · \` tuning`;
}

/** DOM HUD: speed readout, throttle/speed bar, hint per control scheme, arena warning, hit flash. */
export class Hud {
  private readonly speedEl: HTMLElement;
  private readonly barEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private readonly moveEl: HTMLElement;
  private lastMove = "";
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
  private readonly cursorEl: HTMLElement;
  private readonly arrowEl: HTMLElement;
  private readonly cardEl: HTMLElement;
  private readonly cardH: HTMLElement;
  private readonly cardP: HTMLElement;
  private lastObj = "";
  private lastHp = -1;
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
  private lastHint = "";
  private lastSchemeO = "";
  private lastFlashO = "";
  private lastBoostW = "";
  private lastCursorTf = "";

  constructor(private readonly root: HTMLElement) {
    this.speedEl = must(root.querySelector<HTMLElement>(".speed .v"));
    this.barEl = must(root.querySelector<HTMLElement>(".throttle > i"));
    this.hintEl = must(root.querySelector<HTMLElement>(".hint"));
    this.warnEl = must(root.querySelector<HTMLElement>(".warn"));
    this.flashEl = must(root.querySelector<HTMLElement>(".flash"));
    this.schemeEl = must(root.querySelector<HTMLElement>(".scheme"));
    this.boostEl = must(root.querySelector<HTMLElement>(".boost > i"));
    this.moveEl = must(root.querySelector<HTMLElement>(".boost .mv"));
    this.hpEl = must(root.querySelector<HTMLElement>(".hp > i"));
    this.titleEl = must(root.querySelector<HTMLElement>(".mission .title"));
    this.objEl = must(root.querySelector<HTMLElement>(".mission .obj"));
    this.tgtEl = must(root.querySelector<HTMLElement>(".tgt"));
    this.tgtLabel = must(root.querySelector<HTMLElement>(".tgt small"));
    this.leadEl = must(root.querySelector<HTMLElement>(".lead"));
    this.cursorEl = must(root.querySelector<HTMLElement>(".cursor"));
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

  /** New mission in the same page: forget the cached objective and card so the new ones write. */
  reset(): void {
    this.lastObj = "";
    this.cardShown = "";
    this.cardEl.classList.remove("on");
  }

  /** Everything but the perf overlay goes while the gate is dialing, in the wormhole or fading in. */
  setTravel(on: boolean): void {
    this.root.classList.toggle("travel", on);
  }

  hideHint(): void {
    this.hintEl.classList.add("hidden");
  }

  update(flight: Flight, input: Input, outside: boolean): void {
    const scheme = input.scheme;
    const h = input.padActive ? PAD_HINT : hint(scheme.name, input.binds);
    if (h !== this.lastHint) (this.lastHint = h), (this.hintEl.textContent = h);
    if (scheme.name !== this.lastScheme || scheme.assist !== this.lastAssist) {
      this.lastScheme = scheme.name;
      this.lastAssist = scheme.assist;
      this.schemeEl.textContent = `${scheme.name.toUpperCase()} CONTROLS${scheme.assist ? "" : " · ASSIST OFF"}`;
    }
    // style writes are change-gated: a same-value write still invalidates layout on some browsers
    const so = Math.max(0, Math.min(1, 2.5 - scheme.sinceSwitch)).toFixed(2);
    if (so !== this.lastSchemeO) (this.lastSchemeO = so), (this.schemeEl.style.opacity = so);
    this.warnEl.classList.toggle("hidden", !outside);
    const fo = Math.max(0, 0.55 - flight.sinceHit * 1.6).toFixed(3);
    if (fo !== this.lastFlashO) (this.lastFlashO = fo), (this.flashEl.style.opacity = fo);
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
    const bw = `${(flight.boostEnergy * 100).toFixed(1)}%`;
    if (bw !== this.lastBoostW) (this.lastBoostW = bw), (this.boostEl.style.width = bw);
    this.boostEl.classList.toggle("low", flight.boostEnergy < T.flight.boostMinEngage && !flight.boosting);
    // the running move's name sits on the bar it was paid from
    const mv = flight.moveFeedback || (flight.move ? `${flight.move.name.toUpperCase()} · ${Math.round(flight.moveT / flight.move.duration * 100)}%` : "");
    if (mv !== this.lastMove) {
      this.lastMove = mv;
      if (mv) this.moveEl.textContent = mv;
      this.moveEl.classList.toggle("on", mv !== "");
    }
    this.hintEl.classList.toggle("hidden", input.locked);
    // cursor steer: the aim cursor sits where the nose is heading (invert Y flips the mouse, not the picture)
    const cursorOn = input.steer === "cursor" && input.locked && !input.padActive;
    this.cursorEl.classList.toggle("on", cursorOn);
    if (cursorOn) {
      const c = input.cursor, k = T.flight.cursorRadius > 0 ? Math.min(1, window.innerHeight * 0.42 / T.flight.cursorRadius) : 1;
      const tf = `translate(${(c.x * k).toFixed(1)}px, ${((input.invertY ? -c.y : c.y) * k).toFixed(1)}px)`;
      if (tf !== this.lastCursorTf) (this.lastCursorTf = tf), (this.cursorEl.style.transform = tf);
    }
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
    if (P.hp !== this.lastHp) {
      this.lastHp = P.hp;
      this.hpEl.style.width = `${((P.hp / combat.maxHp) * 100).toFixed(1)}%`;
      this.hpEl.classList.toggle("hurt", P.hp < combat.maxHp * 0.35);
    }
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
    // box where the thing is drawn this frame, not where the sim last put it: at 240 Hz the hull is interpolated
    // between ticks and a box on the tick position detaches from it three frames in four
    const at = best.visPos ?? best.pos;
    _s.copy(at).project(cam);
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
      _l.copy(at).addScaledVector(best.vel, t).addScaledVector(playerVel, -t).project(cam);
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
