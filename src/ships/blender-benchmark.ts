/** Isolated review entry point. Deliberately not imported by ShipRig or the hull registry. */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadShipGLTF } from '@/ships/loader';
import { buildShip } from '@/ships/builder';
import { GLIDER_ORIGINAL, GLIDER_REVISED } from '@/combat/glider-def';
import { toonMaterial, glowMaterial } from '@/render/toon';
import { outlineShell } from '@/render/outline';

const q=new URLSearchParams(location.search),kind=q.get('kind')??'blender',view=q.get('view')??'perspective';
const native=q.get('material')==='pbr',silhouette=view==='silhouette';
const imported=await loadShipGLTF('/benchmarks/death-glider.glb');
const original=buildShip(GLIDER_ORIGINAL),current=buildShip(GLIDER_REVISED);
const groups={original,current,blender:imported};
const group=groups[kind as keyof typeof groups]??imported;
const bounds=new THREE.Box3();for(const g of Object.values(groups))bounds.union(new THREE.Box3().setFromObject(g));
const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
const extent=Math.max(size.x,size.y,size.z)*.57;
const scene=new THREE.Scene();scene.background=new THREE.Color(silhouette?0xe9edf0:0x111820);scene.add(group);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace;
document.body.append(renderer.domElement);
const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();
const mats:Record<string,THREE.Material>={alloy:toonMaterial(GLIDER_REVISED.palette.body),brass:toonMaterial(GLIDER_REVISED.palette.accent),recess:toonMaterial(GLIDER_REVISED.palette.dark),canopy:toonMaterial(GLIDER_REVISED.palette.canopy),engine:glowMaterial(GLIDER_REVISED.palette.glow)};
const importedMeshes:THREE.Mesh[]=[];imported.traverse(o=>{if(o instanceof THREE.Mesh)importedMeshes.push(o)});
for(const o of importedMeshes){
 if(!native){const m=o.material as THREE.Material;o.material=mats[m.name]??mats.alloy!;}
 if(!native){const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry;const shell=outlineShell(geo.attributes.position!.array);shell.position.copy(o.position);shell.quaternion.copy(o.quaternion);shell.scale.copy(o.scale);o.parent!.add(shell);if(geo!==o.geometry)geo.dispose();}
}
if(silhouette)group.traverse(o=>{if(o instanceof THREE.Mesh){if(o.name==='outline'||o.name==='decal')o.visible=false;else o.material=new THREE.MeshBasicMaterial({color:0x111820})}});
const key=new THREE.DirectionalLight(0xfff3db,2.7);key.position.set(60,90,100);scene.add(key);
scene.add(new THREE.HemisphereLight(0xc3d8f5,0x465365,1.2));
const rim=new THREE.DirectionalLight(0x91b8df,1.1);rim.position.set(-60,20,-70);scene.add(rim);
const aspect=innerWidth/innerHeight;const camera=new THREE.OrthographicCamera(-extent*aspect,extent*aspect,extent,-extent,.1,1000);
camera.layers.enable(1);
const direction=view==='top'||silhouette?new THREE.Vector3(0,1,0):view==='side'?new THREE.Vector3(1,0,0):view==='front'?new THREE.Vector3(0,0,1):view==='rear'?new THREE.Vector3(0,0,-1):new THREE.Vector3(1,.7,1.2).normalize();
if(view==='top'||silhouette)camera.up.set(0,0,1);camera.position.copy(center).addScaledVector(direction,extent*5);camera.lookAt(center);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(center);controls.enableDamping=false;controls.update();
function render():void{renderer.render(scene,camera)}
controls.addEventListener('change',render);render();
document.body.dataset.ready='true';document.body.dataset.triangles=String(renderer.info.render.triangles);document.body.dataset.calls=String(renderer.info.render.calls);
document.body.dataset.anchors=JSON.stringify(['engine_port','engine_starboard','muzzle_port','muzzle_starboard'].map(n=>({name:n,pos:imported.getObjectByName(n)?.getWorldPosition(new THREE.Vector3()).toArray()})));
if(q.get('capture')!=='1')document.getElementById('hint')!.textContent='Isolated benchmark · drag to orbit · wheel to zoom · no fleet changes';
window.addEventListener('resize',()=>{const a=innerWidth/innerHeight;camera.left=-extent*a;camera.right=extent*a;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);render()});
