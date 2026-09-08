import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';

// Exercise ownership and scheduling without claiming acoustic quality from a mock.
class Param {
  value = 0;
  setValueAtTime(v) { this.value = v; }
  setTargetAtTime(v) { this.value = v; }
  linearRampToValueAtTime(v) { this.value = v; }
  exponentialRampToValueAtTime(v) { this.value = v; }
  cancelScheduledValues() {}
}
class Node {
  gain = new Param(); frequency = new Param(); Q = new Param();
  detune = new Param(); playbackRate = new Param(); offset = new Param();
  connections = []; stops = [];
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
  start(time) { this.started = time; }
  stop(time) { this.stops.push(time); }
}
class Context {
  currentTime = 1; sampleRate = 100; destination = new Node(); state = 'running';
  createGain() { return new Node(); }
  createOscillator() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createBufferSource() { return new Node(); }
  createConstantSource() { return new Node(); }
  createBuffer() { return { getChannelData: () => new Float32Array(200) }; }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
globalThis.AudioContext = Context;
globalThis.window = { addEventListener() {} };
const source = fs.readFileSync(new URL('../src/audio/audio.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { Audio } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const audio = new Audio();
assert.equal(audio.muted, false);
const muteChanges = [];
audio.onMuteChanged = muted => muteChanges.push(muted);
audio.setMute(true);
assert.equal(audio.muted, true);
assert.deepEqual(muteChanges, [true]);
audio.setMute(true);
assert.deepEqual(muteChanges, [true]);
audio.setScene('flight');
audio.unlock();
audio.cannon();
audio.win();
assert.equal(audio.voices.size, 6);
const flightVoices = [...audio.voices];
audio.setScene('travel');
assert.equal(audio.voices.size, 0);
assert(flightVoices.every(v => v.source.stops.at(-1) === undefined));
assert.equal(audio.buses.flight.gain.value, 0);
audio.setMood('combat');
assert.equal(audio.buses.flight.gain.value, 0);
audio.cannon();
assert.equal(audio.voices.size, 0);
audio.chevron(1, false);
audio.wormhole(4);
assert.equal(audio.voices.size, 6);
audio.setScene('paused');
assert.equal(audio.ctx.state, 'suspended');
assert.equal(audio.voices.size, 6);
audio.unlock();
assert.equal(audio.ctx.state, 'suspended');
audio.setScene('travel');
assert.equal(audio.ctx.state, 'running');
assert.equal(audio.voices.size, 6);
audio.setScene('replay');
assert.equal(audio.voices.size, 0);
audio.replayExplosion(1, 0.25);
assert.equal(audio.voices.size, 2);
assert([...audio.voices].every(v => v.rate === 0.25));
audio.ctx.currentTime += 0.1;
audio.setReplayRate(1);
assert([...audio.voices].every(v => v.rate === 1));
audio.setScene('paused');
audio.replayShot();
audio.ui();
assert.equal(audio.voices.size, 2);
audio.setScene('hub');
assert.equal(audio.ctx.state, 'running');
assert.equal(audio.voices.size, 0);
assert.equal(audio.buses.replay.gain.value, 0);
audio.setMute(false);
assert.equal(audio.master.gain.value, 0.5);
assert.deepEqual(muteChanges, [true, false]);
console.log('PASS: bus isolation, scheduled-tail cancellation, replay rate changes, pause/resume, pre-unlock scene and mute persistence callback.');
