// Map all four page corners between viewport rectangles, independently in X/Y.
export function rectangleTransform(from,to){
 return `translate(${to.left-from.left}px, ${to.top-from.top}px) scale(${to.width/from.width}, ${to.height/from.height})`;
}
export function captureDocumentPage(page){
 if(!page)return null;
 const rect=page.getBoundingClientRect();
 if(rect.width<=0||rect.height<=0)return null;
 const copy=page.cloneNode(true),originals=page.querySelectorAll('canvas');
 copy.querySelectorAll('canvas').forEach((canvas,index)=>{
  const original=originals[index];canvas.width=original.width;canvas.height=original.height;
  if(original.width&&original.height)canvas.getContext('2d').drawImage(original,0,0);
 });
 copy.classList.add('document-motion-snapshot');copy.removeAttribute('data-page');copy.setAttribute('aria-hidden','true');copy.inert=true;
 Object.assign(copy.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',transformOrigin:'0 0',pointerEvents:'none',zIndex:'10000',transition:'none',overflow:'hidden',visibility:'visible',boxSizing:'border-box'});
 return {element:copy,rect};
}
export async function animateDocumentPage(capture,from,to,{opening=false,thumbnail,signal}={}){
 if(!capture||signal?.aborted)return;
 const {element,rect}=capture;
 document.body.append(element);
 let animation;
 try{
  animation=element.animate([
   {transform:rectangleTransform(rect,from)},
   {transform:rectangleTransform(rect,to)}
  ],{duration:opening?360:300,easing:'cubic-bezier(.22,.75,.2,1)',fill:'both'});
  // The first-page thumbnail remains the recognizable surface at the small end.
  if(thumbnail){
   const image=document.createElement('img');image.src=thumbnail;image.alt='';
   Object.assign(image.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'100',pointerEvents:'none'});
   element.append(image);
   image.animate([{opacity:opening?1:0},{opacity:opening?0:1}],{duration:opening?360:300,easing:'ease-in-out',fill:'both'});
  }
  const abort=()=>animation.cancel();signal?.addEventListener('abort',abort,{once:true});
  try{await animation.finished.catch(()=>{});}finally{signal?.removeEventListener('abort',abort);}
 }finally{animation?.cancel();element.remove();}
}
