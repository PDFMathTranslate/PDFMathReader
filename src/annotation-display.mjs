// Whole-page translation follows the displayed PDF; paragraph flags only apply
// to the independently rendered Ultra fast overlays.
export function annotationDisplaysTranslation(page,showTranslations,block){
 if(page.mathDocument)return !!showTranslations;
 return !!(block&&!block.math&&block.translation&&block.translated);
}

// PDF text runs on one baseline can have different font metrics. Consolidate
// their overlapping boxes before applying the spacing between highlight lines.
export function annotationLineRects(rects){
 const lines=[];
 for(const rect of [...rects].sort((a,b)=>a.y-b.y||a.x-b.x)){
  const line=lines.find(line=>{
   const overlap=Math.min(line.y+line.height,rect.y+rect.height)-Math.max(line.y,rect.y);
   return overlap>0&&overlap>=Math.min(line.height,rect.height)*.5;
  });
  if(!line){lines.push({...rect});continue;}
  const right=Math.max(line.x+line.width,rect.x+rect.width),bottom=Math.max(line.y+line.height,rect.y+rect.height);
  line.x=Math.min(line.x,rect.x);line.y=Math.min(line.y,rect.y);
  line.width=right-line.x;line.height=bottom-line.y;
 }
 return lines;
}

// Keep every marker on the same page rail, with a screen-space edge inset.
export function annotationRailX(pageWidth,textRight,zoom){
 const size=34/zoom,gap=8/zoom,limit=Math.max(0,pageWidth-size-gap);
 return Math.max(0,Math.min(limit,textRight+gap));
}

// Pack markers down the shared rail, then pull back from the page bottom.
export function annotationNotePositions(notes,pageHeight,zoom){
 const sorted=notes.map(n=>({...n})).sort((a,b)=>a.y-b.y||String(a.id).localeCompare(String(b.id)));
 const size=34/zoom,gap=6/zoom;
 for(let i=0;i<sorted.length;i++)sorted[i].y=Math.max(sorted[i].y,i?sorted[i-1].y+size+gap:0);
 if(sorted.length){sorted.at(-1).y=Math.min(sorted.at(-1).y,Math.max(0,pageHeight-size));
  for(let i=sorted.length-2;i>=0;i--)sorted[i].y=Math.min(sorted[i].y,sorted[i+1].y-size-gap);
 }
 return new Map(sorted.map(n=>[n.id,Math.max(0,n.y)]));
}
