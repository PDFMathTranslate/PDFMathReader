export function translationPages(mode,current,total){return mode==='full'?Array.from({length:total},(_,i)=>i+1):[current,current+1,current-1,current+2,current-2].filter(n=>n>=1&&n<=total);}
