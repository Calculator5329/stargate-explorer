"""Author an isolated glider benchmark; all coordinates below are game-space metres.
Run: blender --background --factory-startup --python scripts/blender-glider.py
The editable source is saved before the export copy is joined by material.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path.cwd()
OUT=ROOT/'docs/design/blender-glider'
OUT.mkdir(parents=True,exist_ok=True)
# A fresh factory scene contains no user work. Keep its objects in a hidden collection.
archive=bpy.data.collections.new('Factory objects — retained')
bpy.context.scene.collection.children.link(archive)
for o in list(bpy.context.scene.objects):
 for c in list(o.users_collection): c.objects.unlink(o)
 archive.objects.link(o)
archive.hide_render=True;archive.hide_viewport=True
art=bpy.data.collections.new('Benchmark editable components');bpy.context.scene.collection.children.link(art)
def mat(name,color,metal,rough,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
 return m
alloy=mat('alloy',(0.31,0.33,0.29),.65,.43)
trim=mat('brass',(0.29,0.23,0.13),.65,.48)
dark=mat('recess',(0.035,0.043,0.041),.45,.57)
glass=mat('canopy',(0.025,0.042,0.049),.4,.16)
glow=mat('engine',(1,.34,.055),.1,.35,2)
def cv(p):return (p[0],-p[2],p[1])
def mesh(name,verts,faces,material,smooth=True):
 me=bpy.data.meshes.new(name);me.from_pydata([cv(v) for v in verts],[],faces);me.update()
 o=bpy.data.objects.new(name,me);art.objects.link(o);o.data.materials.append(material)
 # Recalculate closed-surface winding after the coordinate conversion.
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
 for p in me.polygons:p.use_smooth=smooth
 return o
def tube(name,points,r,material,sides=8):
 verts=[]
 for i,p in enumerate(points):
  tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
  tangent.normalize();axis=Vector((0,1,0))
  if abs(tangent.dot(axis))>.95:axis=Vector((1,0,0))
  a=tangent.cross(axis).normalized();b=tangent.cross(a).normalized()
  for j in range(sides):verts.append(tuple(Vector(p)+r*(a*math.cos(j*math.tau/sides)+b*math.sin(j*math.tau/sides))))
 faces=[]
 for i in range(len(points)-1):
  for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
 faces.extend([tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+j for j in range(sides))])
 return mesh(name,verts,faces,material)
# Continuous swept crescent. A smooth analytic shoulder and dropping tips replace
# the original five straight segments; the silhouette is still intentionally stylized.
def wing(u,v,side,top=True):
 x=.7+6.1*u
 lead=2.6+1.0*math.sin(math.pi*u)-4.1*u*u
 chord=4.7*(1-u)**.62+.08
 y=-.08-3.55*u**2.1
 thick=(.28*(1-u)+.018)*math.sin(math.pi*v)**.7
 return (side*x,y+(thick if top else -thick*.68),lead-v*chord)
for side in [-1,1]:
 verts=[];N=36;M=16
 for top in [True,False]:
  for i in range(N+1):
   for j in range(M+1):verts.append(wing(i/N,j/M,side,top))
 layer=(N+1)*(M+1);faces=[]
 for k in range(2):
  for i in range(N):
   for j in range(M):
    a=k*layer+i*(M+1)+j;faces.append((a,a+1,a+M+2,a+M+1))
 for i in range(N):
  for j in [0,M]:
   a=i*(M+1)+j;b=(i+1)*(M+1)+j;faces.append((a,b,b+layer,a+layer))
 for j in range(M):
  for i in [0,N]:
   a=i*(M+1)+j;faces.append((a,a+layer,a+1+layer,a+1))
 mesh('Continuous crescent '+str(side),verts,faces,alloy)
 # Narrow inlaid panel courses follow the actual curved upper skin.
 for v in [.15,.67,.88]:
  tube('Wing seam',[(x,y+.018,z) for x,y,z in [wing(i/36,v,side) for i in range(2,35)]],.009,dark,6)
 for u in [.19,.36,.54,.72,.87]:
  tube('Wing rib',[(x,y+.018,z) for x,y,z in [wing(u,j/24,side) for j in range(3,22)]],.012,trim,6)
 tube('Leading rim',[wing(i/36,.02,side) for i in range(37)],.032,trim)
# Hull and canopy lofts with rounded shoulder cross sections.
def loft(name,stations,material,sides=24):
 verts=[]
 for z,w,h,y in stations:
  for j in range(sides):
   a=j*math.tau/sides;verts.append((w*math.cos(a),y+h*math.sin(a),z))
 faces=[]
 for i in range(len(stations)-1):
  for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
 faces.extend([tuple(range(sides)),tuple((len(stations)-1)*sides+j for j in range(sides-1,-1,-1))])
 return mesh(name,verts,faces,material)
loft('Central armored body',[(-3.3,.28,.22,-.08),(-2.7,.67,.38,-.02),(-1.8,1.0,.56,0),(-.4,1.14,.66,.05),(1,1.03,.56,.03),(2.2,.77,.36,-.03),(3.3,.3,.16,-.13),(3.65,.04,.045,-.16)],alloy,32)
canopy=[(-1.95,.27,.12,.49),(-1.45,.56,.35,.63),(-.6,.66,.45,.72),(.45,.6,.39,.64),(1.3,.43,.22,.5),(1.75,.09,.045,.37)]
loft('Dark tandem canopy',canopy,glass,32)
for i in [1,3]:
 z,w,h,y=canopy[i]
 tube('Canopy frame',[(w*math.cos(a),y+h*math.sin(a)+.015,z) for a in [j*math.pi/20 for j in range(21)]],.028,trim)
tube('Canopy spine',[(0,y+h+.025,z) for z,w,h,y in canopy],.024,alloy)
for side in [-1,1]:
 tube('Cockpit sill',[(side*w,y+.02,z) for z,w,h,y in canopy],.032,alloy)
 # Staff cannon fairing, barrel and recessed muzzle, kept under the inner wing.
 x=side*2.5
 loft('Staff cannon breech',[(-.5,.16,.17,-.58),(.3,.24,.23,-.62),(1.4,.16,.16,-.68)],dark,16).location.x=x
 tube('Staff barrel',[(x,-.68,.9),(x,-.68,3.55)],.095,trim,12)
 for z in [1.1,1.42,2.95,3.38]:tube('Cannon collar',[(x,-.68,z),(x,-.68,z+.08)],.135,alloy,12)
 tube('Dark muzzle',[(x,-.68,3.5),(x,-.68,3.59)],.075,dark,12)
 # Twin aft outlets and named nodes ready for a later ShipRig adapter.
 x=side*.51
 tube('Engine shroud',[(x,-.23,-2.55),(x,-.23,-3.25)],.235,dark,16)
 tube('Engine lip',[(x,-.23,-3.12),(x,-.23,-3.28)],.245,trim,16)
 tube('Engine throat',[(x,-.23,-3.265),(x,-.23,-3.28)],.177,glow,16)
 for name,p in [('engine', (x,-.23,-3.3)),('muzzle',(side*2.5,-.68,3.6))]:
  o=bpy.data.objects.new(name+('_port' if side>0 else '_starboard'),None);art.objects.link(o);o.location=cv(p);o['attachment']=name
bpy.context.scene['benchmark']='Death glider, independent Blender asset; not installed in gameplay'
bpy.context.scene['axes']='Model authored +Z forward +Y up in game space; converted to Blender Z-up before glTF export'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'death-glider-benchmark.blend'))
# Export a joined duplicate, retaining separately editable source meshes above.
bpy.ops.object.select_all(action='DESELECT')
copies=[]
for o in list(art.objects):
 if o.type=='MESH':
  d=o.copy();d.data=o.data.copy();bpy.context.scene.collection.objects.link(d);d.select_set(True);copies.append(d)
if copies:
 bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();copies[0].name='GliderBenchmark'
for o in art.objects:
 if o.type=='EMPTY':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/benchmarks/death-glider.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True)
ob=bpy.context.view_layer.objects.active;ob.data.calc_loop_triangles()
(OUT/'asset.json').write_text(json.dumps({'blender':bpy.app.version_string,'triangles':len(ob.data.loop_triangles),'materials':len(ob.data.materials),'source':'death-glider-benchmark.blend','asset':'/benchmarks/death-glider.glb','installedInGameplay':False},indent=2))
