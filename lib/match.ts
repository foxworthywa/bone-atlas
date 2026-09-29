// Forgiving answer matching for typed quiz answers (shared approach with Muscle Explorer).
export type Named={id:string;name:string;aka?:string[]};
export function normalize(s:string){
 return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\(.*?\)/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\b(the|a|an|of|bone|bones)\b/g,' ').replace(/\s+/g,' ').trim();
}
export function levenshtein(a:string,b:string){
 if(a===b)return 0;const prev=Array.from({length:b.length+1},(_,j)=>j);
 for(let i=1;i<=a.length;i++){let diag=prev[0];prev[0]=i;for(let j=1;j<=b.length;j++){const tmp=prev[j];prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diag+(a[i-1]===b[j-1]?0:1));diag=tmp;}}
 return prev[b.length];
}
// Spelling tolerance grows with the length of the expected answer.
function tolerance(expected:string){const n=expected.replace(/ /g,'').length;return n<=4?0:n<=7?1:n<=12?2:3;}
function distanceTo(n:string,item:Named){let d=Infinity,tol=0;for(const c of [item.name,...item.aka??[]].map(normalize)){if(!c)continue;const x=levenshtein(n,c);if(x<d){d=x;tol=tolerance(c);}}return {d,tol};}
// Accepts the name, listed alternatives and small misspellings, but only when the answer is closer to this item than
// to any other: "medial condyle" never passes for "lateral condyle".
export function nameMatches(input:string,item:Named,all:Named[]){
 const n=normalize(input);if(!n)return false;const mine=distanceTo(n,item);if(mine.d>mine.tol)return false;
 return all.every(o=>o.id===item.id||normalize(o.name)===normalize(item.name)||distanceTo(n,o).d>mine.d);
}
