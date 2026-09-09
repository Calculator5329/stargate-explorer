import { DEFAULT_MOVE_BINDS, mergeMoveBinds, type MoveBinds } from "@/core/move-binds";
import type { SchemeName, SteerMode } from "@/core/scheme";
import type { DifficultyName } from "@/core/difficulty";
import type { Quality } from "@/render/renderer";
import { DEFAULT_BINDS, mergeBinds, type Binds } from "@/core/binds";
import { parseDifficulty } from "@/core/difficulty";
import { parseQuality } from "@/render/renderer";

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

/** Ethan's selected flight profile, 2026-09-08. Applied after old saved values. Invert Y is not part of it: it
 * stays a switch, off by default (Ethan, 2026-09-08: "invert stays a switcher defaulting to no"). */
export const FLIGHT_PROFILE = { scheme: "classic", steer: "cursor", rawMouse: true, assist: true, assistStrength: 0.9 } as const;

export const DEFAULT_SAVE: Save = {
  settings: { ...FLIGHT_PROFILE, invertY: false, speedTurn: false, sens: 1, difficulty: "normal", mute: false, quality: "med", dynamicRes: true, eventLighting: false, binds: { ...DEFAULT_BINDS }, moveBinds: { ...DEFAULT_MOVE_BINDS }, onboarded: false },
  progress: { ship: "f11", unlocked: ["f11"], missions: {} },
};

/**
 * A stored value is only trusted once it has been checked against the type it claims to be. The blob is
 * whatever is in localStorage: a save written by an older build, hand-edited, or half-written when a tab
 * died. Spreading it verbatim let two of those shapes kill the page outright, with no way back because the
 * surface that would fix the setting is the surface that failed to build. `quality: "ultra"` threw on
 * `QUALITY[q].dpr` before the canvas existed (black page, no menu); `sens: "loud"` threw on `sens.toFixed`
 * inside the Menu constructor, so the whole session had no pause screen, no settings and no MISSIONS button.
 * Every field below is either an enum with a parser or a primitive with a range, so check them all: the next
 * bad value should cost a reset to default, never the game.
 */
function sanitise(raw: Partial<Settings> | undefined): Partial<Settings> {
  if (!raw || typeof raw !== "object") return {};
  const d = DEFAULT_SAVE.settings;
  const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);
  const num = (v: unknown, lo: number, hi: number, fallback: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  return {
    ...raw,
    quality: parseQuality(typeof raw.quality === "string" ? raw.quality : null),
    difficulty: parseDifficulty(typeof raw.difficulty === "string" ? raw.difficulty : null),
    steer: raw.steer === "relative" ? "relative" : "cursor",
    scheme: raw.scheme === "arcade" ? "arcade" : "classic",
    sens: num(raw.sens, 0.1, 5, d.sens),
    assistStrength: num(raw.assistStrength, 0.2, 1, d.assistStrength),
    assist: bool(raw.assist, d.assist),
    speedTurn: bool(raw.speedTurn, d.speedTurn),
    rawMouse: bool(raw.rawMouse, d.rawMouse),
    mute: bool(raw.mute, d.mute),
    invertY: bool(raw.invertY, d.invertY),
    dynamicRes: bool(raw.dynamicRes, d.dynamicRes),
    eventLighting: bool(raw.eventLighting, d.eventLighting),
    onboarded: bool(raw.onboarded, d.onboarded),
  };
}

/** Progress drives array and record reads all over the mission code; a wrong type there is the same class of crash. */
function sanitiseProgress(raw: Partial<Progress> | undefined): Partial<Progress> {
  if (!raw || typeof raw !== "object") return {};
  const missions: Record<string, MissionRecord> = {};
  const src = raw.missions;
  if (src && typeof src === "object" && !Array.isArray(src)) {
    for (const [id, rec] of Object.entries(src as Record<string, unknown>)) {
      if (!rec || typeof rec !== "object") continue;
      const r = rec as Partial<MissionRecord>;
      const completions = typeof r.completions === "number" && Number.isFinite(r.completions) ? Math.max(0, Math.floor(r.completions)) : 0;
      const bestTime = typeof r.bestTime === "number" && Number.isFinite(r.bestTime) ? r.bestTime : 0;
      missions[id] = { completions, bestTime };
    }
  }
  const unlocked = Array.isArray(raw.unlocked) ? raw.unlocked.filter((x): x is string => typeof x === "string") : [...DEFAULT_SAVE.progress.unlocked];
  return {
    ship: typeof raw.ship === "string" ? raw.ship : DEFAULT_SAVE.progress.ship,
    unlocked: unlocked.length ? unlocked : [...DEFAULT_SAVE.progress.unlocked],
    missions,
  };
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const j = JSON.parse(raw) as Partial<Save>;
    return {
      settings: { ...DEFAULT_SAVE.settings, ...sanitise(j.settings), ...FLIGHT_PROFILE, binds: mergeBinds(j.settings?.binds), moveBinds: mergeMoveBinds(j.settings?.moveBinds, mergeBinds(j.settings?.binds)) },
      progress: { ...structuredClone(DEFAULT_SAVE.progress), ...sanitiseProgress(j.progress) },
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
