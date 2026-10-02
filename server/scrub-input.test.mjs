import assert from 'node:assert/strict';
import test from 'node:test';
import {clampScrubValue,consumeDetents,formatPercentValue,normalizeWheelPixels,parsePercentValue,createScrubInput} from '../src/scrub-input.mjs';

test('percent parsing accepts plain percentages and percent suffixes',()=>{
 assert.equal(parsePercentValue('125%',{min:.1,max:4}),1.25);
 assert.equal(parsePercentValue('125',{min:.1,max:4}),1.25);
 assert.equal(parsePercentValue('1.25',{min:.1,max:4}),.1);
 assert.equal(parsePercentValue('50',{min:.1,max:4}),.5);
 assert.equal(parsePercentValue('999%',{min:.1,max:4}),4);
 assert.equal(parsePercentValue('',{min:.1,max:4,fallback:1.5}),1.5);
 assert.equal(formatPercentValue(1.25), '125%');
});

test('wheel normalization and detent consumption retain sub-detent motion',()=>{
 assert.equal(normalizeWheelPixels({deltaY:2,deltaX:10,deltaMode:1}),160);
 assert.deepEqual(consumeDetents(95,40),{detents:2,remainder:15});
 assert.deepEqual(consumeDetents(-95,40),{detents:-2,remainder:-15});
 assert.deepEqual(consumeDetents(400,40,3),{detents:3,remainder:280});
 assert.equal(clampScrubValue(9,0,4),4);
});

class FakeClassList {
 constructor(){this.values=new Set();}
 add(value){this.values.add(value);}
 remove(value){this.values.delete(value);}
 contains(value){return this.values.has(value);}
 toggle(value,force){if(force===undefined? !this.values.delete(value):force)this.values.add(value);else this.values.delete(value);return this.values.has(value);}
}

class FakeWindow extends EventTarget {
 constructor(){super();this.ticks=0;this.previewHaptics={tick:()=>{this.ticks++;}};}
}

class FakeInput extends EventTarget {
 constructor(ownerDocument){super();this.ownerDocument=ownerDocument;this.value='1';this.classList=new FakeClassList();this.focused=false;}
 focus(){this.focused=true;}
 setPointerCapture(){this.captured=true;}
 hasPointerCapture(){return !!this.captured;}
 releasePointerCapture(){this.captured=false;}
}

function wheelEvent({deltaX=0,deltaY=0,deltaMode=0,altKey=false}={}){
 const event=new Event('wheel',{cancelable:true});
 Object.assign(event,{deltaX,deltaY,deltaMode,altKey});
 return event;
}

test('Alt wheel is cumulative, bounded to the input range, and ticks per detent',()=>{
 const ownerWindow=new FakeWindow(),ownerDocument={defaultView:ownerWindow,documentElement:{clientHeight:800}};
 const input=new FakeInput(ownerDocument);let commits=0;
 const scrub=createScrubInput(input,{getValue:()=>Number(input.value),setValue:value=>{input.value=String(value);},min:1,max:5,step:1,wheelDetent:40,wheelThrottle:0,onCommit:()=>{commits++;}});
 input.dispatchEvent(wheelEvent({deltaY:-20,altKey:true}));
 input.dispatchEvent(wheelEvent({deltaY:-25,altKey:true}));
 scrub.flushWheel();
 assert.equal(input.value,'2');
 assert.equal(ownerWindow.ticks,1);
 assert.equal(commits,1);
 input.dispatchEvent(wheelEvent({deltaY:200,altKey:false}));
 assert.equal(input.value,'2');
 scrub.destroy();
 assert.equal(input.classList.contains('scrub-input'),false);
});
