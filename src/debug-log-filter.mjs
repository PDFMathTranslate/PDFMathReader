export function formatDebugLog(event){
 return [event.time||'',event.kernel?`[${event.kernel}]`:'',event.kind?`[${event.kind}]`:'',event.pid?`PID ${event.pid}`:'',String(event.message||'')].filter(Boolean).join(' ');
}
export function filterDebugLogLines(lines,pattern){
 const query=String(pattern||'').trim();
 if(!query)return lines.map((_,index)=>index);
 if(query.length>1000)throw Error('Pattern is too long');
 const literal=query.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/);
 const expression=literal?new RegExp(literal[1],literal[2]):new RegExp(query,'i');
 return lines.flatMap((line,index)=>{expression.lastIndex=0;return expression.test(line)?[index]:[];});
}
