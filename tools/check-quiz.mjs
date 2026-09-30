// Checks Quiz me against the course data and the model: typed answers, Name-it and Articulations choices, and that
// every Find-it question can be clicked and is scored right. It loads lib/quiz.ts through Vite (no browser needed).
// Run after changing the catalog, landmarks, joints or quiz rules:  node tools/check-quiz.mjs [--verbose]
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
import * as THREE from 'three';
const verbose=process.argv.includes('--verbose'),root=new URL('..',import.meta.url).pathname;
const server=await createServer({root,configFile:false,logLevel:'error',server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
const Q=await server.ssrLoadModule('/lib/quiz.ts'),A=await server.ssrLoadModule('/lib/atlas.ts'),{normalize,nameDistance}=await server.ssrLoadModule('/lib/match.ts');await server.close();
const {items,itemById,typedAnswer,nameChoices,articQuestions,articChoices,articTruth,findHit,findWhat,findStage,instanceMeshes}=Q,{boneMeshes,defaultAnnotations,jointById,meshIndex,meshInScope,mirror}=A;
const lmMesh=JSON.parse(readFileSync(root+'lib/landmark-meshes.json','utf8'));
let failures=0,warnings=0;const fail=(...m)=>{failures++;console.log('FAIL',...m);},warn=(...m)=>{warnings++;console.log('warn',...m);};
const norm=s=>s.toLowerCase();
// 1. Typed answers: every name and alternative is accepted for its own item and never for another of the same kind.
for(const i of items){for(const n of [i.name,...i.aka])if(typedAnswer(n,i)!=='right')fail(`typed "${n}" rejected for ${i.id}`);
 for(const o of items)if(o!==i&&o.entry.kind===i.entry.kind&&!i.same?.includes(o.id)&&normalize(o.name)!==normalize(i.name))for(const n of [o.name,...o.aka])if(typedAnswer(n,i)==='right'&&!(i.aka.some(a=>norm(a)===norm(n))))fail(`typed "${n}" (${o.id}) accepted for ${i.id}`);}
// Nor for a structure of another kind, unless it is one of that structure's own names too ("hip" for the coxal bone and
// the hip joint): "inferior concha" is not the superior nasal conchae, "ankle" is not the angle of the mandible.
for(const i of items)for(const o of items)if(o.entry.kind!==i.entry.kind&&!i.same?.includes(o.id))for(const n of [o.name,...o.aka]){const d=nameDistance(n,i);if(d>0&&d<=3&&typedAnswer(n,i)==='right')fail(`typed "${n}" (${o.id}, ${o.entry.kind}) accepted for ${i.id}`);}
// A swap of two neighbouring letters ("humreus") never makes one structure's name pass for another's.
for(const i of items){const n=i.name.toLowerCase();for(let k=0;k+1<n.length;k++){if(n[k]===n[k+1]||!/[a-z]/.test(n[k]+n[k+1]))continue;const t=n.slice(0,k)+n[k+1]+n[k]+n.slice(k+2);
 for(const o of items)if(o!==i&&!o.same?.includes(i.id)&&normalize(o.name)!==normalize(i.name)&&(o.entry.kind===i.entry.kind||nameDistance(t,o)<=3&&nameDistance(t,o)>nameDistance(t,i))&&typedAnswer(t,o)==='right')fail(`typo "${t}" of ${i.id} accepted for ${o.id}`);}}
const must=[['hip bone','coxal'],['hip','coxal'],['hip joint','joint-hip'],['hip','joint-hip'],['jugular notch','sternum-mark-0'],['C1','atlas'],['C2','axis'],['xiphoid','xiphoid'],['ASIS','coxal-mark-3'],['PSIS','coxal-mark-5'],['centrum','vertebrae-mark-0'],['costal facet','thoracic-vertebrae-mark-0'],['supraorbital notch','frontal-mark-1'],['external acoustic meatus','temporal-2'],['internal acoustic meatus','temporal-3'],['optic foramen','sphenoid-4'],['inion','occipital-3'],['mandibular condyle','mandible-mark-4'],['hypophyseal fossa','sphenoid-5'],['sella turcica','sphenoid-6'],['pituitary fossa','sphenoid-5'],['fovea capitis','femur-mark-1'],['glenoid fossa','scapula-mark-13'],['angel','mandible-mark-2'],['ankel','joint-talocrural'],['supraorbital rim','frontal-mark-0'],['intercondylar notch','femur-mark-9'],['greater tuberosity','h-greater-tubercle'],['radial styloid','radius-mark-3'],['ulnar styloid process','ulna-mark-2'],['femoral head','femur-mark-0'],['radial head','radius-mark-0'],['tibial crest','tibia-mark-4'],['anterior crest','tibia-mark-4'],['coracoid','scapula-mark-12'],['lateral end','clavicle-mark-0'],['medial end','clavicle-mark-1'],['atlantoaxial joint','joint-atlantoaxial'],['metacarpal 2','metacarpal-II'],['second metacarpal','metacarpal-II'],['proximal phalanx of the thumb','hand-digit-1-proximal'],['distal phalanx of the great toe','foot-digit-1-distal'],['humreus','humerus'],['raduis','radius'],['feumr','femur'],['patlela','patella'],['hyiod','hyoid'],['iscihal tuberosity','coxal-mark-13'],['dens','axis-mark-0']];
const mustNot=[['coronoid','scapula-mark-12'],['C2','atlas'],['C1','axis'],['internal acoustic meatus','temporal-2'],['external acoustic meatus','temporal-3'],['mandibular condyle','mandible-mark-5'],['lesser horn','hyoid-mark-1'],['greater horn','hyoid-mark-2'],['supraorbital notch','frontal-mark-0'],['notch','frontal-mark-1'],['crest','tibia-mark-4'],['medial condyle','femur-mark-5'],['ASIS','coxal-mark-5'],['inferior articular facet','vertebrae-mark-7'],['radial styloid','ulna-mark-2'],['glenoid fossa','temporal-1'],['inferior nasal conchae','ethmoid-4'],['superior concha','inferior-conchae'],['ankle','mandible-mark-2'],['angle','joint-talocrural'],['hip bone','joint-hip'],['hip joint','coxal']];
for(const [n,id] of must)if(typedAnswer(n,itemById.get(id))!=='right')fail(`typed "${n}" should be right for ${id}`);
for(const [n,id] of mustNot)if(typedAnswer(n,itemById.get(id))==='right')fail(`typed "${n}" should not be right for ${id}`);
if(typedAnswer('pubis',itemById.get('coxal-mark-16'))!=='part'||typedAnswer('femur',itemById.get('femur-mark-5'))!=='part'||typedAnswer('supraorbital margin',itemById.get('frontal-mark-1'))!=='part')fail('naming the bone or region of a landmark should be a hint, not wrong');
// 2. Name-it choices: four different names, never two right answers.
for(const i of items)for(let k=0;k<40;k++){const c=nameChoices(i).map(id=>itemById.get(id));
 if(!c.includes(i)||new Set(c.map(x=>norm(x.name))).size!==c.length)fail(`name choices for ${i.id}: ${c.map(x=>x.name)}`);
 const bad=c.find(x=>x!==i&&(i.same?.includes(x.id)||Q.nested(i.id,x.id)));if(bad){fail(`name choices for ${i.id} include ${bad.id}`);break;}}
// 3. Articulations: single-surface answers, no true partner as a distractor, readable prompts.
for(const q of articQuestions()){if(q.answer.includes(' + '))fail(`multi-part answer: ${q.prompt}`);if(/\(\(|\) \(|\bof the (scapulae|clavicles|vertebrae|ribs|coxal bones|temporal bones)\b/.test(q.prompt))fail(`prompt wording: ${q.prompt}`);
 for(let k=0;k<60;k++){const c=articChoices(q);if(!c.includes(q.answer)||new Set(c).size!==c.length){fail(`choices for ${q.id}: ${c}`);break;}
  if(q.surface!==undefined){const t=articTruth(q),x=c.find(o=>o!==q.answer&&t.has(normalize(o)));if(x){fail(`${q.id} offers a true partner: ${x}`);break;}}}
 if(verbose)console.log('artic',q.prompt,'->',q.answer);}
// 4. Find it, scoring: a click on a landmark's own point counts; a click on another landmark's point does not (unless
// the asked one is a region containing it, or the same spot, or the other is ilium, ischium or pubis, whose points sit on
// their sub-features). A part never takes its region's point: the body of the mandible is not the mental foramen.
const mayTake=(a,b)=>!!(Q.PARTS[a]?.includes(b)||Q.SHARED[b]?.includes(a)||Q.WHOLE.includes(b));
const models=new Map(JSON.parse(readFileSync(root+'public/model.json','utf8')).map(m=>[m.id,m])),meshes=new Map();
for(const [id,m] of models){const P=m.positions,I=[...m.indices];let vol=0;for(let k=0;k<I.length;k+=3){const a=I[k]*3,b=I[k+1]*3,c=I[k+2]*3;vol+=P[a]*(P[b+1]*P[c+2]-P[b+2]*P[c+1])-P[a+1]*(P[b]*P[c+2]-P[b+2]*P[c])+P[a+2]*(P[b]*P[c+1]-P[b+1]*P[c]);}
 if(vol<0)for(let k=0;k<I.length;k+=3){const t=I[k+1];I[k+1]=I[k+2];I[k+2]=t;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setIndex(I);g.computeBoundingBox();g.computeBoundingSphere();const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.userData.id=id;meshes.set(id,mesh);}
const landmarks=items.filter(i=>i.entry.kind==='landmark'),copyOf=(i,side)=>{const p=defaultAnnotations[i.id].point,x=Math.abs(p[0]);return side==='right'?[-x,p[1],p[2]]:[x,p[1],p[2]];};
const normalOf=(i,side)=>{const n=lmMesh[i.id].normal;return n&&(side==='left'?mirror(n):n);};
for(const a of landmarks)for(const side of ['right','left']){const mesh=lmMesh[a.id][side];
 if(!findHit(a,mesh,copyOf(a,side),normalOf(a,side)))fail(`click on its own point rejected: ${a.id} (${side})`);
 for(const b of landmarks)if(b!==a&&b.entry.bone===a.entry.bone&&findHit(a,lmMesh[b.id][side],copyOf(b,side),normalOf(b,side))&&!a.same?.includes(b.id)){if(mayTake(a.id,b.id))continue;const d=Math.hypot(...[0,1,2].map(k=>copyOf(a,side)[k]-copyOf(b,side)[k]));(d<.0065?warn:fail)(`${b.id} "${b.name}" point accepted for ${a.id} "${a.name}" (${(d*1000).toFixed(1)} mm apart)`);}}
// Clicks that must (true) or must not (false) count: across the femur from the linea aspera, the parietal beside the
// sagittal suture, the outside of the ramus, the other face of thin plates, another vertebra's spinous process.
const tri=new THREE.Triangle(),cp=new THREE.Vector3();
function surf(id,p){const g=meshes.get(id).geometry,pos=g.attributes.position,ix=g.index,t=new THREE.Vector3(...p);let best={d:Infinity};
 for(let k=0;k<ix.count;k+=3){tri.setFromAttributeAndIndices(pos,ix.getX(k),ix.getX(k+1),ix.getX(k+2));tri.closestPointToPoint(t,cp);const d=cp.distanceTo(t);if(d<best.d)best={d,q:cp.toArray(),n:tri.getNormal(new THREE.Vector3()).toArray()};}return best;}
const R=id=>{const p=defaultAnnotations[id].point;return [-Math.abs(p[0]),p[1],p[2]];},behind=(id,mesh)=>{const n=lmMesh[id].normal,p=R(id);return [mesh,p.map((v,k)=>v-n[k]*.004)];};
const probes=[['femur-mark-4','v29',[-0.100,0.654,0.011],false],['femur-mark-4','v29',[-0.1054,0.5941,-0.0112],false],['femur-mark-4','v29',[-0.0945,0.58,-0.0211],true],['femur-mark-4','v29',[-0.1035,0.70,-0.0167],true],
 ['suture-sagittal','11',[-0.025,1.70,-0.03],false],['suture-sagittal','11',[-0.035,1.69,-0.03],false],['suture-sagittal','11',[-0.045,1.68,-0.03],false],['suture-sagittal','11',[-0.001,1.7008,-0.0447],true],['suture-coronal','13',[-0.03,1.69,0.03],true],
 ['mandible-mark-7','27',[-0.04418,1.5415,0.02],false],['mandible-mark-1','27',[-0.04418,1.5415,0.02],true],
 ['scapula-mark-10',...behind('scapula-mark-10','v103'),false],['scapula-mark-9',...behind('scapula-mark-9','v103'),false],['coxal-mark-8',...behind('coxal-mark-8','v141'),false],['coxal-mark-0','v141',[-0.04,0.877,-0.012],false],['h-olecranon-fossa',...behind('h-olecranon-fossa','123'),false],
 ['coxal-mark-8','v141',R('coxal-mark-1'),true],['coxal-mark-9','v141',R('coxal-mark-13'),true],['coxal-mark-9','v141',R('coxal-mark-2'),false],['coxal-mark-15','v141',R('coxal-mark-17'),true],['coxal-mark-1','v141',R('coxal-mark-3'),true],
 ['scapula-mark-9','v103',R('scapula-mark-7'),false],['scapula-mark-7','v103',R('scapula-mark-11'),false],['tibia-mark-0','v117',R('tibia-mark-1'),true],['femur-mark-0','v29',R('femur-mark-1'),true],['femur-mark-1','v29',R('femur-mark-0'),false],
 ['vertebrae-mark-1','v174',[0.0004,1.2651,-0.0982],false],['vertebrae-mark-7','v179',R('vertebrae-mark-7'),false],
 ['frontal-mark-0','13',[-0.012,1.6045,0.0764],true],['frontal-mark-0','13',[-0.02,1.612,0.0793],true],['frontal-mark-0','13',[-0.046,1.6075,0.0685],true],['frontal-mark-0','13',R('frontal-mark-1'),true],['frontal-mark-1','13',R('frontal-mark-0'),false]];
for(const [id,mesh,p,want] of probes){const s=surf(mesh,p);if(findHit(itemById.get(id),mesh,s.q,s.n)!==want)fail(`click at [${s.q.map(v=>v.toFixed(3))}] on ${mesh} should ${want?'':'not '}count for ${id}`);}
const joints=items.filter(i=>i.entry.kind==='joint');
for(const j of joints)for(const [k,s] of jointById.get(j.id).surfaces.entries()){if(!findHit(j,s.mesh,s.point))fail(`joint ${j.id} surface ${k} rejected`);
 for(const o of joints)if(o!==j&&findHit(o,s.mesh,s.point))fail(`joint ${o.id} accepts ${j.id} surface "${s.label}"`);}
// 5. Find it, reach: from many directions, a click aimed at the landmark (or joint surface) with the question's model
// state (skull base open, see-through partner bone) must land somewhere findHit accepts. Cameras sit 30 cm away, so
// outside the body.
const dirs=[];for(let k=0;k<96;k++){const y=1-(k+.5)/48,r=Math.sqrt(1-y*y),t=k*2.39996;dirs.push(new THREE.Vector3(Math.cos(t)*r,y,Math.sin(t)*r));}
const ray=new THREE.Raycaster(),boxes=new Map([...meshes].map(([id,m])=>[id,m.geometry.boundingBox]));
function reach(item,targets){const st=findStage(item),shown=meshIndex.filter(m=>meshInScope(m,st.scope??'all')||st.highlight.includes(m.id)).map(m=>m.id).filter(id=>!st.ghost.includes(id));let ok=0;
 for(const d of dirs){let hit=false;for(const {p} of targets){const target=new THREE.Vector3(...p),eye=target.clone().addScaledVector(d,.3);
   const near=shown.filter(id=>boxes.get(id).distanceToPoint(target)<.31).map(id=>meshes.get(id));ray.set(eye,d.clone().negate());ray.far=.35;const h=ray.intersectObjects(near,false)[0];
   if(!h)continue;const n=h.face.normal.clone();if(n.dot(ray.ray.direction)>0)n.negate();if(findHit(item,h.object.userData.id,h.point.toArray(),n.toArray())){hit=true;break;}}
  if(hit)ok++;}
 return ok;}
const reachOf=new Map();
for(const i of [...landmarks,...joints]){const targets=i.entry.kind==='landmark'?['right','left'].map(s=>({p:copyOf(i,s)})):jointById.get(i.id).surfaces.flatMap(s=>[{p:s.point},{p:mirror(s.point)}]);
 const n=reach(i,targets);reachOf.set(i.id,n);if(!n)fail(`Find it: ${i.id} "${findWhat(i)}" cannot be clicked from any direction`);else if(n<6)warn(`Find it: ${i.id} "${findWhat(i)}" can be clicked from only ${n} of ${dirs.length} directions`);
 if(verbose)console.log('find',String(n).padStart(3),i.id,'Click',findWhat(i),instanceMeshes(i).length?`[${instanceMeshes(i)}]`:'');}
console.log(`${items.length} items, ${articQuestions().length} articulation questions: ${failures} failures, ${warnings} warnings`);
process.exit(failures?1:0);
