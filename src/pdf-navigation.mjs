// PDF destinations use PDF user-space coordinates, not DOM top-left coordinates.
export async function resolvePDFDestination(document, destination) {
 const dest=typeof destination==='string'?await document.getDestination(destination):destination;
 if(!Array.isArray(dest)||dest.length<2)return null;
 const pageNumber=Number.isInteger(dest[0])?dest[0]+1:await document.getPageIndex(dest[0])+1;
 if(pageNumber<1||pageNumber>document.numPages)return null;
 return {pageNumber,dest};
}
export function destinationPoint(page, dest, scale) {
 const viewport=page.getViewport({scale}),[left,bottom,right,top]=page.view;
 let x=left,y=top;
 switch(dest[1]?.name){
  case 'XYZ':x=dest[2]??left;y=dest[3]??top;break;
  case 'FitH':case 'FitBH':y=dest[2]??top;break;
  case 'FitV':case 'FitBV':x=dest[2]??left;break;
  case 'FitR':x=dest[2]??left;y=dest[5]??top;break;
 }
 const [vx,vy]=viewport.convertToViewportPoint(x,y);
 return {x:Math.max(0,Math.min(viewport.width,vx)),y:Math.max(0,Math.min(viewport.height,vy))};
}
export function destinationScale(page,dest,current,width,height){
 const viewport=page.getViewport({scale:1}),kind=dest[1]?.name;
 let scale=current;
 if(kind==='XYZ'&&Number.isFinite(dest[4])&&dest[4]>0)scale=dest[4];
 else if(kind==='Fit'||kind==='FitB')scale=Math.min(width/viewport.width,height/viewport.height);
 else if(kind==='FitH'||kind==='FitBH')scale=width/viewport.width;
 else if(kind==='FitV'||kind==='FitBV')scale=height/viewport.height;
 else if(kind==='FitR'&&dest.slice(2,6).every(Number.isFinite)){
  const [x1,y1]=viewport.convertToViewportPoint(dest[2],dest[3]),[x2,y2]=viewport.convertToViewportPoint(dest[4],dest[5]);
  if(x1!==x2&&y1!==y2)scale=Math.min(width/Math.abs(x2-x1),height/Math.abs(y2-y1));
 }
 return Math.max(.1,Math.min(4,scale));
}
