// Quiz questions: "Find it" (click it on the model), "Name it" (type or choose the name) and "Articulations"
// (which surfaces meet at each joint). Built from the same course list as Explore; nothing is scored or sent anywhere.
import {Entry,Lateral,Point,Region,boneLabel,boneMeshes,catalog,defaultAnnotations,jointById,mirror} from './atlas';
import {partners} from './display';
import {Named,normalize} from './match';
export type QType='find'|'name'|'artic';
export const TYPES:Record<QType,{label:string;help:string}>={
 find:{label:'Find it',help:'Click the named structure on the model'},
 name:{label:'Name it',help:'Type or choose the name of the highlighted structure'},
 artic:{label:'Articulations',help:'Which surfaces meet at each joint (needs the Joints section)'},
};
export type SectionId=Region|'joints';
export const SECTIONS:{id:SectionId;label:string}[]=[
 {id:'skull',label:'Skull & hyoid'},{id:'spine',label:'Vertebral column'},{id:'thorax',label:'Thoracic cage'},{id:'shoulder',label:'Pectoral girdle'},{id:'humerus',label:'Humerus'},{id:'forearm',label:'Radius & ulna'},{id:'hand',label:'Hand & wrist'},{id:'pelvis',label:'Pelvic girdle'},{id:'thigh',label:'Femur & patella'},{id:'leg',label:'Tibia & fibula'},{id:'foot',label:'Foot & ankle'},{id:'joints',label:'Joints'},
];
// Everything a student can be asked about, with the other names a typed answer may use.
export type Item=Named&{entry:Entry};
function akaFor(e:Entry):string[]{
 if(e.kind==='joint')return jointById.get(e.id)?.aka??[];
 const parts=e.label.split('/').map(s=>s.trim()),out=parts.length>1?[...parts]:[];
 if(e.kind==='landmark')for(const p of parts)out.push(`${p} of ${boneLabel(e.bone)}`);
 else{const l=e.label;if(/ae$/.test(l))out.push(l.slice(0,-1));else if(/s$/.test(l))out.push(l.slice(0,-1));if(e.bone==='coxal')out.push('hip bone','os coxae','innominate');}
 return out;
}
export const items:Item[]=catalog.filter(e=>!e.unavailable&&(e.kind!=='landmark'||defaultAnnotations[e.id]?.reviewed)).map(e=>({id:e.id,name:e.label,aka:akaFor(e),entry:e}));
export const itemById=new Map(items.map(i=>[i.id,i]));
const sectionOf=(e:Entry):SectionId=>e.kind==='joint'?'joints':e.region;
// Articulation questions: a surface and what it meets, plus a few common mix-ups.
export type Artic={id:string;prompt:string;answer:string;options:string[];explain:string;joint:string;surface?:number};
const FACTS:Omit<Artic,'id'>[]=[
 {prompt:'Which bone does NOT articulate with the femur?',answer:'Fibula',options:['Tibia','Patella','Coxal bone','Fibula'],explain:'The femur meets the coxal bone at the hip, and the tibia and patella at the knee. The fibula sits below the lateral condyle of the tibia and never reaches the femur.',joint:'joint-tibiofemoral'},
 {prompt:'Which bone does NOT articulate with the fibula?',answer:'Femur',options:['Tibia','Talus','Femur'],explain:'The fibula meets the tibia (proximal tibiofibular joint) and the talus (lateral malleolus at the ankle). It does not reach the femur.',joint:'joint-tibiofibular'},
 {prompt:'The patella articulates with which bone?',answer:'Femur',options:['Femur','Tibia','Fibula','Talus'],explain:'The patella glides on the patellar surface of the femur. The patellar ligament anchors it to the tibia, but the two bones do not articulate.',joint:'joint-patellofemoral'},
 {prompt:'Which bone does NOT articulate with the humerus?',answer:'Clavicle',options:['Scapula','Radius','Ulna','Clavicle'],explain:'The humerus meets the scapula at the glenoid cavity and the radius and ulna at the elbow. The clavicle articulates with the acromion of the scapula and with the sternum.',joint:'joint-glenohumeral'},
 {prompt:'The occipital condyles articulate with which vertebra?',answer:'Atlas (C1)',options:['Atlas (C1)','Axis (C2)','C3','T1'],explain:'The occipital condyles rest in the superior articular facets of the atlas (C1), forming the atlanto-occipital joint.',joint:'joint-atlanto-occipital'},
];
const shuffle=<T,>(a:T[])=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export function articQuestions():Artic[]{
 const out:Artic[]=[];
 for(const [id,j] of jointById)j.surfaces.forEach((s,i)=>{const p=partners(j,i);if(!p.length)return;
  const answer=p.map(k=>j.surfaces[k].label).join(' + ');
  out.push({id:`${id}:${i}`,prompt:`What articulates with the ${s.label.charAt(0).toLowerCase()+s.label.slice(1)} (${boneLabel(s.bone).toLowerCase()})?`,answer,options:[],explain:`${j.label}: ${j.note}`,joint:id,surface:i});});
 return [...out,...FACTS.map((f,k)=>({...f,id:`fact:${k}`}))];
}
// Distractors never include anything that truly meets the asked surface in any joint (the head of the radius meets
// both the capitulum and the radial notch), nor another name for the right answer.
const root=(label:string)=>normalize(label.replace(/\(.*?\)/g,''));
export function articChoices(q:Artic){
 if(q.options.length)return shuffle([...q.options]);
 const j=jointById.get(q.joint)!,asked=j.surfaces[q.surface!],truth=new Set([root(q.answer)]);
 for(const o of jointById.values())o.surfaces.forEach((s,i)=>{if(s.bone===asked.bone&&root(s.label)===root(asked.label))for(const k of partners(o,i))truth.add(root(o.surfaces[k].label));});
 for(const k of partners(j,q.surface!))truth.add(root(j.surfaces[k].label));
 const seen=new Set(truth),other:string[]=[];seen.add(root(asked.label));
 const pool=[...jointById.values()].flatMap(o=>o.surfaces.map(s=>({s,near:o.region===j.region})));
 for(const {s} of [...shuffle(pool.filter(x=>x.near)),...shuffle(pool.filter(x=>!x.near))]){const n=root(s.label);if(seen.has(n))continue;seen.add(n);other.push(s.label);if(other.length===3)break;}
 return shuffle([q.answer,...other]);
}
export type Question={type:QType;id:string};
export function questionPool(type:QType,sections:SectionId[]):Question[]{
 if(type==='artic')return sections.includes('joints')?articQuestions().map(q=>({type,id:q.id})):[];
 return items.filter(i=>sections.includes(sectionOf(i.entry))).map(i=>({type,id:i.id}));
}
export function buildQuestions(sections:SectionId[],types:QType[]){
 const qs=shuffle(types.flatMap(t=>questionPool(t,sections)));
 for(let i=1;i<qs.length;i++)if(qs[i].id===qs[i-1].id){const j=qs.findIndex((q,k)=>k>i&&q.id!==qs[i].id);if(j>0)[qs[i],qs[j]]=[qs[j],qs[i]];}
 return qs;
}
// Name distractors: same kind, preferring the same bone (landmarks) or region, never a same-named structure.
export function nameChoices(target:Item,count=4){
 const e=target.entry,ok=items.filter(i=>i.entry.kind===e.kind&&normalize(i.name)!==normalize(target.name));
 const close=shuffle(ok.filter(i=>e.kind==='landmark'?i.entry.bone===e.bone:i.entry.region===e.region)).slice(0,2);
 const names=new Set([normalize(target.name)]),picked=[target];for(const i of [...close,...shuffle(ok)]){if(picked.length===count)break;const n=normalize(i.name);if(names.has(n))continue;names.add(n);picked.push(i);}
 return shuffle(picked).map(i=>i.id);
}
const dist=(p:Point,q:Point)=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);
const nearestCopy=(p:Point,q:Point)=>Math.min(dist(p,q),dist(mirror(p),q));
export function bonesOfMesh(mesh:string){return items.filter(i=>i.entry.kind==='bone'&&boneMeshes[i.entry.bone].includes(mesh)).sort((a,b)=>boneMeshes[a.entry.bone].length-boneMeshes[b.entry.bone].length);}
// Nearest course landmark to a clicked point on a mesh, if the click is close to one.
export function landmarkNear(mesh:string,p:Point,within=.015){
 let best:Item|undefined,d=within;for(const i of items)if(i.entry.kind==='landmark'&&boneMeshes[i.entry.bone].includes(mesh)){const x=nearestCopy(defaultAnnotations[i.id].point,p);if(x<d){d=x;best=i;}}
 return best;
}
// Either side counts. A landmark click must land on its bone and be closer to it than to any other landmark there.
export function findHit(target:Item,mesh:string,p:Point):boolean{
 const e=target.entry;
 if(e.kind==='bone')return boneMeshes[e.bone].includes(mesh);
 if(e.kind==='landmark'){if(!boneMeshes[e.bone].includes(mesh))return false;const a=defaultAnnotations[e.id],d=nearestCopy(a.point,p);return d<=Math.max(a.radius,.006)||landmarkNear(mesh,p,.018)?.id===e.id;}
 const j=jointById.get(e.id)!;return j.surfaces.some(s=>boneMeshes[s.bone].includes(mesh)&&nearestCopy(s.point,p)<=Math.max(s.radius*1.8,.02));
}
export const sideOfPoint=(p:Point):Lateral=>p[0]>0?'left':'right';
