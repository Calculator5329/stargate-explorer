import { Vector3 } from 'three';
import { T } from '@/core/tunables';
import { HANDLING_PRESETS } from '@/sim/handling';
import type { Flight } from '@/sim/flight';
import type { Input } from '@/core/input';
import { keyName } from '@/core/binds';
import { chordName } from '@/sim/moves';
import './sandbox-guide.css';

const forward = new Vector3();

/** Practice hints read the same move table and bindings that consume input. */
export class SandboxGuide {
  private readonly el = document.createElement('section');
  private signature = '';
  private readonly handling = document.createElement('p');
  private readonly telemetry = document.createElement('p');
  private frame = 0;
  private readonly rows = new Map<string, { row: HTMLElement; state: HTMLElement }>();
  private active = false;

  constructor(root: HTMLElement) {
    this.el.className = 'sandbox-guide';
    this.el.setAttribute('aria-label', 'Sandbox moves');
    this.el.hidden = true;
    root.append(this.el);
  }

  setActive(active: boolean): void { this.active = active; this.el.hidden = !active; }

  update(flight: Flight, input: Input): void {
    if (!this.active) return;
    // the bind table changes from the menu, not per frame: check it four times a second, not 240
    const signature = this.frame++ % 15 === 0 || !this.signature ? JSON.stringify([flight.moves.map(m => [m.id, m.name, m.trigger, m.cost, m.duration]), input.moveBinds, input.binds]) : this.signature;
    if (signature !== this.signature) {
      this.signature = signature;
      this.el.replaceChildren();
      this.rows.clear();
      const title = document.createElement('h2');
      title.textContent = 'MOVE PRACTICE';
      this.el.append(title, this.handling, this.telemetry);
      const directions = { up: input.binds.pullUp, down: input.binds.dive, left: input.binds.rollLeft, right: input.binds.rollRight };
      for (const move of flight.moves) {
        const row = document.createElement('div');
        const key = document.createElement('kbd');
        key.textContent = keyName(input.moveBinds[move.id] ?? '') || '—';
        const name = document.createElement('span');
        name.textContent = move.name;
        const chord = document.createElement('small');
        chord.textContent = `${Math.round(move.cost * 100)}% boost · ${move.duration.toFixed(1)} s`;
        const fallback = document.createElement('span');
        fallback.className = 'chord-fallback';
        fallback.textContent = ` · or ${chordName(move, directions).replace(' + ', ' then ')}`;
        chord.append(fallback);
        name.append(chord);
        const state = document.createElement('b');
        row.append(key, name, state);
        this.el.append(row);
        this.rows.set(move.id, { row, state });
      }
      const help = document.createElement('p');
      help.textContent = 'Tap a shortcut once. Each move spends boost, then the sandbox refills it. Engine trails show the flight path. Esc → Flight lab to tune handling; Flight & move keys to rebind.';
      this.el.append(help);
    }
    if (this.frame % 15 === 0) {
      const h = flight.handling;
      const preset = h ? HANDLING_PRESETS.find(p => Object.keys(h).every(k => Reflect.get(p.values, k) === Reflect.get(h, k))) : null;
      this.handling.textContent = `${h ? (preset?.name ?? 'Custom handling') : 'Current handling'} · Esc to tune${h?.sweet ? ` · Best turn near ${Math.round((T.flight.minSpeed + T.flight.maxSpeed) / 2 * flight.stats.speed)} m/s` : ''}`;
      forward.set(0, 0, 1).applyQuaternion(flight.quat);
      const slip = flight.speed > 1 ? Math.acos(Math.min(1, Math.max(-1, forward.dot(flight.velDir)))) * 180 / Math.PI : 0;
      this.telemetry.textContent = `${Math.round(flight.speed)} m/s · ${flight.turnGain(input.scheme.speedTurn).toFixed(2)}× steering · ${Math.round(slip)}° slide${flight.move ? ' · TRICK' : ''}`;
    }
    for (const [id, {row, state}] of this.rows) {
      const running = flight.move?.id === id;
      row.classList.toggle('active', running);
      const cost = flight.moves.find(m => m.id === id)?.cost ?? 0;
      const label = running ? `${Math.round(flight.moveT / flight.move!.duration * 100)}%` : flight.move ? 'WAIT' : flight.boostEnergy < cost ? 'LOW BAR' : 'READY';
      if (state.textContent !== label) state.textContent = label;
    }
  }
}
