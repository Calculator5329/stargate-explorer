import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, Quaternion, ShaderMaterial, Vector3 } from 'three';
import type { EngineDef } from '@/ships/defs';
import { T } from '@/core/tunables';
import { noEdge } from '@/render/layers';

const SAMPLES = 96;
const _point = new Vector3(), _side = new Vector3();

/** Two bounded engine ribbons make powered trajectories visible; no ordinary-flight exhaust history. */
export class MoveTrails {
  readonly group = new Group();
  private clock = 0;
  private head = 0;
  private count = 0;
  private readonly times = new Float32Array(SAMPLES);
  private readonly ribbons;
  private readonly material = new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending,
    vertexShader: `varying vec2 vUv;
      void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv;
      void main(){
        float edge=pow(max(0.0,1.0-abs(vUv.x)),1.5);
        float fade=pow(max(0.0,1.0-vUv.y),2.0);
        vec3 color=mix(vec3(.12,.55,1.5),vec3(1.1,1.9,2.2),edge);
        gl_FragColor=vec4(color,edge*fade*.6);
      }`,
  });

  constructor(engines: EngineDef[]) {
    // Outer engines preserve the ship's width/roll, with at most two extra draw calls.
    const sorted = [...engines].sort((a,b) => a.pos[0]-b.pos[0]);
    const selected = sorted.length > 1 ? [sorted[0]!,sorted[sorted.length-1]!] : sorted;
    this.ribbons = selected.map(engine => {
      const geometry = new BufferGeometry();
      const positions = new Float32Array(SAMPLES*6), uvs = new Float32Array(SAMPLES*4);
      const indices: number[] = [];
      for(let i=0;i<SAMPLES-1;i++) { const a=i*2; indices.push(a,a+1,a+2,a+1,a+3,a+2); }
      geometry.setAttribute('position',new BufferAttribute(positions,3));
      geometry.setAttribute('uv',new BufferAttribute(uvs,2));
      geometry.setIndex(indices);
      geometry.setDrawRange(0,0);
      const mesh=noEdge(new Mesh(geometry,this.material));
      mesh.frustumCulled=false;
      this.group.add(mesh);
      return { geometry, positions, uvs, history:new Float32Array(SAMPLES*6), nozzle:new Vector3(engine.pos[0],engine.pos[1],engine.pos[2]-engine.length/2), radius:engine.radius };
    });
  }

  clear(): void { this.count=0; this.head=0; for(const r of this.ribbons) r.geometry.setDrawRange(0,0); }

  update(dt: number, active: boolean, pos: Vector3, quat: Quaternion): void {
    if(dt<=0) return;
    this.clock+=dt;
    if(active) {
      this.times[this.head]=this.clock;
      for(const r of this.ribbons) {
        _point.copy(r.nozzle).applyQuaternion(quat).add(pos);
        _side.set(r.radius*T.plume.stuntTrailWidth,0,0).applyQuaternion(quat);
        const i=this.head*6;
        r.history[i]=_point.x-_side.x; r.history[i+1]=_point.y-_side.y; r.history[i+2]=_point.z-_side.z;
        r.history[i+3]=_point.x+_side.x; r.history[i+4]=_point.y+_side.y; r.history[i+5]=_point.z+_side.z;
      }
      this.head=(this.head+1)%SAMPLES; this.count=Math.min(this.count+1,SAMPLES);
    }
    let visible=0;
    for(let n=0;n<this.count;n++) {
      const i=(this.head-1-n+SAMPLES)%SAMPLES;
      const age=(this.clock-this.times[i]!)/T.plume.stuntTrailLife;
      if(age>=1) break;
      for(const r of this.ribbons) {
        for(let axis=0;axis<6;axis++) r.positions[n*6+axis]=r.history[i*6+axis]!;
        r.uvs[n*4]=-1; r.uvs[n*4+1]=age; r.uvs[n*4+2]=1; r.uvs[n*4+3]=age;
      }
      visible++;
    }
    for(const r of this.ribbons) {
      r.geometry.setDrawRange(0,Math.max(0,visible-1)*6);
      r.geometry.attributes.position!.needsUpdate=true;
      r.geometry.attributes.uv!.needsUpdate=true;
    }
    if(!active && visible===0) this.clear();
  }

  dispose(): void { for(const r of this.ribbons) r.geometry.dispose(); this.material.dispose(); }
}
