import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
export async function verifyKernelUI(window){
 const evaluate=async code=>{try{return await window.webContents.executeJavaScript(code);}catch(e){console.log('UI test failed at:',code.slice(0,280));throw e;}};
 async function wait(code){for(let i=0;i<900;i++){if(await evaluate(code))return;await new Promise(r=>setTimeout(r,100));}console.log('UI wait timed out:',code.slice(0,200));console.log(await evaluate(`JSON.stringify({toggle:document.querySelector('.translation-toggle')?.getAttribute('aria-pressed'),canvas:[document.querySelector('.page canvas')?.width,document.querySelector('.page canvas')?.height],difference:window.fixtureDifference?.(),error:document.querySelector('.error')?.textContent})`));await writeFile('/tmp/preview-toggle-failure.png',(await window.webContents.capturePage()).toPNG());throw Error('Kernel UI timed out');}

 async function canvasSettled(translated){let stable=0,previous;for(let i=0;i<900;i++){const state=await evaluate(`(()=>{const c=document.querySelector('.page canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let ink=0;for(let j=0;j<d.length;j+=4)if(d[j]<200&&d[j+1]<200&&d[j+2]<200)ink++;return {pressed:document.querySelector('.translation-toggle').getAttribute('aria-pressed'),difference:window.fixtureDifference(),ink};})()`);const valid=state.pressed===String(translated)&&state.ink>1000&&(translated?state.difference>1:state.difference<1);const current=JSON.stringify(state);stable=valid&&current===previous?stable+1:0;previous=current;if(stable>=4)return state.difference;await new Promise(r=>setTimeout(r,100));}throw Error('Stable full-page toggle did not complete');}
 await evaluate(`(()=>{const original=window.fetch;window.fetch=async(...args)=>{const response=await original(...args);if(String(args[0]).startsWith('/api/math-layout/')&&response.ok){const layout=await response.json();layout.paragraphs.push({id:'unchanged-table-header',text:'UNCHANGED TABLE AND HEADER',translation:'UNCHANGED TABLE AND HEADER',fontSize:12,sourceBox:{x:100,y:10,width:400,height:700},translatedBox:{x:100,y:10,width:400,height:702}});return new Response(JSON.stringify(layout),{status:200,headers:{'Content-Type':'application/json'}});}return response;};})()`);
 await wait(`!!document.querySelector('[aria-label="Translation settings"]')`);
 window.focus();await new Promise(r=>setTimeout(r,250));
 await evaluate(`(()=>{const b=document.querySelector('[aria-label="Translation settings"]');b.focus();b.click();})()`);
 await wait(`!!document.querySelector('.settings input[type="checkbox"]')&&document.querySelector('.kernel-traffic-light')?.dataset.status==='ready'`);
 await evaluate(`document.querySelector('.settings input[type="checkbox"]').click();(()=>{const s=Array.from(document.querySelectorAll('.settings select')).find(s=>s.options[0]?.text==='Simplified Chinese');s.value='French';s.dispatchEvent(new Event('change',{bubbles:true}));})();document.querySelector('[aria-label="Close settings"]').click()`);
 await new Promise(resolve=>setTimeout(resolve,100));
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Try a sample document').click()`);
 await wait(`document.querySelectorAll('.thumb canvas').length===2&&document.querySelectorAll('.thumb canvas')[1].width>0`);
 window.focus();await new Promise(r=>setTimeout(r,250));
 await evaluate(`(()=>{const b=document.querySelector('[aria-label="Translation settings"]');b.focus();b.click();})()`);
 await wait(`!!document.querySelector('.settings input[type="checkbox"]')`);
 await evaluate(`document.querySelector('[aria-label="Close settings"]').click()`);
 await wait(`(()=>{const c=document.querySelector('.page canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let ink=0;for(let i=0;i<d.length;i+=4)if(d[i]<200&&d[i+1]<200&&d[i+2]<200)ink++;return ink>1000;})()`);
 const original=await evaluate(`document.querySelector('.page canvas').toDataURL()`);
 await evaluate(`window.fixturePixels=document.querySelector('.page canvas').getContext('2d').getImageData(0,0,document.querySelector('.page canvas').width,document.querySelector('.page canvas').height).data;window.fixtureDifference=()=>{const c=document.querySelector('.page canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;if(d.length!==window.fixturePixels.length)return Infinity;let total=0;for(let i=0;i<d.length;i++)total+=Math.abs(d[i]-window.fixturePixels[i]);return total/d.length;};true;`);
 await writeFile('/tmp/preview-toggle-baseline.png',Buffer.from(original.split(',')[1],'base64'));
 window.focus();await new Promise(r=>setTimeout(r,250));
 await evaluate(`(()=>{const b=document.querySelector('[aria-label="Translation settings"]');b.focus();b.click();})()`);
 await wait(`!!document.querySelector('.settings input[type="checkbox"]')`);
 await evaluate(`document.querySelector('.settings input[type="checkbox"]').click();document.querySelector('[aria-label="Close settings"]').click()`);
 const result={};
 for(const id of ['pdf_math_fast','pdf_math_precise']){console.log('UI checking',id);
  await evaluate(`document.querySelector('.thumb[aria-label="Go to page 1"]').click()`);
  await wait(`document.querySelector('.reader').scrollTop<100`);
  await new Promise(r=>setTimeout(r,300));
  await evaluate(`window.fixtureStalls=[];window.fixtureLast=performance.now();window.fixtureHeartbeat=setInterval(()=>{const now=performance.now();window.fixtureStalls.push(now-window.fixtureLast);window.fixtureLast=now;},16);true`);
  window.focus();await new Promise(r=>setTimeout(r,250));
 await evaluate(`(()=>{const b=document.querySelector('[aria-label="Translation settings"]');b.focus();b.click();})()`);
  await wait(`!!document.querySelector('.kernel-switcher button')`);
  await evaluate(`(()=>{const button=Array.from(document.querySelectorAll('.kernel-switcher button')).find(b=>b.textContent===${JSON.stringify(id==='pdf_math_fast'?'Fast':'Precise')});button.focus();button.click();})()`);
  await wait(`document.querySelector('.kernel-traffic-light')?.dataset.status==='ready'&&!document.querySelector('.kernel-switcher button')?.disabled`);
  await evaluate(`document.querySelector('[aria-label="Close settings"]').click()`);
  await wait(`document.querySelector('.thumb small')?.innerText==='Translated'&&!document.querySelector('.page-caption')?.innerText.includes('Translating')&&document.querySelector('.page canvas').toDataURL()!==${JSON.stringify(original)}`);
  await canvasSettled(true);
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Toggle paragraph: UNCHANGED TABLE AND HEADER"]')`),false,'unchanged merged table/header must not create a page-spanning hit target');
  await wait(`document.querySelectorAll('.paragraph.math').length>0`);
  await evaluate(`document.querySelector('.paragraph.math[data-translation-changed="true"]').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}))`);
  await wait(`(()=>{const c=document.querySelector('.paragraph.math .math-region');return !!c&&c.width>0&&c.height>0;})()`);
  await evaluate(`document.querySelector('.paragraph.math[data-translation-changed="true"]').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}))`);
  await wait(`!document.querySelector('.paragraph.math .math-region')`);
  window.focus();await new Promise(r=>setTimeout(r,250));
 await evaluate(`(()=>{const b=document.querySelector('[aria-label="Translation settings"]');b.focus();b.click();})()`);
  await wait(`document.querySelectorAll('.settings input[type="checkbox"]').length===2`);
  await evaluate(`(()=>{const c=document.querySelectorAll('.settings input[type="checkbox"]')[1];if(!c.checked)c.click();})();document.querySelector('[aria-label="Close settings"]').click()`);
  await wait(`document.querySelector('.paragraph.math.outlined')?.getBoundingClientRect().width>0`);
  await writeFile('/tmp/preview-'+id+'-ui.png',(await window.webContents.capturePage()).toPNG());
  console.log('UI toggle original',id,'baseline difference',await evaluate('window.fixtureDifference()'));
  await evaluate(`document.querySelector('.translation-toggle').click()`);
  await canvasSettled(false);
  console.log('Original pixel difference',id,await evaluate('window.fixtureDifference()'));
  await evaluate(`document.querySelector('.translation-toggle').click()`);
  await canvasSettled(true);
  console.log('Translation pixel difference',id,await evaluate('window.fixtureDifference()'));
  await evaluate(`document.querySelector('.reader').scrollTop=0;true`);await new Promise(resolve=>setTimeout(resolve,300));
  const scrollBefore=await evaluate(`document.querySelector('.reader').scrollTop`);
  const point=await evaluate(`(()=>{const r=document.querySelector('.reader').getBoundingClientRect();return {x:r.left+r.width*.6,y:r.top+r.height*.5};})()`);
  for(let step=0;step<8;step++){window.webContents.sendInputEvent({type:'mouseWheel',x:Math.round(point.x),y:Math.round(point.y),deltaY:-80,deltaX:0,canScroll:true});await new Promise(r=>setTimeout(r,50));}
  await wait(`document.querySelector('.reader').scrollTop>${scrollBefore+100}`);
  const maxGap=await evaluate(`clearInterval(window.fixtureHeartbeat);Math.max(...window.fixtureStalls)`);assert.ok(maxGap<250,`${id} renderer stalled for ${maxGap}ms`);console.log('Renderer heartbeat and scroll',id,maxGap+'ms');
  result[id]={rendererResponsive:true,scrollWhileTranslated:true,versionChecked:true,translatedPageRendered:true,originalToggle:true,paragraphOriginalToggle:true,layoutBoundaries:true};
 }
 assert.equal(Object.keys(result).length,2);await writeFile('/tmp/preview-kernel-ui.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));window.close();
}
