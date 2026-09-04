import type { Save, Settings } from "@/core/save";
import { writeSave } from "@/core/save";
import type { SchemeName } from "@/core/scheme";
import { parseDifficulty } from "@/core/difficulty";

export interface MenuHooks {
  /** push the edited settings into the live systems (scheme, input, difficulty, audio) */
  apply(s: Settings): void;
  /** restart the current mission */
  restart(): void;
  /** back to mission select (optional until the hub exists) */
  hub?(): void;
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

  constructor(root: HTMLElement, canvas: HTMLElement, save: Save, hooks: MenuHooks, enabled = true, private readonly missionTitle = "") {
    this.el = root;
    this.title = q(root, ".title");
    this.sub = q(root, ".sub");
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
    scheme.value = s.scheme;
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
      writeSave(save);
      hooks.apply(s);
    };
    for (const c of [scheme, assist, sens, diff, mute]) c.addEventListener("input", commit);
    q(root, ".fly").addEventListener("click", () => canvas.requestPointerLock());
    q(root, ".restart").addEventListener("click", () => hooks.restart());
    const hub = q(root, ".hub");
    if (hooks.hub) hub.addEventListener("click", () => hooks.hub?.());
    else hub.style.display = "none";
    document.addEventListener("pointerlockchange", () => this.set(document.pointerLockElement !== canvas));
    // the overlay swallows keys meant for the game; only Esc/Enter matter here
    root.addEventListener("keydown", (e) => {
      if (e.code === "Enter" && !(e.target instanceof HTMLSelectElement)) canvas.requestPointerLock();
    });
    hooks.apply(s);
    this.set(true, true);
  }

  /** Show or hide; `first` is the start screen (no "paused" wording). */
  private set(open: boolean, first = false): void {
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
