import { build } from 'esbuild';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const cache=join(homedir(),'.cache','tmp','stargate-explorer');await mkdir(cache,{recursive:true});
const outfile=join(await mkdtemp(join(cache,'audio-scene-')),'check.mjs');
await build({stdin:{contents:`
import assert from 'node:assert/strict';
import {Audio} from '@/audio/audio';
import {T} from '@/core/tunables';
import {loadSave,writeSave} from '@/core/save';
class Param {value=0; events=[]; setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t]);} setTargetAtTime(v,t){this.value=v;this.events.push(['target',v,t]);} linearRampToValueAtTime(v,t){this.value=v;this.events.push(['linear',v,t]);} exponentialRampToValueAtTime(v,t){this.value=v;this.events.push(['exp',v,t]);} cancelScheduledValues(){} }
class Node {
 gain=new Param();frequency=new Param();Q=new Param();detune=new Param();playbackRate=new Param();offset=new Param();threshold=new Param();ratio=new Param();knee=new Param();attack=new Param();release=new Param();delayTime=new Param();pan=new Param();
 connections=[];stops=[];connect(n){this.connections.push(n);return n;}disconnect(){this.connections=[];}start(t){this.started=t;}stop(t){this.stops.push(t);}
}
class Context {
 currentTime=1;sampleRate=100;destination=new Node();state='running';
 createGain(){return new Node();}createOscillator(){return new Node();}createBiquadFilter(){return new Node();}createBufferSource(){return new Node();}createConstantSource(){return new Node();}createDynamicsCompressor(){return new Node();}createDelay(){return new Node();}createStereoPanner(){return new Node();}
 createBuffer(){return {getChannelData:()=>new Float32Array(200)};}decodeAudioData(){return Promise.resolve({duration:2});}
 suspend(){this.state='suspended';return Promise.resolve();}resume(){this.state='running';return Promise.resolve();}
}
globalThis.AudioContext=Context;globalThis.window={addEventListener(){}};
globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)});
const audio=new Audio(),muteChanges=[];audio.onMuteChanged=m=>muteChanges.push(m);audio.setMute(true);audio.setMute(true);assert.deepEqual(muteChanges,[true]);
audio.setMix({master:.4,effects:.7,engines:.2,music:0});audio.setScene('flight');audio.unlock();
// Before decoding, the existing synthesis is a real fallback.
audio.cannon();assert(audio.voices.size>0);assert([...audio.voices].every(v=>!v.sampled));
const before=[...audio.voices];audio.setScene('travel');assert.equal(audio.voices.size,0);assert(before.every(v=>v.source.stops.at(-1)===undefined));
await audio.bank.ready;assert.equal(audio.bank.buffers.size,27);assert.equal(audio.bank.failed,0);assert(audio.engineBed&&audio.boostBed);
assert.equal(audio.engineMix.gain.value,.2);assert.equal(audio.musicMix.gain.value,0);assert.equal(audio.effects.flight.gain.value,.7);assert.equal(audio.master.gain.value,0);
audio.wormhole(1.4);assert([...audio.voices].every(v=>v.source.playbackRate.value<=1.25),'short arrivals retain a bounded pitch');audio.setScene('hub');audio.setScene('travel');audio.chevron(1,false);audio.wormhole(4);assert([...audio.voices].every(v=>v.sampled&&v.bus==='travel'));const travelling=[...audio.voices];
audio.setScene('paused');assert.equal(audio.ctx.state,'suspended');audio.unlock();assert.equal(audio.ctx.state,'suspended');audio.ui();assert.equal(audio.voices.size,travelling.length);
audio.setScene('travel');assert.equal(audio.ctx.state,'running');assert.equal(audio.voices.size,travelling.length);
audio.cannon();assert.equal(audio.voices.size,travelling.length,'flight cannot leak into travel');
audio.setScene('replay');assert.equal(audio.voices.size,0);assert(travelling.every(v=>v.source.stops.at(-1)===undefined));
audio.replayExplosion(1,.25);let v=[...audio.voices][0];assert(v.sampled);assert.equal(v.rate,.25);assert.equal(v.source.detune.value,-2400);const level=v.gain.gain.value;
audio.ctx.currentTime+=.5;audio.setReplayRate(1);assert.equal(v.rate,1);assert.equal(v.gain.gain.value,level,'sample envelope is not faded twice on replay rate change');assert.equal(v.remaining,1.875);assert.equal(v.source.detune.value,0);
audio.setScene('flight');audio.setMute(false);assert.equal(audio.master.gain.value,.4,'unmute retains saved master volume');
audio.cannon();audio.cannon();audio.cannon();assert.equal(new Set([...audio.voices].map(v=>v.source.buffer)).size,3,'successive shots use three different buffers');
audio.move('cobra');const n=audio.voices.size;audio.move('cobra');assert.equal(audio.voices.size,n,'render frames cannot repeat the move cue');audio.move(null);audio.move('cobra');assert.equal(audio.voices.size,n+1);
audio.update(.8,true);assert(audio.engineBedGain.gain.value>0);assert(audio.boostBedGain.gain.value>0);assert.equal(audio.engineGain.gain.value,0);assert.equal(audio.boostGain.gain.value,0,'new engine beds replace the fallback loops');
for(let i=0;i<200;i++)audio.explosion(1);assert.equal(audio.voices.size,T.audio.maxVoices,'overlap stays bounded');
audio.setCinematic(false);assert.equal(audio.engineBedGain.gain.value,0);audio.cannon();assert([...audio.voices].some(v=>!v.sampled),'original synthesis remains available');
audio.setScene('hub');assert.equal(audio.voices.size,0);assert.equal(audio.buses.flight.gain.value,0);assert.equal(audio.buses.replay.gain.value,0);
globalThis.fetch=async()=>({ok:false,status:404});const fallback=new Audio();fallback.setScene('flight');fallback.unlock();await fallback.bank.ready;assert.equal(fallback.bank.failed,27);fallback.cannon();assert(fallback.voices.size>0);assert([...fallback.voices].every(v=>!v.sampled));
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};let save=loadSave();save.settings.masterVolume=.33;save.settings.engineVolume=.22;writeSave(save);save=loadSave();assert.equal(save.settings.masterVolume,.33);assert.equal(save.settings.engineVolume,.22);
store.set('stargate-explorer.save.v1',JSON.stringify({settings:{masterVolume:8,effectsVolume:-1,engineVolume:'bad',musicVolume:null},progress:{missions:{keep:{completions:2}}}}));save=loadSave();assert.equal(save.settings.masterVolume,1);assert.equal(save.settings.effectsVolume,0);assert.equal(save.settings.engineVolume,T.audio.engines);assert.equal(save.settings.musicVolume,T.audio.music);assert.equal(save.progress.missions.keep.completions,2);
console.log('PASS: decoded sample and synth fallback paths, 27 assets, mix/mute persistence, scene isolation, pause/resume, sampled replay timing, variation, one cue per trick, replaced engine beds, 48-voice bound, failed downloads and corrupt saved mix. Scheduling mock does not establish acoustic quality.');
`,resolveDir:root,loader:'ts'},bundle:true,define:{'import.meta.env.DEV':'false'},platform:'node',format:'esm',alias:{'@':join(root,'src')},outfile});
await import(pathToFileURL(outfile).href);
