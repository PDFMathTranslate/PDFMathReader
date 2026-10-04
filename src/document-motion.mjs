// Map all four page corners between viewport rectangles, independently in X/Y.
export function rectangleTransform(from,to){
 return `translate(${to.left-from.left}px, ${to.top-from.top}px) scale(${to.width/from.width}, ${to.height/from.height})`;
}
// Motion textures need screen resolution, not the PDF's zoomed backing store.
export function motionCanvasSize(width,height,maxPixels=2*1024*1024){
 const ratio=Math.min(1,Math.sqrt(maxPixels/(width*height)));
 return {width:Math.max(1,Math.floor(width*ratio)),height:Math.max(1,Math.floor(height*ratio))};
}
export function captureDocumentPage(page){
 if(!page)return null;
 const rect=page.getBoundingClientRect();
 if(rect.width<=0||rect.height<=0)return null;
 const copy=page.cloneNode(true),originals=page.querySelectorAll('canvas');
 const windows=!!document.querySelector('.app[data-platform="win32"]');
 copy.querySelectorAll('canvas').forEach((canvas,index)=>{
  const original=originals[index];
  if(windows&&original.width&&original.height){
   const style=getComputedStyle(original),size=motionCanvasSize(original.width,original.height);
   canvas.style.width=style.width;canvas.style.height=style.height;
   canvas.width=size.width;canvas.height=size.height;
  }else{canvas.width=original.width;canvas.height=original.height;}
  if(original.width&&original.height)canvas.getContext('2d').drawImage(original,0,0,canvas.width,canvas.height);
 });
 copy.classList.add('document-motion-snapshot');copy.removeAttribute('data-page');copy.setAttribute('aria-hidden','true');copy.inert=true;
 Object.assign(copy.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',transformOrigin:'0 0',pointerEvents:'none',zIndex:'10000',transition:'none',overflow:'hidden',visibility:'visible',boxSizing:'border-box'});
 return {element:copy,rect};
}
export async function animateDocumentPage(capture,from,to,{opening=false,thumbnail,signal}={}){
 if(!capture||signal?.aborted)return;
 const {element,rect}=capture;
 const app=document.querySelector('.app');
 // Keep the snapshot inside the app's isolated stacking context, below its toolbar (5).
 element.style.zIndex='4';
 (app||document.body).append(element);
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

// Animate a frozen rail so its motion never changes the reader's geometry.
export async function animateDocumentSidebar(sidebar,{opening=false,signal}={}){
 const capture=captureDocumentPage(sidebar);
 if(!capture||signal?.aborted)return;
 const {element,rect}=capture,app=document.querySelector('.app');
 element.style.height=rect.height+'px';element.style.zIndex='3';
 (app||document.body).append(element);
 const hidden={transform:`translateX(${-rect.width}px)`,opacity:0};
 const visible={transform:'translateX(0)',opacity:1};
 const animation=element.animate(opening?[hidden,visible]:[visible,hidden],{duration:opening?360:300,easing:'cubic-bezier(.22,.75,.2,1)',fill:'both'});
 const abort=()=>animation.cancel();signal?.addEventListener('abort',abort,{once:true});
 try{await animation.finished.catch(()=>{});}
 finally{signal?.removeEventListener('abort',abort);animation.cancel();element.remove();}
}
