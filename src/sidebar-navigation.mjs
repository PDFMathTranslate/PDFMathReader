// Resolve only against the original PDF. Destinations become physical page numbers.
export async function readOutline(pdf) {
 const outline=await pdf.getOutline();
 async function resolve(items,depth=0,prefix='') {
  return (await Promise.all((items||[]).map(async(item,index)=>{
   const id=prefix+index;let page=null;
   try {
    const destination=typeof item.dest==='string'?await pdf.getDestination(item.dest):item.dest;
    if(Array.isArray(destination)) {
     const target=destination[0];
     const number=Number.isInteger(target)?target+1:await pdf.getPageIndex(target)+1;
     if(number>=1&&number<=pdf.numPages)page=number;
    }
   }catch{} // Broken/external destinations retain their heading and children.
   return [{id,title:item.title||'',depth,page},...await resolve(item.items,depth+1,id+'.')];
  }))).flat();
 }
 return resolve(outline);
}
export function orderedAnnotations(items) {
 return [...items].sort((a,b)=>a.page-b.page||(a.rects[0]?.y||0)-(b.rects[0]?.y||0)||(a.rects[0]?.x||0)-(b.rects[0]?.x||0)||a.createdAt.localeCompare(b.createdAt));
}
