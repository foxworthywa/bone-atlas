// Forgiving answer matching for typed quiz answers (shared approach with Muscle Explorer).
// same: other entries for the very same answer (two course names marked on one spot); they never compete.
export type Named={id:string;name:string;aka?:string[];same?:string[]};
export function normalize(s:string){
 return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\(.*?\)/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\b(the|a|an|of|bone|bones)\b/g,' ').replace(/\s+/g,' ').trim();
}
// Edit distance in which swapping two neighbouring letters ("humreus", "raduis") is one typo, not two.
export function levenshtein(a:string,b:string){
 if(a===b)return 0;let pp:number[]=[],prev=Array.from({length:b.length+1},(_,j)=>j);
 for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++){let v=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])v=Math.min(v,pp[j-2]+1);cur.push(v);}pp=prev;prev=cur;}
 return prev[b.length];
}
// Spelling tolerance grows with the length of the expected answer.
function tolerance(expected:string){const n=expected.replace(/ /g,'').length;return n<=4?0:n<=7?1:n<=12?2:3;}
function distanceTo(n:string,item:Named){let d=Infinity,tol=0;for(const c of [item.name,...item.aka??[]].map(normalize)){if(!c)continue;const x=levenshtein(n,c);if(x<d){d=x;tol=tolerance(c);}}return {d,tol};}
// Accepts the name, listed alternatives and small misspellings, but only when the answer is closer to this item than
// to any other: "medial condyle" never passes for "lateral condyle".
export function nameMatches(input:string,item:Named,all:Named[]){
 const n=normalize(input);if(!n)return false;const mine=distanceTo(n,item);if(mine.d>mine.tol)return false;
 return all.every(o=>o.id===item.id||item.same?.includes(o.id)||normalize(o.name)===normalize(item.name)||distanceTo(n,o).d>mine.d);
}
