// A deliberately small reading aid: match words and phrases, never infer claims.
export const IMPORTANT_INFORMATION_KEYWORDS=Object.freeze({
 results:Object.freeze([
  'result','results','finding','findings','outcome','outcomes','evidence',
  'significant','significantly','insignificant','nonsignificant','non-significant',
  'statistical significance','statistically significant','not statistically significant',
  'null result','null results','effect size','effect sizes','robust','robustness',
  '结果','結果','研究结果','研究結果','研究发现','研究發現','证据','證據','显著','顯著','不显著','不顯著',
  '统计显著','統計顯著','统计显著性','統計顯著性','效应量','效應量','稳健','穩健'
 ]),
 ordinals:Object.freeze([
  'first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth',
  'firstly','secondly','thirdly','fourthly','finally',
  '首先','其次','再次','最后','最後','第一','第二','第三','第四','第五','第六','第七','第八','第九','第十'
 ]),
 logic:Object.freeze([
  'however','therefore','thus','hence','consequently','nevertheless','nonetheless',
  'although','whereas','because','despite','conversely','moreover','furthermore',
  'in contrast','by contrast','in addition','as a result','on the other hand',
  '然而','但是','因此','因而','所以','由此','从而','從而','不过','不過','尽管','儘管','虽然','雖然',
  '因为','因為','由于','由於','相反','此外','进一步','進一步','一方面','另一方面','与此同时','與此同時'
 ]),
 discovery:Object.freeze([
  'support','supports','supported','supporting','do not support','does not support',
  'falsify','falsifies','falsified','falsifying','falsification',
  'refute','refutes','refuted','refuting','reject','rejects','rejected','rejecting',
  'suggest','suggests','suggested','suggesting','indicate','indicates','indicated','indicating',
  'demonstrate','demonstrates','demonstrated','demonstrating',
  'reveal','reveals','revealed','revealing','discover','discovers','discovered','discovering',
  'find','finds','found','show','shows','showed','shown','showing',
  'confirm','confirms','confirmed','confirming','corroborate','corroborates','corroborated',
  'contradict','contradicts','contradicted','contradicting',
  'observe','observes','observed','observing','establish','establishes','established',
  '支持','不支持','证伪','證偽','反对','反對','反驳','反駁','否定','拒绝','拒絕',
  '表明','显示','顯示','提示','说明','說明','证明','證明','证实','證實','验证','驗證',
  '发现','發現','揭示','观察到','觀察到','印证','印證'
 ]),
 comparison:Object.freeze([
  'higher','lower','greater','smaller','larger','better','worse','stronger','weaker',
  'increase','increases','increased','increasing','decrease','decreases','decreased','decreasing',
  'reduce','reduces','reduced','reducing','reduction','improve','improves','improved','improvement',
  'similar','similarly','different','difference','differences','equivalent',
  'compared with','compared to','relative to','greater than','less than','no difference',
  'more likely','less likely','at least','at most',
  '相比','相较','相較','相对于','相對於','高于','高於','低于','低於','大于','大於','小于','小於',
  '更多','更少','更高','更低','更强','更強','更弱','增加','增大','上升','减少','減少','下降','降低',
  '改善','提高','优于','優於','劣于','劣於','相似','不同','差异','差異','无差异','無差異','没有差异','沒有差異',
  '更可能','更不可能','至少','至多'
 ])
});
const entries=Object.entries(IMPORTANT_INFORMATION_KEYWORDS).flatMap(([category,words])=>words.map(word=>({word,category,english:/^[a-z]/i.test(word)}))).sort((a,b)=>b.word.length-a.word.length);
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=entries.map(entry=>({...entry,pattern:new RegExp(escaped(entry.word).replace(/ /g,'\\s+'),'giu')}));
const wordCharacter=character=>!!character&&/[\p{L}\p{N}_]/u.test(character);

/** UTF-16 offsets into unchanged source text, longest phrase wins. */
export function importantInformationRanges(text=''){
 if(typeof text!=='string'||!text)return [];
 const matches=[];
 for(const entry of patterns){entry.pattern.lastIndex=0;for(const match of text.matchAll(entry.pattern)){
  const start=match.index,end=start+match[0].length;
  if(entry.english&&(wordCharacter(text[start-1])||wordCharacter(text[end])))continue;
  matches.push({start,end,category:entry.category});
 }}
 matches.sort((a,b)=>a.start-b.start||(b.end-b.start)-(a.end-a.start));
 const selected=[];for(const match of matches)if(!selected.length||match.start>=selected.at(-1).end)selected.push(match);
 return selected;
}

/** Shared plain-text segments for normal text, emphasis and reveal animation. */
export function informationTextSegments(text='',{topicEnd=0,emphasizeInformation=false,ranges}={}){
 const source=typeof text==='string'?text:'',topic=Math.max(0,Math.min(source.length,topicEnd||0));
 const keywords=emphasizeInformation?(ranges??importantInformationRanges(source)):[];
 const boundaries=[...new Set([0,source.length,topic,...keywords.flatMap(r=>[r.start,r.end])])].filter(n=>n>=0&&n<=source.length).sort((a,b)=>a-b);
 return boundaries.slice(0,-1).map((start,i)=>({text:source.slice(start,boundaries[i+1]),start,end:boundaries[i+1],topic:start<topic,important:keywords.some(r=>start>=r.start&&start<r.end)}));
}

/** Match native PDF runs without changing their text, coordinates or selection. */
export function informationRunRanges(runs=[]){
 let logical='';const parts=[];
 for(let index=0;index<runs.length;index++){
  const run=runs[index],text=run.text||'',previous=runs[index-1];
  if(previous&&logical&&text&&!/\s$/.test(logical)&&!/^\s/.test(text)){
   const height=Math.max(1,Math.min(previous.height||12,run.height||12));
   const sameLine=Math.abs((previous.y||0)-(run.y||0))<height*.5;
   const gap=(run.x||0)-(previous.x||0)-(previous.width||0);
   if(!sameLine&&/[-‐]$/.test(logical)&&/^[a-z]/i.test(text))logical=logical.slice(0,-1);
   else if(!sameLine||gap>Math.max(.5,height*.08))logical+=' ';
  }
  const start=logical.length;logical+=text;parts.push({index,start,end:logical.length});
 }
 const matches=importantInformationRanges(logical),result=[];
 for(const match of matches)for(const part of parts){const start=Math.max(match.start,part.start),end=Math.min(match.end,part.end);if(end>start)result.push({index:part.index,start:start-part.start,end:end-part.start,category:match.category});}
 return result;
}

// Only join touching boxes on the same line; distant keywords stay separate.
export function mergeInformationRects(rects){
 const merged=[];
 for(const rect of [...rects].sort((a,b)=>a.y-b.y||a.x-b.x)){
  if(rect.width<=0||rect.height<=0)continue;
  const existing=merged.find(r=>Math.min(r.y+r.height,rect.y+rect.height)-Math.max(r.y,rect.y)>=Math.min(r.height,rect.height)*.6&&rect.x<=r.x+r.width+1&&rect.x+rect.width>=r.x-1);
  if(!existing){merged.push({...rect});continue;}
  const right=Math.max(existing.x+existing.width,rect.x+rect.width),bottom=Math.max(existing.y+existing.height,rect.y+rect.height);
  existing.x=Math.min(existing.x,rect.x);existing.y=Math.min(existing.y,rect.y);existing.width=right-existing.x;existing.height=bottom-existing.y;
 }
 return merged;
}
