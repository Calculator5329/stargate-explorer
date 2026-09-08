/** CPU-side FX contract checks; visual acceptance still requires a browser capture. */
import { build } from 'esbuild';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const cache = join(homedir(), '.cache', 'tmp', 'stargate-explorer');
await mkdir(cache, { recursive: true });
const run = await mkdtemp(join(cache, 'destruction-check-'));
const output = join(run, 'check.mjs');
await build({
  stdin: {
    contents: `
import assert from 'node:assert/strict';
import { Explosions } from '@/fx/explosion';
import { Vector3 } from 'three';
const a = new Explosions(), b = new Explosions();
const pos = new Vector3(2, 3, 4), vel = new Vector3(10, 2, 0), camera = new Vector3(0, 0, 100);
const lightPos = new Vector3();
const snapshot = fx => fx.group.children.map(mesh => ({
  visible: mesh.visible, matrix: [...mesh.instanceMatrix.array],
  color: mesh.instanceColor ? [...mesh.instanceColor.array] : null,
}));
for (const kind of ['ship', 'rock', 'impact']) {
  a.clear(); b.clear();
  assert.equal(a.spawn(pos, vel, 12, 12345, kind), 12345);
  b.spawn(pos, vel, 12, 12345, kind);
  for (let frame = 0; frame < 80; frame++) {
    a.update(1 / 60, camera); b.update(1 / 60, camera);
    assert.deepEqual(snapshot(a), snapshot(b), kind + ' deterministic reconstruction');
  }
}
a.clear(); b.clear();
a.spawn(pos, vel, 5, 1); b.spawn(pos, vel, 5, 2);
a.update(0.2, camera); b.update(0.2, camera);
assert.notDeepEqual(snapshot(a), snapshot(b), 'different seeds vary breakup');
assert(a.strongestLight(lightPos) > 0, 'active fireball illuminates');
assert(lightPos.distanceTo(pos) > 0, 'light inherits victim momentum');
for (let replay = 0; replay < 3; replay++) {
  a.clear(); b.clear();
  assert(a.group.children.every(mesh => !mesh.visible), 'clear hides every mesh');
  assert.equal(a.strongestLight(lightPos), 0, 'clear removes light');
  for (const mesh of a.group.children) {
    const matrix = mesh.instanceMatrix.array;
    for (let i = 0; i < matrix.length; i += 16) {
      assert.equal(matrix[i], 0); assert.equal(matrix[i + 5], 0); assert.equal(matrix[i + 10], 0);
    }
  }
  a.spawn(pos, vel, 5, 12345); b.spawn(pos, vel, 5, 12345);
  a.update(0.25, camera); b.update(0.125, camera); b.update(0.125, camera);
  assert.deepEqual(snapshot(a), snapshot(b), 'same accumulated playback time');
}
const meshes = a.group.children.length;
const slots = a.group.children.reduce((sum, mesh) => sum + mesh.count, 0);
for (let i = 0; i < 100; i++) { a.spawn(pos, vel, 5, i); a.update(1 / 60, camera); }
assert.equal(a.group.children.length, meshes, 'bounded mesh count');
assert.equal(a.group.children.reduce((sum, mesh) => sum + mesh.count, 0), slots, 'bounded instance slots');
a.update(4, camera); a.update(0, camera);
assert(a.group.children.every(mesh => !mesh.visible), 'expired pools hide');
assert.equal(a.strongestLight(lightPos), 0, 'expired pools stop illuminating');
console.log('PASS: deterministic ship/rock/impact reconstruction, seed variation, repeat clear/replay, playback clock, lighting, bounded pools, expiry.');
`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  alias: { '@': join(root, 'src') },
  outfile: output,
});
await import(pathToFileURL(output).href);
