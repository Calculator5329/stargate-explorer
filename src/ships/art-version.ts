import type { ShipDef } from '@/ships/defs';

/** URL-only art switch: never changes the save or flight/combat stats. */
export const originalArt = new URLSearchParams(globalThis.location?.search ?? '').get('art') === 'original';
export function selectArt(original: ShipDef, revised: ShipDef): ShipDef {
  return originalArt ? original : revised;
}
