// Resolves the articular surfaces in lib/joints.json against the model.
// Surfaces with "landmark" take the approved landmark point. Surfaces with "nearestTo" have no landmark of their own:
// their point is the closest spot on their bone to the partner surface(s) it faces. Surfaces with "near" take the
// closest spot on their bone to that fixed point (right side), for a facet whose landmark marks a different face of the
// feature (the front of the dens, the symphyseal face of the pubis). Every surface also records the mesh it sits on.
// Points are stored on the right side (x < 0); the atlas mirrors them for the left.
// It also writes lib/landmark-meshes.json: the mesh under each landmark, by nearest surface. Bounding boxes of stacked
// vertebrae and ribs overlap, so the viewer cannot tell from them which one a landmark is on.
// It also records each landmark's outward surface normal (right side), which Find it uses to tell the two faces of a
// thin plate apart (the subscapular fossa is not the back of the scapula).
// Run after changing lib/joints.json or lib/published-annotations.json:  node tools/derive-joints.mjs
import {readFileSync,writeFileSync} from 'node:fs';
import {Triangle,Vector3} from 'three';
const read=f=>JSON.parse(readFileSync(new URL('../'+f,import.meta.url),'utf8'));
const joints=read('lib/joints.json'),annotations=read('lib/published-annotations.json'),index=read('lib/model-index.json'),catalog=read('lib/catalog.json');
const models=new Map(read('public/model.json').map(m=>[m.id,m])),info=new Map(index.models.map(m=>[m.id,m]));
const canonical=p=>p[0]>.008?[-p[0],p[1],p[2]]:[...p];
const boxDistance=(m,p)=>Math.hypot(...[0,1,2].map(i=>Math.max(m.min[i]-p[i],0,p[i]-m.max[i])));
function closest(ids,target){
 const t=new Vector3(...target),tri=new Triangle(),out=new Vector3();let best={d:Infinity};
 for(const id of ids){if(boxDistance(info.get(id),target)>=best.d)continue;const {positions:P,indices:I}=models.get(id);const v=i=>new Vector3(P[i*3],P[i*3+1],P[i*3+2]);
  for(let k=0;k<I.length;k+=3){tri.set(v(I[k]),v(I[k+1]),v(I[k+2]));tri.closestPointToPoint(t,out);const d=out.distanceTo(t);if(d<best.d)best={d,point:out.toArray(),mesh:id};}}
 return best;
}
const round=p=>p.map(v=>+v.toFixed(5));
// Outward normal where a point lies on a mesh, as the viewer computes it: the closest face's normal averaged with nearby
// faces on the same side. Meshes stored inside-out (negative volume) have their faces flipped.
const outward=new Map();
function normalAt(id,target){
 const {positions:P,indices:I}=models.get(id),v=i=>new Vector3(P[i*3],P[i*3+1],P[i*3+2]),t=new Vector3(...target),tri=new Triangle(),out=new Vector3(),near=[];let best=Infinity,n=null;
 if(!outward.has(id)){let vol=0;for(let k=0;k<I.length;k+=3)vol+=v(I[k]).dot(new Vector3().crossVectors(v(I[k+1]),v(I[k+2])));outward.set(id,vol<0?-1:1);}
 for(let k=0;k<I.length;k+=3){tri.set(v(I[k]),v(I[k+1]),v(I[k+2]));tri.closestPointToPoint(t,out);const d=out.distanceTo(t);if(d>.004)continue;const fn=tri.getNormal(new Vector3()).multiplyScalar(outward.get(id));near.push([fn,tri.getArea()]);if(d<best){best=d;n=fn;}}
 if(!n)return null;const sum=new Vector3();for(const [fn,a] of near)if(fn.dot(n)>-.3)sum.addScaledVector(fn,a);return sum.normalize().toArray().map(x=>+x.toFixed(2));
}
for(const j of joints)for(const s of j.surfaces){
 const ids=index.groups[s.bone].filter(id=>info.get(id).side!=='left'&&!(s.excludeMeshOf!==undefined&&id===j.surfaces[s.excludeMeshOf].mesh));
 if(!ids.length)throw Error(`${j.id}: no meshes for ${s.bone}`);
 let target;
 if(s.landmark){const a=annotations[s.landmark];if(!a)throw Error(`${j.id}: unknown landmark ${s.landmark}`);target=canonical(a.point);}
 else if(s.near)target=[...s.near];
 else{const refs=[s.nearestTo].flat().map(i=>j.surfaces[i].point);target=[0,1,2].map(k=>refs.reduce((t,p)=>t+p[k],0)/refs.length);}
 const hit=closest(ids,target);
 s.point=round(s.landmark?target:hit.point);s.mesh=hit.mesh;
 if(s.landmark&&hit.d>.012)console.warn(`${j.id}: ${s.label} is ${(hit.d*1000).toFixed(1)} mm from its bone`);
 console.log(`${j.id.padEnd(30)} ${s.label.padEnd(42)} ${info.get(s.mesh).name.padEnd(22)} ${s.landmark?'landmark':'derived '} ${(hit.d*1000).toFixed(1)} mm`);
}
writeFileSync(new URL('../lib/joints.json',import.meta.url),'[\n'+joints.map(j=>' '+JSON.stringify(j)).join(',\n')+'\n]\n');
// "right" is the mesh under the landmark's copy on the body's right (x <= 0), "left" under its copy on the left;
// "normal" is the outward surface normal at the right copy.
const lines=[];
for(const e of catalog){const a=annotations[e.id];if(e.kind!=='landmark'||!a)continue;const ids=index.groups[e.bone],x=Math.abs(a.point[0]);
 const [right,left]=[-x,x].map(v=>closest(ids,[v,a.point[1],a.point[2]]));
 if(Math.min(right.d,left.d)>.003)console.warn(`${e.id}: ${(Math.min(right.d,left.d)*1000).toFixed(1)} mm from its bone`);
 lines.push(` ${JSON.stringify(e.id)}:{"right":${JSON.stringify(right.mesh)},"left":${JSON.stringify(left.mesh)},"normal":${JSON.stringify(normalAt(right.mesh,[-x,a.point[1],a.point[2]]))}}`);
}
writeFileSync(new URL('../lib/landmark-meshes.json',import.meta.url),'{\n'+lines.join(',\n')+'\n}\n');
console.log(`${lines.length} landmark meshes`);
