import { DEFAULT_MOVE_BINDS, mergeMoveBinds, type MoveBinds } from "@/core/move-binds";
import type { SchemeName, SteerMode } from "@/core/scheme";
import type { DifficultyName } from "@/core/difficulty";
import type { Quality } from "@/render/renderer";
import { DEFAULT_BINDS, mergeBinds, type Binds } from "@/core/binds";

/**
 * Persistent player state in localStorage, one key, one JSON blob. Settings are
 * what the pause menu edits; progress is what missions write. Everything has a
 * default so a missing or corrupt blob just resets. Never store anything a
 * tunable already owns (T stays the source of feel numbers).
 */
export interface Settings {
  scheme: SchemeName;
  assist: boolean;
  /** how hard flight assist works while on, 0.2..1 (Scheme.assistStrength) */
  assistStrength: number;
  /** speed-coupled turn rate (Scheme.speedTurn) */
  speedTurn: boolean;
  /** how the mouse steers: aim cursor or mouse-speed stick */
  steer: SteerMode;
  /** request unaccelerated mouse motion from pointer lock */
  rawMouse: boolean;
  /** mouse sensitivity multiplier (Input.sens) */
  sens: number;
  difficulty: DifficultyName;
  mute: boolean;
  /** mouse / pad Y axis flipped: push forward to dive */
  invertY: boolean;
  /** render tier; `?quality=` on the URL still wins for one page */
  quality: Quality;
  /** drop render resolution before dropping frames (Renderer.dynamic) */
  dynamicRes: boolean;
  /** Optional gate, weapon and explosion illumination, retained for visual comparison. */
  eventLighting: boolean;
  binds: Binds;
  moveBinds: MoveBinds;
  /** the start screen has been seen and dismissed once; later loads go straight to "click to fly" */
  onboarded: boolean;
}

export interface MissionRecord {
  /** best clock (s) on a completed run */
  bestTime: number;
  completions: number;
}

export interface Progress {
  ship: string;
  unlocked: string[];
  missions: Record<string, MissionRecord>;
}

export interface Save {
  settings: Settings;
  progress: Progress;
}

const KEY = "stargate-explorer.save.v1";

export const DEFAULT_SAVE: Save = {
  settings: { scheme: "arcade", assist: true, assistStrength: 1, speedTurn: false, steer: "cursor", rawMouse: true, sens: 1, difficulty: "normal", mute: false, invertY: false, quality: "med", dynamicRes: true, eventLighting: false, binds: { ...DEFAULT_BINDS }, moveBinds: { ...DEFAULT_MOVE_BINDS }, onboarded: false },
  progress: { ship: "f11", unlocked: ["f11"], missions: {} },
};

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const j = JSON.parse(raw) as Partial<Save>;
    return {
      settings: { ...DEFAULT_SAVE.settings, ...(j.settings ?? {}), binds: mergeBinds(j.settings?.binds), moveBinds: mergeMoveBinds(j.settings?.moveBinds, mergeBinds(j.settings?.binds)) },
      progress: { ...structuredClone(DEFAULT_SAVE.progress), ...(j.progress ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function writeSave(s: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode or quota: the run still works, it just does not persist */
  }
}
