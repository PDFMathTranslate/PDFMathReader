// Inspector coordinates use a lower-left origin; browser overlays use top-left.
export function paragraphs(items, height) {
 const runs = items.filter(i => i.text?.trim() && i.width > 0 && i.height > 0 && !i.rotation && !['Image','Link','FormField'].includes(i.itemType)).map(i => ({...i, top:height-i.y-i.height})).sort((a,b)=>a.top-b.top || a.x-b.x);
 const lines=[];
 for (const r of runs) {
  const line=lines.find(l=>Math.abs(l.top-r.top)<Math.min(l.fontSize,r.fontSize)*.4 && r.x>=l.x-2 && r.x-l.right<Math.max(12,r.fontSize*1.8));
  if(line){line.text+=' '+r.text;line.x=Math.min(line.x,r.x);line.top=Math.min(line.top,r.top);line.right=Math.max(line.right,r.x+r.width);line.bottom=Math.max(line.bottom,r.top+r.height);}
  else lines.push({text:r.text,x:r.x,top:r.top,right:r.x+r.width,bottom:r.top+r.height,fontSize:r.fontSize||r.height,isBold:r.isBold});
 }
 lines.sort((a,b)=>a.top-b.top||a.x-b.x);
 const bodySize=runs.map(r=>r.fontSize||r.height).sort((a,b)=>a-b)[Math.floor(runs.length/2)]||12;
 // Learn normal leading from nearby lines of the same size, independently of columns.
 const gaps=new Map();
 for(let i=0;i<lines.length;i++){
  const l=lines[i],next=lines.slice(i+1).find(n=>n.top>l.top+l.fontSize*.5&&Math.abs(n.x-l.x)<l.fontSize*1.5&&Math.abs(n.fontSize-l.fontSize)<1.5);
  const gap=next?next.top-l.bottom:-1;
  if(gap>=0&&gap<l.fontSize*.85){const key=Math.round(l.fontSize),values=gaps.get(key)||[];values.push(gap);gaps.set(key,values);}
 }
 const leading=new Map([...gaps].filter(([,values])=>values.length>=3).map(([key,values])=>[key,values.sort((a,b)=>a-b)[Math.floor(values.length*.25)]]));
 const blocks=[];
 // Centered headings can have very different left edges on consecutive lines.
 // Require matching centers and substantial overlap so separate columns stay apart.
 const centered=(b,l)=>(l.isBold||l.fontSize>bodySize*1.2)&&Math.abs((l.x+l.right-b.x-b.right)/2)<l.fontSize*.5 && Math.min(l.right,b.right)-Math.max(l.x,b.x)>Math.min(l.right-l.x,b.right-b.x)*.6;
 const boundary=(b,l)=>{
  if(centered(b,l))return false;
  const last=b.last||b,terminal=/[.!?。！？]["'”’）)]?$/.test(last.text.trim()),indent=l.x-b.x;
  const normal=leading.get(Math.round(l.fontSize));
  if(normal!==undefined&&l.top-last.bottom>normal+Math.max(2,l.fontSize*.18))return true;
  if(/^\s*(?:[•●▪◦]|\d+[.)、]\s|[（(]\d+[）)]\s)/u.test(l.text))return true;
  if(indent>l.fontSize*.5&&(terminal||(b.count>=2&&b.firstX-b.x>l.fontSize*.5)))return true;
  return terminal&&b.count>=2&&last.right<b.right-l.fontSize*2&&last.right-last.x<(b.right-b.x)*.85;
 };
 for(const l of lines.sort((a,b)=>a.top-b.top||a.x-b.x)){
  const b=blocks.findLast(b=>l.top>=b.top && l.top-b.bottom<l.fontSize*.85 && l.top-b.bottom>=-2 && (Math.abs(l.x-b.x)<l.fontSize*1.5 || (b.count===1&&b.x>l.x&&b.x-l.x<=l.fontSize*3) || centered(b,l)) && Math.abs(l.fontSize-b.fontSize)<1.5 && !!l.isBold===!!b.isBold);
  if(b&&!boundary(b,l)){if(Math.abs(l.x-b.x)>=l.fontSize*1.5&&centered(b,l))b.textAlign='center';b.text=b.text.replace(/-$/,'')+(b.text.endsWith('-')?'':' ')+l.text;b.x=Math.min(b.x,l.x);b.top=Math.min(b.top,l.top);b.right=Math.max(b.right,l.right);b.bottom=Math.max(b.bottom,l.bottom);b.last=l;b.count++;}
  else blocks.push({...l,firstX:l.x,count:1,last:l});
 }
 return blocks.map((b,id)=>({id,text:b.text,x:b.x,y:b.top,width:b.right-b.x,height:b.bottom-b.top,fontSize:b.fontSize,bold:!!b.isBold,...(b.textAlign?{textAlign:b.textAlign}:{})}));
}
