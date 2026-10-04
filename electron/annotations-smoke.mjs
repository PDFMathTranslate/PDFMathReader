import assert from 'node:assert/strict';
import {app,Menu,clipboard} from 'electron';
import {PDFDocument,PDFName,PDFHexString} from 'pdf-lib';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {writeFile} from 'node:fs/promises';
export async function verifyAnnotations(window,recents){
 const run=async code=>{try{return await window.webContents.executeJavaScript(code);}catch(error){throw Error(error.message+'\nRenderer script: '+code);}},pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function wait(code){for(let i=0;i<160;i++){if(await run(code))return;await pause(60);}await writeFile('/tmp/pdfreader-annotation-failure.png',(await window.webContents.capturePage()).toPNG());throw Error('Annotation smoke timeout: '+code+' '+JSON.stringify(await run(`({mode:document.querySelector('.app')?.className,text:document.body.innerText.slice(0,2000),diagnostics:window.previewRenderDiagnostics?.(),errors:window.annotationErrors})`))); }
 async function contextAction(selector,action,kind='comment'){
  const dispatch=`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:300,clientY:300}))`;
  if(process.platform!=='darwin'){
   await run(dispatch);await wait(`!!document.querySelector('.annotation-menu')`);
   if(action)await run(`Array.from(document.querySelectorAll('.annotation-menu button')).find(b=>b.textContent===${JSON.stringify(action)}).click()`);
   else await run(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
   return;
  }
  const popup=Menu.prototype.popup;let captured;
  Menu.prototype.popup=function(options){captured={menu:this,options};};
  try{
   await run(dispatch);
   for(let i=0;i<100&&!captured;i++)await pause(20);
   assert.ok(captured,'annotation event reaches native Electron Menu');
   assert.equal(captured.options.window,window);
   assert.deepEqual(captured.menu.items.filter(i=>i.type!=='separator').map(i=>i.label),kind==='comment'?['复制','分享','Hand over to AI','修改','删除']:['复制','分享','谷歌搜索','谷歌学术搜索','Hand over to AI','删除']);
   assert.equal(await run(`!!document.querySelector('.annotation-menu')`),false,'macOS has no custom context menu');
   if(action)captured.menu.items.find(i=>i.label===action).click();
   captured.options.callback();await pause(100);
  }finally{Menu.prototype.popup=popup;}
 }
 await wait('window.previewReady');
 await run(`window.previewPreferences.save({interactionMode:'reading',automatic:false})`);
 await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload();});await wait('window.previewReady');await wait(`document.querySelector('.app').classList.contains('reading-interaction')`);
 await run(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Try a sample document').click()`);
 await wait(`!window.previewRenderDiagnostics().opening&&window.previewRenderDiagnostics().totalPages>0`);
 await wait(`!document.querySelector('.translation-toggle')?.disabled`);
 await run(`(()=>{if(window.previewRenderDiagnostics().readingView.showTranslations)document.querySelector('.translation-toggle').click();return true;})()`);
 await wait(`document.querySelector('.reading-text-layer span')`);
 // Exercise the real nested stacking contexts against opaque black page ink.
 await run(`(()=>{const fixture=document.createElement('div');fixture.id='highlight-ink-fixture';fixture.style.cssText='position:fixed;left:0;top:0;width:80px;height:40px;z-index:99999;background:white';fixture.innerHTML='<div style="position:absolute;inset:0;background:linear-gradient(to right,black 50%,white 50%)"></div><div class="annotation-visibility"><div class="annotation-layer"><button class="annotation-mark annotation-highlight" style="left:0;top:0;width:80px;height:40px;background:#66ff66"></button></div></div>';document.body.append(fixture);return true;})()`);
 await pause(100);
 const inkImage=(await window.webContents.capturePage({x:0,y:0,width:80,height:40})).resize({width:80,height:40}).toBitmap();
 const pixel=(x,y)=>[...inkImage.subarray((y*80+x)*4,(y*80+x)*4+3)];
 assert.ok(pixel(20,20).every(c=>c<=2),`highlight preserves black ink: ${pixel(20,20)}`);
 assert.ok(pixel(60,20).some(c=>c<240),'highlight still colors the white paper');
 await run(`document.querySelector('#highlight-ink-fixture').remove()`);
 async function select(){await wait(`!!document.querySelector('.reading-text-layer span')`);await run(`(()=>{const el=document.querySelector('.reading-text-layer span');const range=document.createRange();range.selectNodeContents(el);const s=window.getSelection();if(!s)throw Error('Selection unavailable');s.removeAllRanges();s.addRange(range);el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));return true;})()`);await wait(`!!document.querySelector('.annotation-toolbar')`);}
 await select();assert.equal(await run(`document.querySelectorAll('.annotation-toolbar button').length`),4);
 const commentIcon=await run(`(()=>{const el=document.querySelector('[aria-label="添加批注"] .annotation-comment-icon'),s=getComputedStyle(el),r=el.getBoundingClientRect();return {tag:el.tagName,paths:el.querySelectorAll('path').length,stroke:s.stroke,width:r.width,height:r.height};})()`);
 assert.equal(commentIcon.tag,'svg');assert.equal(commentIcon.paths,2);assert.notEqual(commentIcon.stroke,'none');assert.ok(commentIcon.width>0&&commentIcon.height>0);

 await run(`document.querySelector('[aria-label="荧光黄"]').click()`);
 await wait(`!!document.querySelector('.annotation-highlight')`);
 await wait(`document.querySelector('.copy-toast')?.textContent.includes('自动保存')`);
 assert.equal(await run(`getComputedStyle(document.querySelector('.annotation-highlight')).borderRadius`),'6px');
 await wait(`(async()=> (await window.previewAnnotations.load(window.previewRenderDiagnostics().annotationKey)).length===1)()`);
 await select();await run(`document.querySelector('[aria-label="添加批注"]').click()`);
 await wait(`!!document.querySelector('.annotation-editor textarea')`);
 await run(`(()=>{const t=document.querySelector('.annotation-editor textarea');t.value='A saved reading comment';t.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
 await run(`document.querySelector('.annotation-editor').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
 await wait(`!!document.querySelector('.annotation-note')&&!document.querySelector('.annotation-editor')`);await wait(`(async()=> (await window.previewAnnotations.load(window.previewRenderDiagnostics().annotationKey)).some(a=>a.comment==='A saved reading comment'))()`);
 await wait(`!!document.querySelector('.annotation-comment-highlight')`);
 await contextAction('.annotation-highlight',null,'highlight');
 assert.equal(await run(`!!document.querySelector('.annotation-confirm')`),false,'cancel preserves annotation');
 await contextAction('.annotation-note','复制');assert.match(await clipboard.readText(),/A saved reading comment/);
 await contextAction('.annotation-note','修改');await wait(`!!document.querySelector('.annotation-editor')`);
 await run(`document.querySelector('.annotation-editor button[type="button"]').click()`);
 await contextAction('.annotation-note','删除');await wait(`!!document.querySelector('.annotation-confirm')`);
 await run(`document.querySelector('.annotation-confirm button:first-of-type').click()`);
 console.log(JSON.stringify({nativeAnnotationContextMenu:process.platform==='darwin',menuCancellation:true,menuCopy:true,menuEdit:true,menuDeleteConfirmation:true}));

 const commentGeometry=await run(`(()=>{const h=document.querySelector('.annotation-comment-highlight').getBoundingClientRect(),n=document.querySelector('.annotation-comment-note').getBoundingClientRect();return {outside:n.left>h.right,aligned:Math.abs((n.top+n.height/2)-(h.top+h.height/2))<2,background:getComputedStyle(document.querySelector('.annotation-comment-highlight')).backgroundColor};})()`);
 assert.equal(commentGeometry.outside,true,'comment marker sits outside text');assert.equal(commentGeometry.aligned,true,'comment marker aligns with selected line');assert.equal(commentGeometry.background,'rgb(155, 155, 155)');
 await run(`document.querySelector('.annotation-comment-highlight').click()`);await wait(`document.querySelector('.annotation-reader')?.textContent.includes('A saved reading comment')`);
 await pause(250);
 const popup=await run(`(()=>{const el=document.querySelector('.annotation-reader'),r=el.getBoundingClientRect(),text=el.querySelector('p'),header=el.querySelector('header span'),time=el.querySelector('time'),close=el.querySelector('button'),line=document.querySelector('.annotation-comment-highlight').getBoundingClientRect();return {markerHidden:!document.querySelector('.annotation-comment-note'),aligned:Math.abs(header.getBoundingClientRect().left-text.getBoundingClientRect().left)<1&&Math.abs(time.getBoundingClientRect().left-text.getBoundingClientRect().left)<1,muted:[header,time,close].map(n=>getComputedStyle(n).color),body:getComputedStyle(text).color,bounded:r.left>=11&&r.right<=innerWidth-11&&r.top>=11&&r.bottom<=innerHeight-11,anchored:r.top>=line.bottom+6||r.bottom<=line.top-6};})()`);
 assert.equal(popup.markerHidden,true);assert.equal(popup.aligned,true);assert.equal(new Set(popup.muted).size,1);assert.notEqual(popup.body,popup.muted[0]);assert.equal(popup.bounded,true);assert.equal(popup.anchored,true);
 await writeFile('/tmp/pdfreader-comment-popup.png',(await window.webContents.capturePage()).toPNG());

 await run(`document.querySelector('.annotation-reader [aria-label="关闭"]').click()`);await wait(`!document.querySelector('.annotation-reader')`);
 await run(`document.querySelector('.annotation-note').click()`);await wait(`document.querySelector('.annotation-reader')?.textContent.includes('A saved reading comment')`);
 assert.ok(await run(`!!document.querySelector('.annotation-reader time').textContent`));
 await run('window.previewSaveReadingView()');await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload();});await wait('window.previewReady');await run(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Try a sample document').click()`);await wait(`!!document.querySelector('.annotation-note')&&!!document.querySelector('.annotation-highlight')`);
 // Existing annotations must render on first mount, without a mode toggle.
 for(let reopen=0;reopen<3;reopen++){
  await run('window.previewSaveReadingView()');
  Menu.getApplicationMenu().getMenuItemById('file-close-document').click();await wait(`!!document.querySelector('.empty')`);
  await run(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Try a sample document').click()`);
  await wait(`!window.previewRenderDiagnostics().opening&&!document.querySelector('.document-motion-snapshot')&&!!document.querySelector('.annotation-comment-highlight')&&!!document.querySelector('.annotation-comment-note')`);
  const marks=await run(`Array.from(document.querySelectorAll('.page .annotation-mark')).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {width:r.width,height:r.height,visibility:s.visibility,display:s.display};})`);
  assert.equal(marks.length,3,'saved highlight and comment render immediately on reopen');
  assert.ok(marks.every(m=>m.width>0&&m.height>0&&m.visibility==='visible'&&m.display!=='none'));
 }
 await contextAction('.annotation-note','删除');
 await wait(`!!document.querySelector('.annotation-confirm')`);
 await run(`document.querySelector('.annotation-confirm button:last-child').click()`);await wait(`!!document.querySelector('.annotation-erasing')`);await wait(`(async()=>{const key=window.previewRenderDiagnostics().annotationKey;return !(await window.previewAnnotations.load(key)).some(a=>a.comment==='A saved reading comment');})()`);assert.equal(await run(`!!document.querySelector('.annotation-note.annotation-erasing')`),true,'menu deletion keeps note marker as an erasing ghost');await wait(`!document.querySelector('.annotation-note')`);
 await run(`(()=>{const h=document.querySelector('.annotation-highlight');h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,clientX:200,clientY:200}));return true;})()`);
 await run(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true}));document.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true}));true`);
 await wait(`!!document.querySelector('.annotation-highlight.annotation-erasing')`);await wait(`(async()=> (await window.previewAnnotations.load(window.previewRenderDiagnostics().annotationKey)).length===0)()`);await wait(`!document.querySelector('.annotation-highlight')`);
 await select();await run(`document.querySelector('[aria-label="荧光绿"]').click()`);await wait(`!!document.querySelector('.annotation-highlight')`);await run(`(()=>{const h=document.querySelector('.annotation-highlight');h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,clientX:200,clientY:200}));for(const x of [220,180])h.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,clientX:x,clientY:200}));return true;})()`);assert.equal(await run(`!!document.querySelector('.annotation-highlight')`),true,'one shake preserves highlight');await run(`(()=>{const h=document.querySelector('.annotation-highlight');for(const x of [220,180])h.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,clientX:x,clientY:200}));return true;})()`);assert.equal(await run(`!!document.querySelector('.annotation-highlight')`),true,'two shakes wait for release');await pause(80);assert.notEqual(await run(`document.querySelector('.annotation-highlight').style.transform`),'','highlight follows drag');await run(`document.querySelector('.annotation-highlight').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,clientX:180,clientY:200}))`);await wait(`(()=>{const h=document.querySelector('.annotation-highlight.annotation-erasing');return !!h&&h.getAnimations().some(a=>a.animationName==='annotation-erase');})()`);const eraseState=await run(`(()=>{const h=document.querySelector('.annotation-highlight.annotation-erasing'),animation=h.getAnimations().find(a=>a.animationName==='annotation-erase'),before=getComputedStyle(h).opacity;animation.pause();animation.currentTime=160;const s=getComputedStyle(h),match=s.clipPath.match(/inset\\([^)]*?([\\d.]+)%/);animation.play();return {animation:s.animationName,opacity:s.opacity,before,clip:s.clipPath,clipRight:match?Number(match[1]):NaN};})()`);assert.match(eraseState.animation,/annotation-erase/,'release runs annotation-erase animation');assert.equal(eraseState.opacity,eraseState.before,'erasing highlight retains opacity');assert.notEqual(eraseState.opacity,'0','erasing highlight does not fade opacity');assert.ok(Number.isFinite(eraseState.clipRight)&&Math.abs(eraseState.clipRight-50)<10,`release midpoint clip progress is about 50%: ${eraseState.clip}`);await wait(`!document.querySelector('.annotation-highlight')`);
 await select();await pause(3100);await wait(`!document.querySelector('.annotation-toolbar')`);
 await run(`document.querySelector('[aria-label="Translation settings"]').click()`);await wait(`!!document.querySelector('.settings')`);await run(`Array.from(document.querySelectorAll('.settings .macvue-segment')).find(b=>b.textContent.includes('Comparison')).click()`);await wait(`!document.querySelector('.reading-text-layer')`);await wait(`!document.querySelector('.annotation-layer')`);
 await run('window.previewSaveReadingView()');Menu.getApplicationMenu().getMenuItemById('file-close-document').click();await wait(`!!document.querySelector('.empty')`);
 const folder=await mkdtemp(join(tmpdir(),'native-annotation-smoke-')),path=join(folder,'Portrait and landscape.pdf');try{
 const doc=await PDFDocument.load(await readFile(new URL('../public/sample.pdf',import.meta.url))),page=doc.getPage(0),context=doc.context;const note=context.obj({Type:'Annot',Subtype:'Text',Rect:context.obj([50,600,66,616]),Contents:PDFHexString.fromText('Existing native comment'),M:PDFHexString.fromText('D:20250101000000Z')});const highlight=context.obj({Type:'Annot',Subtype:'Highlight',Rect:context.obj([50,720,300,750]),QuadPoints:context.obj([50,750,300,750,50,720,300,720]),C:context.obj([1,1,0])});page.node.set(PDFName.Annots,context.obj([context.register(note),context.register(highlight)]));await writeFile(path,await doc.save());await recents.remember(path);const id=recents.list()[0].id;await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload();});await wait('window.previewReady');await run(`document.querySelector('[data-recent-id="${id}"]').click()`);await wait(`window.previewRenderDiagnostics().totalPages>0&&!window.previewRenderDiagnostics().opening`);await run(`document.querySelector('[aria-label="Translation settings"]').click()`);await wait(`!!document.querySelector('.settings')`);await run(`Array.from(document.querySelectorAll('.settings [aria-label="Interaction mode"] .macvue-segment')).find(b=>b.textContent.includes('Reading')).click();document.querySelector('[aria-label="Close settings"]').click()`);await wait(`!!document.querySelector('.annotation-note')&&!!document.querySelector('.annotation-highlight')`);await run(`document.querySelector('.annotation-note').click()`);await wait(`document.querySelector('.annotation-reader')?.textContent.includes('Existing native comment')`);assert.match(await run(`document.querySelector('.annotation-reader time').textContent`),/2025/);await run(`document.querySelector('.annotation-reader [aria-label="关闭"]').click()`);await wait(`!!document.querySelector('.annotation-note')`);await contextAction('.annotation-note','删除');await wait(`!!document.querySelector('.annotation-confirm')`);await run(`document.querySelector('.annotation-confirm button:last-child').click()`);await wait(`!document.querySelector('.annotation-note')`);await run('window.previewSaveReadingView()');const written=await PDFDocument.load(await readFile(path));assert.equal(written.getPage(0).node.Annots().size(),1);
 }finally{await rm(folder,{recursive:true,force:true});}
 console.log(JSON.stringify({nativeImportAndDelete:true,annotationToolbar:true,highlight:true,comment:true,nativePersistence:true,reopenRestoration:true,deleteConfirmation:true,doubleDelete:true,twoShakes:true,idleDismissal:true,readingOnly:true}));app.quit();
}
