export const selectionSearchQuery=value=>String(value||'').replace(/\p{P}+/gu,' ').replace(/\s+/gu,' ').trim();
const normalized=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu,'');
export function searchSegments(segments,query){
 const needles=[...new Set(String(query||'').trim().split(/\s+/u).map(normalized).filter(Boolean))];if(!needles.length)return [];
 const groups=new Map();
 for(const segment of segments){const key=segment.block||segment.paragraph||0;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(segment);}
 const matches=[];
 for(const group of groups.values()){
  let text='';const spans=[];
  for(const segment of group){const value=normalized(segment.text);if(!value)continue;spans.push({start:text.length,end:text.length+value.length,box:segment.box,block:segment.block});text+=value;}
  if(needles.length===1){
   const needle=needles[0];
   for(let start=text.indexOf(needle);start!==-1;start=text.indexOf(needle,start+needle.length)){
    const selected=spans.filter(span=>span.end>start&&span.start<start+needle.length);
    matches.push({boxes:selected.map(span=>span.box),blocks:[...new Set(selected.map(span=>span.block).filter(Boolean))]});
   }
  }else if(needles.every(needle=>text.includes(needle))){
   const selected=new Set();
   for(const needle of needles)for(let start=text.indexOf(needle);start!==-1;start=text.indexOf(needle,start+needle.length))for(const span of spans)if(span.end>start&&span.start<start+needle.length)selected.add(span);
   const ordered=spans.filter(span=>selected.has(span));
   matches.push({boxes:ordered.map(span=>span.box),blocks:[...new Set(ordered.map(span=>span.block).filter(Boolean))]});
  }
 }
 return matches;
}

export async function pdfSearchSegments(page){
 const viewport=page.getViewport({scale:1}),content=await page.getTextContent();
 let paragraph={},previous;
 return content.items.filter(item=>item.str&&item.transform).map(item=>{
  const [x,y]=viewport.convertToViewportPoint(item.transform[4],item.transform[5]);
  const height=Math.max(1,item.height||Math.hypot(item.transform[2],item.transform[3]));
  const box={x,y:y-height,width:Math.max(1,item.width),height};
  if(previous){const dy=box.y-previous.y;const lineHeight=Math.max(height,previous.height);if(dy < -lineHeight*.5||dy>lineHeight*1.6||(Math.abs(dy)<lineHeight*.5&&x>previous.x+previous.width+lineHeight*3))paragraph={};}
  previous=box;
  return {text:item.str,box,paragraph};
 });
}
