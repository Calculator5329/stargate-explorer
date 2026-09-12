export const SOUND_IDS = [
  'cannon-0', 'cannon-1', 'cannon-2', 'hit-0', 'hit-1', 'hit-2',
  'explosion-0', 'explosion-1', 'explosion-2', 'damage', 'missile',
  'ui', 'lock', 'ring', 'chevron', 'chevron-lock', 'win', 'lose',
  'gate-open', 'wormhole', 'engine', 'boost', 'boost-start',
  'move-cobra', 'move-vortex', 'move-sidewinder-left', 'move-sidewinder-right',
] as const;
export type SoundId = typeof SOUND_IDS[number];

/** Decode once after a user gesture; a missing asset retains the synth fallback. */
export class SoundBank {
  readonly buffers = new Map<SoundId, AudioBuffer>();
  failed = 0;
  ready: Promise<void> | null = null;
  get status(): string {
    return this.ready === null ? 'Click to enable audio'
      : this.buffers.size + this.failed < SOUND_IDS.length ? `Loading sounds ${this.buffers.size}/${SOUND_IDS.length}`
      : this.failed ? `${this.buffers.size} sounds ready · ${this.failed} using synth fallback` : 'All 27 sounds ready';
  }
  load(ctx: AudioContext): Promise<void> {
    return this.ready ??= Promise.all(SOUND_IDS.map(async id => {
      try {
        const response = await fetch(`/audio/${id}.ogg`);
        if (!response.ok) throw new Error(`Audio asset ${id}: ${response.status}`);
        this.buffers.set(id, await ctx.decodeAudioData(await response.arrayBuffer()));
      } catch { this.failed++; }
    })).then(() => undefined);
  }
}
