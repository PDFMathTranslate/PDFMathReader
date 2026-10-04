import {captureDocumentPage,rectangleTransform,releaseDocumentCapture} from './document-motion.mjs';

// Keep the old page visible while Vue commits the destination geometry.
export function captureLayoutMotion(reader,page,{reducedMotion=false}={}){
 if(reducedMotion||!reader||!page||typeof page.animate!=='function')return null;
 const capture=captureDocumentPage(page);
 if(!capture)return null;
 const bounds=reader.getBoundingClientRect(),layer=document.createElement('div');
 Object.assign(layer.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'4',clipPath:`inset(${bounds.top}px ${Math.max(0,innerWidth-bounds.right)}px ${Math.max(0,innerHeight-bounds.bottom)}px ${bounds.left}px)`});
 layer.setAttribute('aria-hidden','true');layer.inert=true;
 capture.element.style.zIndex='auto';layer.append(capture.element);
 (document.querySelector('.app')||document.body).append(layer);
 const hidden=new Map();let animation;
 function hide(host){if(host&&!hidden.has(host)){hidden.set(host,host.style.visibility);host.style.visibility='hidden';}}
 hide(page);
 function cancel(){animation?.cancel();releaseDocumentCapture(capture);layer.remove();for(const [host,visibility] of hidden)host.style.visibility=visibility;hidden.clear();}
 return {
  cancel,
  async play(target){
   if(!target){cancel();return;}
   hide(target);
   const destination=target.getBoundingClientRect();
   try{
    animation=capture.element.animate([{transform:'translate(0px, 0px) scale(1, 1)'},{transform:rectangleTransform(capture.rect,destination)}],{duration:300,easing:'cubic-bezier(.22,.75,.2,1)',fill:'both'});
    await animation.finished.catch(()=>{});
   }finally{cancel();}
  }
 };
}
