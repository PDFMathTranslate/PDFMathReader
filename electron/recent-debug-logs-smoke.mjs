import {app,BrowserWindow} from 'electron';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import vue from '@vitejs/plugin-vue';

const repoRoot=fileURLToPath(new URL('../',import.meta.url));
const smokeEntryPath='/__recent-debug-logs-smoke-entry.js';
const smokeVirtualId='\0recent-debug-logs-smoke-entry';
const normalEvents=[
 {id:1,time:'2026-10-05T00:00:01.000Z',kind:'stderr',kernel:'pdf_inspector',pid:42,message:'ERROR timeout'},
 {id:2,time:'2026-10-05T00:00:02.000Z',kind:'stdout',kernel:'pdf_inspector',pid:42,message:'ready'}
];
const stressEvents=[
 normalEvents[0],
 {...normalEvents[1],message:`ready ${'a'.repeat(4000)}!`}
];
const entrySource=`
import {createApp,h,reactive} from 'vue';
import RecentDebugLogs from '/src/RecentDebugLogs.vue';
import '/src/style.css';

const props=reactive({debugEnabled:false,engine:'pdf_inspector',active:true});
let developerEnabled=false;
const listeners=new Set();
const setDeveloperEnabled=value=>{
 developerEnabled=value===true;
 for(const listener of listeners)listener(developerEnabled);
};
window.previewDeveloper={
 enabled:async()=>developerEnabled,
 onChange(callback){if(typeof callback!=='function')return()=>{};listeners.add(callback);return()=>listeners.delete(callback);},
 setEnabled:setDeveloperEnabled
};
window.setRecentDebugLogsSmokeProps=next=>Object.assign(props,next||{});
window.setPreviewDeveloperEnabled=setDeveloperEnabled;
window.recentDebugLogsSmokeState=()=>({...props,developerEnabled});
const App={
 setup(){
  return()=>h('div',{class:'settings'},[
   h(RecentDebugLogs,{debugEnabled:props.debugEnabled,engine:props.engine,active:props.active})
  ]);
 }
};
createApp(App).mount('#app');
`;

const pause=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

async function asyncMain(){
 let exitCode=0;
 let server;
 let reader;
 let apiRequestCount=0;
 try{
  const smokePlugin={
   name:'recent-debug-logs-smoke-fixture',
   resolveId(id){
    if(id===smokeEntryPath||id.endsWith(smokeEntryPath))return smokeVirtualId;
   },
   load(id){
    if(id===smokeVirtualId)return entrySource;
   },
   configureServer(viteServer){
    viteServer.middlewares.use((request,response,next)=>{
     const requestUrl=new URL(request.url||'/', 'http://127.0.0.1');
     if(request.method==='GET'&&requestUrl.pathname==='/api/developer/recent-logs'){
      apiRequestCount++;
      const events=requestUrl.searchParams.get('engine')==='stress'?stressEvents:normalEvents;
      response.statusCode=200;
      response.setHeader('Content-Type','application/json; charset=utf-8');
      response.setHeader('Cache-Control','no-store');
      response.end(JSON.stringify({events}));
      return;
     }
     if(request.method==='GET'&&(requestUrl.pathname==='/'||requestUrl.pathname==='/index.html')){
      response.statusCode=200;
      response.setHeader('Content-Type','text/html; charset=utf-8');
      response.end(`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recent debug logs smoke</title></head><body><div id="app"></div><script type="module" src="${smokeEntryPath}"></script></body></html>`);
      return;
     }
     next();
    });
   }
  };
  server=await createServer({
   root:repoRoot,
   appType:'custom',
   configFile:false,
   plugins:[vue(),smokePlugin],
   server:{host:'127.0.0.1',port:0,strictPort:false}
  });
  await server.listen();
  const origin=server.resolvedUrls?.local?.find(url=>url.startsWith('http://127.0.0.1'))||server.resolvedUrls?.local?.[0];
  assert.ok(origin,'Vite server did not expose a local URL');

  reader=new BrowserWindow({
   show:false,
   width:900,
   height:700,
   webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}
  });
  await reader.loadURL(origin);
  const evaluate=code=>reader.webContents.executeJavaScript(code);
  const waitFor=async(check,label,timeout=5000)=>{
   const deadline=Date.now()+timeout;
   let lastError;
   while(Date.now()<deadline){
    try{if(await check())return;}
    catch(error){lastError=error;}
    await pause(25);
   }
   throw Error(`${label} timed out${lastError?`: ${lastError.message}`:''}`);
  };
  const setProps=props=>evaluate(`window.setRecentDebugLogsSmokeProps(${JSON.stringify(props)});true`);
  const setPattern=pattern=>evaluate(`(()=>{
   const input=document.querySelector('.debug-log-filter input');
   if(!input)throw Error('Recent debug logs filter is not mounted');
   const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
   setter.call(input,${JSON.stringify(pattern)});
   input.dispatchEvent(new Event('input',{bubbles:true}));
   return true;
  })()`);
  const countIs=count=>evaluate(`document.querySelector('.debug-log-count')?.textContent.trim()===${JSON.stringify(count)}`);

  await waitFor(()=>evaluate(`document.readyState==='complete'&&!document.querySelector('.recent-debug-logs')`),'initial debug section hidden');
  await pause(350);
  assert.equal(apiRequestCount,0,'debug logs must not poll while both controls are off');

  await setProps({debugEnabled:true});
  await waitFor(()=>evaluate(`!!document.querySelector('.recent-debug-logs input')`),'debug-enabled section');
  await waitFor(()=>countIs('2 / 2'),'normal debug events');
  assert.equal(apiRequestCount,1,'debug-enabled component should fetch once immediately');

  const textStyles=await evaluate(`(()=>{
   const pre=document.querySelector('.debug-log-output');
   const span=pre?.querySelector('span');
   const selection=window.getSelection();
   if(!pre||!span||!selection)return null;
   const range=document.createRange();
   range.selectNodeContents(span);
   selection.removeAllRanges();
   selection.addRange(range);
   const preStyle=getComputedStyle(pre),spanStyle=getComputedStyle(span);
   return {
    preColor:preStyle.color,
    spanColor:spanStyle.color,
    preUserSelect:preStyle.userSelect,
    spanUserSelect:spanStyle.userSelect,
    selection:selection.toString()
   };
  })()`);
  assert.ok(textStyles,'debug log output and span should render');
  assert.equal(textStyles.preUserSelect,'text','pre text must override the settings user-select rule');
  assert.equal(textStyles.spanUserSelect,'text','span text must override the settings user-select rule');
  assert.equal(textStyles.preColor,textStyles.spanColor,'pre and span should use the same gray text color');
  const colorChannels=(textStyles.preColor.match(/\d+/g)||[]).map(Number);
  assert.equal(colorChannels.length,3,'debug log color should be an RGB color');
  assert.ok(Math.max(...colorChannels)-Math.min(...colorChannels)<=12,'debug log text should be gray');
  assert.ok(textStyles.selection.includes('ERROR timeout'),'actual Selection should include the stderr message');

  await setPattern('error|timeout');
  await waitFor(()=>evaluate(`document.querySelector('.debug-log-count')?.textContent.trim()==='1 / 2'&&document.querySelector('.debug-log-output')?.textContent.includes('ERROR timeout')&&!document.querySelector('.debug-log-output')?.textContent.includes('ready')`),'plain regex worker filter');

  await setPattern('/ready/i');
  await waitFor(()=>evaluate(`document.querySelector('.debug-log-count')?.textContent.trim()==='1 / 2'&&document.querySelector('.debug-log-output')?.textContent.includes('ready')&&!document.querySelector('.debug-log-output')?.textContent.includes('ERROR timeout')`),'flagged regex worker filter');

  await setPattern('[');
  await waitFor(()=>evaluate(`document.querySelector('.debug-log-notice')?.textContent.includes('Invalid regular expression')&&document.querySelector('.debug-log-count')?.textContent.trim()==='2 / 2'`),'invalid regex notice');
  assert.equal(await evaluate(`document.querySelector('.debug-log-output').textContent.includes('ERROR timeout')&&document.querySelector('.debug-log-output').textContent.includes('ready')`),true,'invalid regex should show all lines');

  await setProps({engine:'stress'});
  await waitFor(()=>evaluate(`document.querySelector('.debug-log-output')?.textContent.includes('a'.repeat(4000)+'!')`),'catastrophic regex fixture');
  await setPattern('(a+)+$');
  await waitFor(()=>evaluate(`document.querySelector('.debug-log-notice')?.textContent.includes('Expression took too long')`),'catastrophic regex timeout',4500);
  const roundTripStart=Date.now();
  await evaluate('document.body.getBoundingClientRect().width');
  const roundTripMilliseconds=Date.now()-roundTripStart;
  assert.ok(roundTripMilliseconds<300,`renderer remained responsive during catastrophic regex (${roundTripMilliseconds} ms)`);

  await setPattern('');
  await waitFor(()=>evaluate(`!document.querySelector('.debug-log-notice')&&document.querySelector('.debug-log-count')?.textContent.trim()==='2 / 2'&&document.querySelector('.debug-log-output')?.textContent.includes('a'.repeat(4000)+'!')`),'clear catastrophic filter');
  await setProps({engine:'pdf_inspector'});
  await waitFor(()=>evaluate(`document.querySelector('.debug-log-output')?.textContent.includes('ERROR timeout')&&!document.querySelector('.debug-log-output')?.textContent.includes('a'.repeat(4000))`),'restore normal debug fixture');
  await reader.setContentSize(900,700);
  await pause(200);
  await writeFile('/tmp/pdfmathreader-recent-debug-logs.png',(await reader.webContents.capturePage()).toPNG());

  const beforeDebugOff=apiRequestCount;
  await setProps({debugEnabled:false});
  await waitFor(()=>evaluate('!document.querySelector(".recent-debug-logs")'),'debug-off hidden section');
  await pause(1200);
  assert.equal(apiRequestCount,beforeDebugOff,'debug-off component must stop polling');

  await evaluate('window.setPreviewDeveloperEnabled(true);true');
  await waitFor(()=>evaluate(`!!document.querySelector('.recent-debug-logs')`),'developer-enabled section');
  await waitFor(()=>countIs('2 / 2'),'developer-enabled events');
  assert.ok(apiRequestCount>beforeDebugOff,'developer bridge should enable polling independently');

  await reader.setContentSize(340,640);
  await pause(250);
  const narrowLayout=await evaluate(`(()=>{
   const root=document.documentElement,body=document.body,settings=document.querySelector('.settings');
   return {
    viewport:innerWidth,
    documentOverflow:root.scrollWidth>innerWidth+1,
    bodyOverflow:body.scrollWidth>body.clientWidth+1,
    settingsOverflow:settings.scrollWidth>settings.clientWidth+1
   };
  })()`);
  assert.equal(narrowLayout.documentOverflow,false,'narrow settings viewport must not overflow horizontally');
  assert.equal(narrowLayout.bodyOverflow,false,'narrow settings body must not overflow horizontally');
  assert.equal(narrowLayout.settingsOverflow,false,'narrow settings container must not overflow horizontally');
  console.log(`Recent debug logs smoke passed: worker filters, selection, timeout recovery, bridge toggle, narrow layout; screenshot /tmp/pdfmathreader-recent-debug-logs.png; max executeJavaScript roundtrip ${roundTripMilliseconds} ms.`);
 }catch(error){
  exitCode=1;
  console.error(error?.stack||error);
 }finally{
  reader?.destroy();
  await server?.close();
  app.exit(exitCode);
 }
}

app.whenReady().then(asyncMain).catch(error=>{
 console.error(error?.stack||error);
 app.exit(1);
});
