// What the viewer should emphasise: mesh tones, painted surface patches, point markers, labels and joint lines.
import {Annotation,Entry,Joint,Lateral,Point,boneMeshes,jointById,landmarkOnSide,meshById,meshOnSide,mirror,onSide,sideMeshes} from './atlas';
import landmarkMeshes from './landmark-meshes.json';
export type Tone='strong'|'soft'|'correct'|'wrong';
export type Patch={point:Point;radius:number;color:string;mesh:string};
export type Marker={point:Point;color:string;size:'lg'|'sm';entry?:string};
export type Label={point:Point;text:string;color:string};
export type Line={from:Point;to:Point;color:string};
// offsets slide whole meshes (a joint pulled apart); fade makes everything without a tone see-through.
export type Display={tones:Map<string,Tone>;patches:Patch[];markers:Marker[];labels:Label[];lines:Line[];offsets:Map<string,Point>;fade:boolean;focus:{meshes:string[];points:Point[];pad:number;dir?:Point}};
export const colors={teal:'#358574',amber:'#c57c32',joint:'#d4572a',joint2:'#2f6fd0',correct:'#2e9e57',wrong:'#8c5cf0'};
export const emptyDisplay=():Display=>({tones:new Map(),patches:[],markers:[],labels:[],lines:[],offsets:new Map(),fade:false,focus:{meshes:[],points:[],pad:0}});
const near=(p:Point,q:Point)=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);
const boxDistance=(m:{min:number[];max:number[]},p:Point)=>Math.hypot(...[0,1,2].map(i=>Math.max(m.min[i]-p[i],0,p[i]-m.max[i])));
// The mesh of a bone group that a point sits on (groups such as "ribs" hold many meshes). Landmarks use the mesh
// recorded by tools/derive-joints.mjs, since stacked vertebrae and ribs have overlapping boxes; the box guess below is
// the fallback if the annotations change without re-running it.
export function meshForPoint(bone:string,p:Point,id?:string){
 const known=id?(landmarkMeshes as Record<string,{right:string;left:string}>)[id]?.[p[0]>0?'left':'right']:undefined,m=known&&meshById.get(known);
 if(m&&boneMeshes[bone].includes(m.id)&&boxDistance(m,p)<.002)return m.id;
 let best='',d=Infinity;for(const id of boneMeshes[bone]){const m=meshById.get(id)!;const out=boxDistance(m,p);const c=near(p,[0,1,2].map(i=>(m.min[i]+m.max[i])/2) as Point);const score=out*10+c*.01;if(score<d){d=score;best=id;}}
 return best;
}
export function boneDisplay(e:Entry,side:Lateral,tone:Tone='strong'):Display{
 const d=emptyDisplay(),mine=sideMeshes(e.bone,side);
 for(const id of boneMeshes[e.bone])d.tones.set(id,mine.includes(id)?tone:'soft');
 d.focus.meshes=mine;return d;
}
export function landmarkDisplay(e:Entry,a:Annotation,side:Lateral,color=a.reviewed?colors.teal:colors.amber,d=emptyDisplay()):Display{
 const p=landmarkOnSide(e,a.point,side),mesh=meshForPoint(e.bone,p,e.id);
 d.patches.push({point:p,radius:Math.max(a.radius,.004),color,mesh});d.markers.push({point:p,color,size:'lg',entry:e.id});
 d.focus={meshes:[mesh],points:[p],pad:.03};return d;
}
// Copies of a surface to draw: one per side for midline joints (both occipital condyles), else the chosen side.
function copies(j:Joint,p:Point,mesh:string,side:Lateral):{point:Point;mesh:string}[]{
 if(!j.midline)return [{point:onSide(p,side),mesh:meshOnSide(mesh,side)}];
 const out=[{point:p,mesh}];if(Math.abs(p[0])>.004)out.push({point:mirror(p),mesh:meshOnSide(mesh,'left')});return out;
}
export function surfaceColor(j:Joint,i:number){const k=j.pairs?.findIndex(pair=>pair.includes(i))??0;return k===1?colors.joint2:colors.joint;}
export function partners(j:Joint,i:number){return j.pairs?j.pairs.filter(p=>p.includes(i)).flat().filter(k=>k!==i):j.surfaces.map((_,k)=>k).filter(k=>k!==i);}
const add=(p:Point,o?:Point):Point=>o?[p[0]+o[0],p[1]+o[1],p[2]+o[2]]:p;
// A joint's articular surfaces, labelled and linked. With apart, the moving bone slides away so the facing surfaces
// can be seen; with fade, the rest of the skeleton turns see-through.
export function jointDisplay(id:string,side:Lateral,{labels=true,only,apart=false,fade=false}:{labels?:boolean;only?:number[];apart?:boolean;fade?:boolean}={}):Display{
 const j=jointById.get(id)!,d=emptyDisplay(),drawn=j.surfaces.map(s=>copies(j,s.point,s.mesh,side));d.fade=fade;
 if(apart&&j.apart&&j.move){for(const i of j.move)for(const c of drawn[i])d.offsets.set(c.mesh,c.point[0]>0&&!j.midline?mirror(j.apart):j.apart);
  // Bones that travel with the moving one (the fibula with the tibia), so none is left standing in the gap.
  for(const bone of j.carry??[])for(const id of sideMeshes(bone,side))d.offsets.set(id,side==='left'&&!j.midline?mirror(j.apart):j.apart);}
 const at=(c:{point:Point;mesh:string})=>add(c.point,d.offsets.get(c.mesh));
 j.surfaces.forEach((s,i)=>{if(only&&!only.includes(i))return;const color=surfaceColor(j,i);drawn[i].forEach((c,k)=>{
  d.tones.set(c.mesh,'soft');d.patches.push({point:c.point,radius:s.radius,color,mesh:c.mesh});d.focus.points.push(at(c));
  if(labels&&k===0)d.labels.push({point:at(c),text:s.label,color});});});
 if(!only)for(const [a,b] of j.pairs??(j.surfaces.length===2?[[0,1]]:[]))drawn[a].forEach((c,k)=>{const to=drawn[b][k]??drawn[b][0];d.lines.push({from:at(c),to:at(to),color:surfaceColor(j,a)});});
 d.focus.meshes=[...d.tones.keys()];d.focus.pad=Math.max(...j.surfaces.map(s=>s.radius))*2.2;d.focus.dir=side==='left'&&!j.midline?mirror(j.view):j.view;return d;
}
