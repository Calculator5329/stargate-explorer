import { build } from 'esbuild';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const cache = join(homedir(), '.cache', 'tmp', 'stargate-explorer');
await mkdir(cache, {recursive:true});
const output = join(await mkdtemp(join(cache,'replay-evaluation-')),'check.mjs');
await build({stdin:{contents:`
import assert from 'node:assert/strict';
import {SceneReview} from '@/render/scene-review';
import {Replay} from '@/replay/replay';
import {Combat} from '@/combat/combat';
import {Enemies} from '@/combat/enemies';
import {Flight} from '@/sim/flight';
import {Input} from '@/core/input';
import {Scheme} from '@/core/scheme';
import {T} from '@/core/tunables';
import {Object3D,PerspectiveCamera,Vector3} from 'three';
const noop=()=>{};
globalThis.document={createElement:()=>({style:{},setAttribute:noop,getContext:()=>new Proxy({},{get:()=>noop})}),body:{append:noop}};
globalThis.window={addEventListener:noop};
const audio=new Proxy({},{get:()=>noop});
let scene;
const reset=()=>{
 const flight=new Flight(),input=new Input({},new Scheme('arcade'),false,true),camera=new PerspectiveCamera(60,16/9);
 const rocks={count:0,centers:new Float32Array(),radii:new Float32Array(),vel:new Float32Array(),tick:noop};
 const enemies=new Enemies(rocks),combat=new Combat(enemies,rocks,new Object3D(),audio),replay=new Replay();
 combat.setShip(flight);
 combat.onKill=(p,v,s,seed,id)=>replay.markKill(p,v,flight,{x:0,y:0},s,seed,id);
 combat.onFire=(p,v)=>replay.markShot(p,v);
 scene={flight,input,camera,game:{combat,enemies,replay,mission:{clock:0}}};
};
reset();
const review=new SceneReview(()=>scene,reset,{phase:'idle'},{settings:{eventLighting:false}},audio);
const actions=globalThis.reviewActions;
assert(!actions['Play whole gate trip'],'approved gate controls removed');
const originalArena=T.arena.radius;
for(const label of ['Play whole replay','Play multi-kill encounter']){
 actions[label]();
 assert.equal(review.paused,false,label+' starts moving');
 const {game,camera}=scene;
 assert.equal(game.combat.player.kills,label.includes('multi')?3:1,'real simulation fixture kills');
 assert.equal(game.replay.highlightKills,label.includes('multi')?3:1,'fixture captures every kill');
 assert.equal(T.arena.radius,originalArena,'temporary fixture arena restored');
 let frames=0,previous=-1,stationaryCamera=0;
 while(game.replay.playing && frames<2400){
  const pos=camera.position.clone();
  game.replay.update(review.frameDt(1/60),camera,game.combat.ship,game.enemies.list);
  assert(camera.position.toArray().every(Number.isFinite),'finite camera throughout playback');
  if(game.replay.playing){assert(game.replay.progress>previous,'whole replay advances every frame');previous=game.replay.progress;}
  if(pos.distanceTo(camera.position)<.001) stationaryCamera++;
  review.report('replay');frames++;
 }
 assert(frames<2400,'whole replay finishes');

 assert(stationaryCamera>20,'world-space camera stays parked while player flies');
 assert.equal(review.paused,true,'fixture holds after completion instead of silently flying away');
 actions['Play player follow-through']();
 assert.equal(review.paused,false,'follow-through plays instead of freezing');
 assert(game.replay.progress>.65,'follow-through seeks after final kill');
 const start=game.replay.progress;
 game.replay.update(review.frameDt(.1),camera,game.combat.ship,game.enemies.list);
 assert(game.replay.progress>start,'follow-through advances');
 game.replay.stop(camera,game.enemies.list);
}
console.log('PASS: real simulated single/three-kill fixtures, play/freeze control semantics, advancing whole replay, parked camera, follow-through playback, completion hold.');
`,resolveDir:root,loader:'ts'},bundle:true,define:{'import.meta.env.DEV':'false'},platform:'node',format:'esm',alias:{'@':join(root,'src')},outfile:output,
plugins:[{name:'gui-controls',setup(b){b.onResolve({filter:/lil-gui/},()=>({path:'gui',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`
globalThis.reviewActions={};
export default class GUI {addFolder(){return this;} add(obj,key){const control={name(label){if(typeof obj[key]==='function')globalThis.reviewActions[label]=()=>obj[key]();return control;},listen(){return control;},onChange(){return control;}};return control;}}
`,loader:'js'}));}}]});
await import(pathToFileURL(output).href);
