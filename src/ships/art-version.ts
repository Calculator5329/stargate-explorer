import type { ShipDef } from '@/ships/defs';

/** URL-only selection never changes saves or gameplay stats. */
const art = new URLSearchParams(globalThis.location?.search ?? '').get('art');
export const originalArt = art === 'original';
export function selectArt(original: ShipDef, revised: ShipDef, pass1 = revised, preferOriginal = false): ShipDef {
  if (originalArt) return original;
  if (art === 'pass1') return pass1;
  return preferOriginal && art !== 'candidate' ? original : revised;
}
