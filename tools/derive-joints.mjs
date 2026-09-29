// Resolves the articular surfaces in lib/joints.json against the model.
// Surfaces with "landmark" take the approved landmark point. Surfaces with "nearestTo" have no landmark of their own:
// their point is the closest spot on their bone to the partner surface(s) it faces. Every surface also records the
// mesh it sits on. Points are stored on the right side (x < 0); the atlas mirrors them for the left.
// "offset" nudges the search point, e.g. toward the anterior arch of the atlas for the dens.
// Run after changing lib/joints.json or lib/published-annotations.json:  node tools/derive-joints.mjs
import {readFileSync,writeFileSync} from 'node:fs';
import {Triangle,Vector3} from 'three';
const read=f=>JSON.parse(readFileSync(new URL('../'+f,import.meta.url),'utf8'));
const joints=read('lib/joints.json'),annotations=read('lib/published-annotations.json'),index=read('lib/model-index.json');
const models=new Map(read('public/model.json').map(m=>[m.id,m])),info=new Map(index.models.map(m=>[m.id,m]));
const canonical=p=>p[0]>.008?[-p[0],p[1],p[2]]:[...p];
function closest(ids,target){
 const t=new Vector3(...target),tri=new Triangle(),out=new Vector3();let best={d:Infinity};
 for(const id of ids){const {positions:P,indices:I}=models.get(id);const v=i=>new Vector3(P[i*3],P[i*3+1],P[i*3+2]);
  for(let k=0;k<I.length;k+=3){tri.set(v(I[k]),v(I[k+1]),v(I[k+2]));tri.closestPointToPoint(t,out);const d=out.distanceTo(t);if(d<best.d)best={d,point:out.toArray(),mesh:id};}}
 return best;
}
const round=p=>p.map(v=>+v.toFixed(5));
for(const j of joints)for(const s of j.surfaces){
 const ids=index.groups[s.bone].filter(id=>info.get(id).side!=='left'&&!(s.excludeMeshOf!==undefined&&id===j.surfaces[s.excludeMeshOf].mesh));
 if(!ids.length)throw Error(`${j.id}: no meshes for ${s.bone}`);
 let target;
 if(s.landmark){const a=annotations[s.landmark];if(!a)throw Error(`${j.id}: unknown landmark ${s.landmark}`);target=canonical(a.point);}
 else{const refs=[s.nearestTo].flat().map(i=>j.surfaces[i].point);target=[0,1,2].map(k=>refs.reduce((t,p)=>t+p[k],0)/refs.length+(s.offset?.[k]??0));}
 const hit=closest(ids,target);
 s.point=round(s.landmark?target:hit.point);s.mesh=hit.mesh;
 if(s.landmark&&hit.d>.012)console.warn(`${j.id}: ${s.label} is ${(hit.d*1000).toFixed(1)} mm from its bone`);
 console.log(`${j.id.padEnd(30)} ${s.label.padEnd(42)} ${info.get(s.mesh).name.padEnd(22)} ${s.landmark?'landmark':'derived '} ${(hit.d*1000).toFixed(1)} mm`);
}
writeFileSync(new URL('../lib/joints.json',import.meta.url),'[\n'+joints.map(j=>' '+JSON.stringify(j)).join(',\n')+'\n]\n');
