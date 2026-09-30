'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Lateral,Point,Scope,Side,meshIndex,meshInScope} from '@/lib/atlas';
import {Display,Tone,colors} from '@/lib/display';
// 'side': like 'focus', but from the mirrored direction (the same view of the other side's bone).
export type ViewName='anterior'|'posterior'|'superior'|'inferior'|'lateral'|'reset'|'focus'|'pivot'|'side';
// normal: the clicked face's normal turned toward the camera (which face of a thin plate was clicked), in model space.
export type Hit={mesh:string;point:Point;entry?:string;normal?:Point};
type Props={display:Display;region:Scope;side:Side;focusSide:Lateral;isolate:boolean;view:{name:ViewName;sequence:number};onPick:(hit:Hit)=>void};
type Model={id:string;name:string;positions:number[];indices:number[]};
type Engine={group:THREE.Group;overlay:THREE.Group;camera:THREE.PerspectiveCamera;controls:OrbitControls;meshes:Map<string,THREE.Mesh>;fit:(name:ViewName)=>void;patches:{centers:THREE.Vector4[];colors:THREE.Color[];normals:THREE.Vector3[]};reveal:{key:string}};
const MAX_PATCHES=16;
const ivory=new THREE.Color('#e5dbc7'),cartilage=new THREE.Color('#a4bdc0');
const toneColor:Record<Tone,THREE.Color>={strong:new THREE.Color(colors.teal),soft:ivory.clone().lerp(new THREE.Color(colors.teal),.3),correct:new THREE.Color(colors.correct),wrong:new THREE.Color(colors.wrong)};
const ease=(t:number)=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
// Outward normal where a point lies on a bone's surface: the closest face's normal averaged with nearby faces on the
// same side, so a point on the wall of a foramen faces out of the hole. Null when the point is not on the surface.
const tri=new THREE.Triangle(),tmp=new THREE.Vector3(),normalCache=new Map<string,THREE.Vector3|null>();
function surfaceNormal(mesh:THREE.Mesh|undefined,p:Point){
 if(!mesh)return null;const key=mesh.userData.id+':'+p.join();if(normalCache.has(key))return normalCache.get(key)!;
 const g=mesh.geometry,pos=g.attributes.position,idx=g.index!,v=new THREE.Vector3(...p),near:[THREE.Vector3,number][]=[];let best=Infinity,n:THREE.Vector3|null=null;
 if(g.boundingBox!.distanceToPoint(v)<.001)for(let i=0;i<idx.count;i+=3){tri.setFromAttributeAndIndices(pos,idx.getX(i),idx.getX(i+1),idx.getX(i+2));tri.closestPointToPoint(v,tmp);const d=tmp.distanceTo(v);if(d>.004)continue;const fn=tri.getNormal(new THREE.Vector3());near.push([fn,tri.getArea()]);if(d<best){best=d;n=fn;}}
 if(n&&best<.0004){const sum=new THREE.Vector3();for(const [fn,a] of near)if(fn.dot(n)>-.3)sum.addScaledVector(fn,a);n=sum.normalize();}else n=null;
 normalCache.set(key,n);return n;
}
function setFaded(mesh:THREE.Mesh,faded:boolean){const mat=mesh.material as THREE.MeshStandardMaterial;if(mat.transparent!==faded){mat.transparent=faded;mat.opacity=faded?.14:1;mat.depthWrite=!faded;mat.needsUpdate=true;}}
const focusKey=(d:Display)=>JSON.stringify([d.focus.points,d.focus.meshes]);
// Directions a focus view may turn to: the 26 of a cube, then a denser sphere for points that only show through a
// narrow opening (the sacral canal, through the sacral hiatus).
const cube:THREE.Vector3[]=[],sphere:THREE.Vector3[]=[];
for(const x of [-1,0,1])for(const y of [-1,0,1])for(const z of [-1,0,1])if(x||y||z)cube.push(new THREE.Vector3(x,y,x||z?z:.02).normalize());
for(let i=0;i<160;i++){const y=1-(i+.5)/80,r=Math.sqrt(1-y*y),a=i*2.39996;sphere.push(new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r));}
// Paints soft-edged surface patches (landmarks, articular surfaces) per fragment, so they stay round on coarse meshes.
// A patch with a normal fades out on faces turned away from it, so it does not show on the far side of thin bone.
function patchMaterial(shared:{uPatch:{value:THREE.Vector4[]};uPatchColor:{value:THREE.Color[]};uPatchNormal:{value:THREE.Vector3[]}}){
 const mat=new THREE.MeshStandardMaterial({color:ivory,roughness:.65,metalness:0,side:THREE.DoubleSide});const mask={value:0};mat.userData.mask=mask;
 mat.onBeforeCompile=s=>{
  Object.assign(s.uniforms,shared,{uMask:mask});
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vModelPos;varying vec3 vModelNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvModelPos=position;vModelNormal=normal;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 vModelPos;varying vec3 vModelNormal;uniform vec4 uPatch[${MAX_PATCHES}];uniform vec3 uPatchColor[${MAX_PATCHES}];uniform vec3 uPatchNormal[${MAX_PATCHES}];uniform int uMask;`).replace('#include <color_fragment>',`#include <color_fragment>
  for(int i=0;i<${MAX_PATCHES};i++){if(((uMask>>i)&1)==0)continue;vec4 p=uPatch[i];float t=1.0-smoothstep(p.w*.72,p.w,distance(vModelPos,p.xyz));vec3 pn=uPatchNormal[i];if(dot(pn,pn)>.5)t*=smoothstep(-.1,.3,dot(normalize(vModelNormal),pn));diffuseColor.rgb=mix(diffuseColor.rgb,uPatchColor[i],t*.92);}`);
 };
 return mat;
}
export default function Viewer(props:Props){
 const host=useRef<HTMLDivElement>(null),labelHost=useRef<HTMLDivElement>(null),engine=useRef<Engine|null>(null),latest=useRef(props);latest.current=props;
 const [status,setStatus]=useState('Loading anatomical model…'),[ready,setReady]=useState(0),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const div=host.current,labels=labelHost.current;if(!div||!labels)return;let active=true;const abort=new AbortController();setStatus('Loading anatomical model…');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.001,100);let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{setStatus('3D graphics are unavailable. Try a browser with WebGL enabled.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xffffff,0);renderer.outputColorSpace=THREE.SRGBColorSpace;div.appendChild(renderer.domElement);
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','3D specimen. Drag or use arrow keys to rotate; plus and minus to zoom; double-click a spot to rotate around it. Select structures with the course list.');
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.12;controls.rotateSpeed=.8;controls.zoomSpeed=1.1;controls.screenSpacePanning=true;controls.zoomToCursor=true;
  scene.add(new THREE.HemisphereLight(0xfffcf0,0x65776b,2.2));for(const [pos,col,intensity] of [[[2,3,4],0xfff5dc,2],[[-2,1,-3],0xc4e3dd,1.9]] as [number[],number,number][]){const light=new THREE.DirectionalLight(col,intensity);light.position.fromArray(pos);scene.add(light);}
  // A light from the camera evens out the key light on the body's left, so right-side views are not left in shadow.
  const head=new THREE.DirectionalLight(0xfff8ec,1.2),aim=new THREE.Object3D();head.position.set(.3,.5,1);aim.position.set(0,0,-1);head.target=aim;camera.add(head,aim);scene.add(camera);
  const group=new THREE.Group(),overlay=new THREE.Group();scene.add(group);group.add(overlay);
  const patches={centers:Array.from({length:MAX_PATCHES},()=>new THREE.Vector4()),colors:Array.from({length:MAX_PATCHES},()=>new THREE.Color()),normals:Array.from({length:MAX_PATCHES},()=>new THREE.Vector3())};
  const shared={uPatch:{value:patches.centers},uPatchColor:{value:patches.colors},uPatchNormal:{value:patches.normals}},reveal={key:''};
  // Camera moves glide instead of jumping; any drag or zoom by the student takes over immediately.
  let tween:{pos:[THREE.Vector3,THREE.Vector3];target:[THREE.Vector3,THREE.Vector3];t0:number;dur:number}|null=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const moveTo=(pos:THREE.Vector3,target:THREE.Vector3,dur=650)=>{tween={pos:[camera.position.clone(),pos],target:[controls.target.clone(),target],t0:performance.now(),dur:reduced?1:dur};};
  controls.addEventListener('start',()=>{tween=null;});
  fetch(new URL('./model.json',document.baseURI).href,{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('load');return r.json() as Promise<Model[]>;}).then(data=>{
   if(!active)return;const meshes=new Map<string,THREE.Mesh>();
   for(const bone of data){
    // Some mirrored copies (left skull bones, left costal cartilages) are stored inside-out; wind them outward so
    // their normals point out of the bone.
    const P=bone.positions,I=bone.indices;let vol=0;for(let k=0;k<I.length;k+=3){const a=I[k]*3,b=I[k+1]*3,c=I[k+2]*3;vol+=P[a]*(P[b+1]*P[c+2]-P[b+2]*P[c+1])-P[a+1]*(P[b]*P[c+2]-P[b+2]*P[c])+P[a+2]*(P[b]*P[c+1]-P[b+1]*P[c]);}
    if(vol<0)for(let k=0;k<I.length;k+=3){const t=I[k+1];I[k+1]=I[k+2];I[k+2]=t;}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setIndex(I);geo.computeVertexNormals();geo.computeBoundingBox();const mesh=new THREE.Mesh(geo,patchMaterial(shared));mesh.name=bone.name;mesh.userData.id=bone.id;mesh.userData.info=meshIndex.find(m=>m.id===bone.id);group.add(mesh);meshes.set(bone.id,mesh);}
   const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).length();group.position.copy(center).negate();controls.minDistance=.02;controls.maxDistance=size*4;
   const probe=new THREE.Raycaster();
   // A focus view keeps the requested direction when the focused point or bone can be seen from it. Otherwise it
   // turns to the nearest direction that shows it, preferring the face the point is on, or for a bone the outside of
   // the body. If nothing shows it (inside the skull, deep in a joint), the other bones turn see-through until the
   // focus changes, and the view faces it through as few of them as it can.
   const look=(d:Display,mid:THREE.Vector3,D:number,want:THREE.Vector3,visible:THREE.Mesh[])=>{
    const f=d.focus,point=f.points.length===1,keep=new Set([...f.meshes,...d.patches.map(p=>p.mesh)]),verts:[THREE.Vector3,THREE.Vector3][]=[];
    const n=point?surfaceNormal(meshes.get(f.meshes[0]),f.points[0]):null,p=point?new THREE.Vector3(...f.points[0]).applyMatrix4(group.matrixWorld):null;
    if(!point){const ms=f.meshes.map(id=>meshes.get(id)!).filter(Boolean),step=Math.max(1,Math.floor(ms.reduce((t,m)=>t+m.geometry.attributes.position.count,0)/24));let i=step>>1;
     for(const m of ms){const pos=m.geometry.attributes.position,nor=m.geometry.attributes.normal;for(;i<pos.count;i+=step){const nv=new THREE.Vector3().fromBufferAttribute(nor,i);verts.push([new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(m.matrixWorld).addScaledVector(nv,.001),nv]);}i-=pos.count;}
     if(!verts.length)return want;}
    // A point counts as seen when most of its marker is: the centre (2 mm out of the bone) and four spots 1.5 mm
    // around it across the view. A bone counts as seen when most of its sampled surface facing the camera is not
    // hidden by other bones.
    const centre=(dir:THREE.Vector3)=>p?p.clone().addScaledVector(n??dir,n?.002:.0015):mid;
    const sample=(dir:THREE.Vector3,eye:THREE.Vector3)=>{if(!p)return verts.filter(([v,nv])=>nv.dot(tmp.copy(eye).sub(v))>0).map(([v])=>v);const c=centre(dir),t=new THREE.Vector3().crossVectors(dir,Math.abs(dir.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0)).normalize(),u=new THREE.Vector3().crossVectors(dir,t);return [c,...[t,u,t.clone().negate(),u.clone().negate()].map(v=>c.clone().addScaledVector(v,.0015))];};
    const need=.6;
    // Share of the samples with nothing in the way of a camera at mid+dir*D; stops once it cannot reach need.
    const seen=(dir:THREE.Vector3,blockers:THREE.Mesh[])=>{const eye=mid.clone().addScaledVector(dir,D),pts=sample(dir,eye);let k=0,miss=0;
     for(const o of pts){const to=eye.clone().sub(o),far=to.length();probe.set(o,to.divideScalar(far));probe.far=far;if(!probe.intersectObjects(blockers,false).length)k++;else if(++miss>pts.length*(1-need))break;}
     return pts.length?k/pts.length:0;};
    const out=new THREE.Vector3(mid.x,0,mid.z);out.multiplyScalar(Math.min(1,out.length()/.06)/Math.max(out.length(),1e-6));
    const rank=(c:THREE.Vector3)=>point?.5*c.dot(want)+(n?c.dot(n):0)+.3*c.dot(out):.7*c.dot(want)+c.dot(out);
    let best=want,score=-1;
    const solid=visible.filter(m=>!(m.material as THREE.Material).transparent),order=[want,...[...cube].sort((a,b)=>rank(b)-rank(a))];
    for(const c of order){const v=seen(c,point?solid:solid.filter(m=>!keep.has(m.userData.id)));if(v>=need)return c.clone();if(v>score+.05){score=v;best=c;}}
    if(!point&&score>=.3)return best.clone();
    reveal.key=focusKey(d);for(const [id,m] of meshes)if(m.visible&&!keep.has(id))setFaded(m,true);
    // Each see-through surface in front of it counts against a direction.
    const own=point?solid.filter(m=>keep.has(m.userData.id)):[],faded=visible.filter(m=>!keep.has(m.userData.id));
    const haze=(c:THREE.Vector3)=>{const o=centre(c),to=mid.clone().addScaledVector(c,D).sub(o),far=to.length();probe.set(o,to.divideScalar(far));probe.far=far;return probe.intersectObjects(faded,false).length;};
    const clearest=(dirs:THREE.Vector3[])=>{let top=-Infinity;for(const c of dirs){const v=seen(c,own);if(v<need){if(top===-Infinity&&v>score+.05){score=v;best=c;}continue;}const k=rank(c)-.06*haze(c);if(k>top){top=k;best=c;}}return top>-Infinity;};
    if(!clearest(order)&&point)clearest([...sphere].sort((a,b)=>rank(b)-rank(a)));
    return best.clone();
   };
   const fit=(name:ViewName)=>{
    const p=latest.current,d=p.display,f=d.focus,b=new THREE.Box3(),visible=[...meshes.values()].filter(m=>m.visible);group.updateMatrixWorld(true);
    const local=new THREE.Box3();if(f.points.length){f.points.forEach(pt=>local.expandByPoint(new THREE.Vector3(...pt)));local.expandByScalar(f.pad);}else f.meshes.forEach(id=>{const m=meshes.get(id);if(m)local.union(m.geometry.boundingBox!);});
    const focused=['focus','pivot','side'].includes(name)&&!local.isEmpty();
    if(focused)b.copy(local).applyMatrix4(group.matrixWorld);else visible.forEach(m=>b.expandByObject(m));if(b.isEmpty())return;
    const mid=b.getCenter(new THREE.Vector3()),sz=b.getSize(new THREE.Vector3());
    if(name==='pivot'){moveTo(camera.position.clone().add(mid.clone().sub(controls.target)),mid,500);return;}
    const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),turn=name==='focus'||name==='side';let dist=Math.max(Math.max(sz.length(),Math.max(sz.y,sz.x/camera.aspect))/(2*tan)*1.2,controls.minDistance*1.5);
    const dirs:Record<string,number[]>={anterior:[0,0,1],posterior:[0,0,-1],superior:[0,1,.001],inferior:[0,-1,.001],lateral:p.focusSide==='left'?[1,0,0]:[-1,0,0],reset:['skull-base','pelvis'].includes(p.region)?[.35,.9,.6]:[.1,.05,1]};
    let direction=turn?(f.dir?new THREE.Vector3(...f.dir):camera.position.clone().sub(controls.target).multiply(new THREE.Vector3(name==='side'?-1:1,1,1))).normalize():new THREE.Vector3().fromArray(dirs[name]).normalize();
    // Up stays vertical: OrbitControls takes its orbit axis from the initial up, so a tilted up stops left/right orbit.
    camera.up.set(0,1,0);
    // Joints with several surfaces keep their own tuned view; slid-apart bones are still moving, so they are skipped.
    if(turn&&focused&&f.points.length<=1&&!d.offsets.size)direction=look(d,mid,dist,direction,visible);
    // Presets fit the extent across the view: seen from above, a standing skeleton is not 1.75 m wide.
    if(!turn){const z=direction.clone(),x=new THREE.Vector3().crossVectors(camera.up,z).normalize(),y=new THREE.Vector3().crossVectors(z,x);let w=0,h=0,depth=0;for(let i=0;i<8;i++){const c=new THREE.Vector3(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).sub(mid);w=Math.max(w,Math.abs(c.dot(x)));h=Math.max(h,Math.abs(c.dot(y)));depth=Math.max(depth,c.dot(z));}dist=Math.max(h,w/camera.aspect)/tan*1.25+depth;}
    moveTo(mid.clone().add(direction.multiplyScalar(dist)),mid);
   };
   engine.current={group,overlay,camera,controls,meshes,fit,patches,reveal};group.updateMatrixWorld(true);fit('reset');if(tween)tween.dur=1;setStatus('');setReady(v=>v+1);
  }).catch(e=>{if(active&&e.name!=='AbortError')setStatus('The anatomical model could not load. Please try again.');});
  const resize=()=>{const w=Math.max(div.clientWidth,1),h=Math.max(div.clientHeight,1);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(div);resize();
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=[0,0],pickTimer=0;
  // A see-through (faded) bone only catches a click when nothing solid is behind it.
  const cast=(e:MouseEvent)=>{const en=engine.current;if(!en)return null;const b=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);ray.setFromCamera(pointer,camera);
   const markers=en.overlay.children.filter(o=>o.userData.entry&&o.visible),shown=[...en.meshes.values()].filter(m=>m.visible),solid=shown.filter(m=>!(m.material as THREE.Material).transparent);
   const hit=ray.intersectObjects([...markers,...solid],false)[0]??ray.intersectObjects(shown,false)[0];return hit?{hit,en}:null;};
  const onDown=(e:PointerEvent)=>{if(e.isPrimary)down=[e.clientX,e.clientY];};
  // Picks use 'click' (primary button or one-finger tap, never a right-drag or the end of a pinch) and wait out the
  // double-click window, so a double-click only sets the centre of rotation: no new selection, no extra quiz answer.
  const onClick=(e:MouseEvent)=>{clearTimeout(pickTimer);if(e.detail>1||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=cast(e);if(!r)return;const {hit,en}=r;
   // Meshes are only translated, so the face normal is already in model space.
   const n=hit.face?.normal.clone();if(n&&n.dot(ray.ray.direction)>0)n.negate();
   const pick={mesh:hit.object.userData.id,point:en.group.worldToLocal(hit.point.clone()).toArray() as Point,entry:hit.object.userData.entry,normal:n?.toArray() as Point|undefined};pickTimer=window.setTimeout(()=>latest.current.onPick(pick),400);};
  // Double-click (or double-tap) a spot to make it the centre of rotation.
  const onDouble=(e:MouseEvent)=>{clearTimeout(pickTimer);const r=cast(e);if(!r)return;const target=r.hit.point.clone();moveTo(camera.position.clone().add(target.clone().sub(controls.target)),target,450);};
  // Modified keys stay with the browser (Ctrl/Cmd +/- zoom the page, Alt+Left goes back).
  const onKey=(e:KeyboardEvent)=>{const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'];if(!keys.includes(e.key)||e.ctrlKey||e.metaKey||e.altKey)return;e.preventDefault();tween=null;const offset=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(offset);if(e.key==='ArrowLeft')s.theta-=.12;if(e.key==='ArrowRight')s.theta+=.12;if(e.key==='ArrowUp')s.phi-=.12;if(e.key==='ArrowDown')s.phi+=.12;if(e.key==='+'||e.key==='=')s.radius*=.85;if(e.key==='-')s.radius*=1.15;s.makeSafe();s.radius=THREE.MathUtils.clamp(s.radius,controls.minDistance,controls.maxDistance);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();};
  renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('click',onClick);renderer.domElement.addEventListener('dblclick',onDouble);renderer.domElement.addEventListener('keydown',onKey);
  const v=new THREE.Vector3(),w=new THREE.Vector3(),sight=new THREE.Raycaster();let sighted=0;
  renderer.setAnimationLoop(now=>{
   if(tween){const k=Math.min(1,(now-tween.t0)/tween.dur),t=ease(k);camera.position.lerpVectors(tween.pos[0],tween.pos[1],t);controls.target.lerpVectors(tween.target[0],tween.target[1],t);if(k>=1)tween=null;}
   controls.update();
   const en=engine.current;if(en){
    // Bones slide smoothly when a joint is pulled apart or closed.
    for(const m of en.meshes.values()){const t=m.userData.offset as THREE.Vector3|undefined;if(t&&!m.position.equals(t)){m.position.lerp(t,reduced?1:.14);if(m.position.distanceTo(t)<1e-5)m.position.copy(t);}}
    // Markers keep a steady on-screen size at any zoom, and sit on their bone's surface instead of poking through it.
    // A few times a second: is bone in front of the selected marker? Then its faint copy shows through (the vertebral
    // foramen seen from above, a landmark on the far side after turning the model).
    const recheck=now-sighted>250,solid=recheck?[...en.meshes.values()].filter(m=>m.visible&&!(m.material as THREE.Material).transparent):[];if(recheck)sighted=now;
    for(const o of en.overlay.children)if(o.userData.size){o.getWorldPosition(w);o.scale.setScalar(Math.min(Math.max(w.distanceTo(camera.position)*o.userData.size,.0012),.012));if(o.userData.normal)o.position.copy(o.userData.base).addScaledVector(o.userData.normal,o.scale.x*.9);
     if(!o.children[0])continue;if(recheck){o.getWorldPosition(w);const to=w.sub(camera.position),far=to.length();sight.set(camera.position,to.divideScalar(far));sight.far=far-o.scale.x;o.userData.hidden=sight.intersectObjects(solid,false).length>0;}
     o.children[0].visible=!!en.reveal.key||!!o.userData.hidden;}
    // Each label sits beside its surface: above or below to the right, else on the other side or the left, whichever
    // keeps it clear of the labels placed before it and inside the view.
    const b=div.getBoundingClientRect(),placed:number[][]=[];for(const el of Array.from(labels.children) as HTMLElement[]){const p=JSON.parse(el.dataset.point!);v.set(p[0],p[1],p[2]).applyMatrix4(en.group.matrixWorld).project(camera);const off=v.z>1||Math.abs(v.x)>1.1||Math.abs(v.y)>1.1;el.style.display=off?'none':'';if(off)continue;
     const x=(v.x+1)/2*b.width,y=(1-v.y)/2*b.height,lw=el.offsetWidth,lh=el.offsetHeight,first=el.dataset.below?8:-30,other=first<0?8:-30,spots=[[8,first],[8,other],[-8-lw,first],[-8-lw,other]].map(([dx,dy])=>[x+dx,y+dy,lw,lh]);
     const pick=spots.find(r=>r[0]>=0&&r[0]+lw<=b.width&&!placed.some(q=>r[0]<q[0]+q[2]&&q[0]<r[0]+lw&&r[1]<q[1]+q[3]&&q[1]<r[1]+lh))??spots[0];placed.push(pick);el.style.transform=`translate(${pick[0]}px,${pick[1]}px)`;}
   }
   renderer.render(scene,camera);
  });
  return()=>{active=false;abort.abort();clearTimeout(pickTimer);engine.current=null;ro.disconnect();controls.dispose();renderer.setAnimationLoop(null);scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
 },[retry]);
 useEffect(()=>{const en=engine.current,labels=labelHost.current;if(!en||!labels)return;const {display:d}=props;
  // Isolate keeps what is focused (one side of a paired bone, a joint's bones, a landmark's bone) and painted meshes.
  const patchMeshes=new Set(d.patches.map(p=>p.mesh)),keep=new Set([...d.focus.meshes,...patchMeshes]),masks=new Map<string,number>();if(en.reveal.key!==focusKey(d))en.reveal.key='';
  d.patches.slice(0,MAX_PATCHES).forEach((p,i)=>{en.patches.centers[i].set(p.point[0],p.point[1],p.point[2],p.radius);en.patches.colors[i].set(p.color);const n=p.oneSided?surfaceNormal(en.meshes.get(p.mesh),p.point):null;en.patches.normals[i].set(0,0,0);if(n)en.patches.normals[i].copy(n);masks.set(p.mesh,(masks.get(p.mesh)??0)|1<<i);});
  for(const [id,mesh] of en.meshes){const info=mesh.userData.info,tone=d.tones.get(id);
   mesh.visible=(props.isolate?keep.has(id):meshInScope(info,props.region)||d.tones.has(id)||patchMeshes.has(id))&&(props.side==='both'||info.side==='midline'||info.side===props.side);
   const mat=mesh.material as THREE.MeshStandardMaterial;mat.color.copy(tone?toneColor[tone]:info.tissue==='cartilage'?cartilage:ivory);mat.userData.mask.value=masks.get(id)??0;
   setFaded(mesh,d.fade&&!tone&&!patchMeshes.has(id)||!!d.ghost?.includes(id)||!!en.reveal.key&&!keep.has(id));
   const o=d.offsets.get(id);mesh.userData.offset=new THREE.Vector3(...(o??[0,0,0]));}
  for(const child of [...en.overlay.children]){en.overlay.remove(child);child.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();(o.material as THREE.Material).dispose();}});}
  for(const m of d.markers){const sphere=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshStandardMaterial({color:m.color,emissive:m.color,emissiveIntensity:m.size==='lg'?.35:0,roughness:.5}));sphere.position.fromArray(m.point);sphere.scale.setScalar(.004);
   const n=m.mesh?surfaceNormal(en.meshes.get(m.mesh),m.point):null;sphere.userData={entry:m.entry,size:m.size==='lg'?.011:.0065,...(n?{normal:n.clone(),base:sphere.position.clone()}:{})};sphere.renderOrder=2;en.overlay.add(sphere);
   // A faint copy shows through bone while the rest is see-through for a hidden landmark, or bone hides it from the camera.
   if(m.size==='lg'){const ghost=new THREE.Mesh(sphere.geometry,new THREE.MeshBasicMaterial({color:m.color,transparent:true,opacity:.45,depthTest:false,depthWrite:false}));ghost.renderOrder=4;ghost.visible=false;sphere.add(ghost);}}
  for(const l of d.lines){const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...l.from),new THREE.Vector3(...l.to)]);const line=new THREE.Line(geo,new THREE.LineDashedMaterial({color:l.color,dashSize:.003,gapSize:.002,depthTest:false,transparent:true,opacity:.85}));line.computeLineDistances();line.renderOrder=3;en.overlay.add(line);}
  labels.replaceChildren(...d.labels.map((l,i)=>{const el=document.createElement('span');el.className='surface-label';if(i%2)el.dataset.below='1';el.textContent=l.text;el.style.setProperty('--label-color',l.color);el.dataset.point=JSON.stringify(l.point);return el;}));
 },[props.display,props.isolate,props.region,props.side,ready]);
 useEffect(()=>{engine.current?.fit(props.view.name);},[props.view,ready]);
 return <><div ref={host} className="canvas-host"/><div ref={labelHost} className="surface-labels" aria-hidden="true"/>{status&&<div role="status" className="model-status">{status}{!status.startsWith('Loading')&&<button onClick={()=>setRetry(v=>v+1)}>Retry loading</button>}</div>}</>;
}
