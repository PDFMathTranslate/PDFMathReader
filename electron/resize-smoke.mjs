import assert from 'node:assert/strict';
import {Menu} from 'electron';
import {PDFDocument} from 'pdf-lib';
import {writeFile} from 'node:fs/promises';
export async function verifyResize(window){
 const evaluate=code=>window.webContents.executeJavaScript(code),pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function wait(code){for(let i=0;i<100;i++){if(await evaluate(code))return;await pause(50);}throw Error('Resize assertion timed out: '+code);}
 await wait(`!!document.querySelector('.empty .primary')`);
 assert.equal(await evaluate(`document.querySelector('[aria-label="Open PDF"]')`),null);
 assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Zoom"],[aria-label="Zoom in"],[aria-label="Zoom out"],[aria-label="Fit width"],[aria-label="Fit height"]').length`),0);
 const fixture=await PDFDocument.create();for(let i=0;i<4;i++)fixture.addPage([612,792]).drawRectangle({x:250,y:340,width:100,height:100});const encoded=Buffer.from(await fixture.save()).toString('base64');
 await evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File([Uint8Array.from(atob(${JSON.stringify(encoded)}),c=>c.charCodeAt(0))],'Portrait and landscape.pdf',{type:'application/pdf'}));const input=document.querySelector('input[type=file]');input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait(`!!document.querySelector('.page canvas')?.width`);
 // CSS transparency must reach the native behind-window material.
 const glassLayers=await evaluate(`(()=>{const rail=document.querySelector('.sidebar');return [rail,...function*(node){while(node.parentElement){node=node.parentElement;yield node}}(rail)].map(e=>getComputedStyle(e).backgroundColor)})()`);
 assert.ok(glassLayers.every(color=>color==='rgba(0, 0, 0, 0)'),JSON.stringify(glassLayers));
 const railImage=await window.webContents.capturePage(),railSize=railImage.getSize(),railPixels=railImage.toBitmap(),railScale=railSize.width/window.getContentBounds().width;
 assert.equal(railPixels[(Math.floor(100*railScale)*railSize.width+Math.floor(5*railScale))*4+3],0,'Sidebar compositor must expose the native material');
 await wait(`!!document.querySelector('.thumbnail-highlight')`);
 await evaluate(`document.querySelector('[aria-label="Go to page 2"]').click();true`);
 await wait(`document.querySelector('.thumb.selected')?.getAttribute('aria-label')==='Go to page 2'`);
 assert.ok(await evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches || document.querySelector('.thumbnail-highlight').getAnimations().some(a=>a.playState==='running')`),'Selection surface should animate between pages');
 await pause(300);
 assert.ok(await evaluate(`(()=>{const h=document.querySelector('.thumbnail-highlight').getBoundingClientRect(),b=document.querySelector('.thumb.selected').getBoundingClientRect();return ['top','left','width','height'].every(key=>Math.abs(h[key]-b[key])<1)})()`),'Highlight must settle onto the selected thumbnail');
 await evaluate(`document.querySelector('[aria-label="Go to page 1"]').click();true`);await pause(300);
 await evaluate(`document.querySelector('.title strong').textContent='A very long document filename with many words '.repeat(20);true`);
 await wait(`Array.from(document.querySelectorAll('.page canvas,.thumb canvas')).every(c=>{const p=c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data;return p[3]===255&&p[0]<50;})`);
 await evaluate(`window.fixtureBlankFrames=0;window.fixtureFrameCount=0;window.fixtureMonitor=true;function observeFrame(){if(!window.fixtureMonitor)return;for(const c of document.querySelectorAll('.page canvas,.thumb canvas')){if(!c.width||!c.height)continue;const pixel=c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data;if(pixel[3]<250||pixel[0]>50)window.fixtureBlankFrames++;}window.fixtureFrameCount++;requestAnimationFrame(observeFrame);}requestAnimationFrame(observeFrame);true`);
 const menu=Menu.getApplicationMenu();
 for(const count of [2,4,1]){menu.getMenuItemById('columns-'+count).click();await pause(400);const rects=await evaluate(`Array.from(document.querySelectorAll('.page')).map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right};})`);assert.equal(rects[0].y,rects[count-1].y);if(count<4)assert.ok(rects[count].y>rects[0].y);assert.equal(menu.getMenuItemById('columns-'+count).checked,true,'selected columns '+count);}
 menu.getMenuItemById('layout-horizontal').click();await pause(400);assert.equal(menu.getMenuItemById('layout-columns').enabled,false,'horizontal disables column menu');const horizontal=await evaluate(`Array.from(document.querySelectorAll('.page')).map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y};})`);assert.ok(horizontal.every(r=>r.y===horizontal[0].y));assert.ok(horizontal[3].x>horizontal[0].x);window.webContents.send('reader:action','percent:100');await pause(250);assert.ok(await evaluate(`document.querySelector('.reader').scrollLeft>0`));
 menu.getMenuItemById('layout-vertical').click();await pause(400);window.webContents.send('reader:action','percent:10');await pause(250);assert.equal(menu.getMenuItemById('layout-columns').enabled,true);
 const saved=await evaluate(`window.previewPreferences.load()`);assert.equal(saved.direction,'vertical');assert.equal(saved.columns,1);
 await evaluate(`document.querySelector('.reader').style.scrollBehavior='auto';true`);
 const marginResults=[];
 for(const direction of ['vertical','horizontal']){
  menu.getMenuItemById('layout-'+direction).click();
  for(const columns of direction==='vertical'?[1,2,4]:[1]){
   if(direction==='vertical')menu.getMenuItemById('columns-'+columns).click();
   await evaluate(`document.querySelector('[aria-label="Fit ${direction==='horizontal'?'height':'width'}"]').click();true`);await pause(450);
   await evaluate(`(()=>{const r=document.querySelector('.reader');r.scrollTop=0;r.scrollLeft=0;return true;})()`);await pause(100);
   const before=await evaluate(`(()=>{const reader=document.querySelector('.reader'),layout=document.querySelector('.page-layout'),style=getComputedStyle(reader),gap=getComputedStyle(layout),first=document.querySelector('.page').getBoundingClientRect(),r=reader.getBoundingClientRect();return {padding:[style.paddingTop,style.paddingRight,style.paddingBottom,style.paddingLeft].map(parseFloat),gapX:parseFloat(gap.columnGap),gapY:parseFloat(gap.rowGap),top:first.top-r.top,left:first.left-r.left,pageHeights:[...document.querySelectorAll('.page')].map(p=>p.getBoundingClientRect().height),wrapHeights:[...document.querySelectorAll('.page-wrap')].map(p=>p.getBoundingClientRect().height),scrollWidth:reader.scrollWidth,scrollHeight:reader.scrollHeight,clientHeight:reader.clientHeight,offsetHeight:reader.offsetHeight,readerHeight:r.height};})()`);
   assert.equal(before.padding[0],88);assert.equal(before.padding[1],before.padding[3]);assert.ok(before.padding.slice(1).every(value=>value>=0&&value<=24));assert.equal(before.gapX,24);assert.equal(before.gapY,24);assert.ok(before.top>=23);assert.ok(Math.abs(before.left-24)<1,JSON.stringify({direction,columns,before}));
   for(let i=0;i<before.pageHeights.length;i++)assert.ok(Math.abs(before.pageHeights[i]-before.wrapHeights[i])<1,'status must not enlarge page wrapper');
   await evaluate(`(()=>{document.querySelectorAll('.page-wrap').forEach((wrap,index)=>{const message=document.createElement('div');message.className='page-caption '+['progress','warning','error'][index%3];message.dataset.marginFixture='true';message.textContent='Status fixture '+('long message '.repeat(20));wrap.append(message);});return true;})()`);await pause(100);
   const after=await evaluate(`(()=>{const reader=document.querySelector('.reader');return {heights:[...document.querySelectorAll('.page-wrap')].map(p=>p.getBoundingClientRect().height),scrollWidth:reader.scrollWidth,scrollHeight:reader.scrollHeight};})()`);
   assert.deepEqual(after.heights,before.wrapHeights);assert.equal(after.scrollWidth,before.scrollWidth);assert.equal(after.scrollHeight,before.scrollHeight);
   const pageRects=await evaluate(`Array.from(document.querySelectorAll('.page')).map(p=>{const b=p.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};})`);
   if(direction==='vertical'&&columns>1)assert.ok(Math.abs(pageRects[1].left-pageRects[0].right-24)<1);
   if(direction==='vertical'&&columns<4)assert.ok(Math.abs(pageRects[columns].top-pageRects[0].bottom-24)<1);
   if(direction==='horizontal')assert.ok(Math.abs(pageRects[1].left-pageRects[0].right-24)<1);
   await writeFile(`/tmp/pdfmathreader-margins-${direction}-${columns}.png`,(await window.webContents.capturePage()).toPNG());
   await evaluate(`(()=>{document.querySelectorAll('[data-margin-fixture]').forEach(p=>p.remove());const r=document.querySelector('.reader');r.scrollTop=r.scrollHeight;r.scrollLeft=r.scrollWidth;return true;})()`);await pause(100);
   const end=await evaluate(`(()=>{const r=document.querySelector('.reader'),bounds=r.getBoundingClientRect(),page=[...document.querySelectorAll('.page')].at(-1).getBoundingClientRect();return {view:window.previewRenderDiagnostics().readingView,layout:document.querySelector('.page-layout').className,right:bounds.right-page.right,bottom:bounds.bottom-page.bottom,clientWidth:r.clientWidth,offsetWidth:r.offsetWidth,scrollLeft:r.scrollLeft,scrollWidth:r.scrollWidth,pageRight:page.right,readerRight:bounds.right,paddingRight:getComputedStyle(r).paddingRight};})()`);
   assert.ok(Math.abs(end.right-24)<1,JSON.stringify({direction,columns,end}));assert.ok(Math.abs(end.bottom-(before.top-64))<1,JSON.stringify({before,end}));
   marginResults.push({direction,columns,...before,...end,statusDoesNotChangeGeometry:true});
  }
 }
 menu.getMenuItemById('layout-vertical').click();menu.getMenuItemById('columns-1').click();await pause(300);
 const results=[];
 for(const mode of ['width','height']){
 await evaluate(`document.querySelector('[aria-label="Fit ${mode}"]').click();true`);
 for(const [width,height] of [[720,600],[900,600],[1400,1000],[1050,700]]){
 window.setContentSize(width,height);await pause(400);
 const state=await evaluate(`(()=>{const r=document.querySelector('.reader'),p=document.querySelector('.page').getBoundingClientRect(),s=getComputedStyle(r);return {actual:${mode==='width'?'p.width':'p.height'},expected:${mode==='width'?'r.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)':'r.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom)'},selected:document.querySelector('[aria-label="Fit '+${JSON.stringify(mode)}+'"]')?.getAttribute('aria-pressed')};})()`);
 const header=await evaluate(`(()=>{const bar=document.querySelector('.toolbar'),tools=document.querySelector('.toolbar-actions'),title=document.querySelector('.title'),r=bar.getBoundingClientRect(),t=tools.getBoundingClientRect(),n=title.getBoundingClientRect();return {right:t.right,expected:r.right-parseFloat(getComputedStyle(bar).paddingRight),titleRight:n.right,toolsLeft:t.left,visible:Array.from(tools.children).every(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.left>=t.left&&b.right<=r.right;}),trimmed:document.querySelector('.title strong').scrollWidth>document.querySelector('.title strong').clientWidth};})()`);
 assert.ok(Math.abs(header.right-header.expected)<1);assert.ok(header.titleRight<=header.toolsLeft);assert.equal(header.visible,true);assert.equal(header.trimmed,true);
 assert.ok(Math.abs(state.actual-state.expected)<2,JSON.stringify(state));assert.equal(state.selected,'true');assert.equal(window.isFocused(),false);results.push({mode,width,height,...state});
 }
 }
 await evaluate(`document.querySelector('[aria-label="Zoom in"]').click();true`);await pause(250);const manual=await evaluate(`document.querySelector('.page').getBoundingClientRect().width`);window.setContentSize(1200,850);await pause(400);assert.ok(Math.abs(await evaluate(`document.querySelector('.page').getBoundingClientRect().width`)-manual)<2);
 await evaluate(`document.querySelector('[aria-label="Toggle thumbnails"]').click();true`);await pause(300);await evaluate(`document.querySelector('[aria-label="Toggle thumbnails"]').click();true`);await pause(500);
 await evaluate(`document.querySelector('.reader').dispatchEvent(new Event('scroll'));true`);const originalFullscreen=window.isFullScreen.bind(window);window.isFullScreen=()=>true;window.emit('enter-full-screen');await pause(400);
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('.toolbar')).display`),'none');assert.equal(await evaluate(`document.querySelector('.workspace').getBoundingClientRect().top`),0);assert.equal(window.isFocused(),false);assert.equal(await evaluate(`getComputedStyle(document.querySelector('.page-navigator')).display`),'none');
 window.isFullScreen=()=>false;window.emit('leave-full-screen');await pause(400);assert.equal(await evaluate(`getComputedStyle(document.querySelector('.toolbar')).display`),'grid');assert.equal(await evaluate(`document.querySelector('.workspace').getBoundingClientRect().top`),0);window.isFullScreen=originalFullscreen;
 const frames=await evaluate(`window.fixtureMonitor=false;({blank:window.fixtureBlankFrames,count:window.fixtureFrameCount})`);assert.ok(frames.count>20);assert.equal(frames.blank,0,JSON.stringify(frames));
 const result={symmetricPageMargins:true,statusDoesNotChangeGeometry:true,marginResults,layoutMenuAndNavigation:true,layoutPreferencesPersisted:true,fullscreenUIHidesAndRestores:true,noBlankPreviewOrThumbnailFrames:true,frames,rightAlignedToolbar:true,allHeaderToolsVisible:true,titleTrimTracksWindow:true,fitWidthTracksResize:true,fitHeightTracksResize:true,manualZoomPreserved:true,backgroundWindowNeverFocused:true,results};await writeFile('/tmp/preview-resize-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));window.close();
}
