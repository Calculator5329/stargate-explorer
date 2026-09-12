// Build the real episode assets in Node. Browser captures remain the art-quality check.
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const result=await build({stdin:{resolveDir:root,loader:'ts',contents:`
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildShip} from '@/ships/builder';
import {CARRIER_SHIP,CARGO_SHIP,RACE_TRANSPORT_SHIP} from '@/ships/episode-earth';
import {buildAncientWarship,buildHammerCruiser,buildFlagship,buildSuperweapon,buildScienceCruiser} from '@/ships/episode-alien';
import {buildMachineShip,buildInfestation} from '@/ships/episode-machine';
import {buildPolarSet,buildSupergate,buildDronePaths} from '@/ships/episode-scenes';
const builders={carrier:()=>buildShip(CARRIER_SHIP),cargo:()=>buildShip(CARGO_SHIP),civilian:()=>buildShip(RACE_TRANSPORT_SHIP),ring:buildAncientWarship,hammer:buildHammerCruiser,science:buildScienceCruiser,flagship:buildFlagship,superweapon:buildSuperweapon,machine:buildMachineShip,infestation:buildInfestation,polar:buildPolarSet,supergate:buildSupergate,drones:buildDronePaths};
for(const [name,build] of Object.entries(builders)) {
 const group=build();group.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3());
 assert(!bounds.isEmpty()&&size.toArray().every(n=>Number.isFinite(n)&&n>0),name+': nonempty finite bounds');
 let triangles=0,meshes=0,instances=0;
 group.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  meshes++;
  const geometry=object.geometry,position=geometry.getAttribute('position');
  assert(position&&position.count>0,name+': mesh contains vertices');
  for(const attribute of Object.values(geometry.attributes)) assert(Array.from(attribute.array).every(Number.isFinite),name+': finite geometry attributes');
  assert(object.matrixWorld.elements.every(Number.isFinite),name+': finite world transform');
  let count=1;
  if(object instanceof THREE.InstancedMesh){count=object.count;instances+=count;assert(count>0,name+': nonempty instance batch');assert(Array.from(object.instanceMatrix.array.slice(0,count*16)).every(Number.isFinite),name+': finite instance transforms');}
  triangles+=(geometry.index?geometry.index.count:position.count)/3*count;
 });
 assert(meshes>0&&triangles>0,name+': renderable solids');
 console.log(JSON.stringify({asset:name,geometry:'pass',meshes,instances,triangles,extent:size.toArray().map(n=>+n.toFixed(2))}));
}
// A fleet-sized ring needs an actual open center, not a disk hidden by camera choice.
const gate=buildSupergate(false);gate.updateMatrixWorld(true);
const ray=new THREE.Raycaster(new THREE.Vector3(0,0,300),new THREE.Vector3(0,0,-1));
assert.equal(ray.intersectObject(gate,true).length,0,'inactive Supergate center remains open');
ray.set(new THREE.Vector3(112,0,300),new THREE.Vector3(0,0,-1));
assert(ray.intersectObject(gate,true).length>0,'Supergate rim is solid');
// Machine blocks remain stable across builds, so captures and later fragments can reproduce.
for(const build of [buildMachineShip,buildInfestation]){
 const batches=g=>{const out=[];g.traverse(o=>{if(o instanceof THREE.InstancedMesh)out.push(Array.from(o.instanceMatrix.array));});return out;};
 assert.deepEqual(batches(build()),batches(build()),'deterministic machine assemblies');
}
console.log('PASS: real asset geometry, finite transforms, open Supergate and deterministic machine instances. Visual quality is checked separately.');
`},bundle:true,format:'esm',platform:'node',write:false,alias:{'@':root+'src'}});
await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
