const normalized=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu,'');
export function searchSegments(segments,query){
 const needle=normalized(query);if(!needle)return [];
 let text='';const spans=[];
 for(const segment of segments){const value=normalized(segment.text);if(!value)continue;spans.push({start:text.length,end:text.length+value.length,box:segment.box,block:segment.block});text+=value;}
 const matches=[];
 for(let start=text.indexOf(needle);start!==-1;start=text.indexOf(needle,start+needle.length)){
  const selected=spans.filter(span=>span.end>start&&span.start<start+needle.length);
  matches.push({boxes:selected.map(span=>span.box),blocks:selected.map(span=>span.block).filter(Boolean)});
 }
 return matches;
}
export async function pdfSearchSegments(page){
 const viewport=page.getViewport({scale:1}),content=await page.getTextContent();
 return content.items.filter(item=>item.str&&item.transform).map(item=>{
  const [x,y]=viewport.convertToViewportPoint(item.transform[4],item.transform[5]);
  const height=Math.max(1,item.height||Math.hypot(item.transform[2],item.transform[3]));
  return {text:item.str,box:{x,y:y-height,width:Math.max(1,item.width),height}};
 });
}
