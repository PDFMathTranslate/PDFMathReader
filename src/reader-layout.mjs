const firstAfter=(items,value,end)=>{let low=0,high=items.length;while(low<high){const middle=(low+high)>>>1;if(end(items[middle])<=value)low=middle+1;else high=middle;}return low;};
export function buildReaderLayout(pages,scale=1,direction='vertical',columns=1,gap=24,border=2){
 const count=direction==='horizontal'?1:columns,rows=[],frames=[];
 const rowWidths=[];
 if(direction==='vertical')for(let start=0;start<pages.length;start+=count){const group=pages.slice(start,start+count);rowWidths.push(group.reduce((sum,p)=>sum+p.width*scale+border,0)+Math.max(0,group.length-1)*gap);}
 const layoutWidth=Math.max(0,...rowWidths);
 let offset=0;const height=direction==='horizontal'?pages.reduce((max,p)=>Math.max(max,p.height*scale+border),0):0;
 for(let start=0;start<pages.length;start+=count){
  const group=pages.slice(start,start+count),extent=direction==='horizontal'?group[0].width*scale+border:Math.max(...group.map(p=>p.height*scale+border));
  const row={start,end:start+group.length,offset,extent};rows.push(row);
  let rowX=(layoutWidth-(rowWidths[rows.length-1]||0))/2;
  for(let i=0;i<group.length;i++){const p=group[i],width=p.width*scale+border,h=p.height*scale+border;frames.push({number:p.number,row:rows.length-1,x:direction==='horizontal'?offset:rowX,y:direction==='horizontal'?(height-h)/2:offset,width,height:h});rowX+=width+gap;}
  offset+=extent+gap;
 }
 const length=rows.length?offset-gap:0;
 return {direction,columns:count,rows,frames,width:direction==='horizontal'?length:layoutWidth,height:direction==='horizontal'?height:length};
}
export function visibleReaderWindow(layout,bounds,active=1,buffer=4){
 const horizontal=layout.direction==='horizontal',start=horizontal?bounds.left:bounds.top,end=horizontal?bounds.right:bounds.bottom;
 const first=firstAfter(layout.rows,start,row=>row.offset+row.extent),visible=[];let last=first;
 for(let i=first;i<layout.rows.length&&layout.rows[i].offset<end;i++){last=i;for(let n=layout.rows[i].start;n<layout.rows[i].end;n++){const f=layout.frames[n];const w=Math.min(f.x+f.width,bounds.right)-Math.max(f.x,bounds.left),h=Math.min(f.y+f.height,bounds.bottom)-Math.max(f.y,bounds.top);if(w>0&&h>0)visible.push({number:f.number,ratio:w*h/(f.width*f.height),area:w*h,row:i});}}
 const fallback=Math.min(Math.max(0,Math.floor((active-1)/layout.columns)),Math.max(0,layout.rows.length-1));
 const min=visible.length?visible[0].row:fallback,max=visible.length?visible.at(-1).row:fallback;
 const from=Math.max(0,min-buffer),to=Math.min(layout.rows.length-1,max+buffer),numbers=[];
 for(let i=from;i<=to;i++)for(let n=layout.rows[i].start;n<layout.rows[i].end;n++)numbers.push(layout.frames[n].number);
 return {visible,numbers,firstRow:from,lastRow:to};
}
export function buildThumbnailLayout(pages){let height=0;const frames=pages.map(p=>{const scale=Math.min(128/p.width,160/p.height),item={number:p.number,offset:height,height:p.height*scale+40.2,width:p.width*scale,imageHeight:p.height*scale};height+=item.height+14;return item;});return {frames,height:Math.max(0,height-14)};}
export function visibleThumbnailWindow(layout,top,height,buffer=200){const first=firstAfter(layout.frames,top-buffer,p=>p.offset+p.height),items=[];for(let i=first;i<layout.frames.length&&layout.frames[i].offset<top+height+buffer;i++)items.push(layout.frames[i]);return items;}
