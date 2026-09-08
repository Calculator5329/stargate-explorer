import { MOVES, type MoveDef } from '@/sim/moves';
import type { Binds } from '@/core/binds';

export type MoveBinds = Record<string, string>;
export const DEFAULT_MOVE_BINDS: MoveBinds = { cobra: 'Digit1', lunge: 'Digit2', 'scissor-left': 'Digit3', 'scissor-right': 'Digit4' };
const RESERVED = new Set(['Escape', 'Backquote', 'Enter', 'KeyR', 'KeyV', 'KeyG', 'KeyM', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);

/** Keep menu/system commands and content chord starters available. */
export function reservedKey(code: string, table: readonly MoveDef[] = MOVES): boolean {
  return RESERVED.has(code) || table.some(m => m.trigger.key === code) || !/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Tab|Shift(Left|Right)|[A-Za-z]+)$/.test(code);
}

/** Old saves gain available one-key move shortcuts without stealing flight keys. */
export function mergeMoveBinds(raw: unknown, binds: Binds): MoveBinds {
  const saved = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const used = new Set(Object.values(binds));
  const out: MoveBinds = {};
  for (const m of MOVES) {
    const candidates = [saved[m.id], DEFAULT_MOVE_BINDS[m.id], ...Array.from({length:9}, (_, i) => `Digit${i + 1}`)];
    const code = candidates.find((c): c is string => typeof c === 'string' && !reservedKey(c) && !used.has(c));
    if (code) { out[m.id] = code; used.add(code); }
  }
  return out;
}
