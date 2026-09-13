import rawCatalog from './catalog.json';
import index from './model-index.json';
import legacyIds from './legacy-ids.json';
import published from './published-annotations.json';
import retiredIds from './retired-ids.json';
export type Region='skull'|'spine'|'thorax'|'shoulder'|'humerus'|'forearm'|'hand'|'pelvis'|'thigh'|'leg'|'foot';
export type Scope=Region|'all'|'axial'|'appendicular'|'skull-base';
export type Side='both'|'left'|'right';
export type Point=[number,number,number];
export type Entry={id:string;label:string;bone:string;region:Region;system:'axial'|'appendicular';kind:'bone'|'landmark';point:Point|null;note:string;unavailable?:boolean;sourceAnchor?:string};
export type Annotation={point:Point;reviewed:boolean;radius:number;reviewedAt?:string;note?:string};
export type Annotations=Record<string,Annotation>;
export type MeshInfo={id:string;name:string;region:Region;system:string;side:string;tissue?:string;min:number[];max:number[]};
export const catalog=rawCatalog as Entry[];
export const boneMeshes=index.groups as Record<string,string[]>;
export const meshIndex=index.models as MeshInfo[];
export const scopeLabels:Record<Scope,string>={all:'Whole skeleton',axial:'Axial skeleton',appendicular:'Appendicular skeleton',skull:'Skull & hyoid','skull-base':'Skull base',spine:'Vertebral column',thorax:'Thoracic cage',shoulder:'Pectoral girdle',humerus:'Humerus',forearm:'Radius & ulna',hand:'Hand & wrist',pelvis:'Pelvic girdle',thigh:'Femur & patella',leg:'Tibia & fibula',foot:'Foot & ankle'};
export const baseBones=['occipital','sphenoid','temporal','ethmoid'];
export function inScope(e:Entry,scope:Scope){return scope==='all'||scope===e.system||scope===e.region||(scope==='skull-base'&&baseBones.includes(e.bone));}
export function meshInScope(m:MeshInfo,scope:Scope){return scope==='all'||scope===m.system||scope===m.region||(scope==='skull-base'&&['14','15','16','765','17'].includes(m.id))||(scope==='pelvis'&&/Sacrum|Coccyx/.test(m.name));}
export function pointSide(point:Point):Side{return point[0]<-.008?'right':point[0]>.008?'left':'both';}
export function pointInSide(point:Point,side:Side){return side==='both'||pointSide(point)==='both'||pointSide(point)===side;}
export const annotationRevision='instructor-review-2026-09-13';
export const defaultAnnotations:Annotations=parseAnnotations({version:1,annotations:published});
export function parseAnnotations(value:unknown):Annotations{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Choose an exported Bone Atlas annotations file.');
 const v=value as {version?:unknown;annotations?:unknown};if(v.version!==1||!v.annotations||typeof v.annotations!=='object'||Array.isArray(v.annotations))throw Error('This file is not a supported Bone Atlas export.');
 const out:Annotations={};for(const [id,a] of Object.entries(v.annotations as Record<string,unknown>)){
  // Old exports remain usable after an instructor retires a course target.
  if(retiredIds.includes(id))continue;
  const entry=catalog.find(e=>e.id===id&&e.kind==='landmark');if(!entry||!a||typeof a!=='object')throw Error('The file includes an unknown landmark.');
  const x=a as Annotation;if(!Array.isArray(x.point)||x.point.length!==3||x.point.some(n=>typeof n!=='number'||!Number.isFinite(n))||typeof x.reviewed!=='boolean'||typeof x.radius!=='number'||!Number.isFinite(x.radius)||x.radius<.002||x.radius>.018)throw Error('The file contains an invalid marker.');
  const allowed=meshIndex.filter(m=>boneMeshes[entry.bone].includes(m.id));const nearBone=allowed.some(m=>x.point.every((v,i)=>v>=m.min[i]-.035&&v<=m.max[i]+.035));if(!nearBone)throw Error('A marker is outside its associated bones.');
  if(x.note!==undefined&&(typeof x.note!=='string'||x.note.length>2000))throw Error('A review note is invalid or too long.');
  if(x.reviewedAt!==undefined&&(typeof x.reviewedAt!=='string'||!Number.isFinite(Date.parse(x.reviewedAt))))throw Error('A review date is invalid.');
  out[id]={point:[...x.point],reviewed:entry.unavailable?false:x.reviewed,radius:x.radius,...(x.note?{note:x.note}:{}),...(x.reviewedAt?{reviewedAt:x.reviewedAt}:{})};
 }return out;
}
export function restoreAnnotations(value:unknown):Annotations{
 const saved=parseAnnotations(value);const v=value as {catalogIds?:unknown;annotationRevision?:unknown};const known=Array.isArray(v.catalogIds)?new Set(v.catalogIds.filter(x=>typeof x==='string')):new Set(legacyIds);
 if(v.annotationRevision!==annotationRevision){
  // Publish the instructor's corrections once per revision. Keep later approvals
  // made on this device; subsequent loads preserve local edits and deletions.
  const merged={...saved};
  for(const [id,approved] of Object.entries(defaultAnnotations)){
   const local=saved[id];
   if(!local?.reviewedAt||Date.parse(local.reviewedAt)<=Date.parse(approved.reviewedAt!))merged[id]=approved;
  }
  return merged;
 }
 // Add new-course defaults without resurrecting markers deliberately removed in an earlier version.
 return {...Object.fromEntries(Object.entries(defaultAnnotations).filter(([id])=>!known.has(id))),...saved};
}
export function referenceUrl(region:Region){const page:Record<Region,string>={skull:'7-2-the-skull',spine:'7-3-the-vertebral-column',thorax:'7-4-the-thoracic-cage',shoulder:'8-1-the-pectoral-girdle',humerus:'8-2-bones-of-the-upper-limb',forearm:'8-2-bones-of-the-upper-limb',hand:'8-2-bones-of-the-upper-limb',pelvis:'8-3-the-pelvic-girdle-and-pelvis',thigh:'8-4-bones-of-the-lower-limb',leg:'8-4-bones-of-the-lower-limb',foot:'8-4-bones-of-the-lower-limb'};return 'https://openstax.org/books/anatomy-and-physiology-2e/pages/'+page[region];}
