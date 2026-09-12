import { build } from 'esbuild';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const cache = join(homedir(), '.cache', 'tmp', 'stargate-explorer');
await mkdir(cache, {recursive:true});
const output = join(await mkdtemp(join(cache,'powered-moves-')),'check.mjs');
await build({stdin:{contents:`
import assert from 'node:assert/strict';
import {Input} from '@/core/input';
import {Scheme} from '@/core/scheme';
import {Flight} from '@/sim/flight';
import {MOVES,checkMoves,stepWeight} from '@/sim/moves';
import accepted from '@/../docs/design/sidewinder-before-2026-09-12.json';
import {ChaseCamera} from '@/render/camera';
import {MoveTrails} from '@/fx/move-trails';
import {PerspectiveCamera,Vector3,Quaternion} from 'three';
import {buildShip} from '@/ships/builder';
import {PLAYER_HULL} from '@/ships/variants';
const noop=()=>{};globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>noop})})};
const hull=buildShip(PLAYER_HULL),vertices=[];hull.updateMatrixWorld(true);
hull.traverse(o=>{if(o.geometry&&o.name!=='outline'){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)vertices.push(new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));}});
assert.deepEqual(checkMoves(MOVES),[]);
assert.deepEqual(MOVES.slice(0,2),accepted.moves.slice(0,2),'accepted Cobra/Vortex content is preserved');
for(const dt of [1/30,1/60,1/144]){
 const step={kind:'slide',start:.13,length:1.65,amount:200,ease:'smooth'};
 let displacement=0;
 for(let t=0;t<2;t+=dt)displacement+=stepWeight(step,t,t+dt)*step.amount*dt;
 assert(Math.abs(displacement-330)<1e-7,'smooth displacement independent of sampling interval');
 assert(stepWeight(step,0,.1)===0&&stepWeight(step,1.8,1.9)===0,'inactive outside the timeline');
}
const results=[];
const run=(move,aspect,agility=1)=>{
 const scheme=new Scheme('classic');scheme.assistStrength=.9;
 const input=new Input({},scheme,false,true),f=new Flight();f.vel.set(0,0,150);f.stats.agility=agility;
 const camera=new PerspectiveCamera(62,aspect,.1,30000),chase=new ChaseCamera(camera);
 const trails=new MoveTrails([{pos:[-4,0,-3],length:4,radius:1},{pos:[4,0,-3],length:4,radius:1}]);
 chase.update(0,f.pos,f.quat,f.speed,input.stick,false,99);
 input.moveFired=true;input.move.key=move.trigger.key;input.move.dir=move.trigger.dir;
 let peakSpeed=0,peakSide=0,peakLift=0,turn=0,frames=0,minForward=1,maxDraw=0,maxScreen=0;
 const previous=new Quaternion(),forward=new Vector3(),center=new Vector3(),point=new Vector3();
 const samples=[]; let maxLateralVelocityJump=0,maxRotationStep=0;
 const total=Math.ceil((move.duration+1.5)*60);
 for(let i=0;i<total;i++){
  previous.copy(f.quat); const previousLateralVelocity=f.vel.x;
  f.tick(1/60,input);input.moveFired=false;
  maxLateralVelocityJump=Math.max(maxLateralVelocityJump,Math.abs(f.vel.x-previousLateralVelocity));
  maxRotationStep=Math.max(maxRotationStep,previous.angleTo(f.quat));
  assert(f.pos.toArray().every(Number.isFinite));assert(f.vel.toArray().every(Number.isFinite));
  assert(Math.abs(f.quat.length()-1)<1e-6,'normalized attitude');
  const delta=f.pos.clone().sub(f.prevPos).multiplyScalar(60);
  assert(delta.distanceTo(f.vel)<1e-7,'velocity includes powered translations');
  if(i===0)assert(Math.abs(f.boostEnergy-(1-move.cost))<1e-8,'up-front cost');
  if(f.move)assert(Math.abs(f.boostEnergy-(1-move.cost))<1e-8,'no recharge during stunt');
  if(i<move.duration*60){
   peakSpeed=Math.max(peakSpeed,f.speed);peakSide=Math.max(peakSide,Math.abs(f.pos.x));peakLift=Math.max(peakLift,Math.abs(f.pos.y));
   turn+=previous.angleTo(f.quat);forward.set(0,0,1).applyQuaternion(f.quat);minForward=Math.min(minForward,forward.z);
  }
  chase.update(1/60,f.pos,f.quat,f.speed,input.stick,f.moveThrust,99,1,false,f.move?f.moveT/f.move.duration:-1);
  camera.updateMatrixWorld();
  center.copy(f.pos).project(camera);maxScreen=Math.max(maxScreen,Math.abs(center.x),Math.abs(center.y));
  // Project the actual built fighter vertices, not an oversized rectangular proxy.
  for(const vertex of vertices){
   point.copy(vertex).applyQuaternion(f.quat).add(f.pos).project(camera);
   assert(point.z<1&&point.z>-1,'ship stays in front of camera');
   assert(Math.abs(point.x)<1.05&&Math.abs(point.y)<1.05,move.name+' framing '+aspect+' at '+i+': '+point.toArray());
  }
  trails.update(1/60,f.move!==null,f.pos,f.quat);
  assert.equal(trails.group.children.length,2);
  for(const mesh of trails.group.children){assert(mesh.geometry.drawRange.count<=95*6);maxDraw=Math.max(maxDraw,mesh.geometry.drawRange.count);assert(mesh.geometry.attributes.position.array.every(Number.isFinite));}
  if(i%6===0)samples.push({t:i/60,pos:f.pos.toArray(),q:f.quat.toArray(),camera:camera.position.toArray()});
  frames++;
 }
 assert(maxDraw>0,'ribbons show trajectory');
 for(const mesh of trails.group.children)assert.equal(mesh.geometry.drawRange.count,0,'ribbons expire after stunt');
 assert.equal(f.move,null);assert.equal(f.moveThrust,false);
 assert(f.boostEnergy>1-move.cost,'normal recharge resumes');
 if(move.id==='cobra'){assert(minForward<-.98,'full reversal');assert(peakLift>50,'vertical pop');assert(f.vel.z<0,'exits in opposite direction');}
 if(move.id==='lunge'){assert(turn>Math.PI*3.9,'two complete rolls');assert(peakSpeed>750,'super-boost speed');assert(peakLift>35,'corkscrew has a real radius');}
 if(move.id.startsWith('scissor')){assert(turn>Math.PI*2.7,'bank, full corkscrew and recovery');assert(peakSide>300,'large vector-thrust displacement');assert(maxLateralVelocityJump<13,'lateral thrust starts and ends smoothly');assert(maxRotationStep<.17,'rotation no longer snaps between stages');assert(f.quat.angleTo(new Quaternion())<.05,'sidewinder recovers entry heading');}
 trails.dispose();
 return {id:move.id,aspect,agility,peakSpeed,peakSide,peakLift,turnDegrees:turn*180/Math.PI,maxScreen,maxLateralVelocityJump,maxRotationStep,frames,samples};
};
for(const move of MOVES){for(const aspect of [16/9,4/5])results.push(run(move,aspect));run(move,16/9,.7);}
const left=results.find(r=>r.id==='scissor-left'),right=results.find(r=>r.id==='scissor-right');
for(let i=0;i<left.samples.length;i++){const a=left.samples[i].pos,b=right.samples[i].pos;assert(Math.abs(a[0]+b[0])<1e-7&&Math.abs(a[1]-b[1])<1e-7&&Math.abs(a[2]-b[2])<1e-7,'Sidewinders mirror their actual path');}
console.log('PASS: smooth mirrored Sidewinders, preserved accepted move content, paid multi-stage trajectories, real vector thrust, 180-degree reversal, 720-degree helix, mirrored cuts, all-hull rotation, landscape/portrait camera fit, bounded fading ribbons.');
export default results;
`,resolveDir:root,loader:'ts'},bundle:true,define:{'import.meta.env.DEV':'false'},platform:'node',format:'esm',alias:{'@':join(root,'src')},outfile:output});
const results=(await import(pathToFileURL(output).href)).default;
await writeFile(join(cache,'powered-moves-measurements.json'),JSON.stringify(results,null,2));
for(const {samples,...summary} of results)console.log(JSON.stringify(summary));
