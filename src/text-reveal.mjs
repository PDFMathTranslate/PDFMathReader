import {loadPDFRuntime} from './pdf-runtime.mjs';
export const revealDuration=520;
const segmenter=new Intl.Segmenter(undefined,{granularity:'grapheme'});
export const characters=text=>Array.from(segmenter.segment(text),item=>item.segment);
export const reducedMotion=()=>document.documentElement.dataset.reduceMotion==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches;
const intersects=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
export function snapshot(canvas){if(!canvas?.width)return null;const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);return copy;}
// Reveal crops of the rendered PDF: its typography and formula glyphs stay native.
export async function revealPDF({canvas,page,scale,host,boxes,previous,signal,origin={x:0,y:0}}){
 if(document.hidden||window.previewActivityActive===false||reducedMotion()||!canvas||!host||signal?.aborted)return;
 const {Util}=await loadPDFRuntime();
 const view=page.getViewport({scale}),content=await page.getTextContent();
 if(signal?.aborted||!host.isConnected)return;
 const blob=await new Promise(resolve=>canvas.toBlob(resolve));if(!blob||signal?.aborted)return;const image=URL.createObjectURL(blob),measure=document.createElement('canvas').getContext('2d');
 const sample=document.createElement('canvas');sample.width=Math.min(512,canvas.width);sample.height=Math.max(1,Math.round(canvas.height*sample.width/canvas.width));const sampleContext=sample.getContext('2d',{willReadFrequently:true});sampleContext.drawImage(canvas,0,0,sample.width,sample.height);const pixels=sampleContext.getImageData(0,0,sample.width,sample.height).data;
 const regions=boxes.map(box=>({x:Math.max(0,box.x-3),y:Math.max(0,box.y-3),width:box.width+6,height:box.height+6}));
 const layer=document.createElement('div');layer.className='pdf-text-reveal';layer.style.setProperty('--pdf-reveal-image',`url("${image}")`);layer.setAttribute('aria-hidden','true');
 const fills=regions.map(region=>{const fill=document.createElement('div');fill.className='pdf-reveal-region';Object.assign(fill.style,{left:(region.x-origin.x)+'px',top:(region.y-origin.y)+'px',width:region.width+'px',height:region.height+'px'});const x=Math.min(sample.width-1,Math.max(0,Math.floor(region.x*sample.width/view.width))),y=Math.min(sample.height-1,Math.max(0,Math.floor(region.y*sample.height/view.height))),offset=(y*sample.width+x)*4;fill.style.backgroundColor=`rgb(${pixels[offset]},${pixels[offset+1]},${pixels[offset+2]})`;layer.append(fill);return {region,fill};});
 let index=0,work=0;
 for(const item of content.items){if(++work%24===0){await new Promise(requestAnimationFrame);if(signal?.aborted){URL.revokeObjectURL(image);return;}}if(!item.str?.trim()||!item.transform)continue;const t=Util.transform(view.transform,item.transform);if(Math.abs(t[1])>.01||Math.abs(t[2])>.01)continue;
  const fontSize=Math.hypot(t[2],t[3]),style=content.styles[item.fontName]||{},height=fontSize*((style.ascent??.9)-(style.descent??-.25));
  const run={x:t[4],y:t[5]-fontSize*(style.ascent??.9),width:item.width*scale,height};const region=fills.find(({region})=>intersects(run,region));if(!region)continue;
  const glyphs=characters(item.str);let family=style.fontFamily||'serif';try{family=page.commonObjs.get(item.fontName).loadedName||family;}catch{}measure.font=fontSize+'px '+family;const widths=glyphs.map(c=>Math.max(.01,measure.measureText(c).width)),total=widths.reduce((a,b)=>a+b,0);let x=run.x;
  for(let i=0;i<glyphs.length;i++){if(i&&i%48===0){await new Promise(requestAnimationFrame);if(signal?.aborted){URL.revokeObjectURL(image);return;}}const width=run.width*widths[i]/total;if(glyphs[i].trim()){
   const mask=document.createElement('span');mask.className='pdf-glyph-mask';Object.assign(mask.style,{left:x-region.region.x+'px',top:run.y-region.region.y+'px',width:width+'px',height:height+'px'});
   const glyph=document.createElement('span');glyph.className='pdf-glyph-rise';Object.assign(glyph.style,{backgroundSize:`${view.width}px ${view.height}px`,backgroundPosition:`${-x}px ${-run.y}px`,'--reveal-delay':Math.min(index++*6,180)+'ms'});mask.append(glyph);region.fill.append(mask);
  }x+=width;}
 }
 if(!index||signal?.aborted){URL.revokeObjectURL(image);return;}
 // A short outgoing phase precedes all incoming glyphs; the mask is opaque.
 if(previous){previous.className='pdf-reveal-old';previous.style.width=view.width+'px';previous.style.height=view.height+'px';layer.append(previous);}
 host.append(layer);const cleanup=()=>{layer.remove();URL.revokeObjectURL(image);};signal?.addEventListener('abort',cleanup,{once:true});
 await new Promise(resolve=>{const finish=()=>{clearTimeout(timer);signal?.removeEventListener('abort',finish);cleanup();resolve();};const timer=setTimeout(finish,revealDuration);signal?.addEventListener('abort',finish,{once:true});});signal?.removeEventListener('abort',cleanup);
}
