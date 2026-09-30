import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Lateral,Point,boneMeshes,defaultAnnotations,jointById,meshById} from '@/lib/atlas';
import {Display,boneDisplay,colors,emptyDisplay,jointDisplay,landmarkDisplay} from '@/lib/display';
import {Artic,Item,QType,SECTIONS,SectionId,TYPES,articById,articChoices,buildQuestions,clickedWhat,findHit,findStage,findWhat,itemById,meshLabel,nameChoices,reviewName,sideOfPoint,typedAnswer} from '@/lib/quiz';
import {Hit,ViewName} from './viewer';
type Prefs={sections:SectionId[];types:QType[];length:number|'all'};
// chose: answered right from the choices after "Show choices instead" (reported apart from typed answers).
type Q={type:QType;id:string;answered:boolean;attempts:number;showChoices:boolean;choices:string[];pick?:string;chose?:boolean;feedback?:{cls:'good'|'bad'|'info';text:string}};
// n: which run this is, so each question gets a fresh answer box (a retry of the same list included).
type Run={n:number;retry?:boolean;questions:Q[];i:number;score:number;missed:{type:QType;id:string}[];done:boolean};
let runs=0;
const STORE='bone-atlas.quiz';
function loadPrefs():Prefs{
 let p:Partial<Prefs>={};try{p=JSON.parse(localStorage.getItem(STORE)??'{}');}catch{/* private mode: defaults */}
 const sections=Array.isArray(p.sections)?p.sections.filter(s=>SECTIONS.some(x=>x.id===s)):SECTIONS.map(s=>s.id);
 const types=Array.isArray(p.types)&&p.types.length?p.types.filter(t=>t in TYPES):(Object.keys(TYPES) as QType[]);
 return {sections,types,length:p.length==='all'||typeof p.length==='number'?p.length:10};
}
function savePrefs(p:Prefs){try{localStorage.setItem(STORE,JSON.stringify(p));}catch{/* private mode: fine */}}
// How a structure looks on the model when it is the question or the answer.
function show(item:Item,side:Lateral,answer:boolean):Display{
 const e=item.entry;
 if(e.kind==='bone')return boneDisplay(e,side,answer?'correct':'strong');
 if(e.kind==='landmark')return landmarkDisplay(e,defaultAnnotations[e.id],side,answer?colors.correct:colors.teal);
 return jointDisplay(e.id,side,{labels:answer,apart:answer,fade:true});
}
// Find it: the skull base opened, a partner bone see-through, the vertebra or rib meant highlighted, and (while asking)
// the camera on the named bone from the front, with some of its surroundings. See findStage.
function staged(item:Item,answer:boolean,d:Display=emptyDisplay()):Display{
 const s=findStage(item);d.scope=s.scope;d.ghost=[...d.ghost??[],...s.ghost];for(const m of s.highlight)if(!d.tones.has(m))d.tones.set(m,answer?'soft':'strong');
 if(!d.focus.meshes.length&&!d.focus.points.length&&!s.scope&&s.focus.length){const box=s.focus.map(id=>meshById.get(id)!);
  d.focus={meshes:[],points:[[0,1,2].map(k=>Math.min(...box.map(m=>m.min[k]))) as Point,[0,1,2].map(k=>Math.max(...box.map(m=>m.max[k]))) as Point],pad:.05,dir:[.1,.05,1]};}
 return d;
}
// The course marks the sella turcica and the hypophyseal fossa on one spot; either name is right.
const sameSpot=(i:Item)=>i.same?.length?` The ${i.same.map(id=>itemById.get(id)!.name.toLowerCase()).join(', ')} is marked on the same spot, so that name counts too.`:'';
export default function Quiz({active,side,pick,onShow,onReview,onExit}:{active:boolean;side:Lateral;pick:{hit:Hit;sequence:number}|null;onShow:(d:Display,view?:ViewName)=>void;onReview:(id:string)=>void;onExit:()=>void}){
 const [prefs,setPrefs]=useState<Prefs>(loadPrefs),[run,setRun]=useState<Run|null>(null),[,redraw]=useState(0);
 const input=useRef<HTMLInputElement>(null),lastPick=useRef(pick?.sequence??0),shown=useRef<{d:Display;view?:ViewName}>({d:emptyDisplay(),view:'reset'});
 const update=(p:Prefs)=>{setPrefs(p);savePrefs(p);};
 const total=useMemo(()=>buildQuestions(prefs.sections,prefs.types).length,[prefs]);
 const count=prefs.length==='all'?total:Math.min(prefs.length,total);
 const q=run&&!run.done?run.questions[run.i]:null,item=q&&q.type!=='artic'?itemById.get(q.id)!:null,artic=q?.type==='artic'?articById.get(q.id)!:null;
 const render=()=>redraw(v=>v+1);
 // Everything shown goes through here, so coming back to Quiz me shows the model as it was left.
 function display(d:Display,view?:ViewName){shown.current={d,view:view??shown.current.view};onShow(d,view);}
 function present(r:Run){const q=r.questions[r.i],it=itemById.get(q.id);
  if(q.type==='find'){const d=staged(it!,false);display(d,d.scope?'superior':d.focus.points.length?'focus':'reset');}
  else if(q.type==='name'){if(!q.choices.length)q.choices=nameChoices(it!);display(show(it!,side,false),'focus');}
  else{const a=articById.get(q.id)!;if(!q.choices.length)q.choices=articChoices(a);display(a.surface===undefined?emptyDisplay():jointDisplay(a.joint,side,{labels:false,only:[a.surface],fade:true}),a.surface===undefined?'reset':'focus');}
 }
 // The run lives on while Explore or Recall is open (Review on the results page, the structure list, a link).
 useEffect(()=>{if(active&&run)onShow(shown.current.d,shown.current.view);},[active]);// eslint-disable-line react-hooks/exhaustive-deps
 function start(list:{type:QType;id:string}[],retry=false){const r:Run={n:++runs,retry,questions:list.map(x=>({...x,answered:false,attempts:0,showChoices:false,choices:[]})),i:0,score:0,missed:[],done:false};setRun(r);present(r);}
 function next(){if(!run)return;if(run.i+1>=run.questions.length)return finish();run.i++;present(run);render();setTimeout(()=>input.current?.focus({preventScroll:true}));}
 // A question left after a wrong try still counts as asked and goes on the review list.
 function finish(){if(!run)return;run.done=true;for(const x of run.questions)if(!x.answered&&(x.attempts||run.retry))run.missed.push({type:x.type,id:x.id});run.missed=[...new Map(run.missed.map(m=>[m.type+':'+m.id,m])).values()];display(emptyDisplay(),'reset');render();}
 function right(text:string){if(!run||!q)return;q.answered=true;if(!q.attempts)run.score++;else run.missed.push({type:q.type,id:q.id});q.feedback={cls:'good',text};render();}
 function wrong(text:string){if(!run||!q)return;q.answered=true;q.attempts++;run.missed.push({type:q.type,id:q.id});q.feedback={cls:'bad',text};render();}
 function revealJoint(a:Artic){display(jointDisplay(a.joint,side,{apart:true,fade:true}),'focus');}
 function showMe(){if(!q)return;
  if(item&&q.type==='find'){display(staged(item,true,show(item,side,true)),'focus');wrong(`Here it is: ${findWhat(item)}.`);}
  else if(item){display(show(item,side,true),'focus');q.showChoices=true;wrong(`It’s ${reviewName(item)}.${sameSpot(item)}`);}
  else if(artic){revealJoint(artic);wrong(`${artic.answer}. ${artic.explain}`);}
 }
 // Find it: a click on the model.
 useEffect(()=>{if(!pick||pick.sequence===lastPick.current)return;lastPick.current=pick.sequence;
  if(!active||!q||q.answered||q.type!=='find'||!item)return;const {mesh,point,normal}=pick.hit,s=sideOfPoint(point);
  if(findHit(item,mesh,point,normal)){display(staged(item,true,show(item,s,true)));return right(`Correct: that’s ${findWhat(item)}.`);}
  q.attempts++;const what=clickedWhat(item,mesh,point,normal);
  // The clicked bone turns purple only when it is the wrong bone; on the right bone the purple dot marks the miss.
  const d=staged(item,q.attempts>=2,q.attempts>=2?show(item,s,true):emptyDisplay());if(item.entry.kind!=='landmark'||!boneMeshes[item.entry.bone].includes(mesh))d.tones.set(mesh,'wrong');d.markers.push({point:point as Point,color:colors.wrong,size:'sm',mesh});
  if(q.attempts>=2){display(d,'focus');return wrong(`That’s ${what}. Here is ${findWhat(item)}.`);}
  display(d);q.feedback={cls:'bad',text:`That’s ${what}. Try again.`};render();
 },[pick]);// eslint-disable-line react-hooks/exhaustive-deps
 function checkTyped(e:FormEvent){e.preventDefault();if(!q||!item||q.answered)return;const typed=input.current?.value??'';if(!typed.trim())return;
  const r=typedAnswer(typed,item);
  if(r==='right'){display(show(item,side,true));return right(`Correct: ${reviewName(item)}.${sameSpot(item)}`);}
  // Naming the bone or region the landmark lies on, or a group the bone belongs to, is not wrong, just not specific
  // enough: no attempt is used.
  if(r==='part'){q.feedback={cls:'info',text:item.entry.kind==='landmark'?'Yes, it lies there, but which landmark is it? Try again.':'Yes, that group includes it, but be more specific. Try again.'};return render();}
  if(!q.attempts){q.attempts++;q.feedback={cls:'bad',text:'Not quite. Try again, or show the choices.'};return render();}
  q.showChoices=true;display(show(item,side,true));wrong(`It’s ${reviewName(item)}.${sameSpot(item)}`);
 }
 function choose(choice:string){if(!q||q.answered)return;q.pick=choice;
  if(item){display(show(item,side,true));if(choice!==q.id)return (q.attempts++,wrong(`It’s ${reviewName(item)}.${sameSpot(item)}`));q.chose=!q.attempts;return right(`Correct: ${reviewName(item)}.${sameSpot(item)}`);}
  if(artic){revealJoint(artic);return choice===artic.answer?right(artic.explain):(q.attempts++,wrong(`${artic.answer}. ${artic.explain}`));}
 }
 const choiceClass=(isRight:boolean,picked:boolean)=>!q?.answered?'':isRight?' correct':picked?' wrong':'';
 const needsJoints=!total&&prefs.sections.length>0&&prefs.types.length>0&&prefs.types.every(t=>t==='artic');
 if(!run)return <div className="quiz">
  <p className="eyebrow">QUIZ ME</p><h3 className="detail-title">Quiz yourself</h3><p className="muted">Pick what you are studying. Nothing is graded or saved except these settings, in this browser.</p>
  <fieldset><legend>Sections</legend><div className="row-actions"><button type="button" onClick={()=>update({...prefs,sections:SECTIONS.map(s=>s.id)})}>Select all</button><button type="button" onClick={()=>update({...prefs,sections:[]})}>Clear</button></div>
   {SECTIONS.map(s=><label key={s.id} className="check"><input type="checkbox" checked={prefs.sections.includes(s.id)} onChange={e=>update({...prefs,sections:e.target.checked?[...prefs.sections,s.id]:prefs.sections.filter(x=>x!==s.id)})}/>{s.label}</label>)}</fieldset>
  <fieldset><legend>Question types</legend>{(Object.keys(TYPES) as QType[]).map(t=><label key={t} className="check"><input type="checkbox" checked={prefs.types.includes(t)} onChange={e=>update({...prefs,types:e.target.checked?[...prefs.types,t]:prefs.types.filter(x=>x!==t)})}/><span>{TYPES[t].label}<small>{TYPES[t].help}</small></span></label>)}</fieldset>
  <fieldset><legend>Length</legend><div className="seg" role="group" aria-label="Number of questions">{([10,20,'all'] as const).map(v=><button type="button" key={v} aria-pressed={prefs.length===v} onClick={()=>update({...prefs,length:v})}>{v==='all'?`All (${total})`:v}</button>)}</div></fieldset>
  <Button className="quiz-start" disabled={!count} onClick={()=>{const qs=buildQuestions(prefs.sections,prefs.types);start(prefs.length==='all'?qs:qs.slice(0,prefs.length));}}>{count?`Start: ${count} question${count===1?'':'s'}`:needsJoints?'Articulations needs the Joints section':'Choose a section and a question type'}</Button>
  <Button variant="ghost" className="quiz-start" onClick={onExit}>Back to Explore</Button>
 </div>;
 if(run.done){const asked=run.questions.filter(x=>x.answered||x.attempts).length,chose=run.questions.filter(x=>x.chose).length;return <div className="quiz">
  <p className="eyebrow">RESULTS</p><p className="score-big">{run.score} / {asked}</p><p className="muted">{asked?`${Math.round(run.score/asked*100)}% right on the first try${chose?`, ${chose} of them picked from the choices instead of typed`:''}.`:'No questions answered.'}</p>
  {!!run.missed.length&&<><p className="eyebrow">TO REVIEW</p><ul className="missed">{run.missed.map(m=>{const name=m.type==='artic'?articById.get(m.id)!.prompt:reviewName(itemById.get(m.id)!);const target=m.type==='artic'?articById.get(m.id)!.joint:m.id;return <li key={m.type+m.id}><span>{name}<small>{TYPES[m.type].label}</small></span><Button size="sm" variant="outline" onClick={()=>onReview(target)}>Review</Button></li>;})}</ul></>}
  <div className="quiz-actions">{!!run.missed.length&&<Button onClick={()=>start(run.missed,true)}>Retry the ones I missed</Button>}<Button variant="outline" onClick={()=>{setRun(null);display(emptyDisplay(),'reset');}}>New quiz</Button></div>
 </div>;}
 const cur=q!;
 let body;
 if(cur.type==='find'&&item){const s=findStage(item);
  const note=s.scope?' The top of the skull is removed so you can see the cranial floor.':s.partner?` The ${s.partner} is see-through.`:s.highlight.length?` Highlighted: ${[...new Set(s.highlight.map(meshLabel))].join(' and ')}.`:'';
  body=<><p className="q-prompt">Click <b>{findWhat(item)}</b> on the model.</p><p className="muted">Either side counts.{note} Rotate and zoom to get close; double-click to rotate around a spot.</p></>;}
 else if(cur.type==='name'&&item){body=<><p className="q-prompt">Name the highlighted {item.entry.kind==='joint'?'joint':item.entry.kind==='bone'?'bone':'landmark'}.</p>
  {!cur.showChoices?<><form className="answer-row" onSubmit={checkTyped} autoComplete="off"><Input key={run.n+':'+run.i} ref={input} name="answer" placeholder="Type the name…" aria-label="Your answer" disabled={cur.answered} autoCapitalize="off" spellCheck={false} autoFocus/><Button type="submit" disabled={cur.answered}>Check</Button></form>{!cur.answered&&<button type="button" className="link-btn" onClick={()=>{cur.showChoices=true;render();}}>Show choices instead</button>}</>
  :<div className="choices">{cur.choices.map(id=><button key={id} className={'choice'+choiceClass(id===cur.id,cur.pick===id)} disabled={cur.answered} onClick={()=>choose(id)}>{itemById.get(id)!.name}</button>)}</div>}</>;}
 else if(artic){body=<><p className="q-prompt">{artic.prompt}</p><div className="choices">{cur.choices.map(c=><button key={c} className={'choice'+choiceClass(c===artic.answer,cur.pick===c)} disabled={cur.answered} onClick={()=>choose(c)}>{c}</button>)}</div></>;}
 return <div className="quiz">
  <div className="q-progress"><span>Question {run.i+1} of {run.questions.length}</span><span>Score {run.score}</span></div><div className="q-bar"><div style={{width:`${run.i/run.questions.length*100}%`}}/></div>
  <p className="eyebrow q-kind">{TYPES[cur.type].label.toUpperCase()}</p>{body}
  {cur.feedback&&<div className={'feedback '+cur.feedback.cls} role="status">{cur.feedback.text}</div>}
  {cur.answered&&item?.entry.kind==='joint'&&<p className="muted">{jointById.get(item.id)!.note}</p>}
  <div className="quiz-actions">{cur.answered?<Button onClick={next}>{run.i+1<run.questions.length?'Next question →':'See results'}</Button>:<Button variant="outline" onClick={showMe}>Show me</Button>}<Button variant="ghost" onClick={finish}>End quiz</Button></div>
 </div>;
}
