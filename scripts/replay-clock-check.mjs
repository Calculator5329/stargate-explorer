/** CPU-side replay clock and restoration checks; visual acceptance still requires a browser capture. */
import { build } from 'esbuild';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const cache = join(homedir(), '.cache', 'tmp', 'stargate-explorer');
await mkdir(cache, { recursive: true });
const run = await mkdtemp(join(cache, 'replay-clock-check-'));
const output = join(run, 'check.mjs');
await build({
  stdin: {
    contents: `
import assert from 'node:assert/strict';
import { Replay } from '@/replay/replay';
import { T } from '@/core/tunables';
import { Explosions } from '@/fx/explosion';
import { Vector3, Quaternion, Object3D, PerspectiveCamera } from 'three';
const replay = new Replay(), liveFX = new Explosions();
const camera = new PerspectiveCamera(73), ship = new Object3D();
const flight = { pos: new Vector3(), quat: new Quaternion(), barrelLeft: 0, speed: 120, boosting: false };
let plumeTime = 0;
const enemy = id => ({ id, alive: true, pos: new Vector3(id * 12, 0, 30), quat: new Quaternion(),
  rig: { root: new Object3D(), update(dt) { plumeTime += dt; } } });
const victim = enemy(0), survivor = enemy(1), enemies = [victim, survivor];
const velocity = new Vector3(0, 0, 100), dt = 1 / 60;
const snapshot = fx => fx.group.children.map(mesh => ({ visible: mesh.visible,
  matrix: [...mesh.instanceMatrix.array], color: mesh.instanceColor ? [...mesh.instanceColor.array] : null }));
let killTime = 0;
for (let tick = 1; tick <= 360; tick++) {
  replay.beginTick(dt);
  flight.pos.z += flight.speed * dt;
  if (victim.alive) victim.pos.z += 100 * dt;
  survivor.pos.z += 80 * dt;
  if (tick === 120) {
    victim.alive = false;
    const seed = liveFX.spawn(victim.pos, velocity, 7, 42319);
    replay.markKill(victim.pos, velocity, flight, { x: 0, y: 0 }, 7, seed);
    killTime = tick * dt;
  }
  replay.record(dt, flight, enemies);
}
assert(replay.hasHighlight, 'recorded kill produces a playable clip');
const liveBefore = snapshot(liveFX);
const survivorPos = survivor.pos.clone(), survivorQuat = survivor.quat.clone();
const victimPos = victim.pos.clone();
let emitted = 0, eventClock = 0;
replay.onBurst = () => { emitted++; eventClock = replay.clipT; };
// Deliberately step to an exact post-kill observation. Dividing by the public rate
// keeps this a playback-clock check even when slow motion changes the wall clock.
function playTo(target, step) {
  assert(replay.play(camera));
  while (replay.clipT < target - 1e-10) {
    const advance = Math.min(step, target - replay.clipT);
    assert(replay.update(advance / replay.playbackRate, camera, ship, enemies));
  }
}
playTo(killTime - 0.001, 0.05);
assert.equal(emitted, 0, 'no destruction before the killing simulation tick');
assert(victim.rig.root.visible, 'victim visible before the killing tick');
replay.update(0.002 / replay.playbackRate, camera, ship, enemies);
assert.equal(emitted, 1, 'burst occurs at the killing tick');
assert(Math.abs(eventClock - killTime) <= 0.0011, 'beginTick aligns event to recorded death');
assert.equal(victim.rig.root.visible, false, 'victim hidden at destruction');
assert(plumeTime > 0, 'enemy exhaust advances during playback');
assert.deepEqual(snapshot(liveFX), liveBefore, 'replay leaves live explosion pool untouched');
replay.stop(camera, enemies);
assert.equal(camera.fov, 73, 'stop restores gameplay FOV');
assert.equal(survivor.rig.root.visible, true, 'stop restores live enemy visibility');
assert(survivor.rig.root.position.equals(survivorPos), 'stop restores live enemy position');
assert(survivor.rig.root.quaternion.equals(survivorQuat), 'stop restores live enemy attitude');
assert.equal(victim.rig.root.visible, false, 'stop keeps the dead enemy hidden');
assert(victim.rig.root.position.equals(victimPos), 'stop restores dead enemy position too');
assert.equal(replay.fx.strongestLight(new Vector3()), 0, 'stop clears replay light');
assert.equal(replay.group.visible, false, 'stop hides replay visuals');
let reference;
for (const step of [0.025, 0.025, 0.125]) {
  playTo(killTime + 0.25, step);
  assert(replay.fx.strongestLight(new Vector3()) > 0, 'sample contains an active destruction effect');
  const result = snapshot(replay.fx);
  if (reference) assert.deepEqual(result, reference, 'repeated playback reconstructs equal-time FX across render step sizes');
  else reference = result;
  assert.deepEqual(snapshot(liveFX), liveBefore, 'repeat playback preserves live effects');
  replay.stop(camera, enemies);
}
assert(survivor.pos.equals(survivorPos), 'playback never writes simulation position');
assert(survivor.quat.equals(survivorQuat), 'playback never writes simulation attitude');
// Continuous multi-kill clips: enforce both bounds and retain the post-kill player footage.
function sequence(times, maxKills, windowSeconds) {
  T.replay.maxKills = maxKills; T.replay.windowSeconds = windowSeconds;
  const r = new Replay(), es = times.map((_, i) => enemy(i));
  const f = { ...flight, pos: new Vector3(), quat: new Quaternion() };
  for (let tick = 1; tick <= Math.ceil((times.at(-1) + 3.1) * 60); tick++) {
    r.beginTick(dt); f.pos.z = tick * 2;
    for (const e of es) {
      e.pos.set(e.id * 35, 0, f.pos.z + 120);
      if (tick === Math.round(times[e.id] * 60)) {
        e.alive = false;
        r.markKill(e.pos, velocity, f, {x:0,y:0}, 7, 800+e.id, e.id);
      }
    }
    r.record(dt, f, es);
  }
  return { r, es };
}
for (const [times, cap, seconds, expected] of [
  [[8,10,12],3,8,3], [[8,10,12,14],2,8,2], [[8,10,12],8,3,2],
  [[8,10,12],1,8,1], [[8,16],3,8,2], [[8,16.1],3,8,1],
  [[8,12,16,20,24,28,32,36],8,30,8],
]) {
  const {r,es} = sequence(times,cap,seconds);
  assert.equal(r.highlightKills,expected,'kill count and time window both constrain capture');
  const h = r.highlight;
  assert.equal(h.bursts.filter(b=>b.kill).length,expected,'pre-roll cannot leak excluded kills');
  assert(h.frames[(h.count-1)*152] >= times.at(-1)+2.95,'retains three seconds after latest death');
  assert(h.frames[0] <= times[times.length-expected]+.02,'retains first included death');
  for (const aspect of [16/9, .7]) {
    camera.aspect=aspect; camera.updateProjectionMatrix();
    let bursts=0; r.onBurst=()=>bursts++;
    assert(r.play(camera));
    while (r.playing) {
      r.update(dt/r.playbackRate,camera,ship,es);
      if (!r.playing) break;
      camera.updateMatrixWorld(true);
      for (const {event} of h.kills) if (Math.abs(r.clipT-event.t)<.35) {
        const pp=ship.position.clone().project(camera);
        assert(Math.abs(pp.x)<.95 && Math.abs(pp.y)<.95 && pp.z<1,'player framed through kill');
        const victim=es[event.victimId];
        const target = r.clipT < event.t ? victim.rig.root.position : event.pos.clone().addScaledVector(event.vel,r.clipT-event.t);
        const ep=target.clone().project(camera);
        assert(Math.abs(ep.x)<.95 && Math.abs(ep.y)<.95 && ep.z<1,'victim/debris framed through kill');
      }
      if (r.clipT>times.at(-1)+2) {
        const pp=ship.position.clone().project(camera);
        assert(Math.abs(pp.x)<.05 && Math.abs(pp.y)<.05,'ending follows player');
      }
    }
    assert.equal(bursts,expected,'every selected kill replays once');
  }
}
console.log('PASS: N/X limits, window boundaries, long capture, each kill emitted, paired framing in landscape/portrait, player follow-through.');
console.log('PASS: kill/death clock alignment, repeated equal-time seeded FX, enemy exhaust clock, stop pose/FOV/visibility restoration, live FX preservation.');
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
