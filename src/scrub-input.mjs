const DEFAULT_MIN = -Infinity;
const DEFAULT_MAX = Infinity;
const DEFAULT_WHEEL_DETENT = 40;
const DEFAULT_WHEEL_THROTTLE = 32;
const DEFAULT_MAX_DETENTS = 8;

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function clampScrubValue(value, min = DEFAULT_MIN, max = DEFAULT_MAX) {
 const lower = finite(min, DEFAULT_MIN), upper = finite(max, DEFAULT_MAX);
 return Math.min(upper, Math.max(lower, finite(value, lower)));
}

/** Parse the percent field consistently: 125 and 125% both mean 125 percent. */
export function parsePercentValue(value, {min = .1, max = 4, fallback = 1} = {}) {
 const raw = String(value ?? '').trim();
 if(!raw)return clampScrubValue(fallback,min,max);
 const percent = raw.endsWith('%');
 const number = Number(percent ? raw.slice(0,-1).trim() : raw);
 if(!Number.isFinite(number))return clampScrubValue(fallback,min,max);
 const ratio = number/100;
 return clampScrubValue(ratio,min,max);
}

export function formatPercentValue(value, digits = 0) {
 const ratio = finite(value, 1);
 return `${(ratio*100).toFixed(Math.max(0,Math.min(3,Math.trunc(digits))))}%`;
}

export function normalizeWheelPixels(event, viewportHeight = 800) {
 if(!event)return 0;
 const mode = Number(event.deltaMode)||0;
 const multiplier = mode===1 ? 16 : mode===2 ? Math.max(1,finite(viewportHeight,800)) : 1;
 const vertical = finite(event.deltaY,0), horizontal = finite(event.deltaX,0);
 return (Math.abs(vertical)>=Math.abs(horizontal) ? vertical : horizontal)*multiplier;
}

/** Consume whole detents while retaining the sub-detent remainder. */
export function consumeDetents(accumulator, detent = DEFAULT_WHEEL_DETENT, maxDetents = DEFAULT_MAX_DETENTS) {
 const size = Math.max(1,Math.abs(finite(detent,DEFAULT_WHEEL_DETENT)));
 const limit = Math.max(1,Math.trunc(finite(maxDetents,DEFAULT_MAX_DETENTS)));
 const raw = Number(accumulator)||0;
 const whole = raw >= 0 ? Math.floor(raw/size) : Math.ceil(raw/size);
 const detents = Math.max(-limit,Math.min(limit,whole));
 return {detents,remainder:raw-detents*size};
}

function defaultRead(input) {
 const number = Number(input?.value);
 return Number.isFinite(number) ? number : 0;
}

/**
 * Attach an Alt-drag / Alt-wheel scrub interaction to a native input.
 * Normal pointer, wheel, and keyboard input are left untouched.
 */
export function createScrubInput(input, options = {}) {
 if(!input?.addEventListener)throw new TypeError('createScrubInput requires an input element');
 const ownerDocument = input.ownerDocument || (typeof document!=='undefined' ? document : null);
 const ownerWindow = ownerDocument?.defaultView || (typeof window!=='undefined' ? window : globalThis);
 const read = options.getValue || (()=>defaultRead(input));
 const write = options.setValue || ((value)=>{input.value=String(value);});
 const min = options.min ?? DEFAULT_MIN;
 const max = options.max ?? DEFAULT_MAX;
 const step = Math.max(Number.EPSILON,Math.abs(finite(options.step,1)));
 const pixelsPerStep = Math.max(1,finite(options.pixelsPerStep,16));
 const wheelDetent = Math.max(1,finite(options.wheelDetent,DEFAULT_WHEEL_DETENT));
 const wheelThrottle = Math.max(0,finite(options.wheelThrottle,DEFAULT_WHEEL_THROTTLE));
 const maxDetents = Math.max(1,Math.trunc(finite(options.maxDetents,DEFAULT_MAX_DETENTS)));
 const deltaToValue = options.deltaToValue || ((value,delta)=>value+delta*step);
 const tick = options.tick || (()=>ownerWindow?.previewHaptics?.tick?.());
 const onCommit = options.onCommit || (()=>{});
 const className = options.className || 'alt-scrub';
 let hovering=false,altDown=false,active=false,pointerId=null,startX=0,startValue=0;
 let wheelRemainder=0,wheelTimer=0,pointerFrame=0,pendingPointerX=null;
 const wasScrubInput=input.classList.contains('scrub-input');
 input.classList.add('scrub-input');

 function updateClass(){input.classList.toggle(className,(hovering&&altDown)||active);}
 function currentValue(){return clampScrubValue(Number(read()),min,max);}
 function setValue(value,source){
  const next=clampScrubValue(value,min,max);
  write(next,{source,commit:false});
  return next;
 }
 function commit(source){onCommit({source,value:currentValue()});}
 function finishPointer(source='pointer'){
  if(!active)return;
  if(pointerFrame){(ownerWindow.cancelAnimationFrame||clearTimeout).call(ownerWindow,pointerFrame);pointerFrame=0;flushPointer();}
  active=false;
  const id=pointerId;pointerId=null;pendingPointerX=null;
  ownerDocument?.removeEventListener('pointermove',documentPointerMove,true);
  ownerDocument?.removeEventListener('pointerup',documentPointerUp,true);
  ownerDocument?.removeEventListener('pointercancel',documentPointerCancel,true);
  if(id!==null&&input.hasPointerCapture?.(id))input.releasePointerCapture(id);
  updateClass();commit(source);
 }
 function flushPointer(){
  pointerFrame=0;
  if(!active||pendingPointerX===null)return;
  const delta=pendingPointerX-startX;pendingPointerX=null;
  setValue(deltaToValue(startValue,delta/pixelsPerStep), 'pointer');
 }
 function schedulePointer(x){
  pendingPointerX=x;
  if(pointerFrame)return;
  const frame=ownerWindow.requestAnimationFrame;
  pointerFrame=frame ? frame(flushPointer) : setTimeout(flushPointer,16);
 }
 function pointerMove(event){
  if(!active||event.pointerId!==pointerId)return;
  event.preventDefault();schedulePointer(event.clientX);
 }
 function documentPointerMove(event){pointerMove(event);}
 function documentPointerUp(event){if(event.pointerId===pointerId)finishPointer();}
 function documentPointerCancel(event){if(event.pointerId===pointerId)finishPointer('pointercancel');}
 function pointerDown(event){
  if(event.button!==0||!event.altKey)return;
  event.preventDefault();
  altDown=true;active=true;pointerId=event.pointerId;startX=event.clientX;startValue=currentValue();pendingPointerX=null;
  try{input.focus({preventScroll:true});}catch{input.focus?.();}
  input.setPointerCapture?.(event.pointerId);
  ownerDocument?.addEventListener('pointermove',documentPointerMove,true);
  ownerDocument?.addEventListener('pointerup',documentPointerUp,true);
  ownerDocument?.addEventListener('pointercancel',documentPointerCancel,true);
  updateClass();
 }
 function pointerMoveOnInput(event){pointerMove(event);}
 function pointerEnd(event){if(active&&event.pointerId===pointerId)finishPointer(event.type==='pointercancel'?'pointercancel':'pointer');}
 function flushWheel(){
  wheelTimer=0;
  const result=consumeDetents(wheelRemainder,wheelDetent,maxDetents);wheelRemainder=result.remainder;
  if(result.detents){
   const next=setValue(deltaToValue(currentValue(),result.detents),'wheel');
   for(let index=0;index<Math.abs(result.detents);index++)tick();
   onCommit({source:'wheel',value:next});
  }
  if(Math.abs(wheelRemainder)>=wheelDetent)wheelTimer=setTimeout(flushWheel,wheelThrottle);
 }
 function wheel(event){
  if(!event.altKey)return;
  event.preventDefault();
  altDown=true;updateClass();
  wheelRemainder+=-normalizeWheelPixels(event,ownerDocument?.documentElement?.clientHeight||800);
  if(!wheelTimer)wheelTimer=setTimeout(flushWheel,wheelThrottle);
 }
 function pointerEnter(event){hovering=true;if(event.altKey)altDown=true;updateClass();}
 function pointerLeave(){hovering=false;updateClass();}
 function keyDown(event){if(event.key==='Alt'||event.altKey){altDown=true;updateClass();}}
 function keyUp(event){if(event.key==='Alt'||!event.altKey){altDown=false;if(active)finishPointer('alt-release');updateClass();}}
 function windowBlur(){altDown=false;if(active)finishPointer('blur');updateClass();}

 input.addEventListener('pointerenter',pointerEnter);
 input.addEventListener('pointerleave',pointerLeave);
 input.addEventListener('pointerdown',pointerDown);
 input.addEventListener('pointermove',pointerMoveOnInput);
 input.addEventListener('pointerup',pointerEnd);
 input.addEventListener('pointercancel',pointerEnd);
 input.addEventListener('lostpointercapture',pointerEnd);
 input.addEventListener('wheel',wheel,{passive:false});
 ownerWindow.addEventListener?.('keydown',keyDown);
 ownerWindow.addEventListener?.('keyup',keyUp);
 ownerWindow.addEventListener?.('blur',windowBlur);

 return {
  destroy(){
   if(wheelTimer){clearTimeout(wheelTimer);wheelTimer=0;}
   finishPointer('destroy');
   input.removeEventListener('pointerenter',pointerEnter);input.removeEventListener('pointerleave',pointerLeave);
   input.removeEventListener('pointerdown',pointerDown);input.removeEventListener('pointermove',pointerMoveOnInput);
   input.removeEventListener('pointerup',pointerEnd);input.removeEventListener('pointercancel',pointerEnd);
   input.removeEventListener('lostpointercapture',pointerEnd);input.removeEventListener('wheel',wheel);
   ownerWindow.removeEventListener?.('keydown',keyDown);ownerWindow.removeEventListener?.('keyup',keyUp);ownerWindow.removeEventListener?.('blur',windowBlur);
   input.classList.remove(className);if(!wasScrubInput)input.classList.remove('scrub-input');
  },
  cancel(){if(active)finishPointer('cancel');wheelRemainder=0;if(wheelTimer){clearTimeout(wheelTimer);wheelTimer=0;}},
  flushWheel,
  isScrubbing:()=>active
 };
}

export const SCRUB_DEFAULTS=Object.freeze({wheelDetent:DEFAULT_WHEEL_DETENT,wheelThrottle:DEFAULT_WHEEL_THROTTLE,maxDetents:DEFAULT_MAX_DETENTS});
