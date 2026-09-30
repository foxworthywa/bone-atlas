// Quiz questions: "Find it" (click it on the model), "Name it" (type or choose the name) and "Articulations"
// (which surfaces meet at each joint). Built from the same course list as Explore; nothing is scored or sent anywhere.
import {Entry,Lateral,Point,Region,baseBones,boneLabel,boneMeshes,catalog,defaultAnnotations,jointById,meshById,meshOnSide,mirror} from './atlas';
import {partners} from './display';
import {Named,nameDistance,nameMatches,normalize} from './match';
import landmarkMeshes from './landmark-meshes.json';
import findExtents from './find-extents.json';
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
// Instructor landmarks marked on one spot (the hypophyseal fossa is the seat of the sella turcica): each accepts the
// other's name and they are never offered as each other's distractor.
const SAME_SPOT=[['sphenoid-5','sphenoid-6']];
const twins=(id:string)=>SAME_SPOT.find(g=>g.includes(id))?.filter(x=>x!==id)??[];
// Landmarks that name a region, and the course landmarks lying in it (the ischial tuberosity is part of the ischium).
// A click on a part counts for the region, and a region and its part are never offered together in Name it.
export const PARTS:Record<string,string[]>={
 'coxal-mark-1':['coxal-mark-2','coxal-mark-3','coxal-mark-4','coxal-mark-5','coxal-mark-6','coxal-mark-7','coxal-mark-8'],
 'coxal-mark-9':['coxal-mark-10','coxal-mark-11','coxal-mark-12','coxal-mark-13','coxal-mark-14'],'coxal-mark-15':['coxal-mark-16','coxal-mark-17','coxal-mark-18'],
 'scapula-mark-0':['scapula-mark-6'],'scapula-mark-5':['scapula-mark-13'],'mandible-mark-0':['mandible-mark-3'],'mandible-mark-1':['mandible-mark-6','mandible-mark-7'],
 'sphenoid-0':['sphenoid-5','sphenoid-6'],'tibia-mark-0':['tibia-mark-1','tibia-mark-2'],'femur-mark-0':['femur-mark-1'],'frontal-mark-0':['frontal-mark-1'],
};
// Ilium, ischium and pubis are whole parts of the coxal bone. Their points sit on smaller features (the ilium's in the
// iliac fossa), so they are asked only in Find it, where a click counts for the part whose landmarks are nearest.
// The acetabulum is formed by all three and the obturator foramen is ringed by the ischium and pubis, so a click there
// counts for each of them.
export const WHOLE=['coxal-mark-1','coxal-mark-9','coxal-mark-15'],SHARED:Record<string,string[]>={'coxal-mark-0':WHOLE,'coxal-mark-20':['coxal-mark-9','coxal-mark-15']};
const parentsOf=(id:string)=>Object.keys(PARTS).filter(k=>PARTS[k].includes(id));
// Only ilium, ischium and pubis stay out of the way of their parts' clicks; any other region's point is a spot of its own
// (the body of the mandible is not the mental foramen).
const wholeOf=(id:string)=>parentsOf(id).filter(k=>WHOLE.includes(k));
export const nested=(a:string,b:string)=>!!(PARTS[a]?.includes(b)||PARTS[b]?.includes(a)||SHARED[a]?.includes(b)||SHARED[b]?.includes(a));
const ORD=['first','second','third','fourth','fifth'],DIGIT=[['thumb','index finger','middle finger','ring finger','little finger'],['great toe','second toe','third toe','fourth toe','little toe']];
// A single generic word after "/" keeps the rest of the name: "Supraorbital foramen / notch" -> "Supraorbital notch".
const GENERIC=/^(notch|crest|border|process|foramen|fossa|surface)$/i;
function akaFor(e:Entry):string[]{
 if(e.kind==='joint')return jointById.get(e.id)?.aka??[];
 const parts=e.label.split('/').map(s=>s.trim()),out=parts.length>1?parts.map((p,k)=>k&&GENERIC.test(p)?parts[0].replace(/\S+$/,p):p):[];
 // Catalog aka: other accepted names, e.g. the English or plural form of a Latin label (its parenthesis is ignored).
 out.push(...e.aka??[]);for(const t of twins(e.id)){const c=catalog.find(c=>c.id===t)!;out.push(c.label,...c.aka??[]);}
 if(e.kind==='landmark')for(const p of parts)out.push(`${p} of ${boneLabel(e.bone)}`);
 else{const l=e.label;if(/ae$/.test(l))out.push(l.slice(0,-1));else if(/s$/.test(l))out.push(l.slice(0,-1));if(e.bone==='coxal')out.push('hip bone','os coxae','innominate');
  // Metacarpal II -> "metacarpal 2", "second metacarpal"; Proximal phalanx · digit 1 -> "proximal phalanx of the thumb".
  const m=/^(Metacarpal|Metatarsal) (I{1,3}|IV|V)$/.exec(l);if(m){const n=['I','II','III','IV','V'].indexOf(m[2]);out.push(`${m[1]} ${n+1}`,`${ORD[n]} ${m[1]}`);}
  const ph=/^(Proximal|Middle|Distal) phalanx · digit (\d)$/.exec(l);if(ph){const n=+ph[2]-1,d=DIGIT[e.bone.startsWith('foot')?1:0][n];out.push(`${ph[1]} phalanx ${n+1}`,`${ph[1]} phalanx of digit ${n+1}`,`${ORD[n]} ${ph[1]} phalanx`,`${ph[1]} phalanx of the ${d}`);}}
 return out;
}
export const items:Item[]=catalog.filter(e=>!e.unavailable&&(e.kind!=='landmark'||defaultAnnotations[e.id]?.reviewed)).map(e=>({id:e.id,name:e.label,aka:akaFor(e),same:twins(e.id),entry:e}));
export const itemById=new Map(items.map(i=>[i.id,i]));
const sectionOf=(e:Entry):SectionId=>e.kind==='joint'?'joints':e.region;
// Wording. Bone labels are group names ("Scapulae", "Coxal bones"); prompts use the singular without brackets.
const lowerFirst=(s:string)=>s.charAt(0).toLowerCase()+s.slice(1);
export function boneName(bone:string){return lowerFirst(boneLabel(bone).replace(/\s*\(.*?\)/g,'').split(' / ')[0]).replace(/ bones$/,' bone').replace(/ae$/,'a').replace(/(?<![suia])s$/,'').replace(/phalange$/,'phalanx');}
// "the palatine process of the maxilla", but "the body of sphenoid" and "the mandibular notch", not the bone twice.
const withBone=(name:string,bone:string)=>{const b=boneName(bone);return bone==='sutures'||/ (of|on) /.test(name)||name.toLowerCase().includes(normalize(b).slice(0,4))?name:`${name} of the ${b}`;};
// Vertebrae and ribs repeat. A landmark is marked on one of them (the spinous process on L1), so Find it highlights that
// one and only a click on it counts; the intervertebral foramen lies between T12 and L1.
const SERIAL:Record<string,string>={vertebrae:'vertebra',cervical:'vertebra','thoracic-vertebrae':'vertebra',lumbar:'vertebra',ribs:'rib'};
const BETWEEN:Record<string,string[]>={'vertebrae-mark-4':['v163']};
const lmMesh=landmarkMeshes as unknown as Record<string,{right:string;left:string;normal:Point|null}>;
const serialMesh=(mesh:string)=>boneMeshes.vertebrae.includes(mesh)||boneMeshes.ribs.includes(mesh);
export const sideOfPoint=(p:Point):Lateral=>p[0]>0?'left':'right';
// The meshes of the one vertebra or rib (both sides) a question is about; empty when the structure does not repeat.
export function instanceMeshes(i:Item):string[]{const e=i.entry;
 if(e.kind==='landmark')return SERIAL[e.bone]?[...new Set([lmMesh[e.id].right,lmMesh[e.id].left,...BETWEEN[e.id]??[]])]:[];
 return e.kind==='joint'?[...new Set(jointById.get(e.id)!.surfaces.filter(s=>SERIAL[s.bone]).flatMap(s=>[meshOnSide(s.mesh,'right'),meshOnSide(s.mesh,'left')]))]:[];}
export const meshLabel=(id:string)=>lowerFirst(meshById.get(id)!.name.replace(/\.(l|r|\d+)$/,''));
const handFoot=(e:Entry)=>/^hand-/.test(e.bone)?' of the hand':/^foot-/.test(e.bone)?' of the foot':'';
const isGroup=(e:Entry)=>/(s|ae)$/.test(e.label.replace(/\s*\(.*?\)/g,''))&&boneMeshes[e.bone].filter(id=>meshById.get(id)!.side!=='left').length>1;
// "one of the carpals", "the scapula" (either side), "the proximal phalanx · digit 1 of the hand", "the atlas (C1)".
function bonePhrase(i:Item){const e=i.entry,label=lowerFirst(i.name.replace(/\s*\(group\)/,'')).replace(' / ',' or ');
 return (isGroup(e)?`one of the ${label}`:`the ${boneMeshes[e.bone].length>1&&!/\(/.test(i.name)?boneName(e.bone):label}`)+handFoot(e);}
// The Find-it prompt: "the spinous process of the highlighted vertebra", "the mastoid process of the temporal bone".
export function findWhat(i:Item){const e=i.entry,name=lowerFirst(i.name).replace(' / ',' or ');
 if(e.kind==='landmark')return SERIAL[e.bone]?`the ${name} ${BETWEEN[e.id]?'between the highlighted vertebrae':'of the highlighted '+SERIAL[e.bone]}`:`the ${withBone(name,e.bone)}`;
 return e.kind==='joint'?`the ${name}${instanceMeshes(i).length?' of the highlighted bones':''}`:bonePhrase(i);}
// Short name for the results list: "Head (femur)", "Spinous process (vertebra L1)", "Transverse foramen (atlas, C1)",
// "Proximal phalanx · digit 1 (hand)".
export function reviewName(i:Item){const e=i.entry;
 if(e.kind==='landmark')return `${i.name} (${SERIAL[e.bone]?meshLabel(lmMesh[e.id].right).replace(/ \((C\d)\)$/,', $1'):boneName(e.bone)})`;
 return e.kind==='bone'&&handFoot(e)?`${i.name} (${handFoot(e).slice(8)})`:i.name;}
// Articulation questions: a surface and what it meets, plus a few common mix-ups. twin: a question asking the same
// thing, so a quiz includes only one of the two.
export type Artic={id:string;prompt:string;answer:string;options:string[];explain:string;joint:string;surface?:number;twin?:string};
const FACTS:Omit<Artic,'id'>[]=[
 {prompt:'Which bone does NOT articulate with the femur?',answer:'Fibula',options:['Tibia','Patella','Coxal bone','Fibula'],explain:'The femur meets the coxal bone at the hip, and the tibia and patella at the knee. The fibula sits below the lateral condyle of the tibia and never reaches the femur.',joint:'joint-tibiofemoral'},
 {prompt:'Which bone does NOT articulate with the fibula?',answer:'Femur',options:['Tibia','Talus','Femur'],explain:'The fibula meets the tibia (proximal tibiofibular joint) and the talus (lateral malleolus at the ankle). It does not reach the femur.',joint:'joint-tibiofibular'},
 {prompt:'The patella articulates with which bone?',answer:'Femur',options:['Femur','Tibia','Fibula','Talus'],explain:'The patella glides on the patellar surface of the femur. The patellar ligament anchors it to the tibia, but the two bones do not articulate.',joint:'joint-patellofemoral'},
 {prompt:'Which bone does NOT articulate with the humerus?',answer:'Clavicle',options:['Scapula','Radius','Ulna','Clavicle'],explain:'The humerus meets the scapula at the glenoid cavity and the radius and ulna at the elbow. The clavicle articulates with the acromion of the scapula and with the sternum.',joint:'joint-glenohumeral'},
 {prompt:'The occipital condyles articulate with which vertebra?',answer:'Atlas (C1)',options:['Atlas (C1)','Axis (C2)','C3','T1'],explain:'The occipital condyles rest in the superior articular facets of the atlas (C1), forming the atlanto-occipital joint.',joint:'joint-atlanto-occipital',twin:'joint-atlanto-occipital:0'},
];
const shuffle=<T,>(a:T[])=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
// "the head of the humerus", "the glenoid cavity of the scapula", "the occipital condyles".
const surfaceName=(label:string,bone:string)=>withBone(lowerFirst(label),bone).replace(/ (of|on) (?!the )/,' $1 the ');
export function articQuestions():Artic[]{
 const out:Artic[]=[];
 for(const [id,j] of jointById)j.surfaces.forEach((s,i)=>{const p=partners(j,i);if(!p.length)return;const what=surfaceName(s.label,s.bone);
  // A surface with several partners (the talus) gets one question per partner, so every choice is a single surface and
  // a "+" never marks the answer; articChoices keeps all of its partners out of the distractors. A quiz asks one of them.
  for(const k of p)out.push({id:p.length>1?`${id}:${i}:${k}`:`${id}:${i}`,prompt:p.length>1?`Which of these articulates with the ${what}?`:`What articulates with the ${what}?`,answer:j.surfaces[k].label,options:[],explain:`${j.label}: ${j.note}`,joint:id,surface:i,...p.length>1?{twin:`${id}:${i}`}:{}});});
 return [...out,...FACTS.map((f,k)=>({...f,id:`fact:${k}`}))];
}
export const articById=new Map(articQuestions().map(q=>[q.id,q]));
// Surfaces that also meet (or arguably meet) the asked one although the joint list pairs them elsewhere; they are never
// offered as wrong options. The atlas's superior articular facets are superior articular facets, the fibular facet is
// on the lateral tibial condyle, the patella rides on the femoral condyles, and the lateral malleolus meets the tibia at
// the distal tibiofibular joint.
const ALSO_TRUE:Record<string,string[]>={
 'joint-atlanto-occipital:0':['Superior articular facet'],'joint-intervertebral-facet:0':['Occipital condyles'],
 'joint-tibiofibular:0':['Lateral condyle of tibia'],'joint-tibiofemoral:3':['Head of fibula'],
 'joint-tibiofemoral:0':['Posterior (articular) surface of patella'],'joint-tibiofemoral:1':['Posterior (articular) surface of patella'],
 'joint-patellofemoral:1':['Medial condyle of femur','Lateral condyle of femur'],
 'joint-talocrural:1':['Inferior articular surface of tibia'],'joint-talocrural:3':['Lateral malleolus'],
};
// Distractors never include anything that truly meets the asked surface in any joint (the head of the radius meets
// both the capitulum and the radial notch), nor another name for the right answer. They come from the same part of the
// body first, so they are plausible.
const root=(label:string)=>normalize(label.replace(/\(.*?\)/g,''));
const AREA:Record<Region,string>={skull:'axial',spine:'axial',thorax:'axial',shoulder:'upper',humerus:'upper',forearm:'upper',hand:'upper',pelvis:'lower',thigh:'lower',leg:'lower',foot:'lower'};
export function articTruth(q:Artic){
 const j=jointById.get(q.joint)!,asked=j.surfaces[q.surface!],truth=new Set([root(q.answer)]);
 for(const o of jointById.values())o.surfaces.forEach((s,i)=>{if(s.bone===asked.bone&&root(s.label)===root(asked.label))for(const k of partners(o,i))truth.add(root(o.surfaces[k].label));});
 for(const k of partners(j,q.surface!))truth.add(root(j.surfaces[k].label));
 for(const t of ALSO_TRUE[`${q.joint}:${q.surface}`]??[])truth.add(root(t));
 return truth;
}
export function articChoices(q:Artic){
 if(q.options.length)return shuffle([...q.options]);
 const j=jointById.get(q.joint)!,seen=articTruth(q),other:string[]=[];seen.add(root(j.surfaces[q.surface!].label));
 const pool=[...jointById.values()].flatMap(o=>o.surfaces.map(s=>({s,near:AREA[o.region]===AREA[j.region]})));
 for(const {s} of [...shuffle(pool.filter(x=>x.near)),...shuffle(pool.filter(x=>!x.near))]){const n=root(s.label);if(seen.has(n))continue;seen.add(n);other.push(s.label);if(other.length===3)break;}
 return shuffle([q.answer,...other]);
}
export type Question={type:QType;id:string};
export function questionPool(type:QType,sections:SectionId[]):Question[]{
 if(type==='artic')return sections.includes('joints')?articQuestions().map(q=>({type,id:q.id})):[];
 return items.filter(i=>sections.includes(sectionOf(i.entry))&&!(type==='name'&&WHOLE.includes(i.id))).map(i=>({type,id:i.id}));
}
export function buildQuestions(sections:SectionId[],types:QType[]){
 const topics=new Set<string>(),qs=shuffle(types.flatMap(t=>questionPool(t,sections))).filter(q=>{if(q.type!=='artic')return true;const t=articById.get(q.id)!.twin??q.id;if(topics.has(t))return false;topics.add(t);return true;});
 for(let i=1;i<qs.length;i++)if(qs[i].id===qs[i-1].id){const j=qs.findIndex((q,k)=>k>i&&q.id!==qs[i].id);if(j>0)[qs[i],qs[j]]=[qs[j],qs[i]];}
 return qs;
}
// Name distractors: same kind, preferring the same bone (landmarks) or region, never a same-named structure, the same
// spot under another name, or a region and its part.
export function nameChoices(target:Item,count=4){
 const e=target.entry,ok=items.filter(i=>i.entry.kind===e.kind&&normalize(i.name)!==normalize(target.name)&&!target.same?.includes(i.id)&&!nested(i.id,target.id));
 const close=shuffle(ok.filter(i=>e.kind==='landmark'?i.entry.bone===e.bone:i.entry.region===e.region)).slice(0,2);
 const names=new Set([normalize(target.name)]),picked=[target];for(const i of [...close,...shuffle(ok)]){if(picked.length===count)break;const n=normalize(i.name);if(names.has(n))continue;names.add(n);picked.push(i);}
 return shuffle(picked).map(i=>i.id);
}
// A typed Name-it answer is compared with structures of the same kind, so "hip" can name the coxal bone and the hip
// joint, unless a structure of another kind is closer ("inferior concha" is not the superior nasal conchae, "ankle" not
// the angle of the mandible) or the answer says bone for a joint or joint for anything else. 'part': the answer names
// the bone or region the landmark lies on, not the landmark itself.
export function typedAnswer(input:string,target:Item):'right'|'part'|'wrong'{
 const e=target.entry,d=nameDistance(input,target),said=/\bjoints?\b/i.test(input)?'joint':/\bbones?\b/i.test(input)?'bone':'';
 if(nameMatches(input,target,items.filter(i=>i.entry.kind===e.kind))&&!items.some(o=>o.entry.kind!==e.kind&&!target.same?.includes(o.id)&&nameDistance(input,o)<d)&&!(said&&(said==='joint')!==(e.kind==='joint')))return 'right';
 const up=e.kind==='landmark'?[...parentsOf(target.id).map(id=>itemById.get(id)!),...items.filter(i=>i.entry.kind==='bone'&&i.entry.bone===e.bone)]:[];
 return up.some(u=>nameMatches(input,u,items))?'part':'wrong';
}
const dist=(p:Point,q:Point)=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);
const nearestCopy=(p:Point,q:Point)=>Math.min(dist(p,q),dist(mirror(p),q));
export function bonesOfMesh(mesh:string){return items.filter(i=>i.entry.kind==='bone'&&boneMeshes[i.entry.bone].includes(mesh)).sort((a,b)=>boneMeshes[a.entry.bone].length-boneMeshes[b.entry.bone].length);}
// Landmarks on a thin plate of bone: a click on the plate's other face is not them (the back of the scapula is not the
// subscapular fossa; the outside of the ramus is not the mandibular foramen). Normals are stored for the right side.
const FACING=new Set(['scapula-mark-8','scapula-mark-9','scapula-mark-10','coxal-mark-0','coxal-mark-8','mandible-mark-7','h-olecranon-fossa']);
function farFace(id:string,p:Point,normal?:Point){const n=FACING.has(id)&&normal?lmMesh[id].normal:null;if(!n)return false;const m=p[0]>0?mirror(n):n;return m[0]*normal![0]+m[1]*normal![1]+m[2]*normal![2]<-.2;}
// Long or broad landmarks (sutures, borders, crests; the femoral head and the fossae): a line (for one point, a sphere)
// on the right side along which a click counts, r metres either side. See lib/find-extents.json.
const EXTENTS=findExtents as unknown as Record<string,{r:number;pts:Point[]}>;
function segDist(p:Point,a:Point,b:Point){const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],L=ab[0]**2+ab[1]**2+ab[2]**2,t=L?Math.max(0,Math.min(1,((p[0]-a[0])*ab[0]+(p[1]-a[1])*ab[1]+(p[2]-a[2])*ab[2])/L)):0;return dist(p,[a[0]+ab[0]*t,a[1]+ab[1]*t,a[2]+ab[2]*t]);}
const inExtent=(id:string,p:Point)=>{const x=EXTENTS[id];if(!x)return false;const q=p[0]>0?mirror(p):p;return x.pts.some((a,k)=>segDist(q,a,x.pts[Math.min(k+1,x.pts.length-1)])<=x.r);};
// A click along another landmark's line on the same bone belongs to that one (the spine of the scapula, between the
// supraspinous and infraspinous fossae).
const onOtherLine=(i:Item,p:Point)=>Object.keys(EXTENTS).some(id=>id!==i.id&&EXTENTS[id].pts.length>1&&itemById.get(id)?.entry.bone===i.entry.bone&&!nested(id,i.id)&&inExtent(id,p));
// A click on this landmark's bone: on a vertebra or rib, the very one it is marked on.
function onBone(i:Item,mesh:string,p:Point){const e=i.entry;return boneMeshes[e.bone].includes(mesh)&&(!SERIAL[e.bone]||mesh===lmMesh[e.id][sideOfPoint(p)]||!!BETWEEN[e.id]?.includes(mesh));}
// Nearest course landmark to a clicked point on a mesh, if the click is close to one. skip: landmarks not to consider
// (the region the asked landmark lies in, so the ilium's point never claims a click meant for the iliac fossa).
export function landmarkNear(mesh:string,p:Point,within=.015,normal?:Point,skip:string[]=[]){
 let best:Item|undefined,d=within;for(const i of items)if(i.entry.kind==='landmark'&&!skip.includes(i.id)&&onBone(i,mesh,p)&&!farFace(i.id,p,normal)){const x=nearestCopy(defaultAnnotations[i.id].point,p);if(x<d){d=x;best=i;}}
 return best;
}
// Which of ilium, ischium and pubis a click on the coxal bone is on: the part owning the nearest of their landmarks
// (all three near the acetabulum).
function partsAt(p:Point){let best:string[]=[],d=Infinity;for(const w of [...WHOLE,...Object.keys(SHARED)])for(const id of [w,...PARTS[w]??[]]){const x=nearestCopy(defaultAnnotations[id].point,p);if(x<d){d=x;best=SHARED[w]??[w];}}return best;}
// The joint a click belongs to: the nearest articular surface relative to its size, within 1.8 radii. The capitulum
// belongs to the humeroradial joint, not the humeroulnar, though the two are 2 cm apart.
function nearestJoint(mesh:string,p:Point){let best:{id:string;d:number}|undefined;
 for(const o of jointById.values())for(const s of o.surfaces){if(SERIAL[s.bone]?mesh!==meshOnSide(s.mesh,sideOfPoint(p)):!boneMeshes[s.bone].includes(mesh))continue;const d=nearestCopy(s.point,p)/Math.max(s.radius,.011);if(!best||d<best.d)best={id:o.id,d};}
 return best&&best.d<=1.8?best.id:undefined;}
// Either side counts. A landmark click must land on its bone, on the face the landmark is on, and be within its
// radius, along its extent, or closer to it (or to one of its parts) than to any other landmark there.
export function findHit(target:Item,mesh:string,p:Point,normal?:Point):boolean{
 const e=target.entry;
 if(e.kind==='bone')return boneMeshes[e.bone].includes(mesh);
 if(e.kind==='joint')return nearestJoint(mesh,p)===e.id;
 if(!onBone(target,mesh,p)||farFace(e.id,p,normal))return false;
 if(WHOLE.includes(e.id))return partsAt(p).includes(e.id);
 const a=defaultAnnotations[e.id],near=landmarkNear(mesh,p,.018,normal,wholeOf(e.id));
 if(nearestCopy(a.point,p)<=Math.max(a.radius,.006)||!!near&&(near.id===e.id||!!target.same?.includes(near.id)||!!PARTS[e.id]?.includes(near.id)))return true;
 // Along the extent, unless the click is right on another named landmark (the acromion at the end of the spine).
 return inExtent(e.id,p)&&!(near&&nearestCopy(defaultAnnotations[near.id].point,p)<.008)&&!onOtherLine(target,p);
}
// What a wrong Find-it click landed on, for the feedback: "the ischial spine of the coxal bone", "vertebra T4", "the
// seventh rib".
const theMesh=(id:string)=>{const l=meshLabel(id);return /^vertebra /.test(l)?l:'the '+l;};
export function clickedWhat(target:Item,mesh:string,p:Point,normal?:Point){
 const e=target.entry,inst=instanceMeshes(target),bone=bonesOfMesh(mesh)[0];
 if(inst.length&&!inst.includes(mesh)&&serialMesh(mesh))return `${theMesh(mesh)}, not the highlighted ${e.kind==='joint'?'bones':SERIAL[e.bone]}`;
 if(e.kind==='joint'){const j=nearestJoint(mesh,p);if(j)return `the ${lowerFirst(jointById.get(j)!.label)}`;}
 if(e.kind==='landmark'){const near=landmarkNear(mesh,p,.015,normal,wholeOf(e.id));
  if(near&&near.id!==e.id)return `the ${withBone(lowerFirst(near.name).replace(' / ',' or '),near.entry.bone)}`;
  if(boneMeshes[e.bone].includes(mesh)&&farFace(e.id,p,normal))return `the other face of the ${boneName(e.bone)}`;}
 return !bone?'a structure not on the list':serialMesh(mesh)?theMesh(mesh):bonePhrase(bone);
}
// Find it: what the model shows while asking. Landmarks inside the cranium open the skull base, as in Explore; those
// inside a joint show the partner bone see-through (the fovea through the coxal bone); a landmark on one vertebra or
// rib, or a joint between them, has those bones highlighted. The camera starts on the named or highlighted bones.
const HIDDEN_BY:Record<string,string>={'femur-mark-1':'coxal','coxal-mark-0':'femur','sacrum-mark-0':'coxal'};
export function findStage(i:Item){const e=i.entry,inst=instanceMeshes(i),partner=HIDDEN_BY[i.id];
 return {scope:e.kind==='landmark'&&baseBones.includes(e.bone)?'skull-base' as const:undefined,ghost:partner?boneMeshes[partner]:[],partner:partner&&boneName(partner),highlight:inst,focus:inst.length?inst:e.kind==='landmark'?boneMeshes[e.bone]:[]};}
