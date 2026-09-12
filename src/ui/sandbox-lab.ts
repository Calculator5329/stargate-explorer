import type { Flight } from '@/sim/flight';
import { HANDLING_FIELDS, HANDLING_PRESETS, loadHandling, saveHandling, type HandlingDraft } from '@/sim/handling';
import './sandbox-lab.css';

/** The experiment lives on Flight, never in shared campaign tunables or progress. */
export class SandboxLab {
  private readonly el = document.createElement('section');
  private readonly draft: HandlingDraft = loadHandling();
  private active = false;
  private readonly description = document.createElement('p');
  private readonly saved = document.createElement('p');
  private readonly baseline = document.createElement('button');
  private readonly experiment = document.createElement('button');
  private readonly curve = document.createElement('select');
  private readonly controls = new Map<string, { input: HTMLInputElement; value: HTMLOutputElement }>();
  private readonly presets: HTMLButtonElement[] = [];

  constructor(root: HTMLElement, private readonly flight: Flight, reset: () => void) {
    this.el.className = 'sandbox-lab';
    this.el.setAttribute('aria-label', 'Sandbox flight lab');
    this.el.innerHTML = '<h2>SANDBOX / FLIGHT LAB</h2><p>Pick a feel, fly it, then press Esc to adjust. Saved here only; missions keep your current handling.</p>';
    const choices = document.createElement('div');
    choices.className = 'lab-presets';
    for (const preset of HANDLING_PRESETS) {
      const button = document.createElement('button');
      button.textContent = preset.name;
      button.addEventListener('click', () => {
        Object.assign(this.draft.values, preset.values);
        this.draft.current = false;
        this.commit();
      });
      choices.append(button);
      this.presets.push(button);
    }
    this.el.append(choices, this.description);
    const curveLabel = document.createElement('label');
    curveLabel.append('Turn curve');
    this.curve.setAttribute('aria-label', 'Turn curve');
    this.curve.add(new Option('Slower = tighter', '0'));
    this.curve.add(new Option('Middle-speed sweet spot', '1'));
    this.curve.addEventListener('change', () => { this.draft.values.sweet = Number(this.curve.value); this.commit(); });
    curveLabel.append(this.curve);
    this.el.append(curveLabel);
    const sliders = document.createElement('div');
    sliders.className = 'lab-sliders';
    for (const field of HANDLING_FIELDS) {
      const label = document.createElement('label');
      const caption = document.createElement('span');
      caption.textContent = field.label;
      const hint = document.createElement('small');
      hint.textContent = field.hint;
      caption.append(hint);
      const input = document.createElement('input');
      input.type = 'range'; input.min = String(field.min); input.max = String(field.max); input.step = String(field.step);
      input.setAttribute('aria-label', field.label);
      const value = document.createElement('output');
      input.addEventListener('input', () => { this.draft.values[field.key] = Number(input.value); this.commit(); });
      label.append(caption, value, input);
      sliders.append(label);
      this.controls.set(field.key, { input, value });
    }
    const actions = document.createElement('div');
    actions.className = 'lab-actions';
    this.baseline.textContent = 'Current handling';
    this.experiment.textContent = 'My experiment';
    this.baseline.addEventListener('click', () => { this.draft.current = true; this.commit(); });
    this.experiment.addEventListener('click', () => { this.draft.current = false; this.commit(); });
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset flight position';
    resetButton.addEventListener('click', () => { reset(); this.apply(); });
    actions.append(this.baseline, this.experiment, resetButton);
    this.saved.setAttribute('role', 'status');
    this.saved.className = 'lab-saved';
    curveLabel.before(actions);
    this.el.append(sliders, this.saved);
    root.prepend(this.el);
    this.setActive(false);
    this.refresh();
  }

  setActive(active: boolean): void {
    this.active = active;
    this.el.hidden = !active;
    this.el.closest('#menu')?.classList.toggle('has-lab', active);
    this.apply();
  }

  private apply(): void { this.flight.handling = this.active && !this.draft.current ? this.draft.values : null; }

  private commit(): void {
    this.apply();
    this.saved.textContent = saveHandling(this.draft) ? 'Saved on this browser · Resume flight below to try it.' : 'Active for this visit · Browser storage is unavailable.';
    this.refresh();
  }

  private refresh(): void {
    const h = this.draft.values;
    const match = HANDLING_PRESETS.findIndex(p => Object.keys(h).every(key => Reflect.get(p.values, key) === Reflect.get(h, key)));
    this.presets.forEach((b, i) => b.setAttribute('aria-pressed', String(!this.draft.current && i === match)));
    this.description.textContent = this.draft.current
      ? 'Current campaign handling, including your speed-coupled turning setting. Your experiment is kept for comparison.'
      : `${HANDLING_PRESETS[match]?.note ?? 'Custom handling. Compare with current handling, or pick a preset to start again.'}`;
    this.baseline.setAttribute('aria-pressed', String(this.draft.current));
    this.experiment.setAttribute('aria-pressed', String(!this.draft.current));
    this.curve.value = String(h.sweet);
    this.curve.disabled = this.draft.current;
    for (const field of HANDLING_FIELDS) {
      const { input, value } = this.controls.get(field.key)!;
      input.value = String(h[field.key]);
      input.disabled = this.draft.current;
      input.style.setProperty('--fill', `${(h[field.key] - field.min) / (field.max - field.min) * 100}%`);
      value.value = `${h[field.key].toFixed(2)}×`;
    }
  }
}
