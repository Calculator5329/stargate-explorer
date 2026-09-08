import { MOVES } from "@/sim/moves";
import { mergeMoveBinds, reservedKey } from "@/core/move-binds";
import type { Save, Settings } from "@/core/save";
import { writeSave } from "@/core/save";
import { parseSteer, type SchemeName } from "@/core/scheme";
import { lockPointer } from "@/core/input";
import { parseDifficulty } from "@/core/difficulty";
import { parseQuality } from "@/render/renderer";
import { ACTIONS, BIND_LABELS, DEFAULT_BINDS, keyName } from "@/core/binds";

export interface MenuHooks {
  /** push the edited settings into the live systems (scheme, input, difficulty, audio) */
  apply(s: Settings): void;
  /** restart the current mission */
  restart(): void;
  /** back to mission select (optional until the hub exists) */
  hub?(): void;
  /** play the sortie's highlight; shown only while `hasReplay()` is true */
  replay?(): void;
  hasReplay?(): boolean;
  canOpen?(): boolean;
}

/**
 * Start / pause overlay. The full start screen shows once, on the first ever
 * load; after that a page opens straight to the HUD's "click to fly" line and
 * the menu is Esc (Ethan, 2026-09-06: "once I've picked some settings I should
 * be able to just load into things normally"). Losing the pointer lock opens
 * the pause screen (the browser does the Esc part); FLY or a click on the canvas
 * takes the pointer again and closes it. Edits `save.settings` in place, persists
 * on every change and hands the result to `hooks.apply`. Disabled entirely for
 * `?lock=free` (headless) and inspect views.
 */
export class Menu {
  open = false;
  private readonly el: HTMLElement;
  private readonly title: HTMLElement;
  private readonly sub: HTMLElement;

  private readonly replayBtn: HTMLElement;
  private readonly hasReplay: () => boolean;
  private readonly canOpen: () => boolean;
  private muteControl: HTMLInputElement | null = null;

  constructor(root: HTMLElement, canvas: HTMLElement, save: Save, hooks: MenuHooks, enabled = true, private missionTitle = "") {
    this.el = root;
    this.title = q(root, ".title");
    this.sub = q(root, ".sub");
    this.replayBtn = q(root, ".replay");
    this.hasReplay = hooks.hasReplay ?? (() => false);
    this.canOpen = hooks.canOpen ?? (() => true);
    if (!enabled) {
      root.style.display = "none";
      hooks.apply(save.settings);
      return;
    }
    const s = save.settings;
    const scheme = q<HTMLSelectElement>(root, "[name=scheme]");
    const assist = q<HTMLInputElement>(root, "[name=assist]");
    const assistK = q<HTMLInputElement>(root, "[name=assistK]");
    const assistV = q(root, ".assist-v");
    const speedTurn = q<HTMLInputElement>(root, "[name=speedTurn]");
    const steer = q<HTMLSelectElement>(root, "[name=steer]");
    const raw = q<HTMLInputElement>(root, "[name=raw]");
    const sens = q<HTMLInputElement>(root, "[name=sens]");
    const sensV = q(root, ".sens-v");
    const diff = q<HTMLSelectElement>(root, "[name=difficulty]");
    const mute = q<HTMLInputElement>(root, "[name=mute]");
    this.muteControl = mute;
    const invert = q<HTMLInputElement>(root, "[name=invert]");
    const qual = q<HTMLSelectElement>(root, "[name=quality]");
    const dyn = q<HTMLInputElement>(root, "[name=dynamicRes]");
    const lightingRow = document.createElement("label");
    lightingRow.innerHTML = '<span>Event lighting (evaluation)</span><input type="checkbox" name="eventLighting" />';
    dyn.closest("label")!.after(lightingRow);
    const lighting = q<HTMLInputElement>(lightingRow, "input");
    lighting.checked = s.eventLighting;
    dyn.checked = s.dynamicRes;
    scheme.value = s.scheme;
    invert.checked = s.invertY;
    qual.value = s.quality;
    assist.checked = s.assist;
    assistK.value = String(s.assistStrength);
    assistV.textContent = s.assistStrength.toFixed(2);
    speedTurn.checked = s.speedTurn;
    steer.value = s.steer;
    raw.checked = s.rawMouse;
    sens.value = String(s.sens);
    sensV.textContent = s.sens.toFixed(2);
    diff.value = s.difficulty;
    mute.checked = s.mute;
    const commit = () => {
      s.scheme = scheme.value as SchemeName;
      s.assist = assist.checked;
      s.assistStrength = Number(assistK.value) || 1;
      assistV.textContent = s.assistStrength.toFixed(2);
      s.speedTurn = speedTurn.checked;
      s.steer = parseSteer(steer.value);
      s.rawMouse = raw.checked;
      s.sens = Number(sens.value) || 1;
      sensV.textContent = s.sens.toFixed(2);
      s.difficulty = parseDifficulty(diff.value);
      s.mute = mute.checked;
      s.invertY = invert.checked;
      s.dynamicRes = dyn.checked;
      s.eventLighting = lighting.checked;
      writeSave(save);
      hooks.apply(s);
    };
    for (const c of [scheme, assist, assistK, speedTurn, steer, raw, sens, diff, mute, invert, dyn, lighting]) c.addEventListener("input", commit);
    // the renderer is built once per page, so a tier change is a reload
    qual.addEventListener("input", () => {
      s.quality = parseQuality(qual.value);
      writeSave(save);
      const u = new URL(location.href);
      u.searchParams.delete("quality");
      location.href = u.toString();
    });
    this.buildBinds(root, save, hooks);
    const fly = () => {
      if (!s.onboarded) {
        s.onboarded = true;
        writeSave(save);
      }
      lockPointer(canvas);
    };
    q(root, ".fly").addEventListener("click", fly);
    q(root, ".restart").addEventListener("click", () => hooks.restart());
    const hub = q(root, ".hub");
    if (hooks.hub) hub.addEventListener("click", () => hooks.hub?.());
    else hub.style.display = "none";
    q(root, ".sandbox").addEventListener("click", () => {
      const url = new URL(location.pathname, location.origin);
      url.searchParams.set("mission", "proving-ground");
      location.href = url.toString();
    });
    this.replayBtn.addEventListener("click", () => hooks.replay?.());
    document.addEventListener("pointerlockchange", () => this.set(document.pointerLockElement !== canvas));
    // the overlay swallows keys meant for the game; only Esc/Enter matter here
    root.addEventListener("keydown", (e) => {
      if (e.code === "Enter" && !(e.target instanceof HTMLSelectElement)) fly();
    });
    // Esc with the pointer already free (fresh load, or after the pause screen was dismissed by a click
    // elsewhere) toggles the menu; while locked the browser turns Esc into pointerlockchange instead
    document.addEventListener("keydown", (e) => {
      if (e.code === "Escape" && document.pointerLockElement !== canvas) this.set(!this.open);
    });
    canvas.addEventListener("click", () => {
      if (!s.onboarded) (s.onboarded = true), writeSave(save);
    });
    hooks.apply(s);
    if (!s.onboarded) this.set(true, true);
  }

  /** The page now runs a different sortie (gate travel swapped it in). */
  setMission(title: string): void {
    this.missionTitle = title;
  }

  syncMute(muted: boolean): void { if (this.muteControl) this.muteControl.checked = muted; }

  /** One row per action; click a key, press the new one, Esc cancels. A taken key swaps. */
  private buildBinds(root: HTMLElement, save: Save, hooks: MenuHooks): void {
    const grid = q(root, ".binds .grid");
    const s = save.settings;
    const entries = [
      ...ACTIONS.map(a => ({ label: BIND_LABELS[a], get: () => s.binds[a], set: (code: string) => { s.binds[a] = code; } })),
      ...MOVES.map(m => ({ label: `${m.name} · one key`, get: () => s.moveBinds[m.id] ?? "", set: (code: string) => { s.moveBinds[m.id] = code; } })),
    ];
    const buttons: HTMLButtonElement[] = [];
    let listening = -1;
    const message = document.createElement("p");
    message.className = "binding-message";
    message.setAttribute("role", "status");
    grid.after(message);
    const refresh = () => {
      buttons.forEach((b, i) => {
        b.textContent = listening === i ? "PRESS A KEY" : keyName(entries[i]!.get()) || "UNBOUND";
        b.classList.toggle("listening", listening === i);
      });
      const b = s.binds;
      q(root, ".keys").textContent = `Mouse steers · ${keyName(b.rollLeft)}/${keyName(b.rollRight)} roll · ${keyName(b.boost)} boost · ${keyName(b.brake)} brake · LMB cannons · RMB missile · Esc pause. Moves also use B then a direction.`;
    };
    entries.forEach((entry, i) => {
      const label = document.createElement("span");
      label.textContent = entry.label;
      const button = document.createElement("button");
      button.className = "bind";
      button.setAttribute("aria-label", `Bind ${entry.label}`);
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        listening = listening === i ? -1 : i;
        message.textContent = listening < 0 ? "" : "Press a key. Escape cancels. An occupied key swaps the two actions.";
        refresh();
      });
      grid.append(label, button);
      buttons.push(button);
    });
    q(root, ".binds .reset").addEventListener("click", () => {
      Object.assign(s.binds, DEFAULT_BINDS);
      s.moveBinds = mergeMoveBinds(undefined, s.binds);
      listening = -1;
      message.textContent = "Default flight and move keys restored.";
      writeSave(save);
      hooks.apply(s);
      refresh();
    });
    document.addEventListener("keydown", (e) => {
      if (listening < 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === "Escape") {
        listening = -1;
        message.textContent = "Binding cancelled.";
      } else if (e.repeat || reservedKey(e.code)) {
        message.textContent = "That key is reserved for a game command or move chord. Choose another key.";
      } else {
        const entry = entries[listening]!;
        const taken = entries.find((other, i) => i !== listening && other.get() === e.code);
        if (taken) taken.set(entry.get());
        entry.set(e.code);
        listening = -1;
        message.textContent = "Saved.";
        writeSave(save);
        hooks.apply(s);
      }
      refresh();
    }, true);
    refresh();
  }

  /** Close from outside (the gate is dialing). */
  close(): void {
    this.set(false);
  }

  /** Show or hide; `first` is the start screen (no "paused" wording). */
  private set(open: boolean, first = false): void {
    if (open && !this.canOpen()) return;
    this.replayBtn.style.display = open && this.hasReplay() ? "" : "none";
    this.open = open;
    this.el.classList.toggle("on", open);
    if (!open) return;
    this.title.textContent = first ? "STARGATE EXPLORER" : "PAUSED";
    this.sub.textContent = first ? `${this.missionTitle}  ·  MISSIONS to pick another sortie` : "Paused. FLY to resume.";
  }
}

function q<E extends HTMLElement = HTMLElement>(root: HTMLElement, sel: string): E {
  const el = root.querySelector<E>(sel);
  if (!el) throw new Error(`menu element ${sel} missing from index.html`);
  return el;
}
