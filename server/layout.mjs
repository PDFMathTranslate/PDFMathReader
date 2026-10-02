// Inspector coordinates use a lower-left origin; browser overlays use top-left.
export function paragraphs(items, height) {
 const runs = items.filter(i => i.text?.trim() && i.width > 0 && i.height > 0 && !i.rotation && !['Image','Link','FormField'].includes(i.itemType)).map(i => ({...i, top:height-i.y-i.height})).sort((a,b)=>a.top-b.top || a.x-b.x);
 const lines=[];
 for (const r of runs) {
  const line=lines.find(l=>Math.abs(l.top-r.top)<Math.min(l.fontSize,r.fontSize)*.4 && r.x>=l.x-2 && r.x-l.right<Math.max(12,r.fontSize*1.8));
  if(line){line.text+=' '+r.text;line.x=Math.min(line.x,r.x);line.top=Math.min(line.top,r.top);line.right=Math.max(line.right,r.x+r.width);line.bottom=Math.max(line.bottom,r.top+r.height);}
  else lines.push({text:r.text,x:r.x,top:r.top,right:r.x+r.width,bottom:r.top+r.height,fontSize:r.fontSize||r.height,isBold:r.isBold});
 }
 const blocks=[];
 for(const l of lines.sort((a,b)=>a.top-b.top||a.x-b.x)){
  const b=blocks.findLast(b=>l.top>=b.top && l.top-b.bottom<l.fontSize*.85 && l.top-b.bottom>=-2 && Math.abs(l.x-b.x)<l.fontSize*1.5 && Math.abs(l.fontSize-b.fontSize)<1.5 && !!l.isBold===!!b.isBold);
  if(b){b.text=b.text.replace(/-$/,'')+(b.text.endsWith('-')?'':' ')+l.text;b.x=Math.min(b.x,l.x);b.top=Math.min(b.top,l.top);b.right=Math.max(b.right,l.right);b.bottom=Math.max(b.bottom,l.bottom);}
  else blocks.push({...l});
 }
 return blocks.map((b,id)=>({id,text:b.text,x:b.x,y:b.top,width:b.right-b.x,height:b.bottom-b.top,fontSize:b.fontSize,bold:!!b.isBold}));
}
