// Headless geometry checks; no listener, browser, GPU, or app-state shortcuts required.
// Usage: node scripts/strike-deck-check.mjs
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = await build({
  stdin: {
    contents: `export { StrikeDeck } from './src/world/strike-deck';
      export { MeshSolid } from './src/world/mesh-solid';
      export * as THREE from 'three';`,
    resolveDir: root,
  },
  absWorkingDir: root, tsconfig: 'tsconfig.json', bundle: true,
  write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const { StrikeDeck, MeshSolid, THREE } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const vector = (x, y, z) => new THREE.Vector3(x, y, z);
const hit = () => ({ point: vector(0, 0, 0), normal: vector(0, 1, 0), fraction: 1 });
const near = (actual, expected, message, epsilon = 0.001) => assert.ok(Math.abs(actual - expected) < epsilon, `${message}: ${actual} vs ${expected}`);
const deck = new StrikeDeck();

// Real flight path and cooling target line of fire, with craft radius rather than a point.
for (const x of [-115, -60, 0, 60, 115]) {
  const out = hit();
  assert.equal(deck.sweep(vector(x, 250, 1800), vector(x, 250, 770), 8, out), false, `corridor must be clear at x=${x}`);
}
assert.equal(deck.sweep(deck.approach, deck.jumpExit, 8, hit()), false, 'jump exit reachable along the corridor');
assert.equal(deck.sweep(deck.jumpExit, deck.ventPos, 0, hit()), false, 'cooling target has unobstructed line of fire');
assert.equal(deck.sweep(deck.ventPos, deck.escapePos, 8, hit()), false, 'escape climbs out ahead of the target');

const floor = hit();
assert.equal(deck.sweep(vector(0, 600, 1100), vector(0, 0, 1100), 6, floor), true);
assert.ok(floor.point.y > 185 && floor.point.y < 200, 'floor contact agrees with fighter-height panels');
assert.ok(floor.normal.y > 0.99, 'floor pushes the ship upward');
const wall = hit();
assert.equal(deck.sweep(vector(0, 250, 1000), vector(300, 250, 1000), 6, wall), true);
near(wall.point.x, 134, '280m corridor wall clearance includes radius');
assert.ok(wall.normal.x < -0.99, 'port wall pushes inward');
const fast = hit();
assert.equal(deck.sweep(vector(0, 250, 2200), vector(0, 250, -2200), 6, fast), true, 'fast crossing cannot tunnel through cooling bulkhead');
assert.ok(fast.point.z > 730 && fast.point.z < 745, 'bulkhead is first contact, not a giant hull sphere');
assert.ok(fast.normal.z > 0.99, 'bulkhead pushes toward the approach');

// Independent Three.js raycasts compare point sweeps with actual rendered triangles.
const solids = [];
deck.group.traverse(object => {
  if (object.isMesh && object.material instanceof THREE.MeshToonMaterial) solids.push(object);
});
deck.group.updateMatrixWorld(true);
const rays = [[0, 900, 1100], [530, 1100, 0], [-680, 900, -200], [900, 900, 0], [0, -600, 0]];
for (const xyz of rays) {
  const a = vector(...xyz), b = vector(xyz[0], xyz[1] < 0 ? 800 : -600, xyz[2]);
  const direction = b.clone().sub(a), length = direction.length();
  const ray = new THREE.Raycaster(a, direction.normalize(), 0, length);
  const expected = ray.intersectObjects(solids, false)[0];
  assert.ok(expected, `visible solid under ray ${xyz}`);
  const out = hit();
  assert.equal(deck.sweep(a, b, 0, out), true, `ray contact ${xyz}`);
  near(out.fraction * length, expected.distance, `collision follows visible hull ${xyz}`, 0.01);
}

// Root transforms are excluded, child transforms are included: callers sweep in root-local coordinates.
const craft = new THREE.Group();
craft.position.set(500, -200, 800);
craft.scale.setScalar(3);
const solidBox = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshToonMaterial());
solidBox.position.x = 4;
craft.add(solidBox);
const glow = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial());
glow.position.x = 150;
craft.add(glow);
const meshSolid = new MeshSolid(craft);
const local = hit();
assert.equal(meshSolid.sweep(vector(4, 20, 0), vector(4, 0, 0), 1, local), true);
near(local.point.y, 6, 'query remains in local coordinates');
assert.equal(meshSolid.sweep(vector(150, 100, 0), vector(150, -100, 0), 2, hit()), false, 'glow has no invisible collision volume');

// Expanded AABBs alone give false corner contacts; exact sphere/triangle contacts must not.
assert.equal(meshSolid.sweep(vector(10, 6, 1000), vector(10, 6, -1000), 1, hit()), false, 'near-corner miss remains a miss');
const edge = hit();
assert.equal(meshSolid.sweep(vector(9.6, 0, 1000), vector(9.6, 0, -1000), 1, edge), true);
near(edge.point.z, 5.8, 'continuous contact with rounded edge', 0.002);
const corner = hit();
assert.equal(meshSolid.sweep(vector(9.6, 5.6, 1000), vector(9.6, 5.6, -1000), 1, corner), true);
near(corner.point.z, 5 + Math.sqrt(0.28), 'continuous contact with rounded corner', 0.002);
near(corner.normal.length(), 1, 'contact normal is normalized');
const overlap = hit();
assert.equal(meshSolid.sweep(vector(9.5, 0, 0), vector(9.5, 0, 0), 1, overlap), true, 'initial surface overlap is resolved');
near(overlap.fraction, 0, 'overlap starts at zero');
assert.ok(overlap.normal.x > 0.99);

const begin = performance.now(), scratch = hit();
const a = vector(0, 250, 1280), b = vector(0, 250, 754);
for (let i = 0; i < 2000; i++) deck.sweep(a, b, i % 2 ? 0 : 8, scratch);
console.log(JSON.stringify({ passed: true, corridorWidth: 280, vent: deck.ventPos.toArray(),
  turretPositions: deck.turretPositions.map(p => p.toArray()), sampledSweeps: 2000,
  sampledSweepMs: +(performance.now() - begin).toFixed(2) }, null, 2));
