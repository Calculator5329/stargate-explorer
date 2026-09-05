# Gate address console and ring construction

2026-09-05. Implementation summary for the dispatched lane. The roadmap, changelog,
and status files belong to another lane and were not edited.

## What changed

- `src/ui/glyphs.ts` authors 39 original angular constellation figures, with small
  origin-star circles on selected figures. Inline SVG and a cached 2496 × 64 canvas
  texture strip share the exact same stroke data. A stable system-id seed chooses
  six distinct coordinate symbols from indices 0–37, then appends local origin 38.
  Every entry in `SYSTEMS` gets an address without modifying the systems table.
- An original A–Z angular display face shares the SVG/canvas drawing machinery.
  Gate-control, destination and mission titles carry the face above English.
  The artwork is hidden from assistive technology; English remains visible.
  Numerals and punctuation remain legible in the English subtitle.
- The hub is a flat dial console: address register, selected system and its
  seven-step address, sortie orders, ship assignment, then dial/launch controls.
  Locked systems can be inspected. Their missions cannot launch. Requires chains,
  completion count, best time, unlock reward, ship stats, saved ship choice, back,
  show/hide and the `(level, ship)` launch callback remain. Selected buttons expose
  pressed state; unavailable sorties/ships use native disabled buttons. Focus is
  restored when a selection rebuilds the console. Reduced motion makes the hub's
  sequential highlight immediate.
- The gate has a thick extruded annulus, front/back rails and glyph bands, nine
  geometric V-shaped chevron housings, and small HDR inserts. Geometry outlines
  cover the body and housings. The glyph strip rotates, settles at each selected
  coordinate, and stops after the seventh lock. Six side chevrons encode first;
  the top chevron locks last, leaving the two lower expansion chevrons dark.
- A radial vertex mesh forms a half-second unstable vortex after lock seven.
  The event horizon stays inside the 34 m aperture, and its shader colors stay
  below 1.0 linear. Chevron inserts use `glowMaterial`; the horizon is not a
  full-disc bloom source. The crossing check uses the visible aperture.
- Travel uses the same gate model close to the camera over a solid ink backing.
  The DOM shows the destination address and lights each symbol at the existing
  `audio.chevron()` call site. The original dial → tunnel → reload and arrival
  fade states remain. `busy` still means dial/tunnel and `holding` still means
  any non-idle stage. The burst fits inside the existing seventh-lock pause.
  No changes were made to the simulation/game-loop hold.
- Local art/timing constants are commented because `core/tunables.ts` is outside
  this lane's ownership. Per-frame geometry, textures and vectors are reused.
  Tunnel bands now share the ice/ink colors and use defined smoothstep ordering.

## IP stance and owner authority

The constellation figures and display letters were authored as new procedural
stroke arrangements. They do not trace or reproduce the show's glyph inventory,
Ancient script, or a franchise logo. This follows the repo's franchise-mark
boundary and leaves any publication/likeness decision with Ethan. Ethan may
explicitly override this art direction; such a decision must be recorded before
substituting franchise artwork. This is an implementation provenance statement,
not a legal clearance claim. Existing place names are unchanged.

## Checks run in this lane

- `npm run build`: exited 0 (strict TypeScript and Vite). The final source tree
  emitted a 768.19 kB JS chunk (214.99 kB gzip), with only Vite's existing warning
  class about chunks above 500 kB. The task's “~600 kB” is not the observed size.
  A same-options esbuild comparison against pre-lane `f2052a7` measured 743492
  bytes for the base and 780083 for the new gate/console code before the final title markup, a
  36591-byte increase.
  These esbuild numbers are not Vite output sizes.
- The focused script below exited 0. It checks glyph/address uniqueness, canvas
  dimensions, ring geometry, aperture crossing, seven chevrons and the burst,
  audio/dial step agreement, duplicate departure rejection, arrival hold, hub
  locks, records, ship persistence and launch/back callbacks. Its DOM/canvas
  adapters do **not** check CSS layout, WebGL shader compilation or rendered art.
- `npx vite --port 5199 --strictPort`: exited 1 with
  `Error: listen EPERM: operation not permitted ::1:5199`.
- A direct `playwright-core` Chromium launch also failed before loading a page:
  `sandbox_host_linux.cc:41 ... shutdown: Operation not permitted (1)`; SIGTRAP.
  No listener retries or changes to sandbox policy were made.

**Needs outside-sandbox verification:** browser captures, visual inspection of
spacing/glyph orientation/bloom, actual simulation hold in the browser, and the
mission-driven gate close-up. No screenshot was produced in this lane. No visual
acceptance, frame-rate measurement or sound-quality judgment is claimed.

## Capture manifest (pending, files not created)

| Requested file | Intended contents |
| --- | --- |
| `gate-hub-redesign-hub.png` | `?hub=1&lock=free`, full address register, initial locks, selected address and ships |
| `gate-hub-redesign-dial.png` | Destination at 1.15 seconds, three address glyphs and corresponding chevrons lit |
| `gate-hub-redesign-gate.png` | Return gate after an actual headless mission completion, camera facing the ring at 115 m |

The runnable capture driver below uses port 5199, asserts the real simulation is
held during the paused dial, then kills actual enemy spawns as `chain-test.mjs`
does and frames the resulting return gate. It has been syntax-checked, but could
not execute here. It writes only the three requested capture filenames. Run it
from the repository root with `npx vite --port 5199 --strictPort` in another
terminal outside the restricted lane.

## Reproduce the focused check and capture driver

Extract either embedded script to the cache and run it from this repo's root:

```sh
python3 - <<'PY'
from pathlib import Path
text = Path('docs/design/gate-hub-redesign.md').read_text()
cache = Path.home() / '.cache/tmp/gate-hub'
cache.mkdir(parents=True, exist_ok=True)
for name in ('focused', 'capture'):
    code = text.split(f'<!-- {name}.mjs -->\n```js\n', 1)[1].split('\n```', 1)[0]
    (cache / f'{name}.mjs').write_text(code + '\n')
PY
node "$HOME/.cache/tmp/gate-hub/focused.mjs"
# Outside the sandbox, with Vite running on 5199:
node "$HOME/.cache/tmp/gate-hub/capture.mjs"
```

<!-- focused.mjs -->
```js
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(resolve('package.json'));
const { build } = require('esbuild');
const bundled = await build({ stdin: { contents: `export * from '@/ui/glyphs'; export * from '@/travel/gate'; export * from '@/travel/travel'; export * from '@/ui/hub'; export { SYSTEMS } from '@/world/systems'; export { LEVELS } from '@/mission/levels'; export { DEFAULT_SAVE } from '@/core/save'; export * as THREE from 'three';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
const lib = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const { THREE, Gate, Travel, Hub, SYSTEMS, LEVELS, DEFAULT_SAVE, CHEVRON_T, BURST_T, CHEVRON_ORDER, systemAddress, glyphSvg, scriptSvg, scriptCanvas, glyphStrip } = lib;

// Small DOM adapter: tests data/selection/state only, not browser layout or SVG rendering.
class Element {
  children = []; dataset = {}; style = {}; disabled = false; className = ''; html = ''; text = ''; events = {}; selectors = {};
  classList = { add: (...names) => { this.className = [...new Set([...this.className.split(' '), ...names])].join(' '); }, remove: (...names) => { this.className = this.className.split(' ').filter(n => !names.includes(n)).join(' '); }, contains: name => this.className.split(' ').includes(name) };
  set innerHTML(v) { this.html = v; this.children = [...v.matchAll(/class="glyph"/g)].map(() => { const e = new Element(); e.className = 'glyph'; return e; }); }
  get innerHTML() { return this.html; }
  set textContent(v) { this.text = v; this.children = []; }
  get textContent() { return this.text; }
  appendChild(e) { this.children.push(e); }
  querySelector(s) { return this.selectors[s] ?? null; }
  querySelectorAll(s) { return s === '.glyph' ? this.children : []; }
  addEventListener(name, fn) { this.events[name] = fn; }
  setAttribute() {}
  click() { if (!this.disabled) this.events.click?.(); }
  focus() {}
}
const ctx = { beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {}, fillRect() {}, strokeRect() {}, save() {}, restore() {}, translate() {}, scale() {} };
globalThis.document = { activeElement: null, createElement: tag => tag === 'canvas' ? { width: 0, height: 0, getContext: () => ctx } : new Element() };
globalThis.localStorage = { setItem() {} };
globalThis.location = { search: '' };
function root(selectors) { const r = new Element(); for (const s of selectors) r.selectors[s] = new Element(); return r; }

assert.equal(new Set(Array.from({ length: 39 }, (_, i) => glyphSvg(i))).size, 39);
assert.equal(new Set([..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map(scriptSvg)).size, 26);
const addresses = SYSTEMS.map(s => systemAddress(s.id));
assert.equal(new Set(addresses.map(a => a.join(','))).size, SYSTEMS.length);
for (const [i, a] of addresses.entries()) {
  assert.deepEqual(a, systemAddress(SYSTEMS[i].id)); assert.equal(a.length, 7); assert.equal(a[6], 38);
  assert.equal(new Set(a.slice(0, 6)).size, 6); assert(a.slice(0, 6).every(n => n >= 0 && n < 38));
}
assert.equal(glyphStrip().image.width, 39 * 64);
assert.equal(glyphStrip(), glyphStrip());
assert.equal(scriptCanvas('GATE').width, 4 * 48);

const gate = new Gate(); gate.open(new THREE.Vector3(), new THREE.Vector3(0, 0, 1));
assert(!gate.crossed(new THREE.Vector3(0, 0, -1))); assert(gate.crossed(new THREE.Vector3(0, 0, 1)));
gate.open(new THREE.Vector3(), new THREE.Vector3(0, 0, 1));
assert(!gate.crossed(new THREE.Vector3(39, 0, -1))); assert(!gate.crossed(new THREE.Vector3(39, 0, 1)));
gate.beginDial(addresses[0]); gate.setDial(3 * CHEVRON_T + .1, 3);
assert.equal(gate.chevrons.filter(m => m.color.r > 1).length, 3);
assert(!gate.horizon.visible); const rotation = gate.rotor.rotation.z;
gate.setDial(3 * CHEVRON_T + .2, 3); assert.notEqual(gate.rotor.rotation.z, rotation);
gate.setDial(7 * CHEVRON_T + BURST_T / 2, 7);
assert(gate.burst.visible); assert(gate.horizon.visible);
assert.equal(gate.chevrons.filter(m => m.color.r > 1).length, 7);
assert(gate.chevrons[0].color.r > 1); assert(gate.chevrons[4].color.r < 1); assert(gate.chevrons[5].color.r < 1);
gate.setDial(7 * CHEVRON_T + BURST_T, 7); assert(!gate.burst.visible);
const band = gate.rotor.children[0].geometry;
assert.equal(band.index.count, 39 * 6); assert.equal(band.attributes.uv.count, 40 * 2);

const dial = root(['.ring', '.address', '.line', '.dest']); const calls = [];
const audio = { ui() { calls.push('ui'); }, chevron(n, last) { calls.push([n, last]); }, launch() { calls.push('launch'); } };
const travel = new Travel(dial, new THREE.Scene(), audio), cam = new THREE.PerspectiveCamera(60, 16 / 9, .1, 10000);
assert(!travel.holding); assert(!travel.busy);
travel.depart(SYSTEMS[0], new URLSearchParams('mission=belt-clear'));
assert(travel.holding && travel.busy);
travel.depart(SYSTEMS[1], new URLSearchParams('mission=escort')); assert.equal(calls.length, 1);
for (let i = 1; i <= 7; i++) {
  travel.update(CHEVRON_T + .00001, cam);
  assert.equal(dial.selectors['.address'].children.filter(c => c.classList.contains('on')).length, i);
  assert.equal(dial.selectors['.ring'].children.filter(c => c.classList.contains('on')).length, i);
  assert(dial.selectors['.ring'].children[CHEVRON_ORDER[i - 1]].classList.contains('on'));
  assert.deepEqual(calls[i], [i, i === 7]);
  assert(travel.holding && travel.busy);
}
travel.update(BURST_T / 2, cam); assert(travel.gate.burst.visible); assert(!calls.includes('launch'));
travel.update(BURST_T, cam); assert.equal(calls.at(-1), 'launch'); assert(travel.holding && travel.busy);
travel.update(1.71, cam); assert.match(location.search, /mission=belt-clear/); assert.match(location.search, /arrive=1/);
travel.arrive(); assert(travel.holding && !travel.busy); travel.update(.8, cam); assert(travel.holding);
travel.update(.31, cam); assert(!travel.holding && !travel.busy);

const hubRoot = root(['h1', '.back', '.go', '.systems', '.destination', '.system-blurb', '.selected-address', '.missions', '.ships', '.launch-summary']);
const save = structuredClone(DEFAULT_SAVE); const launched = []; let backs = 0;
const hub = new Hub(hubRoot, save, LEVELS[0], () => backs++, (l, ship) => launched.push([l.id, ship])); hub.show();
assert.equal(hubRoot.selectors['.systems'].children.length, SYSTEMS.length);
assert.equal(hubRoot.selectors['.missions'].children.filter(b => !b.disabled).length, 1);
hubRoot.selectors['.systems'].children[1].click(); assert(hubRoot.selectors['.go'].disabled);
hub.launch(); assert.equal(launched.length, 0);
for (const l of LEVELS) save.progress.missions[l.id] = { bestTime: 65, completions: 2 };
save.progress.unlocked = ['f11', 'heavy', 'prometheus']; hub.show();
assert(hubRoot.selectors['.missions'].children[0].innerHTML.includes('CLEARED ×2 · best 1:05'));
hubRoot.selectors['.ships'].children.at(-1).click(); hubRoot.selectors['.go'].click();
assert.equal(launched.length, 1); assert.equal(launched[0][0], LEVELS.find(l => l.system === SYSTEMS[1].id).id);
assert.equal(launched[0][1], save.progress.ship); assert(!hubRoot.classList.contains('on'));
hub.show(); hubRoot.selectors['.back'].click(); assert.equal(backs, 1);
console.log('Focused assertions completed: glyph uniqueness/addresses, ring geometry/crossing, chevrons/vortex, travel lifecycle/audio, hub locks/records/ship/callback. DOM and canvas are adapters, not visual evidence.');
```

<!-- capture.mjs -->
```js
// Run from the repo root with Vite already listening on 5199, outside the lane sandbox.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(resolve('package.json'));
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const base = 'http://localhost:5199';
  await page.goto(`${base}/?hub=1&lock=free&quality=med`);
  await page.waitForFunction(() => window.__hub && window.__travel);
  await page.waitForTimeout(1300);
  assert.equal(await page.locator('#hub .system').count(), 7);
  assert.equal(await page.locator('#hub .selected-address .glyph').count(), 7);
  await page.screenshot({ path: 'docs/design/gate-hub-redesign-hub.png' });
  await page.evaluate(() => {
    const t = window.__travel, update = t.update.bind(t);
    // Stop only the dial presentation at 1.15 s; sim remains held by production code.
    window.__resumeDial = () => { t.update = update; };
    t.update = (dt, cam) => update(t.stage === 'dial' ? Math.min(dt, Math.max(0, 1.15 - t.t)) : dt, cam);
  });
  await page.locator('#hub .go').click();
  await page.waitForFunction(() => window.__travel.t >= 1.15);
  assert.equal(await page.locator('#dial .address .glyph.on').count(), 3);
  const held = await page.evaluate(() => ({ clock: window.__game.mission.clock, pos: window.__flight.pos.toArray(), holding: window.__travel.holding, busy: window.__travel.busy }));
  assert(held.holding && held.busy);
  await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(() => ({ clock: window.__game.mission.clock, pos: window.__flight.pos.toArray(), holding: window.__travel.holding, busy: window.__travel.busy })), held);
  await page.screenshot({ path: 'docs/design/gate-hub-redesign-dial.png' });
  await page.evaluate(() => window.__resumeDial());
  await page.waitForURL(/arrive=1/, { timeout: 30000 });
  await page.waitForFunction(() => window.__travel && !window.__travel.holding, null, { timeout: 30000 });
  // Same mission-driving strategy as chain-test: kill actual spawns and wait for its runner.
  const phase = await page.evaluate(async () => {
    const g = window.__game, m = g.mission;
    m.timer = 0;
    const deadline = performance.now() + 120000;
    while (!m.done && performance.now() < deadline) {
      for (const enemy of g.enemies.list) if (enemy.alive) g.enemies.damage(enemy, 1e6);
      await new Promise(r => setTimeout(r, 200));
    }
    // Freeze flight only after the runner has completed, so capture cannot cross the return gate.
    window.__flight.tick = () => {};
    return m.phase;
  });
  assert.equal(phase, 'complete');
  await page.waitForFunction(() => window.__game.gate.alive);
  await page.evaluate(() => {
    const g = window.__game, render = g.render.bind(g);
    g.render = (...args) => {
      render(...args);
      const cam = args[2], gate = g.gate;
      cam.position.copy(gate.pos).addScaledVector(gate.normal, -115);
      cam.lookAt(gate.pos); cam.updateMatrixWorld();
    };
    document.querySelector('#hud').style.display = 'none';
  });
  await page.waitForTimeout(3200);
  assert.equal(await page.evaluate(() => window.__game.gate.group.children.filter(c => c.name.startsWith('chevron-')).length), 9);
  await page.screenshot({ path: 'docs/design/gate-hub-redesign-gate.png' });
  assert.deepEqual(errors, []);
  console.log('Captured hub, three-lock dial, and completed-mission return gate.');
} finally {
  await browser.close();
}
```

