import {app,BrowserWindow,ipcMain,clipboard} from 'electron';
import {randomBytes} from 'node:crypto';
import {totalmem,freemem} from 'node:os';
import {fileURLToPath} from 'node:url';

// The monitor owns no reader backend: closing it immediately stops collection.
export function createDeveloperMonitor({windows,token}){
 let monitor=null,opening=null,sampling=null,disabling=Promise.resolve();
 const authorize=event=>{
  const target=BrowserWindow.fromWebContents(event.sender),state=windows.get(target);
  const origin=state?.backend.origin||(target===monitor?monitor?.developerOrigin:null);
  if(!origin||event.senderFrame!==target.webContents.mainFrame||new URL(event.senderFrame.url).origin!==origin)throw Error('Developer request rejected.');
  return target;
 };
 const request=async(state,path,body)=>{
  const response=await fetch(state.backend.origin+path,{method:body?'POST':'GET',headers:{'X-Preview-Token':token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(2500)});
  if(!response.ok)throw Error(`Diagnostics unavailable (${response.status})`);
  return response.json();
 };
 const changed=()=>{for(const target of windows.keys())if(!target.isDestroyed())target.webContents.send('developer:changed',!!monitor&&!monitor.isDestroyed());};
 const setEnabled=async(state,enabled)=>{try{await request(state,'/api/developer/enabled',{enabled});}catch(error){if(enabled)throw error;}};
 const sync=async state=>{if(opening)await opening;if(monitor&&!monitor.isDestroyed())await setEnabled(state,true);};
 const sample=()=>{
  if(sampling)return sampling;
  sampling=(async()=>{
   const metrics=app.getAppMetrics();
   const roleFor=pid=>pid===process.pid?'main':[...windows].some(([target])=>!target.isDestroyed()&&target.webContents.getOSProcessId()===pid)?'renderer':[...windows.values()].some(state=>state.backend.processId===pid)?'backend':monitor?.webContents.getOSProcessId()===pid?'monitor':null;
   const processes=metrics.map(metric=>({pid:metric.pid,role:roleFor(metric.pid)||metric.type?.toLowerCase()||'other',name:metric.name||metric.type,cpuPercent:metric.cpu?.percentCPUUsage??null,rssBytes:Number.isFinite(metric.memory?.workingSetSize)?metric.memory.workingSetSize*1024:null}));
   const backends=await Promise.all([...windows].map(async([target,state])=>{
    try{return {windowId:target.id,title:`Reader ${target.id}`,...await request(state,'/api/developer/snapshot')};}
    catch(error){return {windowId:target.id,title:`Reader ${target.id}`,error:error.message,events:[],tasks:[],processes:[]};}
   }));
   return {sampledAt:Date.now(),system:{totalMemory:totalmem(),freeMemory:freemem()},processes,backends};
  })().finally(()=>{sampling=null;});
  return sampling;
 };
 const open=async(target)=>{
  if(monitor&&!monitor.isDestroyed()){if(monitor.isMinimized())monitor.restore();monitor.show();monitor.focus();return true;}
  if(opening)return opening;
  opening=(async()=>{
   await disabling;
   const state=windows.get(target);if(!state)throw Error('Open developer mode from a reader window.');
   await Promise.all([...windows.values()].map(state=>setEnabled(state,true)));
   monitor=new BrowserWindow({width:1120,height:790,minWidth:760,minHeight:560,title:'PDFMathReader · Developer',backgroundColor:'#f4f6fa',show:false,webPreferences:{partition:'developer-'+randomBytes(16).toString('hex'),preload:fileURLToPath(new URL('./preload.cjs',import.meta.url)),nodeIntegration:false,contextIsolation:true,sandbox:true}});
   const current=monitor;current.developerOrigin=state.backend.origin;
   current.setMenu(null);
   current.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&(process.platform==='darwin'?input.meta:input.control)&&!input.alt&&!input.shift&&String(input.key).toLowerCase()==='w'){event.preventDefault();current.close();}});
   const session=current.webContents.session;
   session.setPermissionRequestHandler((_wc,_permission,reply)=>reply(false));session.setPermissionCheckHandler(()=>false);
   session.webRequest.onBeforeSendHeaders({urls:[`${state.backend.origin}/*`]},(details,reply)=>reply({requestHeaders:{...details.requestHeaders,'X-Preview-Token':token}}));
   current.webContents.setWindowOpenHandler(()=>({action:'deny'}));
   current.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==current.developerOrigin)event.preventDefault();});
   current.on('closed',()=>{if(monitor===current)monitor=null;disabling=Promise.all([...windows.values()].map(state=>setEnabled(state,false)));changed();});
   const url=new URL(state.backend.origin);url.searchParams.set('developer','1');url.searchParams.set('language',state.preferences.uiLanguage||'en');
   await current.loadURL(url.href);current.show();changed();return true;
  })().catch(async error=>{monitor?.destroy();monitor=null;await Promise.all([...windows.values()].map(state=>setEnabled(state,false)));throw error;}).finally(()=>{opening=null;});
  return opening;
 };
 ipcMain.handle('developer:open',event=>open(authorize(event)));
 ipcMain.handle('developer:enabled',event=>{authorize(event);return !!monitor&&!monitor.isDestroyed();});
 ipcMain.handle('developer:close',event=>{authorize(event);monitor?.close();return true;});
 ipcMain.handle('developer:copy',async(event,text)=>{if(authorize(event)!==monitor||typeof text!=='string'||text.length>4000000)throw Error('Invalid diagnostic export.');await clipboard.writeText(text);return true;});
 ipcMain.handle('developer:snapshot',event=>{if(authorize(event)!==monitor)throw Error('Open the developer window to view diagnostics.');return sample();});
 return {sync,close:()=>monitor?.close()};
}
