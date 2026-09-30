import {useEffect,useMemo,useState} from 'react';
import {Bone,RotateCcw,Search,Check,Eye,Target,ChevronRight,BookOpen,Link2,GraduationCap} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {NativeSelect} from '@/components/ui/native-select';
import Viewer,{Hit,ViewName} from './viewer';
import Quiz from './quiz';
import {Entry,Lateral,Scope,Side,boneMeshes,catalog,defaultAnnotations,inScope,jointById,landmarkOnSide,meshById,pointSide,scopeLabels,referenceUrl} from '@/lib/atlas';
import {Display,boneDisplay,colors,emptyDisplay,jointDisplay,landmarkDisplay,meshForPoint,surfaceColor} from '@/lib/display';
const annotations=defaultAnnotations;
const course=catalog.filter(e=>e.kind!=='landmark'||annotations[e.id]?.reviewed);
type Mode='explore'|'recall'|'quiz';
// Paired structures are shown one side at a time so rotation stays centred on a single bone.
function lateral(e:Entry){
 if(e.kind==='bone')return boneMeshes[e.bone].some(id=>meshById.get(id)!.side!=='midline');
 if(e.kind==='landmark')return !!annotations[e.id]&&(!!e.paired||pointSide(annotations[e.id].point)!=='both');
 return !jointById.get(e.id)!.midline;
}
export default function App(){
 const [region,setRegion]=useState<Scope>('all'),[side,setSide]=useState<Side>('both'),[focusSide,setFocusSide]=useState<Lateral>('right'),[selectedId,setSelectedId]=useState('humerus'),[mode,setMode]=useState<Mode>('explore'),[query,setQuery]=useState(''),[isolate,setIsolate]=useState(false),[showMarkers,setShowMarkers]=useState(false),[revealed,setRevealed]=useState(false),[notice,setNotice]=useState(''),[view,setView]=useState<{name:ViewName;sequence:number}>({name:'anterior',sequence:0});
 const [apart,setApart]=useState(true),[fade,setFade]=useState(true);
 const [quizDisplay,setQuizDisplay]=useState<Display>(emptyDisplay),[pick,setPick]=useState<{hit:Hit;sequence:number}|null>(null);
 const practice=mode==='recall',quiz=mode==='quiz';
 const selected=course.find(e=>e.id===selectedId)!,annotation=annotations[selectedId],joint=selected.kind==='joint'?jointById.get(selected.id)!:null,entries=useMemo(()=>course.filter(e=>inScope(e,region)),[region]),landmarks=entries.filter(e=>e.kind==='landmark'),hidden=practice&&!revealed;
 function camera(name:ViewName){setView(v=>({name,sequence:v.sequence+1}));}
 // Switching sides mirrors the view, so the other side's bone is seen from the same side of the body, not through it.
 function chooseSide(s:Lateral){const flip=s!==focusSide&&lateral(selected);setFocusSide(s);if(side!=='both'&&side!==s)setSide(s);camera(flip?'side':'focus');}
 function select(id:string,move:ViewName|null='focus'){if(!course.some(e=>e.id===id))return;setSelectedId(id);setRevealed(false);if(move)camera(move);}
 function changeRegion(r:Scope){setRegion(r);const first=course.find(e=>inScope(e,r));if(first)select(first.id,null);setQuery('');setIsolate(false);setMode('explore');camera(r==='skull-base'?'superior':r==='joints'?'focus':'anterior');}
 function changeSide(s:Side){setSide(s);if(s!=='both'&&s!==focusSide){setFocusSide(s);if(lateral(selected))camera('side');}}
 function nextQuestion(){if(!landmarks.length){setNotice('This region has selectable bones. Choose another region to practice landmark recall.');return;}const alternatives=landmarks.filter(e=>e.id!==selectedId),pool=alternatives.length?alternatives:landmarks;select(pool[Math.floor(Math.random()*pool.length)].id);setMode('recall');setQuery('');setSide('both');}
 function startQuiz(){setMode('quiz');setRegion('all');setSide('both');setIsolate(false);setQuizDisplay(emptyDisplay());camera('reset');}
 function onPick(hit:Hit){
  if(quiz){setPick(p=>({hit,sequence:(p?.sequence??0)+1}));return;}
  if(practice)return;
  if(hit.entry){select(hit.entry,null);return;}
  const entry=course.filter(c=>c.kind==='bone'&&boneMeshes[c.bone].includes(hit.mesh)).sort((a,b)=>boneMeshes[a.bone].length-boneMeshes[b.bone].length)[0];if(!entry)return;
  const s=meshById.get(hit.mesh)!.side;if(s==='left'||s==='right')setFocusSide(s);
  // Clicking a bone makes it the centre of rotation without changing the zoom.
  select(entry.id,'pivot');
 }
 const display=useMemo(()=>{
  if(quiz)return quizDisplay;
  const d=selected.kind==='bone'?boneDisplay(selected,focusSide):selected.kind==='joint'?jointDisplay(selected.id,focusSide,{labels:!hidden,apart,fade}):annotation?landmarkDisplay(selected,annotation,focusSide):boneDisplay(selected,focusSide,'soft');
  if(showMarkers&&!practice)for(const e of entries)if(e.kind==='landmark'&&e.id!==selected.id&&!(isolate&&e.bone!==selected.bone)){const p=landmarkOnSide(e,annotations[e.id].point,side==='both'?focusSide:side);d.markers.push({point:p,color:colors.teal,size:'sm',entry:e.id,mesh:meshForPoint(e.bone,p,e.id)});}
  return d;
 },[quiz,quizDisplay,selected,focusSide,hidden,annotation,showMarkers,practice,entries,isolate,side,apart,fade]);
 // A link can open a structure directly, e.g. …/bone-atlas/#h-capitulum or #joint-hip@left.
 useEffect(()=>{const open=()=>{const [id,s]=decodeURIComponent(location.hash.slice(1)).split('@');if(!course.some(e=>e.id===id))return;setMode('explore');setRegion('all');if(s==='left'||s==='right'){setFocusSide(s);setSide(v=>v==='both'?v:s);}select(id);};open();addEventListener('hashchange',open);return()=>removeEventListener('hashchange',open);},[]);// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(mode!=='explore')return;const hash='#'+selectedId+(lateral(selected)?'@'+focusSide:'');if(location.hash!==hash)history.replaceState(null,'',hash);},[mode,selectedId,focusSide,selected]);
 const filtered=entries.filter(e=>(e.label+' '+e.bone+' '+scopeLabels[e.region]).toLowerCase().includes(query.toLowerCase()));
 const icon=(e:Entry)=>e.kind==='bone'?<Bone size={15}/>:e.kind==='joint'?<Link2 size={15}/>:<Check size={14}/>;
 const title=quiz?'Quiz':hidden?'Name this landmark':selected.label;
 const subtitle=quiz?'Answer in the panel; click the model for “Find it” questions.':hidden?'Rotate the specimen to inspect the highlighted point.':joint?'Articular surfaces highlighted · dashed lines join the surfaces that meet':selected.kind==='bone'?'Selected bone highlighted · click a bone to rotate around it':'Instructor-approved point marker';
 return <main><header className="masthead"><div className="brand"><Bone/><div><strong>Bone Atlas</strong><span>BIO 141 · Interactive anatomy</span></div></div><div className="header-actions"><span className="badge">Student edition</span><a className="credits-link" href="./credits.txt" target="_blank" rel="noreferrer">Model credits</a></div></header>
 <div className="workspace"><aside className="catalog"><p className="eyebrow">YOUR LAB BENCH</p><h1>Explore the skeleton.</h1><p className="muted">Select a structure, study the joints, or quiz yourself.</p><div className="region-switch">{(['all','axial','appendicular','joints'] as Scope[]).map(r=><Button key={r} size="sm" onClick={()=>changeRegion(r)} aria-pressed={region===r&&!quiz} variant={region===r&&!quiz?'default':'outline'}>{r==='all'?'Whole':r==='axial'?'Axial':r==='appendicular'?'Appendicular':'Joints'}</Button>)}</div>
 <NativeSelect className="scope-select" aria-label="Skeleton region" value={region} onChange={e=>changeRegion(e.target.value as Scope)}>{Object.entries(scopeLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</NativeSelect>
 <div className="search-wrap"><Search size={15}/><Input aria-label="Search course structures" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a structure…" disabled={practice||quiz}/></div>
 <div className="list-heading"><p className="eyebrow">{scopeLabels[region]}</p><span>{entries.length} structures</span></div>
 {quiz?<div className="practice-sidebar"><GraduationCap/><h3>Quiz in progress</h3><p>Answer in the panel on the right. For <i>Find it</i> questions, click the structure on the model; either side counts.</p><Button variant="outline" onClick={()=>setMode('explore')}>Return to structure list</Button></div>
 :practice?<div className="practice-sidebar"><BookOpen/><h3>Recall practice</h3><p>Identify the highlighted landmark, then reveal its name.</p><p className="muted">Practice uses your instructor’s approved locations.</p><Button variant="outline" onClick={()=>setMode('explore')}>Return to structure list</Button></div>
 :<div className="structure-list">{filtered.map(e=><Button key={e.id} className={'structure-row '+(selectedId===e.id?'selected ':'')+(e.kind==='bone'?'bone-row':'')} variant="ghost" onClick={()=>select(e.id)} aria-pressed={selectedId===e.id}><span className={'entry-icon'+(e.kind==='joint'?' joint-icon':'')}>{icon(e)}</span><span>{e.label}<small>{e.kind==='joint'?jointById.get(e.id)!.type:scopeLabels[e.region]}{e.kind==='landmark'?' · '+e.bone.replaceAll('-',' '):''}</small></span>{selectedId===e.id&&<ChevronRight size={14}/>}</Button>)}{!filtered.length&&<p className="muted">No structures match your search.</p>}</div>}
 <div className="catalog-footer"><span><Bone size={14}/> Bone or group</span><span><Check size={14}/> Approved landmark</span><span><Link2 size={14}/> Joint</span></div></aside>
 <section className="stage"><div className="stage-title"><span className="eyebrow">{quiz?'QUIZ ME':scopeLabels[region]+' · '+(lateral(selected)?focusSide.toUpperCase()+' SIDE':'MIDLINE')}</span><h2>{title}</h2><span className="stage-subtitle">{subtitle}</span></div>
 <Viewer display={display} region={quiz?quizDisplay.scope??'all':region} side={quiz?'both':side} focusSide={focusSide} isolate={isolate&&!quiz} view={view} onPick={onPick}/>
 <div className="view-controls" aria-label="Camera presets">{(['anterior','posterior','superior','inferior','lateral'] as ViewName[]).map(v=><Button key={v} size="sm" variant="outline" onClick={()=>camera(v)}>{v[0].toUpperCase()+v.slice(1)}</Button>)}<Button size="icon" variant="outline" aria-label="Reset camera" onClick={()=>camera('reset')}><RotateCcw size={14}/></Button></div>
 <div className="stage-hint"><RotateCcw size={14}/> <span className="hint-mouse">Drag / arrow keys to rotate · Pinch or + / − to zoom · Double-click to rotate around a spot</span><span className="hint-touch">Drag to rotate · Pinch to zoom · Double-tap to pivot</span></div></section>
 <aside className="inspector"><div className="mode-tabs" aria-label="Learning mode"><Button size="sm" variant={mode==='explore'?'default':'ghost'} onClick={()=>setMode('explore')}><Eye/>Explore</Button><Button size="sm" variant={practice?'default':'ghost'} onClick={nextQuestion}><BookOpen/>Recall</Button><Button size="sm" variant={quiz?'default':'ghost'} onClick={startQuiz}><GraduationCap/>Quiz me</Button></div>
 {/* The quiz stays mounted, so leaving it (Review, the structure list, a link) keeps the run and its results. */}
 <div hidden={!quiz}><Quiz active={quiz} side={focusSide} pick={pick} onShow={(d,v)=>{setQuizDisplay(d);if(v)camera(v);}} onReview={id=>{setMode('explore');select(id);}} onExit={()=>setMode('explore')}/></div>
 {!quiz&&<>
 <p className="eyebrow">{practice?'RECALL PROMPT':joint?'SELECTED JOINT':'SELECTED STRUCTURE'}</p><h3 className="detail-title">{hidden?'What is this structure?':selected.label}</h3>
 {joint&&!hidden&&<><p className="joint-type">{joint.type}</p><ul className="surface-list">{joint.surfaces.map((s,i)=><li key={i}><span className="swatch" style={{background:surfaceColor(joint,i)}}/>{s.label}<small>{catalog.find(e=>e.kind==='bone'&&e.bone===s.bone)?.label}</small></li>)}</ul></>}
 <p className="muted">{hidden?'Use its shape and position to identify the highlighted point.':selected.note}</p>
 {practice&&<div className="review-actions"><Button onClick={()=>setRevealed(true)} disabled={revealed}>Reveal name</Button><Button variant="outline" onClick={nextQuestion}>Next landmark</Button></div>}
 {lateral(selected)&&<div className="option-row"><span>Side shown</span><div className="seg" role="group" aria-label="Side shown">{(['right','left'] as Lateral[]).map(s=><button key={s} type="button" aria-pressed={focusSide===s} onClick={()=>chooseSide(s)}>{s==='right'?'Right':'Left'}</button>)}</div></div>}
 <div className="option-row"><label htmlFor="side">Show on model</label><NativeSelect id="side" size="sm" value={side} onChange={e=>changeSide(e.target.value as Side)}><option value="both">Both sides</option><option value="right">Right only</option><option value="left">Left only</option></NativeSelect></div>
 {joint&&!hidden&&<><div className="option-row"><label htmlFor="apart">Pull the bones apart</label><input id="apart" type="checkbox" checked={apart} onChange={e=>{setApart(e.target.checked);camera('focus');}}/></div><div className="option-row"><label htmlFor="fade">Fade the other bones</label><input id="fade" type="checkbox" checked={fade} onChange={e=>setFade(e.target.checked)}/></div></>}
 <div className="option-row"><label htmlFor="isolate">Isolate {joint?'the joint’s bones':'selected structure'}</label><input id="isolate" type="checkbox" checked={isolate} onChange={e=>{setIsolate(e.target.checked);camera('focus');}}/></div>{!practice&&<div className="option-row"><label htmlFor="markers">Show other landmarks</label><input id="markers" type="checkbox" checked={showMarkers} onChange={e=>setShowMarkers(e.target.checked)}/></div>}
 <Button className="review-shortcut" variant="outline" onClick={()=>camera('focus')}><Target size={14}/>Focus on {joint?'joint':'structure'}</Button>
 {!practice&&selected.region==='skull'&&region!=='skull-base'&&<Button className="review-shortcut" variant="outline" onClick={()=>{setRegion('skull-base');setQuery('');setIsolate(false);camera('superior');}}>Open skull base</Button>}
 {!hidden&&<a className="reference-link" href={referenceUrl(selected.region)} target="_blank" rel="noreferrer">Open anatomy reference ↗</a>}
 <div className="prototype-note"><strong>Study with your course model</strong><p>The colored point locates a feature; it does not trace its full boundary. Each landmark uses one representative location. Joint surfaces are shaded where the bones meet.</p><p>Use Explore to study the bones and joints, Recall to practice {landmarks.length} approved landmarks in this selection, and Quiz me to test yourself. Nothing is graded or saved.</p><a href="./credits.txt" target="_blank" rel="noreferrer">Anatomical model credits and license</a></div>
 </>}
 </aside></div>{notice&&<div className="notice" role="status"><span>{notice}</span><Button variant="ghost" size="sm" aria-label="Dismiss notification" onClick={()=>setNotice('')}>×</Button></div>}
 </main>;
}
