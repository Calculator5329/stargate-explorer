import { build } from 'esbuild';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const cache = join(homedir(), '.cache', 'tmp', 'stargate-explorer');
await mkdir(cache, { recursive: true });
const output = join(await mkdtemp(join(cache, 'polar-terrain-')), 'check.mjs');
await build({
  stdin: { contents: `
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PolarTerrain } from '@/world/polar-terrain';
import { solidHit } from '@/world/solid';
import { mulberry32 } from '@/core/random';

const terrain = new PolarTerrain();
const hit = solidHit(), a = new THREE.Vector3(), b = new THREE.Vector3();
const near = (actual, expected, epsilon = 1e-5) => assert(Math.abs(actual - expected) < epsilon, actual + ' != ' + expected);
let triangles = 0, heightSamples = 0, maxHeight = -Infinity, minHeight = Infinity;
const triangle = new THREE.Triangle(), point = new THREE.Vector3(), normal = new THREE.Vector3();
const random = mulberry32(17);
const meshTriangles = [];
for (const mesh of terrain.group.children) {
  assert(mesh.isMesh);
  const positions = mesh.geometry.getAttribute('position');
  assert(positions.array.every(Number.isFinite));
  assert(mesh.geometry.getAttribute('color').array.every(Number.isFinite));
  triangles += positions.count / 3;
  for (let i = 0; i < positions.count; i += 3) {
    triangle.a.fromBufferAttribute(positions, i);
    triangle.b.fromBufferAttribute(positions, i + 1);
    triangle.c.fromBufferAttribute(positions, i + 2);
    triangle.getNormal(normal);
    if (normal.y <= 0) continue;
    maxHeight = Math.max(maxHeight, triangle.a.y, triangle.b.y, triangle.c.y);
    minHeight = Math.min(minHeight, triangle.a.y, triangle.b.y, triangle.c.y);
    if (i % 183 !== 0) continue;
    // Sample both diagonals using barycentric coordinates, independently of heightAt.
    const u = random() * .7 + .1, v = random() * (1 - u);
    point.copy(triangle.a).multiplyScalar(1 - u - v).addScaledVector(triangle.b, u).addScaledVector(triangle.c, v);
    near(terrain.heightAt(point.x, point.z), point.y);
    heightSamples++;
    meshTriangles.push(triangle.clone());
  }
}
assert(triangles >= 40000 && triangles <= 90000, 'terrain triangle budget');
assert(terrain.group.children.length < 25, 'draw budget');
assert(maxHeight > 1300 && minHeight < -250, 'mountains and deep ice cuts are real geometry');
for (let x = -180; x <= 180; x += 30) for (let z = -180; z <= 180; z += 30) near(terrain.heightAt(x, z), -180);
for (let z = -1800; z <= 0; z += 35) {
  assert(terrain.heightAt(0, z) < -150, 'clear broad approach');
  assert(terrain.heightAt(200, z) < -130, 'approach accommodates a large ship');
}

// Whole-frame crossing at extreme speed: neither point probes nor substeps suffice.
a.set(0, 1400, 0); b.set(0, -2200, 0);
for (const radius of [0, 8, 85, 180]) {
  assert(terrain.sweep(a, b, radius, hit));
  near(hit.point.y, -180 + radius);
  near(hit.fraction, (1400 + 180 - radius) / 3600);
  near(hit.normal.y, 1);
}
a.set(-250, 0, -1800); b.set(250, 0, 0);
assert(!terrain.sweep(a, b, 80, hit), 'safe approach has no phantom collisions');
a.set(-7900, 3000, 500); b.set(7900, 3000, 500);
assert(!terrain.sweep(a, b, 20, hit), 'clear high flyby');
a.set(-7900, 350, 500); b.set(7900, 350, 500);
assert(terrain.sweep(a, b, 45, hit), 'fast horizontal mountain crossing');
assert(hit.fraction > 0 && hit.fraction < 1);
assert(hit.normal.x < -.1, 'first ridge pushes the eastbound ship west');
near(hit.normal.length(), 1);
near(hit.point.distanceTo(a.clone().lerp(b, hit.fraction)), 0);

// Initial penetration returns an actual nonpenetrating sphere center at fraction zero.
for (const [x, z] of [[0, 0], [3050, 630], [-3420, 820]]) {
  a.set(x, terrain.heightAt(x, z) - 60, z); b.copy(a);
  assert(terrain.sweep(a, b, 35, hit));
  assert.equal(hit.fraction, 0);
  assert(hit.point.y > terrain.heightAt(x, z));
  assert(hit.normal.y > 0);
  const recovered = hit.point.clone().addScaledVector(hit.normal, .01);
  assert(!terrain.sweep(recovered, recovered, 35, solidHit()), 'recovery clears neighboring facets');
}
a.set(0, -170, 0); b.copy(a);
assert(terrain.sweep(a, b, 20, hit), 'stationary overlapping sphere');
near(hit.point.y, -160); assert.equal(hit.fraction, 0);
a.set(0, -130, 0); b.copy(a);
assert(!terrain.sweep(a, b, 20, hit), 'stationary clear sphere');

// Finite sides are rendered ice walls, with an outward normal. Beyond them is empty.
assert.equal(terrain.heightAt(8000.01, 0), -Infinity);
assert.equal(terrain.heightAt(-8001, 0), -Infinity);
assert(Number.isFinite(terrain.heightAt(8000, 8000)));
a.set(8300, -1000, 0); b.set(7700, -1000, 0);
assert(terrain.sweep(a, b, 40, hit)); near(hit.point.x, 8040); near(hit.normal.x, 1);
a.set(-8300, -1000, 0); b.set(-7700, -1000, 0);
assert(terrain.sweep(a, b, 40, hit)); near(hit.point.x, -8040); near(hit.normal.x, -1);
a.set(0, -1000, 8300); b.set(0, -1000, 7700);
assert(terrain.sweep(a, b, 40, hit)); near(hit.point.z, 8040); near(hit.normal.z, 1);
a.set(0, -1000, -8300); b.set(0, -1000, -7700);
assert(terrain.sweep(a, b, 40, hit)); near(hit.point.z, -8040); near(hit.normal.z, -1);
a.set(8300, 1000, 0); b.set(8300, -3000, 0);
assert(!terrain.sweep(a, b, 40, hit), 'outside the finite patch stays empty');
// The rounded corner of the finite solid exercises the edge-cylinder root,
// outside both face footprints; a face-only sweep would tunnel here.
a.set(8250, -1000, 8030); b.set(7900, -1000, 8030);
assert(terrain.sweep(a, b, 50, hit));
near(hit.point.x, 8040); near(hit.normal.x, .8); near(hit.normal.z, .6);
a.set(8250, -1000, 8051); b.set(7900, -1000, 8051);
assert(!terrain.sweep(a, b, 50, hit), 'one metre beyond the rounded edge is clear');
a.set(0, -4300, 0); b.set(0, -3700, 0);
assert(terrain.sweep(a, b, 40, hit)); near(hit.point.y, -4040); near(hit.normal.y, -1);

// Independent mesh raycasts must coincide with radius-zero contact, across rugged terrain.
terrain.group.updateMatrixWorld(true);
const raycaster = new THREE.Raycaster();
let rayChecks = 0;
for (let i = 0; i < 60; i++) {
  const x = random() * 15600 - 7800, z = random() * 15600 - 7800;
  a.set(x, 3500, z); b.set(x, -3500, z);
  raycaster.set(a, new THREE.Vector3(0, -1, 0));
  const intersections = raycaster.intersectObject(terrain.group, true);
  assert(intersections.length > 0);
  assert(terrain.sweep(a, b, 0, hit));
  near(hit.point.y, intersections[0].point.y, 1e-4);
  near(hit.point.y, terrain.heightAt(x, z), 1e-4);
  rayChecks++;
}

// Radius changes contact on a slope; a sphere cannot use center-height + radius.
const slope = meshTriangles.find(t => t.getNormal(normal).y > .45 && normal.y < .75);
assert(slope);
slope.getMidpoint(point); slope.getNormal(normal);
a.copy(point).addScaledVector(normal, 300); b.copy(point).addScaledVector(normal, -50);
assert(terrain.sweep(a, b, 12, hit));
near(hit.point.distanceTo(point.clone().addScaledVector(normal, 12)), 0, 1e-4);
assert(hit.normal.dot(normal) > .999);

console.log(JSON.stringify({ terrainTriangles: triangles, draws: terrain.group.children.length, heightSamples, rayChecks, minHeight, maxHeight, sweepCases: 'fast vertical/horizontal, large sphere, flyby, penetration, stationary, four boundaries, underside, exact slope' }));
`, resolveDir: root, sourcefile: 'polar-terrain-check.ts', loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', outfile: output,
  alias: { '@': join(root, 'src') },
});
await import(pathToFileURL(output).href);
