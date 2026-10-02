import assert from 'node:assert/strict';
import {writeFile,readFile,stat} from 'node:fs/promises';
import {app,BrowserWindow,safeStorage,systemPreferences} from 'electron';
import {join} from 'node:path';
import {createCredentials} from './credentials.mjs';
import {PDFDocument,StandardFonts} from 'pdf-lib';
export async function verify(window,backend,token,mode,credentials){
 const headers={'X-Preview-Token':token};
 const backendMetric=app.getAppMetrics().find(metric=>metric.pid===backend.processId&&metric.type==='Utility'&&metric.name==='PDFMathReader backend');
 if(!backendMetric)console.log('Backend metrics',JSON.stringify(app.getAppMetrics().map(({pid,type,serviceName,name})=>({pid,type,serviceName,name}))),backend.processId);
 assert.ok(backendMetric,`PDFMathReader backend utility process is missing from app metrics (pid ${backend.processId})`);
 const config=await (await fetch(`${backend.origin}/api/config`,{headers})).json();
 assert.equal(config.configured,mode==='present');
 assert.equal((await fetch(`${backend.origin}/api/config`)).status,403);
 assert.equal((await fetch(`${backend.origin}/api/config`,{headers:{...headers,Origin:'https://example.com'}})).status,403);
 const wait=async(code)=>{for(let n=0;n<150;n++){if(await window.webContents.executeJavaScript(code))return;await new Promise(r=>setTimeout(r,100));}console.log('Timed out UI condition:',code.slice(0,150));await writeFile('/tmp/preview-desktop-failure.png',(await window.webContents.capturePage()).toPNG());throw Error('Reader state timed out');};
 await wait(`!!document.querySelector('[aria-label="Translation settings"]')`);
 await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Translation settings"]').click()`);
 await wait(`!!document.querySelector('.kernel-switcher button')`);
 for(const id of ['pdf_math_fast','pdf_math_precise','pdf_inspector']){
  const label={pdf_inspector:'Ultra fast',pdf_math_fast:'Fast',pdf_math_precise:'Precise'}[id];
  await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.kernel-switcher button')).find(b=>b.textContent===${JSON.stringify(label)}).click()`);
  await wait(`document.querySelector('.kernel-switcher [aria-checked=true]').textContent===${JSON.stringify(label)}&&!document.querySelector('.kernel-switcher button').disabled`);
  const state=await (await fetch(`${backend.origin}/api/engines/${id}`,{headers})).json();
  assert.equal(state.id,id);assert.equal(state.available,id==='pdf_inspector');
 }
 await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Close settings"]').click()`);
 const systemAccent='#'+systemPreferences.getAccentColor().slice(0,6);
 await wait(`document.documentElement.style.getPropertyValue('--accent')===${JSON.stringify(systemAccent)}`);
 window.webContents.send('appearance:changed',{accent:'#aabbccff'});
 await wait(`document.documentElement.style.getPropertyValue('--accent')==='#aabbcc'`);
 window.webContents.send('appearance:changed',{accent:systemPreferences.getAccentColor().replace(/^/,'#')});
 await wait(`document.documentElement.style.getPropertyValue('--accent')===${JSON.stringify(systemAccent)}`);
 for(const symbol of ['sidebar.left','minus.magnifyingglass','plus.magnifyingglass','gearshape'])assert.equal((await fetch(`${backend.origin}/symbols/${symbol}.png`,{headers})).status,200);
 await wait(`!!document.querySelector('.toolbar')`);
 assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.statusbar')===null`),true);
 assert.equal(await window.webContents.executeJavaScript('typeof process'),'undefined');
 assert.equal(await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.toolbar button')).every(b=>!b.innerText.trim())`),true);
 await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Try a sample document').click()`);
 await wait(`document.querySelectorAll('.page canvas').length>0 && document.querySelectorAll('.paragraph').length>0`);
 const onColor=await window.webContents.executeJavaScript(`getComputedStyle(document.querySelector('.translation-toggle')).color`);
 await window.webContents.executeJavaScript(`document.querySelector('.translation-toggle').click()`);
 await wait(`document.querySelector('.translation-toggle').getAttribute('aria-pressed')==='false'`);
 await wait(`getComputedStyle(document.querySelector('.translation-toggle')).color!==${JSON.stringify(onColor)}`);
 const offColor=await window.webContents.executeJavaScript(`getComputedStyle(document.querySelector('.translation-toggle')).color`);
 assert.notEqual(onColor,offColor);
 await window.webContents.executeJavaScript(`document.querySelector('.translation-toggle').click()`);
 await wait(`document.querySelector('.translation-toggle').getAttribute('aria-pressed')==='true'`);
 if(mode==='present'){
  await wait(`document.querySelector('.paragraph.translated')?.innerText==='Mock translated paragraph'`);
  const coverage=await window.webContents.executeJavaScript(`(()=>{const el=document.querySelector('.paragraph.translated'),style=getComputedStyle(el);return {padding:parseFloat(style.getPropertyValue('--cover-padding')),shadow:style.boxShadow};})()`);
  assert.ok(coverage.padding>=3);assert.notEqual(coverage.shadow,'none');
  await window.webContents.executeJavaScript(`document.querySelector('.paragraph.translated').click()`);
  await wait(`!document.querySelector('.paragraph').classList.contains('translated')`);
 }else {
  await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Translation settings"]').click()`);
  await wait(`document.querySelector('[aria-label="OpenAI API key"]')?.placeholder==='请提供您的 key'`);
  await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Close settings"]').click()`);
 }

 console.log('Smoke: reader passed; checking credentials');
 // Exercise credential UI and real macOS encryption with synthetic values only.
 await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Translation settings"]').click()`);
 assert.equal(await window.webContents.executeJavaScript(`document.querySelector('[aria-label="OpenAI API key"]').type`),'password');
 const synthetic='sk-local-synthetic-settings-test';
 await window.webContents.executeJavaScript(`(()=>{const input=document.querySelector('[aria-label="OpenAI API key"]');input.value=${JSON.stringify(synthetic)};input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.settings form').requestSubmit();})()`);
 await wait(`document.querySelector('[aria-label="OpenAI API key"]')?.placeholder==='使用用户保存的 key'`);
 assert.equal(credentials.getKey(),synthetic);
 assert.equal(await window.webContents.executeJavaScript(`document.querySelector('[aria-label="OpenAI API key"]').value`),'');
 const encryptedPath=join(app.getPath('userData'),'openai-key.enc');
 assert.equal((await readFile(encryptedPath)).includes(Buffer.from(synthetic)),false);
 assert.equal((await stat(encryptedPath)).mode & 0o777,0o600);
 const reloaded=await createCredentials({path:encryptedPath,safeStorage});
 assert.equal(reloaded.getKey(),synthetic);
 const updated=await (await fetch(`${backend.origin}/api/config`,{headers})).json();
 assert.equal(updated.keySource,'saved');assert.equal(JSON.stringify(updated).includes(synthetic),false);
 await window.webContents.executeJavaScript(`document.querySelector('[aria-label="清除 API key"]').click()`);
 await wait(`document.querySelector('[aria-label="OpenAI API key"]')?.placeholder==='请提供您的 key'`);
 assert.equal(credentials.status().keySource,'none');
 await assert.rejects(readFile(encryptedPath));
 await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Close settings"]').click()`);
 assert.equal(await window.webContents.executeJavaScript(`document.querySelectorAll('header').length`),0);

 console.log('Smoke: encrypted credentials passed; checking mixed-page layout');
 // Portrait/landscape fixture verifies aspect ratio, sidebar scrolling and navigation.
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
 for(let i=0;i<12;i++){const page=doc.addPage(i%2?[792,612]:[612,792]);page.drawText(`Layout fixture page ${i+1}`,{x:40,y:page.getHeight()-70,size:20,font});}
 const fixture=Array.from(await doc.save());
 await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Translation settings"]').click()`);
 await wait(`!!document.querySelector('.settings input[type="checkbox"]')`);
 await window.webContents.executeJavaScript(`document.querySelector('.settings input[type="checkbox"]').click();document.querySelector('[aria-label="Close settings"]').click();`);
 window.webContents.send('reader:action','close-document');await wait(`!!document.querySelector('.empty')`);
 await window.webContents.executeJavaScript(`(()=>{const input=document.querySelector('input[type="file"]'),data=new DataTransfer();data.items.add(new File([new Uint8Array(${JSON.stringify(fixture)})],'Portrait and landscape.pdf',{type:'application/pdf'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait(`(()=>{const d=window.previewRenderDiagnostics?.();return d?.totalPages===12&&d.mountedThumbnails===document.querySelectorAll('.thumb').length&&Array.from(document.querySelectorAll('.thumb canvas')).some(canvas=>canvas.width>0);})()`);
 await window.webContents.executeJavaScript(`(()=>{const list=document.querySelector('.thumbnail-list');list.scrollTop=list.scrollHeight;list.dispatchEvent(new Event('scroll',{bubbles:true}));return true;})()`);
 await wait(`(()=>{const d=window.previewRenderDiagnostics?.(),list=document.querySelector('.thumbnail-list'),last=document.querySelector('.thumb[aria-label="Go to page 12"] canvas');return !!list&&list.scrollTop+list.clientHeight>=list.scrollHeight-2&&d?.thumbnails?.includes(12)&&!!last&&last.width>0;})()`);
 for(const size of [[1200,850],[800,650]]){
  window.setSize(...size);await new Promise(r=>setTimeout(r,150));
  const geometry=await window.webContents.executeJavaScript(`(()=>{const list=document.querySelector('.thumbnail-list'),canvases=Array.from(list.querySelectorAll('canvas'));return {scroll:list.scrollHeight>list.clientHeight,ratios:canvases.filter(c=>c.width>0).map(c=>{const r=c.getBoundingClientRect();return [r.width/r.height,c.width/c.height];}),width:list.getBoundingClientRect().width,toolbarHeight:document.querySelector('.toolbar').getBoundingClientRect().height};})()`);
  assert.equal(geometry.scroll,true);assert.ok(geometry.width>=170 && geometry.width<=220);
  for(const [shown,actual] of geometry.ratios)assert.ok(Math.abs(shown-actual)<.02);
  assert.equal(geometry.toolbarHeight,64);
  const controls=await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.toolbar .icon-button')).map(b=>({target:b.getBoundingClientRect().width,symbol:b.querySelector('.system-icon').getBoundingClientRect().width}))`);
  for(const control of controls){assert.ok(control.target>=36);assert.equal(control.symbol,24);}
 }
 await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Go to page 12"]').click()`);
 await wait(`document.querySelector('[aria-current="page"]')?.getAttribute('aria-label')==='Go to page 12'`);
 window.setSize(1200,850);
 const result={systemSymbols:true,systemAccent:true,accentUpdates:true,secureStorage:true,credentialPrecedence:true,encryptedPersistence:true,clearFallback:true,mixedPageLayout:true,thumbnailNavigation:true,mode,origin:backend.origin,configured:config.configured,pdfRendered:true,paragraphsDetected:true,rendererIsolated:true,mockedTranslation:mode==='present'};
 await writeFile(`/tmp/preview-desktop-${mode}.json`,JSON.stringify(result,null,2));
 await writeFile(`/tmp/preview-desktop-${mode}.png`,(await window.webContents.capturePage()).toPNG());
 console.log(JSON.stringify(result));
 window.close();
}

export async function verifySystemOpen(window){
 const wait=async(name,existing=new Set())=>{for(let i=0;i<200;i++){for(const candidate of BrowserWindow.getAllWindows()){if(existing.has(candidate))continue;if(await candidate.webContents.executeJavaScript(`document.title===${JSON.stringify(name)} && document.querySelectorAll('.page canvas').length===1`))return candidate;}await new Promise(r=>setTimeout(r,100));}throw Error('macOS file delivery timed out');};
 await wait('TEST — Portrait and landscape.pdf');
 const {execFile}=await import('node:child_process');
 const {promisify}=await import('node:util');
 const {dirname}=await import('node:path');
 const appPath=dirname(dirname(dirname(app.getPath('exe'))));
 // Native delivery is tested without activating the window.
 const beforeNative=new Set(BrowserWindow.getAllWindows());
 await promisify(execFile)('/usr/bin/open',['-g','-a',appPath,'/tmp/A quieter way to read.pdf']);
 const nativeWindow=await wait('TEST — A quieter way to read.pdf',beforeNative);
 assert.equal(await window.webContents.executeJavaScript('document.title'),'TEST — Portrait and landscape.pdf');
 const beforeSecond=new Set(BrowserWindow.getAllWindows());
 app.emit('second-instance',{},[app.getPath('exe'),'/tmp/Portrait and landscape.pdf'],'/tmp');
 const secondWindow=await wait('TEST — Portrait and landscape.pdf',beforeSecond);
 assert.notEqual(secondWindow,window);assert.notEqual(nativeWindow,window);
 assert.equal(window.isFocused(),false);
 assert.equal(window.isMinimized(),false);
 await writeFile('/tmp/preview-system-open-result.json',JSON.stringify({passed:true,coldStart:true,runningApp:true,nativeDelivery:true,commandLineDelivery:true,secondInstanceDelivery:true,backgroundWindowNeverFocused:true,pdfRendered:true,independentWindows:true}));
 await writeFile('/tmp/preview-system-open.png',(await window.webContents.capturePage()).toPNG());
 app.quit();
}
