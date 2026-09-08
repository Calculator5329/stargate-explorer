import type { Flight } from '@/sim/flight';
import type { Input } from '@/core/input';
import { keyName } from '@/core/binds';
import { chordName } from '@/sim/moves';
import './sandbox-guide.css';

/** Practice hints read the same move table and bindings that consume input. */
export class SandboxGuide {
  private readonly el = document.createElement('section');
  private signature = '';
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
    const signature = JSON.stringify([flight.moves.map(m => [m.id, m.name, m.trigger]), input.moveBinds, input.binds]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.el.replaceChildren();
      this.rows.clear();
      const title = document.createElement('h2');
      title.textContent = 'MOVE PRACTICE';
      this.el.append(title);
      const directions = { up: input.binds.pullUp, down: input.binds.dive, left: input.binds.rollLeft, right: input.binds.rollRight };
      for (const move of flight.moves) {
        const row = document.createElement('div');
        const key = document.createElement('kbd');
        key.textContent = keyName(input.moveBinds[move.id] ?? '') || '—';
        const name = document.createElement('span');
        name.textContent = move.name;
        const chord = document.createElement('small');
        chord.textContent = `or ${chordName(move, directions).replace(' + ', ' then ')}`;
        name.append(chord);
        const state = document.createElement('b');
        row.append(key, name, state);
        this.el.append(row);
        this.rows.set(move.id, { row, state });
      }
      const help = document.createElement('p');
      help.textContent = 'Esc → Flight & move keys to rebind. Restart resets your position.';
      this.el.append(help);
    }
    for (const [id, {row, state}] of this.rows) {
      const running = flight.move?.id === id;
      row.classList.toggle('active', running);
      const label = running ? 'RUNNING' : flight.move ? 'WAIT' : 'READY';
      if (state.textContent !== label) state.textContent = label;
    }
  }
}
