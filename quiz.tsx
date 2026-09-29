import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Lateral,Point,boneLabel,defaultAnnotations,jointById} from '@/lib/atlas';
import {Display,boneDisplay,colors,emptyDisplay,jointDisplay,landmarkDisplay} from '@/lib/display';
import {nameMatches} from '@/lib/match';
import {Artic,Item,QType,SECTIONS,SectionId,TYPES,articChoices,articQuestions,bonesOfMesh,buildQuestions,findHit,itemById,items,landmarkNear,nameChoices,sideOfPoint} from '@/lib/quiz';
import {Hit,ViewName} from './viewer';
type Prefs={sections:SectionId[];types:QType[];length:number|'all'};
type Q={type:QType;id:string;answered:boolean;attempts:number;showChoices:boolean;choices:string[];pick?:string;typed:string;feedback?:{cls:'good'|'bad'|'info';text:string}};
type Run={questions:Q[];i:number;score:number;missed:{type:QType;id:string}[];done:boolean};
const STORE='bone-atlas.quiz';
function loadPrefs():Prefs{
 let p:Partial<Prefs>={};try{p=JSON.parse(localStorage.getItem(STORE)??'{}');}catch{/* private mode: defaults */}
 const sections=Array.isArray(p.sections)?p.sections.filter(s=>SECTIONS.some(x=>x.id===s)):SECTIONS.map(s=>s.id);
 const types=Array.isArray(p.types)&&p.types.length?p.types.filter(t=>t in TYPES):(Object.keys(TYPES) as QType[]);
 return {sections,types,length:p.length==='all'||typeof p.length==='number'?p.length:10};
}
function savePrefs(p:Prefs){try{localStorage.setItem(STORE,JSON.stringify(p));}catch{/* private mode: fine */}}
const articById=new Map(articQuestions().map(q=>[q.id,q]));
// How a structure looks on the model when it is the question or the answer.
function show(item:Item,side:Lateral,answer:boolean):Display{
 const e=item.entry;
 if(e.kind==='bone')return boneDisplay(e,side,answer?'correct':'strong');
 if(e.kind==='landmark')return landmarkDisplay(e,defaultAnnotations[e.id],side,answer?colors.correct:colors.teal);
 return jointDisplay(e.id,side,{labels:answer,apart:answer,fade:true});
}
export default function Quiz({side,pick,onShow,onReview,onExit}:{side:Lateral;pick:{hit:Hit;sequence:number}|null;onShow:(d:Display,view?:ViewName)=>void;onReview:(id:string)=>void;onExit:()=>void}){
 const [prefs,setPrefs]=useState<Prefs>(loadPrefs),[run,setRun]=useState<Run|null>(null),[,redraw]=useState(0);
 const input=useRef<HTMLInputElement>(null),lastPick=useRef(pick?.sequence??0);
 const update=(p:Prefs)=>{setPrefs(p);savePrefs(p);};
 const total=useMemo(()=>buildQuestions(prefs.sections,prefs.types).length,[prefs]);
 const count=prefs.length==='all'?total:Math.min(prefs.length,total);
 const q=run&&!run.done?run.questions[run.i]:null,item=q&&q.type!=='artic'?itemById.get(q.id)!:null,artic=q?.type==='artic'?articById.get(q.id)!:null;
 const render=()=>redraw(v=>v+1);
 function present(r:Run){const q=r.questions[r.i];
  if(q.type==='find')onShow(emptyDisplay(),'reset');
  else if(q.type==='name'){q.choices=nameChoices(itemById.get(q.id)!);onShow(show(itemById.get(q.id)!,side,false),'focus');}
  else{const a=articById.get(q.id)!;q.choices=articChoices(a);onShow(a.surface===undefined?emptyDisplay():jointDisplay(a.joint,side,{labels:false,only:[a.surface],fade:true}),a.surface===undefined?undefined:'focus');}
 }
 function start(list:{type:QType;id:string}[]){const r:Run={questions:list.map(x=>({...x,answered:false,attempts:0,showChoices:false,choices:[],typed:''})),i:0,score:0,missed:[],done:false};setRun(r);present(r);}
 function next(){if(!run)return;if(run.i+1>=run.questions.length)return finish();run.i++;present(run);render();setTimeout(()=>input.current?.focus({preventScroll:true}));}
 function finish(){if(!run)return;run.done=true;run.missed=[...new Map(run.missed.map(m=>[m.type+':'+m.id,m])).values()];onShow(emptyDisplay());render();}
 function right(text:string){if(!run||!q)return;q.answered=true;if(!q.attempts)run.score++;else run.missed.push({type:q.type,id:q.id});q.feedback={cls:'good',text};render();}
 function wrong(text:string){if(!run||!q)return;q.answered=true;q.attempts++;run.missed.push({type:q.type,id:q.id});q.feedback={cls:'bad',text};render();}
 function revealJoint(a:Artic){onShow(jointDisplay(a.joint,side,{apart:true,fade:true}),'focus');}
 function showMe(){if(!q)return;
  if(item){onShow(show(item,side,true),'focus');if(q.type==='name')q.showChoices=true;wrong(`${q.type==='find'?'Here it is':'It’s'}: ${item.name}.`);}
  else if(artic){revealJoint(artic);wrong(`${artic.answer}. ${artic.explain}`);}
 }
 // Find it: a click on the model.
 useEffect(()=>{if(!pick||pick.sequence===lastPick.current)return;lastPick.current=pick.sequence;
  if(!q||q.answered||q.type!=='find'||!item)return;const {mesh,point}=pick.hit,s=sideOfPoint(point);
  if(findHit(item,mesh,point)){onShow(show(item,s,true));return right(`Correct: that’s the ${item.name}.`);}
  q.attempts++;const bone=bonesOfMesh(mesh)[0],near=landmarkNear(mesh,point);
  const what=item.entry.kind==='landmark'&&near?`the ${near.name.toLowerCase()} of the ${bone?.name.toLowerCase()??'bone'}`:bone?`the ${bone.name.toLowerCase()}`:'a structure not on the list';
  const d=q.attempts>=2?show(item,s,true):emptyDisplay();d.tones.set(mesh,'wrong');d.markers.push({point:point as Point,color:colors.wrong,size:'sm'});
  if(q.attempts>=2){onShow(d,'focus');return wrong(`That’s ${what}. Here is the ${item.name}.`);}
  onShow(d);q.feedback={cls:'bad',text:`That’s ${what}. Try again.`};render();
 },[pick]);// eslint-disable-line react-hooks/exhaustive-deps
 function checkTyped(e:FormEvent){e.preventDefault();if(!q||!item||q.answered)return;const typed=input.current?.value??'';q.typed=typed;if(!typed.trim())return;
  if(nameMatches(typed,item,items)){onShow(show(item,side,true));return right(`Correct: the ${item.name}.`);}
  if(!q.attempts){q.attempts++;q.feedback={cls:'bad',text:'Not quite. Try again, or show the choices.'};return render();}
  q.showChoices=true;onShow(show(item,side,true));wrong(`It’s the ${item.name}.`);
 }
 function choose(choice:string){if(!q||q.answered)return;q.pick=choice;
  if(item){onShow(show(item,side,true));return choice===q.id?right(`Correct: the ${item.name}.`):(q.attempts++,wrong(`It’s the ${item.name}.`));}
  if(artic){revealJoint(artic);return choice===artic.answer?right(artic.explain):(q.attempts++,wrong(`${artic.answer}. ${artic.explain}`));}
 }
 const choiceClass=(isRight:boolean,picked:boolean)=>!q?.answered?'':isRight?' correct':picked?' wrong':'';
 if(!run)return <div className="quiz">
  <p className="eyebrow">QUIZ ME</p><h3 className="detail-title">Quiz yourself</h3><p className="muted">Pick what you are studying. Nothing is graded or saved except these settings, in this browser.</p>
  <fieldset><legend>Sections</legend><div className="row-actions"><button type="button" onClick={()=>update({...prefs,sections:SECTIONS.map(s=>s.id)})}>Select all</button><button type="button" onClick={()=>update({...prefs,sections:[]})}>Clear</button></div>
   {SECTIONS.map(s=><label key={s.id} className="check"><input type="checkbox" checked={prefs.sections.includes(s.id)} onChange={e=>update({...prefs,sections:e.target.checked?[...prefs.sections,s.id]:prefs.sections.filter(x=>x!==s.id)})}/>{s.label}</label>)}</fieldset>
  <fieldset><legend>Question types</legend>{(Object.keys(TYPES) as QType[]).map(t=><label key={t} className="check"><input type="checkbox" checked={prefs.types.includes(t)} onChange={e=>update({...prefs,types:e.target.checked?[...prefs.types,t]:prefs.types.filter(x=>x!==t)})}/><span>{TYPES[t].label}<small>{TYPES[t].help}</small></span></label>)}</fieldset>
  <fieldset><legend>Length</legend><div className="seg" role="group" aria-label="Number of questions">{([10,20,'all'] as const).map(v=><button type="button" key={v} aria-pressed={prefs.length===v} onClick={()=>update({...prefs,length:v})}>{v==='all'?`All (${total})`:v}</button>)}</div></fieldset>
  <Button className="quiz-start" disabled={!count} onClick={()=>{const qs=buildQuestions(prefs.sections,prefs.types);start(prefs.length==='all'?qs:qs.slice(0,prefs.length));}}>{count?`Start: ${count} question${count===1?'':'s'}`:'Choose a section and a question type'}</Button>
  <Button variant="ghost" className="quiz-start" onClick={onExit}>Back to Explore</Button>
 </div>;
 if(run.done){const asked=run.questions.filter(x=>x.answered).length;return <div className="quiz">
  <p className="eyebrow">RESULTS</p><p className="score-big">{run.score} / {asked}</p><p className="muted">{asked?`${Math.round(run.score/asked*100)}% right on the first try.`:'No questions answered.'}</p>
  {!!run.missed.length&&<><p className="eyebrow">TO REVIEW</p><ul className="missed">{run.missed.map(m=>{const name=m.type==='artic'?articById.get(m.id)!.prompt:itemById.get(m.id)!.name;const target=m.type==='artic'?articById.get(m.id)!.joint:m.id;return <li key={m.type+m.id}><span>{name}<small>{TYPES[m.type].label}</small></span><Button size="sm" variant="outline" onClick={()=>onReview(target)}>Review</Button></li>;})}</ul></>}
  <div className="quiz-actions">{!!run.missed.length&&<Button onClick={()=>start(run.missed)}>Retry the ones I missed</Button>}<Button variant="outline" onClick={()=>{setRun(null);onShow(emptyDisplay());}}>New quiz</Button></div>
 </div>;}
 const cur=q!;
 let body;
 if(cur.type==='find'&&item){const what=item.entry.kind==='landmark'?`the ${item.name.toLowerCase()} of the ${boneLabel(item.entry.bone).toLowerCase()}`:`the ${item.name}`;
  body=<><p className="q-prompt">Click <b>{what}</b> on the model.</p><p className="muted">Either side counts. Rotate and zoom to get close; double-click to rotate around a spot.</p></>;}
 else if(cur.type==='name'&&item){body=<><p className="q-prompt">Name the highlighted {item.entry.kind==='joint'?'joint':item.entry.kind==='bone'?'bone':'landmark'}.</p>
  {!cur.showChoices?<><form className="answer-row" onSubmit={checkTyped} autoComplete="off"><Input ref={input} name="answer" placeholder="Type the name…" aria-label="Your answer" defaultValue={cur.typed} disabled={cur.answered} autoCapitalize="off" spellCheck={false} autoFocus/><Button type="submit" disabled={cur.answered}>Check</Button></form>{!cur.answered&&<button type="button" className="link-btn" onClick={()=>{cur.showChoices=true;render();}}>Show choices instead</button>}</>
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
