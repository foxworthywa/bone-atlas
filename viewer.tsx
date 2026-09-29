'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Lateral,Point,Scope,Side,meshIndex,meshInScope} from '@/lib/atlas';
import {Display,Tone,colors} from '@/lib/display';
export type ViewName='anterior'|'posterior'|'superior'|'inferior'|'lateral'|'reset'|'focus'|'pivot';
export type Hit={mesh:string;point:Point;entry?:string};
type Props={display:Display;region:Scope;side:Side;focusSide:Lateral;isolate:boolean;view:{name:ViewName;sequence:number};onPick:(hit:Hit)=>void};
type Model={id:string;name:string;positions:number[];indices:number[]};
type Engine={group:THREE.Group;overlay:THREE.Group;camera:THREE.PerspectiveCamera;controls:OrbitControls;meshes:Map<string,THREE.Mesh>;fit:(name:ViewName)=>void;patches:{centers:THREE.Vector4[];colors:THREE.Color[]}};
const MAX_PATCHES=16;
const ivory=new THREE.Color('#e5dbc7'),cartilage=new THREE.Color('#a4bdc0');
const toneColor:Record<Tone,THREE.Color>={strong:new THREE.Color(colors.teal),soft:ivory.clone().lerp(new THREE.Color(colors.teal),.3),correct:new THREE.Color(colors.correct),wrong:new THREE.Color(colors.wrong)};
const ease=(t:number)=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
// Paints soft-edged surface patches (landmarks, articular surfaces) per fragment, so they stay round on coarse meshes.
function patchMaterial(shared:{uPatch:{value:THREE.Vector4[]};uPatchColor:{value:THREE.Color[]}}){
 const mat=new THREE.MeshStandardMaterial({color:ivory,roughness:.65,metalness:0,side:THREE.DoubleSide});const mask={value:0};mat.userData.mask=mask;
 mat.onBeforeCompile=s=>{
  Object.assign(s.uniforms,shared,{uMask:mask});
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vModelPos;').replace('#include <begin_vertex>','#include <begin_vertex>\nvModelPos=position;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 vModelPos;uniform vec4 uPatch[${MAX_PATCHES}];uniform vec3 uPatchColor[${MAX_PATCHES}];uniform int uMask;`).replace('#include <color_fragment>',`#include <color_fragment>
  for(int i=0;i<${MAX_PATCHES};i++){if(((uMask>>i)&1)==0)continue;vec4 p=uPatch[i];float t=1.0-smoothstep(p.w*.72,p.w,distance(vModelPos,p.xyz));diffuseColor.rgb=mix(diffuseColor.rgb,uPatchColor[i],t*.92);}`);
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
  scene.add(new THREE.HemisphereLight(0xfffcf0,0x65776b,2.2));for(const [pos,col,intensity] of [[[2,3,4],0xfff5dc,2.5],[[-2,1,-3],0xc4e3dd,1.9]] as [number[],number,number][]){const light=new THREE.DirectionalLight(col,intensity);light.position.fromArray(pos);scene.add(light);}
  const group=new THREE.Group(),overlay=new THREE.Group();scene.add(group);group.add(overlay);
  const patches={centers:Array.from({length:MAX_PATCHES},()=>new THREE.Vector4()),colors:Array.from({length:MAX_PATCHES},()=>new THREE.Color())};
  const shared={uPatch:{value:patches.centers},uPatchColor:{value:patches.colors}};
  // Camera moves glide instead of jumping; any drag or zoom by the student takes over immediately.
  let tween:{pos:[THREE.Vector3,THREE.Vector3];target:[THREE.Vector3,THREE.Vector3];t0:number;dur:number}|null=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const moveTo=(pos:THREE.Vector3,target:THREE.Vector3,dur=650)=>{tween={pos:[camera.position.clone(),pos],target:[controls.target.clone(),target],t0:performance.now(),dur:reduced?1:dur};};
  controls.addEventListener('start',()=>{tween=null;});
  fetch(new URL('./model.json',document.baseURI).href,{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('load');return r.json() as Promise<Model[]>;}).then(data=>{
   if(!active)return;const meshes=new Map<string,THREE.Mesh>();
   for(const bone of data){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(bone.positions,3));geo.setIndex(bone.indices);geo.computeVertexNormals();geo.computeBoundingBox();const mesh=new THREE.Mesh(geo,patchMaterial(shared));mesh.name=bone.name;mesh.userData.id=bone.id;mesh.userData.info=meshIndex.find(m=>m.id===bone.id);group.add(mesh);meshes.set(bone.id,mesh);}
   const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).length();group.position.copy(center).negate();controls.minDistance=.02;controls.maxDistance=size*4;
   const fit=(name:ViewName)=>{
    const p=latest.current,f=p.display.focus,b=new THREE.Box3(),visible=[...meshes.values()].filter(m=>m.visible);group.updateMatrixWorld(true);
    const local=new THREE.Box3();if(f.points.length){f.points.forEach(pt=>local.expandByPoint(new THREE.Vector3(...pt)));local.expandByScalar(f.pad);}else f.meshes.forEach(id=>{const m=meshes.get(id);if(m)local.union(m.geometry.boundingBox!);});
    const focused=['focus','pivot'].includes(name)&&!local.isEmpty();
    if(focused)b.copy(local).applyMatrix4(group.matrixWorld);else visible.forEach(m=>b.expandByObject(m));if(b.isEmpty())return;
    const mid=b.getCenter(new THREE.Vector3()),sz=b.getSize(new THREE.Vector3());
    if(name==='pivot'){moveTo(camera.position.clone().add(mid.clone().sub(controls.target)),mid,500);return;}
    const dist=Math.max(sz.length(),Math.max(sz.y,sz.x/camera.aspect))/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.2;
    const dirs:Record<string,number[]>={anterior:[0,0,1],posterior:[0,0,-1],superior:[0,1,.001],inferior:[0,-1,.001],lateral:p.focusSide==='left'?[1,0,0]:[-1,0,0],reset:['skull-base','pelvis'].includes(p.region)?[.35,.9,.6]:[.1,.05,1]};
    const direction=name==='focus'?(f.dir?new THREE.Vector3(...f.dir):camera.position.clone().sub(controls.target)).normalize():new THREE.Vector3().fromArray(dirs[name]).normalize();
    camera.up.set(0,1,0);if(name==='superior')camera.up.set(0,0,-1);if(name==='inferior')camera.up.set(0,0,1);
    moveTo(mid.clone().add(direction.multiplyScalar(Math.max(dist,controls.minDistance*1.5))),mid);
   };
   engine.current={group,overlay,camera,controls,meshes,fit,patches};group.updateMatrixWorld(true);fit('reset');if(tween)tween.dur=1;setStatus('');setReady(v=>v+1);
  }).catch(e=>{if(active&&e.name!=='AbortError')setStatus('The anatomical model could not load. Please try again.');});
  const resize=()=>{const w=Math.max(div.clientWidth,1),h=Math.max(div.clientHeight,1);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(div);resize();
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=[0,0];
  const cast=(e:MouseEvent)=>{const en=engine.current;if(!en)return null;const b=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);ray.setFromCamera(pointer,camera);
   const markers=en.overlay.children.filter(o=>o.userData.entry&&o.visible);const hit=ray.intersectObjects([...markers,...[...en.meshes.values()].filter(m=>m.visible)],false)[0];return hit?{hit,en}:null;};
  const onDown=(e:PointerEvent)=>{down=[e.clientX,e.clientY];};
  const onUp=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=cast(e);if(!r)return;const {hit,en}=r;const point=en.group.worldToLocal(hit.point.clone()).toArray() as Point;
   latest.current.onPick({mesh:hit.object.userData.id,point,entry:hit.object.userData.entry});};
  // Double-click (or double-tap) a spot to make it the centre of rotation.
  const onDouble=(e:MouseEvent)=>{const r=cast(e);if(!r)return;const target=r.hit.point.clone();moveTo(camera.position.clone().add(target.clone().sub(controls.target)),target,450);};
  const onKey=(e:KeyboardEvent)=>{const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'];if(!keys.includes(e.key))return;e.preventDefault();tween=null;const offset=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(offset);if(e.key==='ArrowLeft')s.theta-=.12;if(e.key==='ArrowRight')s.theta+=.12;if(e.key==='ArrowUp')s.phi-=.12;if(e.key==='ArrowDown')s.phi+=.12;if(e.key==='+'||e.key==='=')s.radius*=.85;if(e.key==='-')s.radius*=1.15;s.makeSafe();s.radius=THREE.MathUtils.clamp(s.radius,controls.minDistance,controls.maxDistance);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();};
  renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp);renderer.domElement.addEventListener('dblclick',onDouble);renderer.domElement.addEventListener('keydown',onKey);
  const v=new THREE.Vector3(),w=new THREE.Vector3();
  renderer.setAnimationLoop(now=>{
   if(tween){const k=Math.min(1,(now-tween.t0)/tween.dur),t=ease(k);camera.position.lerpVectors(tween.pos[0],tween.pos[1],t);controls.target.lerpVectors(tween.target[0],tween.target[1],t);if(k>=1)tween=null;}
   controls.update();
   const en=engine.current;if(en){
    // Bones slide smoothly when a joint is pulled apart or closed.
    for(const m of en.meshes.values()){const t=m.userData.offset as THREE.Vector3|undefined;if(t&&!m.position.equals(t)){m.position.lerp(t,reduced?1:.14);if(m.position.distanceTo(t)<1e-5)m.position.copy(t);}}
    // Markers keep a steady on-screen size at any zoom.
    for(const o of en.overlay.children)if(o.userData.size){o.getWorldPosition(w);o.scale.setScalar(Math.min(Math.max(w.distanceTo(camera.position)*o.userData.size,.0012),.012));}
    const b=div.getBoundingClientRect();for(const el of Array.from(labels.children) as HTMLElement[]){const p=JSON.parse(el.dataset.point!);v.set(p[0],p[1],p[2]).applyMatrix4(en.group.matrixWorld).project(camera);const off=v.z>1||Math.abs(v.x)>1.1||Math.abs(v.y)>1.1;el.style.display=off?'none':'';el.style.transform=`translate(${(v.x+1)/2*b.width}px,${(1-v.y)/2*b.height}px)`;}
   }
   renderer.render(scene,camera);
  });
  return()=>{active=false;abort.abort();engine.current=null;ro.disconnect();controls.dispose();renderer.setAnimationLoop(null);scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
 },[retry]);
 useEffect(()=>{const en=engine.current,labels=labelHost.current;if(!en||!labels)return;const {display:d}=props;
  const patchMeshes=new Set(d.patches.map(p=>p.mesh)),masks=new Map<string,number>();
  d.patches.slice(0,MAX_PATCHES).forEach((p,i)=>{en.patches.centers[i].set(p.point[0],p.point[1],p.point[2],p.radius);en.patches.colors[i].set(p.color);masks.set(p.mesh,(masks.get(p.mesh)??0)|1<<i);});
  for(const [id,mesh] of en.meshes){const info=mesh.userData.info,tone=d.tones.get(id);
   mesh.visible=(props.isolate?d.tones.has(id)||patchMeshes.has(id):meshInScope(info,props.region)||d.tones.has(id)||patchMeshes.has(id))&&(props.side==='both'||info.side==='midline'||info.side===props.side);
   const mat=mesh.material as THREE.MeshStandardMaterial;mat.color.copy(tone?toneColor[tone]:info.tissue==='cartilage'?cartilage:ivory);mat.userData.mask.value=masks.get(id)??0;
   const faded=d.fade&&!tone&&!patchMeshes.has(id);if(mat.transparent!==faded){mat.transparent=faded;mat.opacity=faded?.14:1;mat.depthWrite=!faded;mat.needsUpdate=true;}
   const o=d.offsets.get(id);mesh.userData.offset=new THREE.Vector3(...(o??[0,0,0]));}
  for(const child of [...en.overlay.children]){en.overlay.remove(child);const m=child as THREE.Mesh;m.geometry.dispose();(m.material as THREE.Material).dispose();}
  for(const m of d.markers){const sphere=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshStandardMaterial({color:m.color,emissive:m.color,emissiveIntensity:m.size==='lg'?.35:0,roughness:.5}));sphere.position.fromArray(m.point);sphere.userData={entry:m.entry,size:m.size==='lg'?.011:.0065};sphere.renderOrder=2;en.overlay.add(sphere);}
  for(const l of d.lines){const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...l.from),new THREE.Vector3(...l.to)]);const line=new THREE.Line(geo,new THREE.LineDashedMaterial({color:l.color,dashSize:.003,gapSize:.002,depthTest:false,transparent:true,opacity:.85}));line.computeLineDistances();line.renderOrder=3;en.overlay.add(line);}
  labels.replaceChildren(...d.labels.map((l,i)=>{const el=document.createElement('span');el.className='surface-label'+(i%2?' below':'');el.textContent=l.text;el.style.setProperty('--label-color',l.color);el.dataset.point=JSON.stringify(l.point);return el;}));
 },[props.display,props.isolate,props.region,props.side,ready]);
 useEffect(()=>{engine.current?.fit(props.view.name);},[props.view,ready]);
 return <><div ref={host} className="canvas-host"/><div ref={labelHost} className="surface-labels" aria-hidden="true"/>{status&&<div role="status" className="model-status">{status}{!status.startsWith('Loading')&&<button onClick={()=>setRetry(v=>v+1)}>Retry loading</button>}</div>}</>;
}
