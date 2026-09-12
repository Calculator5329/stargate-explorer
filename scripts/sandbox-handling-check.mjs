import { build } from 'esbuild';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const cache = join(homedir(), '.cache', 'tmp', 'stargate-explorer');
await mkdir(cache, {recursive:true});
const output = join(await mkdtemp(join(cache,'sandbox-handling-')),'check.mjs');
await build({stdin:{contents:`
import assert from 'node:assert/strict';
import {Flight} from '@/sim/flight';
import {Scheme} from '@/core/scheme';
import {T} from '@/core/tunables';
import {HANDLING_PRESETS,handlingTurn,loadHandling,saveHandling} from '@/sim/handling';
import {MOVES} from '@/sim/moves';
import {Vector3} from 'three';
const makeInput=()=>({scheme:Object.assign(new Scheme('classic'),{assistStrength:.9}),stick:{x:0,y:0},pitchKey:0,roll:0,strafe:0,boost:false,space:false,barrel:0,moveFired:false});
const makeFlight=(h,speed=140)=>{const f=new Flight();f.handling=h?{...h}:null;f.speed=speed;f.vel.set(0,0,speed);return f;};
const nose=new Vector3();
const slip=f=>nose.set(0,0,1).applyQuaternion(f.quat).angleTo(f.velDir)*180/Math.PI;
const measures={};
for(const preset of HANDLING_PRESETS){
 const h=preset.values;
 for(const hull of [.65,1,1.4]) for(const speed of [0,40,140,240,420,1000]){
  const a=handlingTurn(h,speed,1),b=handlingTurn(h,speed*hull,hull);
  assert(Number.isFinite(a)&&a>0);assert(Math.abs(a-b)<1e-10,'curve follows hull speed scale');
 }
 const f=makeFlight(h);const input=makeInput();input.stick.x=.65;
 for(let n=0;n<120;n++)f.tick(1/60,input);
 measures[preset.id]={speed:f.speed,slideDegrees:slip(f),turnGain:f.turnGain(false)};
 assert(Number.isFinite(f.pos.length())&&Math.abs(f.quat.length()-1)<1e-8);
 f.reset();assert.equal(f.handling,null,'sortie reset removes sandbox handling');
}
assert(handlingTurn(T.sandboxBrake,45,1)>handlingTurn(T.sandboxBrake,420,1)*2,'slow flight turns much faster');
assert(handlingTurn(T.sandboxSweet,140,1)>handlingTurn(T.sandboxSweet,40,1),'sweet spot beats minimum');
assert(handlingTurn(T.sandboxSweet,140,1)>handlingTurn(T.sandboxSweet,420,1),'sweet spot beats boost');
const grip=makeFlight({...T.sandboxGrip,grip:2.4}),loose=makeFlight({...T.sandboxGrip,grip:.35});
const steer=makeInput();steer.stick.x=.7;
for(let n=0;n<90;n++){grip.tick(1/60,steer);loose.tick(1/60,steer);}
assert(slip(grip)<slip(loose)*.6,'grip actually reduces velocity lag under the same steering');
const brake=makeInput();brake.space=true;
const oldBrake=makeFlight(null,240),strongBrake=makeFlight(T.sandboxBrake,240);
for(let n=0;n<20;n++){oldBrake.tick(1/60,brake);strongBrake.tick(1/60,brake);}
assert(strongBrake.speed<oldBrake.speed-50,'strong brake reaches low speed sooner');
const original=makeFlight(null);assert.equal(original.turnGain(false),1);original.speed=T.flight.minSpeed;assert.equal(original.turnGain(true),T.flight.turnSlowGain);
for(const move of MOVES) for(const preset of HANDLING_PRESETS){
 const base=makeFlight(null),lab=makeFlight(preset.values),input=makeInput();
 base.startMove(move.id);lab.startMove(move.id);
 for(let n=0;n<Math.ceil(move.duration*60);n++){
  base.tick(1/60,input);lab.tick(1/60,input);
  assert(base.pos.distanceTo(lab.pos)<1e-8,move.name+' trajectory unchanged under '+preset.id);
  assert(base.quat.angleTo(lab.quat)<1e-7);assert.equal(base.boostEnergy,lab.boostEnergy);
 }
}
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
let draft=loadHandling();assert(!draft.current);draft.values.turn=1.75;draft.current=true;assert(saveHandling(draft));
assert.deepEqual(loadHandling(),draft,'A/B and custom values survive reload');
store.set('stargate-explorer.sandbox-handling.v1','{"values":{"turn":999,"grip":"bad","sweet":7},"current":"yes"}');
draft=loadHandling();assert.equal(draft.values.turn,2.5);assert.equal(draft.values.grip,T.sandboxGrip.grip);assert.equal(draft.values.sweet,0);assert.equal(draft.current,false);
store.set('stargate-explorer.sandbox-handling.v1','bad JSON');assert.equal(loadHandling().values.turn,T.sandboxGrip.turn);
globalThis.localStorage={getItem:()=>{throw Error('denied')},setItem:()=>{throw Error('denied')}};assert.equal(saveHandling(draft),false);assert.equal(loadHandling().values.turn,T.sandboxGrip.turn);
console.log(JSON.stringify({scriptedProbe:measures,gripSlide:slip(grip),looseSlide:slip(loose),brakeSpeeds:[oldBrake.speed,strongBrake.speed]},null,2));
console.log('PASS: actual Flight traces, slow/sweet curves, hull normalization, grip, brake strength, reset isolation, all 16 preset/move trajectories, saved comparison/custom setup and corrupt/unavailable storage.');
`,resolveDir:root,loader:'ts'},bundle:true,define:{'import.meta.env.DEV':'false'},platform:'node',format:'esm',alias:{'@':join(root,'src')},outfile:output});
await import(pathToFileURL(output).href);
