import type { SchemeName } from "@/core/scheme";
import type { DifficultyName } from "@/core/difficulty";

/**
 * Persistent player state in localStorage, one key, one JSON blob. Settings are
 * what the pause menu edits; progress is what missions write. Everything has a
 * default so a missing or corrupt blob just resets. Never store anything a
 * tunable already owns (T stays the source of feel numbers).
 */
export interface Settings {
  scheme: SchemeName;
  assist: boolean;
  /** mouse sensitivity multiplier on T.flight.stickGain */
  sens: number;
  difficulty: DifficultyName;
  mute: boolean;
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
  settings: { scheme: "arcade", assist: true, sens: 1, difficulty: "normal", mute: false },
  progress: { ship: "f11", unlocked: ["f11"], missions: {} },
};

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const j = JSON.parse(raw) as Partial<Save>;
    return {
      settings: { ...DEFAULT_SAVE.settings, ...(j.settings ?? {}) },
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
