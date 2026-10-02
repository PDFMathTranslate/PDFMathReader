import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {PDFDocument,rgb,StandardFonts} from 'pdf-lib';

const PAGE_COUNT=1000;
const OPEN_COUNT=3;
const SCROLL_FRAMES=120;
const RESIZE_BURSTS=20;
const WAIT_MS=30_000;
const STRESS_WAIT_MS=90_000;
const POLL_MS=75;
const FILE_NAME='Portrait and landscape.pdf';
const SIZES=[[612,792],[792,612],[540,760],[760,540]];

function numericValues(values){return values.filter(value=>typeof value==='number'&&Number.isFinite(value));}
function median(values){
 const sorted=numericValues(values).sort((a,b)=>a-b);
 if(!sorted.length)return null;
 const middle=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}
function p95(values){
 const sorted=numericValues(values).sort((a,b)=>a-b);
 if(!sorted.length)return null;
 return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*.95)-1))];
}
function numericMedians(reports,key){return median(reports.map(report=>report?.[key]));}
function nestedNumericMedians(reports,key){
 const keys=new Set(reports.flatMap(report=>Object.keys(report?.[key]||{})));
 return Object.fromEntries([...keys].filter(name=>numericValues(reports.map(report=>report?.[key]?.[name])).length).map(name=>[name,median(reports.map(report=>report?.[key]?.[name]))]));
}

async function createFixture(){
 const pdf=await PDFDocument.create();
 pdf.setTitle('PDFMathReader deterministic benchmark');
 pdf.setAuthor('PDFMathReader benchmark');
 pdf.setCreator('PDFMathReader benchmark');
 pdf.setProducer('PDFMathReader benchmark');
 pdf.setCreationDate(new Date(0));
 pdf.setModificationDate(new Date(0));
 const font=await pdf.embedFont(StandardFonts.Helvetica);
 for(let index=0;index<PAGE_COUNT;index++){
  const [width,height]=SIZES[index%SIZES.length];
  const page=pdf.addPage([width,height]);
  const margin=24,size=8,lineHeight=10;
  const lines=Math.floor((height-margin*2)/lineHeight);
  const pageNumber=String(index+1).padStart(4,'0');
  for(let line=0;line<lines;line++){
   const lineNumber=String(line+1).padStart(2,'0');
   page.drawText(`PDFMathReader benchmark page ${pageNumber} line ${lineNumber} — Helvetica deterministic fixture content for scrolling and layout measurement.`,{
    x:margin,y:height-margin-size-line*lineHeight,size,font,color:rgb(.04,.04,.04)
   });
  }
 }
 const bytes=Buffer.from(await pdf.save({useObjectStreams:false}));
 return {bytes,encoded:bytes.toString('base64')};
}

export async function verifyBenchmark(window){
 const evaluate=code=>window.webContents.executeJavaScript(code);
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const label=String(process.env.PDF_READER_BENCHMARK_LABEL||'latest').replace(/[^a-zA-Z0-9_.-]+/g,'-')||'latest';
 const outputPath=`/tmp/pdfmathreader-benchmark-${label}.json`;
 if(process.env.PDF_READER_PROFILE==='1'){
  window.webContents.debugger.attach('1.3');await window.webContents.debugger.sendCommand('Profiler.enable');await window.webContents.debugger.sendCommand('Profiler.start');
  setTimeout(async()=>{try{const {profile}=await window.webContents.debugger.sendCommand('Profiler.stop');await writeFile('/tmp/pdfmathreader-renderer-profile.json',JSON.stringify(profile));const counts=new Map();for(const id of profile.samples||[])counts.set(id,(counts.get(id)||0)+1);console.log('Renderer profile',JSON.stringify([...counts].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([id,count])=>({count,...profile.nodes.find(n=>n.id===id).callFrame}))));}catch(e){console.log('Profile error',e.message);}},5000);
 }


 async function waitFor(name,code,timeout=WAIT_MS){
  const started=Date.now();
  while(Date.now()-started<timeout){
   if(await evaluate(code))return;
   await pause(POLL_MS);
  }
  let state;
  try{state=await evaluate(`(()=>({title:document.title,empty:!!document.querySelector('.empty'),diagnostics:window.previewRenderDiagnostics?.()}))()`);}catch(error){state={error:error.message};}
  throw Error(`Benchmark timed out waiting for ${name}: ${JSON.stringify(state)}`);
 }

 async function diagnostics(){
  const value=await evaluate('window.previewRenderDiagnostics?.()');
  assert.ok(value,'benchmark diagnostics are unavailable');
  return value;
 }

 async function report(name){
  const started=Date.now();
  let value;
  while(Date.now()-started<WAIT_MS){
   value=await evaluate('(async()=>typeof window.previewPerformanceReport===\'function\'?await window.previewPerformanceReport():null)()');
   if(value&&value.firstScreenMs!==null&&value.firstScreenMs!==undefined)return value;
   await pause(POLL_MS);
  }
  throw Error(`Benchmark ${name} did not produce firstScreenMs: ${JSON.stringify(value)}`);
 }

 async function importFixture(encoded){
  await waitFor('file input',`!!document.querySelector('input[type=file]')`,10_000);
  const literal=JSON.stringify(encoded);
  await evaluate(`(()=>{const bytes=Uint8Array.from(atob(${literal}),character=>character.charCodeAt(0));const data=new DataTransfer();data.items.add(new File([bytes],${JSON.stringify(FILE_NAME)},{type:'application/pdf'}));const input=document.querySelector('input[type=file]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 }

 async function waitForOpen(){
  await waitFor('1000-page document',`(()=>{const d=window.previewRenderDiagnostics?.();return document.title==='TEST — ${FILE_NAME}'&&d?.totalPages===${PAGE_COUNT}&&d?.opening===false;})()`,STRESS_WAIT_MS);
  await waitFor('first nonblank page canvas',`(()=>{const canvas=[...document.querySelectorAll('.page canvas')].find(candidate=>candidate.width>0&&candidate.height>0);if(!canvas)return false;const data=canvas.getContext('2d').getImageData(0,0,Math.min(canvas.width,96),Math.min(canvas.height,96)).data;for(let i=0;i<data.length;i+=16)if(data[i]<245||data[i+1]<245||data[i+2]<245)return true;return false;})()`,STRESS_WAIT_MS);
 }

 async function closeDocument(){
  window.webContents.send('reader:action','close-document');
  await waitFor('document close',`(()=>{const d=window.previewRenderDiagnostics?.();return !!document.querySelector('.empty')&&d?.totalPages===0&&d?.mountedPages===0&&d?.mountedThumbnails===0;})()`,WAIT_MS);
 }

 async function ensureFitWidth(){
  window.webContents.send('reader:action','fit-width');
  await waitFor('fit width',`localStorage.getItem('readerFit')==='width'`,10_000);
  await pause(150);
 }

 async function controlledScroll(){
  const result=await evaluate(`(async()=>{const reader=document.querySelector('.reader');if(!reader)return {frames:0,timestamps:[]};reader.style.scrollBehavior='auto';reader.scrollTop=0;reader.scrollLeft=0;const timestamps=[];const max=Math.max(0,reader.scrollHeight-reader.clientHeight);await new Promise(resolve=>{const tick=timestamp=>{timestamps.push(timestamp);const progress=(timestamps.length-1)/(${SCROLL_FRAMES}-1);reader.scrollTop=max*progress;if(timestamps.length>=${SCROLL_FRAMES})resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});return {frames:timestamps.length,timestamps};})()`);
  assert.equal(result.frames,SCROLL_FRAMES,'controlled scroll did not produce 120 requestAnimationFrame frames');
  const durations=result.timestamps.slice(1).map((timestamp,index)=>timestamp-result.timestamps[index]);
  return {frames:result.frames,p95Ms:p95(durations),maxMs:Math.max(...durations,0),durationsMs:durations};
 }

 async function startResizeProbe(){
  await evaluate(`(()=>{window.__pdfMathReaderBenchmarkProbe?.stop?.();let running=true;const frames=[];let handle=0;const sample=timestamp=>{if(!running)return;const reader=document.querySelector('.reader'),canvas=[...document.querySelectorAll('.page canvas')].find(candidate=>candidate.width>0&&candidate.height>0),diagnostics=window.previewRenderDiagnostics?.();frames.push({timestamp,width:innerWidth,height:innerHeight,layoutWidth:document.querySelector('.page-layout')?.style.width,snapshot:!!document.querySelector('.resize-snapshot'),snapshotReady:[...document.querySelectorAll('.resize-snapshot img')].every(img=>img.complete&&img.naturalWidth>0),frozen:!!document.querySelector('.layout-frozen'),pageFrames:diagnostics?.metrics?.pageFrames??null,canvasReady:!!canvas});handle=requestAnimationFrame(sample);};handle=requestAnimationFrame(sample);window.__pdfMathReaderBenchmarkProbe={stop(){running=false;cancelAnimationFrame(handle);return frames;}};return true;})()`);
 }

 async function stopResizeProbe(){
  const frames=await evaluate('window.__pdfMathReaderBenchmarkProbe?.stop?.()||[]');
  return {
   frames:frames.length,
   layoutChanges:frames.slice(1).filter((frame,index)=>frame.layoutWidth!==frames[index].layoutWidth).length,
   frameP95Ms:p95(frames.slice(1).map((frame,index)=>frame.timestamp-frames[index].timestamp)),
   frameMaxMs:Math.max(...frames.slice(1).map((frame,index)=>frame.timestamp-frames[index].timestamp),0),
   snapshotClassSeen:frames.some(frame=>frame.snapshot),
   allSnapshotsReady:frames.filter(frame=>frame.snapshot).every(frame=>frame.snapshotReady),
   layoutFrozenClassSeen:frames.some(frame=>frame.frozen),
   samples:frames.slice(0,4).concat(frames.slice(-4))
  };
 }

 async function toggleSidebar(){
  const before=await evaluate(`document.querySelector('[aria-label="Toggle thumbnails"]')?.getAttribute('aria-expanded')`);
  window.webContents.send('reader:action','sidebar');
  await waitFor('sidebar toggle',`document.querySelector('[aria-label="Toggle thumbnails"]')?.getAttribute('aria-expanded')!==${JSON.stringify(before)}`,10_000);
  await pause(250);
  const after=await evaluate(`document.querySelector('[aria-label="Toggle thumbnails"]')?.getAttribute('aria-expanded')`);
  return {before,after};
 }

 async function resizeBurst(){
  await startResizeProbe();
  const sizes=[[720,500],[760,540],[820,580],[900,620],[980,680],[1060,740],[1140,800],[1200,850]];
  for(let index=0;index<RESIZE_BURSTS;index++){
   const [width,height]=sizes[index%sizes.length];
   window.setContentSize(width,height);
   await pause(20);
  }
  await pause(300);
  return stopResizeProbe();
 }

 async function finalCanvasAndFit(){
  const value=await evaluate(`(()=>{const reader=document.querySelector('.reader'),readerBounds=reader?.getBoundingClientRect(),fit=localStorage.getItem('readerFit')==='width',pages=[...document.querySelectorAll('.page')],canvas=pages.map(page=>page.querySelector('canvas')).find(candidate=>{if(!candidate||candidate.width<=0||candidate.height<=0)return false;const bounds=candidate.getBoundingClientRect();return !readerBounds||bounds.bottom>readerBounds.top&&bounds.top<readerBounds.bottom;}),style=reader?getComputedStyle(reader):null,available=reader&&style?reader.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight):0,activePage=pages.find(page=>Number(page.dataset.page)===window.previewRenderDiagnostics?.().readingView?.page),maxPageWidth=activePage?.getBoundingClientRect().width||0;let inkSamples=0;if(canvas){const width=Math.min(canvas.width,1024),height=Math.min(canvas.height,1024),data=canvas.getContext('2d').getImageData(0,0,width,height).data;for(let i=0;i<data.length;i+=64)if(data[i]<245||data[i+1]<245||data[i+2]<245){inkSamples++;break;}}return {canvas:{width:canvas?.width||0,height:canvas?.height||0},inkSamples,fitPressed:fit,available,maxPageWidth,widthDelta:Math.abs(maxPageWidth-available)};})()`);
  assert.ok(value.canvas.width>0&&value.canvas.height>0,'final page canvas is empty');
  assert.ok(value.inkSamples>0,'final page canvas is blank');
  assert.equal(value.fitPressed,true,'final view is not in fit-width mode');
  assert.ok(Number.isFinite(value.widthDelta)&&value.widthDelta<=12,`final page does not fit width: ${JSON.stringify(value)}`);
  return value;
 }

 const fixture=await createFixture();
 const reports=[];
 for(let open=1;open<=OPEN_COUNT;open++){
  console.log(`Benchmark: opening deterministic ${PAGE_COUNT}-page fixture (${open}/${OPEN_COUNT})`);
  await importFixture(fixture.encoded);
  await waitForOpen();
  await ensureFitWidth();
  const firstScreen=await report(`open ${open} first screen`);
  for(const key of ['firstScreenMs','stages','scrollLongTasks','memory','transport','resize'])assert.ok(Object.prototype.hasOwnProperty.call(firstScreen,key),`performance report is missing ${key}`);
  const before=await diagnostics();
  const scroll=await controlledScroll();
  const afterScroll=await diagnostics();
  const sidebar=[await toggleSidebar(),await toggleSidebar()];
  const beforeResize=await diagnostics(),beforeResizeReport=await report('before resize');
  const resize=await resizeBurst();
  await pause(2000);
  const afterResize=await diagnostics();
  const finalReport=await evaluate('(async()=>await window.previewPerformanceReport())()');
  assert.ok(finalReport,'final performance report is unavailable');
  for(const key of ['firstScreenMs','stages','scrollLongTasks','memory','transport','resize'])assert.ok(Object.prototype.hasOwnProperty.call(finalReport,key),`final performance report is missing ${key}`);
  const finalCanvas=await finalCanvasAndFit();
  if(label==='optimized'){assert.equal(resize.snapshotClassSeen,true,'resize must display a screenshot');assert.equal(resize.allSnapshotsReady,true,'screenshot must be decoded before it covers the reader');assert.equal(resize.layoutFrozenClassSeen,true,'real layout must be frozen');assert.ok((finalReport.resize.layoutCommits-beforeResizeReport.resize.layoutCommits)<=1,'one burst must commit at most one layout');assert.ok(resize.layoutChanges<=1,'real layout must not reflow through the burst');}
  const metrics={
   pageFramesStart:before.metrics?.pageFrames??0,
   pageFramesAfterScroll:afterScroll.metrics?.pageFrames??0,
   pageFramesBeforeResize:beforeResize.metrics?.pageFrames??0,
   pageFramesEnd:afterResize.metrics?.pageFrames??0,
   pageFramesDelta:(afterResize.metrics?.pageFrames??0)-(before.metrics?.pageFrames??0),
   scrollPageFramesDelta:(afterScroll.metrics?.pageFrames??0)-(before.metrics?.pageFrames??0),
   resizePageFramesDelta:(afterResize.metrics?.pageFrames??0)-(beforeResize.metrics?.pageFrames??0),
   resizeLayoutCommits:finalReport.resize?.layoutCommits??0,
   burstLayoutCommits:(finalReport.resize?.layoutCommits??0)-(beforeResizeReport.resize?.layoutCommits??0),
   burstLayoutChanges:resize.layoutChanges
  };
  reports.push({...finalReport,resize:{...finalReport.resize,frames:resize.frames,frameP95Ms:resize.frameP95Ms,frameMaxMs:resize.frameMaxMs,snapshotClassSeen:resize.snapshotClassSeen,layoutFrozenClassSeen:resize.layoutFrozenClassSeen},benchmark:{open,scroll,sidebar,resize,metrics,finalCanvas}});
  await closeDocument();
 }

 const medians={
  firstScreenMs:numericMedians(reports,'firstScreenMs'),
  stages:nestedNumericMedians(reports,'stages'),
  scrollLongTasks:nestedNumericMedians(reports,'scrollLongTasks'),
  resize:nestedNumericMedians(reports,'resize'),
  metrics:nestedNumericMedians(reports.map(report=>report.benchmark),'metrics')
 };
 const allScrollDurations=reports.flatMap(report=>report.benchmark.scroll.durationsMs||[]);
 const allResizeFrames=reports.map(report=>report.benchmark.resize.frames);
 const result={
  schemaVersion:1,
  label,
  fixture:{name:FILE_NAME,pageCount:PAGE_COUNT,bytes:fixture.bytes.byteLength},
  fixtureBytes:fixture.bytes.byteLength,
  reports,
  medians,
  scroll:{frames:SCROLL_FRAMES,p95Ms:p95(allScrollDurations),maxMs:Math.max(...allScrollDurations,0)},
  scrollFrameP95Ms:p95(allScrollDurations),
  scrollFrameMaxMs:Math.max(...allScrollDurations,0),
  resizeFrames:allResizeFrames,
  resize:{bursts:RESIZE_BURSTS,frames:allResizeFrames,p95Ms:median(reports.map(report=>report.benchmark.resize.frameP95Ms)),maxMs:Math.max(...reports.map(report=>report.benchmark.resize.frameMaxMs),0),snapshotClassSeen:reports.some(report=>report.benchmark.resize.snapshotClassSeen),layoutFrozenClassSeen:reports.some(report=>report.benchmark.resize.layoutFrozenClassSeen)}
 };
 await writeFile(outputPath,JSON.stringify(result,null,2),'utf8');
 console.log(`Benchmark passed: ${outputPath}`);
 console.log(JSON.stringify({label,fixtureBytes:result.fixtureBytes,firstScreenMs:result.medians.firstScreenMs,scrollFrameP95Ms:result.scrollFrameP95Ms,scrollFrameMaxMs:result.scrollFrameMaxMs,resizeFrames:result.resizeFrames,resizeLayoutCommits:result.medians.resize?.layoutCommits??0}));
 window.close();
}
