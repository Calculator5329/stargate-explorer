import type { Save, Settings } from "@/core/save";
import { writeSave } from "@/core/save";
import type { SchemeName } from "@/core/scheme";
import { parseDifficulty } from "@/core/difficulty";
import { parseQuality } from "@/render/renderer";
import { ACTIONS, BIND_LABELS, DEFAULT_BINDS, keyName, type Action } from "@/core/binds";

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
}

/**
 * Start / pause overlay. Opens whenever the pointer is not locked (so Esc pauses
 * by itself, the browser does that part), closes when the player clicks FLY and
 * the canvas takes the pointer again. Edits `save.settings` in place, persists
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

  constructor(root: HTMLElement, canvas: HTMLElement, save: Save, hooks: MenuHooks, enabled = true, private readonly missionTitle = "") {
    this.el = root;
    this.title = q(root, ".title");
    this.sub = q(root, ".sub");
    this.replayBtn = q(root, ".replay");
    this.hasReplay = hooks.hasReplay ?? (() => false);
    if (!enabled) {
      root.style.display = "none";
      return;
    }
    const s = save.settings;
    const scheme = q<HTMLSelectElement>(root, "[name=scheme]");
    const assist = q<HTMLInputElement>(root, "[name=assist]");
    const sens = q<HTMLInputElement>(root, "[name=sens]");
    const sensV = q(root, ".sens-v");
    const diff = q<HTMLSelectElement>(root, "[name=difficulty]");
    const mute = q<HTMLInputElement>(root, "[name=mute]");
    const invert = q<HTMLInputElement>(root, "[name=invert]");
    const qual = q<HTMLSelectElement>(root, "[name=quality]");
    scheme.value = s.scheme;
    invert.checked = s.invertY;
    qual.value = s.quality;
    assist.checked = s.assist;
    sens.value = String(s.sens);
    sensV.textContent = s.sens.toFixed(2);
    diff.value = s.difficulty;
    mute.checked = s.mute;
    const commit = () => {
      s.scheme = scheme.value as SchemeName;
      s.assist = assist.checked;
      s.sens = Number(sens.value) || 1;
      sensV.textContent = s.sens.toFixed(2);
      s.difficulty = parseDifficulty(diff.value);
      s.mute = mute.checked;
      s.invertY = invert.checked;
      writeSave(save);
      hooks.apply(s);
    };
    for (const c of [scheme, assist, sens, diff, mute, invert]) c.addEventListener("input", commit);
    // the renderer is built once per page, so a tier change is a reload
    qual.addEventListener("input", () => {
      s.quality = parseQuality(qual.value);
      writeSave(save);
      const u = new URL(location.href);
      u.searchParams.delete("quality");
      location.href = u.toString();
    });
    this.buildBinds(root, save, hooks);
    q(root, ".fly").addEventListener("click", () => canvas.requestPointerLock());
    q(root, ".restart").addEventListener("click", () => hooks.restart());
    const hub = q(root, ".hub");
    if (hooks.hub) hub.addEventListener("click", () => hooks.hub?.());
    else hub.style.display = "none";
    this.replayBtn.addEventListener("click", () => hooks.replay?.());
    document.addEventListener("pointerlockchange", () => this.set(document.pointerLockElement !== canvas));
    // the overlay swallows keys meant for the game; only Esc/Enter matter here
    root.addEventListener("keydown", (e) => {
      if (e.code === "Enter" && !(e.target instanceof HTMLSelectElement)) canvas.requestPointerLock();
    });
    hooks.apply(s);
    this.set(true, true);
  }

  /** One row per action; click a key, press the new one, Esc cancels. A taken key swaps. */
  private buildBinds(root: HTMLElement, save: Save, hooks: MenuHooks): void {
    const grid = q(root, ".binds .grid");
    const s = save.settings;
    const buttons = new Map<Action, HTMLButtonElement>();
    let listening: Action | null = null;
    const refresh = () => {
      for (const [a, b] of buttons) {
        b.textContent = listening === a ? "PRESS A KEY" : keyName(s.binds[a]);
        b.classList.toggle("listening", listening === a);
      }
    };
    for (const a of ACTIONS) {
      const label = document.createElement("span");
      label.textContent = BIND_LABELS[a];
      const b = document.createElement("button");
      b.className = "bind";
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        listening = listening === a ? null : a;
        refresh();
      });
      grid.append(label, b);
      buttons.set(a, b);
    }
    q(root, ".binds .reset").addEventListener("click", () => {
      Object.assign(s.binds, DEFAULT_BINDS);
      listening = null;
      writeSave(save);
      hooks.apply(s);
      refresh();
    });
    // capture phase so Input never sees the key being bound
    document.addEventListener(
      "keydown",
      (e) => {
        if (!listening) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.code !== "Escape" && e.code !== "Backquote") {
          const taken = ACTIONS.find((o) => o !== listening && s.binds[o] === e.code);
          if (taken) s.binds[taken] = s.binds[listening];
          s.binds[listening] = e.code;
          writeSave(save);
          hooks.apply(s);
        }
        listening = null;
        refresh();
      },
      true,
    );
    refresh();
  }

  /** Close from outside (the gate is dialing). */
  close(): void {
    this.set(false);
  }

  /** Show or hide; `first` is the start screen (no "paused" wording). */
  private set(open: boolean, first = false): void {
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
