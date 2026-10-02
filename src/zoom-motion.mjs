export const ZOOM_MIN = .1;
export const ZOOM_MAX = 4;
const ACTIVE_MOTION = Symbol('pdfmathreader.zoomMotion');

export function clampZoom(value, min = ZOOM_MIN, max = ZOOM_MAX) {
 const number = Number(value);
 return Math.min(max,Math.max(min,Number.isFinite(number) ? number : 1));
}

/** Use multiplicative steps so a step feels the same at every zoom level. */
export function zoomStep(value, direction, amount = .1) {
 const sign = Number(direction)>=0 ? 1 : -1;
 return clampZoom(Math.round(Number(value)*Math.exp(sign*Math.abs(amount))*10000)/10000);
}

function smoothstep(value){const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);}

export function zoomScaleAt(from, to, progress) {
 const start=Number(from),target=Number(to);
 if(!(start>0)||!(target>0))return 1;
 const ratio=start/target;
 return Math.exp(Math.log(ratio)*(1-smoothstep(progress)));
}

export function zoomKeyframes(from, to) {
 const offsets=[0,.18,.5,.82,1];
 return offsets.map(offset=>({offset,transform:`scale(${zoomScaleAt(from,to,offset)})`}));
}

export function zoomAnimationDuration(from, to, {reducedMotion=false,dragging=false} = {}) {
 if(reducedMotion||dragging||Number(from)===Number(to))return 0;
 return Math.min(360,Math.max(140,150+Math.abs(Math.log(Number(to)/Number(from)))*140));
}

/**
 * Animate only the compositor transform. Page geometry and backing-store
 * resolution can update independently, so callers can render the target once
 * after the motion settles.
 */
export function startZoomMotion(element, {from, to, origin, reducedMotion=false, dragging=false} = {}) {
 if(!element)return {animation:null,duration:0,cancel(){}};
 const duration=zoomAnimationDuration(from,to,{reducedMotion,dragging});
 element[ACTIVE_MOTION]?.cancel();
 element.style.transformOrigin=origin||'0 0';
 if(!duration||typeof element.animate!=='function'){
  element.style.transform='';
  element.style.willChange='';element.style.transformOrigin='';
  return {animation:null,duration,cancel(){}};
 }
 element.style.willChange='transform';
 const animation=element.animate(zoomKeyframes(from,to),{duration,easing:'linear',fill:'both'});
 const clear=()=>{if(element[ACTIVE_MOTION]!==motion)return;if(animation.playState!=='idle')animation.cancel();element.style.willChange='';element.style.transformOrigin='';delete element[ACTIVE_MOTION];};
 const motion={animation,duration,finish(){if(animation.playState!=='idle')animation.finish();clear();},cancel(){if(animation.playState!=='idle')animation.cancel();clear();}};
 element[ACTIVE_MOTION]=motion;
 animation.finished.then(clear).catch(clear);
 return motion;
}
