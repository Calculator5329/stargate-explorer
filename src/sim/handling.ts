import { T, clamp, lerp } from '@/core/tunables';

/** Multipliers for ordinary flight only. Null on Flight means the selected campaign handling. */
export interface Handling {
  turn: number;
  slow: number;
  fast: number;
  grip: number;
  brake: number;
  roll: number;
  sweet: number;
}

export const HANDLING_PRESETS = [
  { id: 'grip', name: 'Tight grip', values: T.sandboxGrip, note: 'Quicker steering; your flight path catches the nose sooner. Start here for easier aiming.' },
  { id: 'brake', name: 'Brake & turn', values: T.sandboxBrake, note: 'Slow down for a much tighter turn, then boost out. Hold your brake while steering.' },
  { id: 'sweet', name: 'Sweet spot', values: T.sandboxSweet, note: 'Best turning near half cruise throttle. Slower and faster speeds both turn less.' },
  { id: 'drift', name: 'Loose drift', values: T.sandboxDrift, note: 'Turn the nose quickly while momentum carries you sideways. More expressive, harder to aim.' },
] as const;

export const HANDLING_FIELDS = [
  { key: 'turn', label: 'Steering power', hint: 'Pitch and yaw speed', min: .6, max: 2.5, step: .05 },
  { key: 'slow', label: 'Turn bonus', hint: 'At low speed, or at the sweet spot', min: 1, max: 3, step: .05 },
  { key: 'fast', label: 'High-speed turning', hint: 'Steering retained at full boost', min: .3, max: 1.5, step: .05 },
  { key: 'grip', label: 'Velocity grip', hint: 'Higher = less sliding past your aim', min: .2, max: 3, step: .05 },
  { key: 'brake', label: 'Brake strength', hint: 'How quickly the brake slows you', min: .5, max: 3, step: .05 },
  { key: 'roll', label: 'Roll speed', hint: 'Manual rolling; tricks keep their timing', min: .5, max: 2, step: .05 },
] as const satisfies readonly { key: keyof Handling; label: string; hint: string; min: number; max: number; step: number }[];

export function handlingTurn(h: Handling, speed: number, hullSpeed: number): number {
  const f = T.flight, v = speed / hullSpeed;
  const fraction = clamp((v - f.minSpeed) / (f.boostSpeed - f.minSpeed), 0, 1);
  const middle = (f.minSpeed + f.maxSpeed) / 2;
  const sweet = v < middle
    ? clamp((v - f.minSpeed) / (middle - f.minSpeed), 0, 1)
    : 1 - clamp((v - middle) / (f.boostSpeed - middle), 0, 1);
  return h.turn * lerp(lerp(h.slow, h.fast, fraction), lerp(h.fast, h.slow, sweet), h.sweet);
}

const KEY = 'stargate-explorer.sandbox-handling.v1';
export interface HandlingDraft { current: boolean; values: Handling }
export function loadHandling(): HandlingDraft {
  const fallback = { current: false, values: { ...T.sandboxGrip } };
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object' || !('values' in raw) || !raw.values || typeof raw.values !== 'object') return fallback;
    for (const field of HANDLING_FIELDS) {
      const v: unknown = Reflect.get(raw.values, field.key);
      if (typeof v === 'number' && Number.isFinite(v)) fallback.values[field.key] = clamp(v, field.min, field.max);
    }
    fallback.values.sweet = Reflect.get(raw.values, 'sweet') === 1 ? 1 : 0;
    fallback.current = 'current' in raw && raw.current === true;
  } catch { /* Storage unavailable or corrupt: practice remains usable. */ }
  return fallback;
}
export function saveHandling(draft: HandlingDraft): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(draft)); return true; } catch { return false; }
}
