import {app,BrowserWindow,dialog,Menu,ipcMain,shell,clipboard,safeStorage,systemPreferences,nativeTheme} from 'electron';
import {randomBytes} from 'node:crypto';
import {join} from 'node:path';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
const smoke=process.argv.find(a=>a.startsWith('--smoke-test='))?.split('=')[1];
if(smoke&&app.isPackaged&&!process.execPath.includes('PDFMathReader Tests.app'))throw Error('Mock tests require the isolated test application.');
if(smoke){
 app.setPath('userData',mkdtempSync(join(tmpdir(),'preview-smoke-')));
}
import {startBackendService} from './backend-service.mjs';
import {createCredentials} from './credentials.mjs';
import {createRecents} from './recents.mjs';
import {createReaderPreferences} from './preferences.mjs';
import {fileURLToPath} from 'node:url';
import {readSystemPDF,validateSystemPDF,pdfLaunchPaths} from './documents.mjs';
import {writeFile} from 'node:fs/promises';
import {menuLabel} from './menu-i18n.mjs';
import {createHaptics} from './haptics.mjs';
import {windowChromeOptions,commandAccelerator,closeWindowAccelerator,shortcutAction,serializeApplicationMenu,menuPathItems} from './window-chrome.mjs';
import {appendPerformanceReport,loadPerformanceReports,memoryMetricToBytes,MAX_PERFORMANCE_REPORTS,sumMemoryMetrics,validatePerformanceReport,writePerformanceReports} from './performance-tracker.mjs';

const haptics=createHaptics({packaged:app.isPackaged});app.on('will-quit',()=>haptics.close());
const pendingFiles=[];
function enqueueFiles(paths){for(const path of paths)if(!pendingFiles.includes(path))pendingFiles.push(path);if(paths.length)notifyDocuments();}
let notifyDocuments=()=>{};
app.on('open-file',(event,path)=>{event.preventDefault();if(smoke&&smoke!=='file-open'&&smoke!=='multi-window')return;enqueueFiles([path]);});
app.setName(smoke?'PDFMathReader Tests':'PDFMathReader');if(!smoke)app.setPath('userData',join(app.getPath('appData'),'PDFMathReader'));
if(!smoke||smoke==='file-open')enqueueFiles(pdfLaunchPaths(process.argv.slice(1),process.cwd()));if(process.platform==='darwin'&&['resize','file-open'].includes(smoke))app.setActivationPolicy('prohibited');
if(!app.requestSingleInstanceLock())app.quit();
else {
 let backend,window,credentials,preferences,recents;const windows=new Map(),closingBackends=new Set();let backendOptions,documentsReady=false;let quitting=false,backendFailureHandled=false;let performanceReports=[];let performanceWrite=Promise.resolve();
 const WINDOW_LOCAL_PREFERENCES=['engine','direction','columns','fit','zoom','translationMode'];
 const SETTINGS_PREFERENCES=['interactionMode','language','sourceLanguage','concurrency','pageConcurrency','automatic','layoutVisible','autoHideHeader','uiLanguage','kernelAdvancedOptions'];
 const APPEARANCE_PREFERENCES=['appearance','accentColor','reduceMotion','reduceTransparency','reducePadding'];
 const preferenceSnapshot=state=>Object.fromEntries(APPEARANCE_PREFERENCES.map(key=>[key,state?.[key]]));
 const samePreferences=(left,right)=>APPEARANCE_PREFERENCES.every(key=>left[key]===right[key]);
 const mergeWindowPreferences=(next,current,value,isSender)=>{
  const result={...next};
  for(const key of WINDOW_LOCAL_PREFERENCES)if(current?.[key]!==undefined)result[key]=current[key];
  if(isSender)for(const key of WINDOW_LOCAL_PREFERENCES)if(value&&Object.prototype.hasOwnProperty.call(value,key)&&value[key]!==undefined)result[key]=next[key];
  return result;
 };
 const setWindowVibrancy=(target,reduceTransparency)=>{
  if(process.platform!=='darwin'||typeof target?.setVibrancy!=='function')return;
  try{target.setVibrancy(reduceTransparency?null:windowChromeOptions('darwin').vibrancy);}catch{}
 };
 const chromeOptions=()=>{
  const options=windowChromeOptions(process.platform);
  if(process.platform==='darwin'&&preferences?.load?.().reduceTransparency)delete options.vibrancy;
  return options;
 };
 const backgroundRenderSmoke=['resize','file-open'].includes(smoke);
 const focusedWindow=()=>BrowserWindow.getFocusedWindow()||[...windows.keys()].at(-1);
 const trustedWindow=event=>{const target=BrowserWindow.fromWebContents(event.sender),state=windows.get(target);if(!state||event.senderFrame!==target.webContents.mainFrame||new URL(event.senderFrame.url).origin!==state.backend.origin)throw Error('Window request rejected.');return target;};
 const normalizeMenuPath=value=>{
  const path=Array.isArray(value)?value:typeof value==='string'?[value]:null;
  if(!path||path.length===0||path.length>32||!path.every(segment=>(Number.isSafeInteger(segment)&&segment>=0&&segment<=10000)||(typeof segment==='string'&&/^[\da-z][\da-z:._-]{0,127}$/i.test(segment))))throw Error('Invalid menu path.');
  return path;
 };
 const activateMenuItem=(item,target)=>{
  if(!item||item.visible===false)throw Error('Menu item not found.');
  if(item.type==='separator'||item.enabled===false)throw Error('Menu item is not actionable.');
  if(item.submenu?.items?.length&&!item.click)throw Error('Menu item opens a submenu.');
  const authoredAction=menuActions.get(item.id);
  if(authoredAction){authoredAction(item,target,undefined);return true;}
  const role=String(item.role||''),contents=target?.webContents;
  const normalizedRole=role.toLowerCase();
  if(normalizedRole==='about'){app.showAboutPanel?.();return true;}
  if(normalizedRole==='quit'){app.quit();return true;}
  if(normalizedRole==='close'){target.close();return true;}
  if(normalizedRole==='minimize'){target.minimize();return true;}
  if(normalizedRole==='maximize'){target.isMaximized()?target.unmaximize():target.maximize();return true;}
  if(normalizedRole==='togglefullscreen'){target.setFullScreen(!target.isFullScreen());return true;}
  const roleMethod={copy:'copy',cut:'cut',paste:'paste',selectall:'selectAll',undo:'undo',redo:'redo',reload:'reload',forcereload:'reloadIgnoringCache'}[normalizedRole];
  if(contents&&roleMethod&&typeof contents[roleMethod]==='function'){contents[roleMethod]();return true;}
  throw Error('Menu item is not actionable.');
 };
 let rebuildMenu=()=>{},applicationMenu=null,menuActions=new Map();
 const updateMenu=window=>{const state=windows.get(window)?.preferences;if(!state)return;const menu=applicationMenu||Menu.getApplicationMenu();if(!menu)return;const item=id=>menu.getMenuItemById(id),layout=item('layout-'+(state.direction||'vertical')),columns=item('columns-'+(state.columns||1)),columnMenu=item('layout-columns');if(layout)layout.checked=true;if(columnMenu)columnMenu.enabled=state.direction!=='horizontal';if(columns)columns.checked=true;};
 const updateWindowButtons=target=>{if(process.platform!=='darwin'||!target||target.isDestroyed())return;const visible=!target.isFullScreen()&&!windows.get(target)?.headerHidden;target.setWindowButtonVisibility(visible);if(visible)target.setWindowButtonPosition(windowChromeOptions('darwin').trafficLightPosition);};
 const hideNativeMenuBar=target=>{if(process.platform!=='win32'||!target||target.isDestroyed())return;target.setAutoHideMenuBar?.(true);target.setMenuBarVisibility?.(false);};
 const windowActive=window=>!window.isMinimized()&&(backgroundRenderSmoke||window.isVisible());
 const stopPerformanceSampling=window=>{const state=windows.get(window);if(!state?.performance)return;if(state.performance.timer){clearInterval(state.performance.timer);state.performance.timer=null;}state.performance.samples=0;};
 const performanceMemory=value=>{const memory=memoryMetricToBytes(value);return {...memory,rssEstimateBytes:memory.workingSetBytes,workingSetKind:'rss-estimate',processPeakWorkingSetBytes:memory.peakWorkingSetBytes};};
 const samplePerformance=window=>{
  const state=windows.get(window);if(!state||window.isDestroyed())return null;
  let metrics=[];try{metrics=app.getAppMetrics();}catch{}
  const rendererPid=window.webContents.getOSProcessId(),backendPid=state.backend.processId;
  const find=pid=>metrics.find(metric=>metric?.pid===pid);
  const observe=(key,value)=>{const current=value.workingSetBytes||0,previous=state.performance.peaks.get(key)||0;state.performance.peaks.set(key,Math.max(previous,current));return {...value,peakWorkingSetBytes:Math.max(previous,current)};};
  const rendererRaw=performanceMemory(find(rendererPid)),backendRaw=performanceMemory(find(backendPid)),mainRaw=performanceMemory(find(process.pid));
  const gpuRaw=metrics.filter(metric=>metric?.type==='GPU').map(performanceMemory);
  const renderer=observe('renderer',rendererRaw),backend=observe('backend',backendRaw),main=observe('main',mainRaw),gpu=gpuRaw.map((value,index)=>observe(`gpu:${metrics.filter(metric=>metric?.type==='GPU')[index]?.pid||index}`,value));
  const scopedCurrent=sumMemoryMetrics([rendererRaw,backendRaw]),sharedCurrent=sumMemoryMetrics([mainRaw,...gpuRaw]),aggregateCurrent=sumMemoryMetrics([scopedCurrent,sharedCurrent]);
  const scopedTotal=observe('scoped-total',scopedCurrent),sharedTotal=observe('shared-total',sharedCurrent),aggregate=observe('aggregate',aggregateCurrent);
  return {schemaVersion:1,sampledAtMs:Date.now(),scope:{rendererPid,backendPid,mainPid:process.pid,gpuPids:metrics.filter(metric=>metric?.type==='GPU'&&Number.isInteger(metric.pid)).map(metric=>metric.pid)},scoped:{renderer,backend,total:scopedTotal},shared:{main,gpu,total:sharedTotal},aggregate};
 };
 const updatePerformanceSampling=window=>{
  const state=windows.get(window);if(!state?.performance?.hasDocument||!windowActive(window)){stopPerformanceSampling(window);return;}
  if(state.performance.timer)return;
  state.performance.samples=0;state.performance.timer=setInterval(()=>{if(!windows.has(window)||window.isDestroyed()||!windowActive(window)||state.performance.samples>=12000){stopPerformanceSampling(window);return;}state.performance.samples++;try{samplePerformance(window);}catch{}},250);state.performance.timer.unref?.();
 };
 async function handleBackendFailure(error){
  if(quitting||backendFailureHandled)return;backendFailureHandled=true;
  const key=credentials?.getKey?.();const detail=error?.message&&key?error.message.replaceAll(key,'[redacted]'):error?.message;
  if(smoke){console.error('Desktop smoke backend failed:',detail||'The backend utility process stopped unexpectedly.');app.exit(1);return;}
  dialog.showErrorBox('PDFMathReader',`The local reader backend stopped unexpectedly.${detail?`\n\n${detail}`:''}\n\nQuit and reopen PDFMathReader.`);app.quit();
 }
 notifyDocuments=()=>{if(!documentsReady)return;void deliverPendingFiles().catch(handleBackendFailure);};
 async function deliverPendingFiles(){while(pendingFiles.length){const path=pendingFiles.shift();await createWindow(path);}}
 const token=randomBytes(32).toString('hex');
 const appearance=()=>{const state=preferences?.load?.()||{};return {platform:process.platform,accent:'#'+systemAccent(),appearance:state.appearance||'system',accentColor:state.accentColor||'system',reduceMotion:!!state.reduceMotion,reduceTransparency:!!state.reduceTransparency,reducePadding:!!state.reducePadding,dark:!!nativeTheme.shouldUseDarkColors};};
 const systemAccent=()=>{try{const value=String(systemPreferences.getAccentColor?.()||'').replace(/^#/,'');if(/^[\da-f]{6}$/i.test(value))return value+'ff';if(/^[\da-f]{8}$/i.test(value))return value;}catch{}return '007affff';};
 const updateAppearance=()=>{for(const target of windows.keys())target.webContents.send('appearance:changed',appearance());};
 async function saveWindowReadingView(window){if(!window||window.isDestroyed())return;try{await window.webContents.executeJavaScript('window.previewSaveReadingView?.()');}catch{}}
 async function createWindow(document){
  let window;
  const backend=await startBackendService({...backendOptions,onCrash:error=>{if(quitting)return;if(smoke){void handleBackendFailure(error);return;}dialog.showErrorBox('PDFMathReader','This window’s reader process stopped unexpectedly. Reopen its PDF in a new window.');window?.close();}});
  window=new BrowserWindow({width:1200,height:850,minWidth:720,minHeight:500,title:'PDFMathReader',...chromeOptions(),show:false,webPreferences:{partition:'window-'+randomBytes(16).toString('hex'),backgroundThrottling:['resize','file-open'].includes(smoke)?false:true,additionalArguments:[...(smoke?['--preview-test-mode']:[]),...(smoke==='fluent'?['--preview-ui-platform=win32']:[]),...(backgroundRenderSmoke?['--preview-background-render']:[])],preload:fileURLToPath(new URL('./preload.cjs',import.meta.url)),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  hideNativeMenuBar(window);
  windows.set(window,{backend,documents:document?[document]:[],tickets:new Map(),preferences:preferences.load(),performance:{peaks:new Map(),timer:null,samples:0,hasDocument:!!document}});
  const fullscreenChanged=()=>{if(!window||window.isDestroyed())return;const full=window.isFullScreen();updateWindowButtons(window);window.webContents.send('window:fullscreen',full);};
  const activityChanged=()=>{if(!window||window.isDestroyed())return;window.webContents.send('activity:changed',windowActive(window));updatePerformanceSampling(window);};
  let resizing=false;
  const resizeStart=()=>{if(resizing||!window||window.isDestroyed())return;resizing=true;window.webContents.send('window:resize-start');};
  const resizeEnd=()=>{if(!resizing||!window||window.isDestroyed())return;resizing=false;window.webContents.send('window:resize-end');};
  if(process.platform==='darwin'){window.on('will-resize',resizeStart);window.on('resized',resizeEnd);}
  window.on('show',()=>updateWindowButtons(window));window.on('restore',()=>updateWindowButtons(window));window.on('resized',()=>updateWindowButtons(window));
  window.on('enter-full-screen',fullscreenChanged);window.on('leave-full-screen',fullscreenChanged);
  for(const event of ['minimize','restore','hide','show'])window.on(event,activityChanged);
  window.webContents.setZoomFactor(1);
  window.webContents.setVisualZoomLevelLimits(1,1);
  window.webContents.on('before-input-event',(event,input)=>{if(windows.get(window)?.preferences?.interactionMode==='reading'&&input.type==='keyDown'&&(process.platform==='darwin'?input.meta:input.control)&&!input.alt&&!input.shift&&String(input.key).toLowerCase()==='c'){event.preventDefault();window.webContents.copy();return;}if(windows.get(window)?.preferences?.interactionMode!=='reading'&&input.type==='keyDown'&&(process.platform==='darwin'?input.meta:input.control)&&!input.alt&&!input.shift&&String(input.key).toLowerCase()==='c'){event.preventDefault();window.webContents.send('reader:action','copy-paragraph');return;}const action=shortcutAction(process.platform,input);if(action==='page-previous'||action==='page-next')return;if(action==='new-window'){event.preventDefault();void createWindow().catch(handleBackendFailure);return;}if(action==='toggle-fullscreen'){event.preventDefault();window.setFullScreen(!window.isFullScreen());return;}if(action==='close-window'){event.preventDefault();window.close();return;}if(action){event.preventDefault();window.webContents.send('reader:action',action);}});
  window.webContents.on('context-menu',(_event,params)=>{
   if(windows.get(window)?.preferences?.interactionMode!=='reading'||typeof params?.selectionText!=='string'||!params.selectionText.trim())return;
   const template=[{role:'copy'},{role:'selectAll'}];
   if(process.platform==='darwin'&&typeof window.webContents.showDefinitionForSelection==='function'){
    template.push({type:'separator'},{label:'Look Up Selection',click:()=>window.webContents.showDefinitionForSelection()});
   }
   Menu.buildFromTemplate(template).popup({window});
  });
  const ses=window.webContents.session;
  ses.setPermissionRequestHandler((_wc,_permission,reply)=>reply(false));
  ses.setPermissionCheckHandler(()=>false);
  ses.webRequest.onBeforeSendHeaders({urls:[`${backend.origin}/*`]},(details,reply)=>reply({requestHeaders:{...details.requestHeaders,'X-Preview-Token':token}}));
  window.webContents.setWindowOpenHandler(({url})=>{if(url==='https://github.com/PDFMathTranslate/PDFMathReader')void shell.openExternal(url);return {action:'deny'};});
  window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==backend.origin)event.preventDefault();});
  window.once('ready-to-show',()=>{hideNativeMenuBar(window);if(!['resize','file-open'].includes(smoke)){if(process.argv.includes('--background'))window.showInactive();else window.show();}updatePerformanceSampling(window);});
  window.on('focus',()=>{updateAppearance();updateMenu(window);});
  let closing=false;window.on('close',event=>{if(closing||quitting)return;event.preventDefault();closing=true;void saveWindowReadingView(window).finally(()=>{if(window&&!window.isDestroyed())window.close();});});
  window.on('closed',()=>{stopPerformanceSampling(window);windows.get(window)?.performance.peaks.clear();windows.delete(window);const closing=backend.close();closingBackends.add(closing);void closing.finally(()=>closingBackends.delete(closing));if(!windows.size)app.quit();});
  await window.loadURL(backend.origin);
  activityChanged();return window;
 }
 app.on('second-instance',(_event,args,cwd)=>{const paths=pdfLaunchPaths(args.slice(1),cwd);if((!smoke||['file-open','multi-window'].includes(smoke))&&paths.length)enqueueFiles(paths);else {focusedWindow()?.show();focusedWindow()?.focus();}});
 app.whenReady().then(async()=>{
  if(process.platform==='darwin'&&!app.isPackaged&&!smoke)app.dock.setIcon(fileURLToPath(new URL('../doc/icon.png',import.meta.url)));
  const commandId=action=>`action-${String(action).replace(/[^a-z\d]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()}`;
  const command=(label,accelerator,action,id=commandId(action))=>({id,label,accelerator,click:(_item,target)=>{const receiver=target||focusedWindow();receiver?.webContents.send('reader:action',action);}});
  const accelerator=key=>commandAccelerator(process.platform,key);
  rebuildMenu=()=>{const template=[
   {id:'app-menu',label:smoke?app.name:'PDFMathReader',submenu:[{id:'app-about',role:'about'},command('Settings…',accelerator(','),'settings','app-settings'),{type:'separator'},{id:'app-quit',role:'quit'}]},
   {id:'file-menu',label:'File',submenu:[{id:'file-new-window',label:'New Window',accelerator:accelerator('N'),click:()=>{void createWindow().catch(handleBackendFailure);}},command('Open PDF…',accelerator('O'),'open','file-open'),command('Open recents...',undefined,'recents','file-recents'),command('Preference',undefined,'preferences','file-preferences'),{type:'separator'},command('Close Document',accelerator('W'),'close-document','file-close-document'),{id:'file-close-window',label:'Close Window',accelerator:closeWindowAccelerator(process.platform),click:(_item,target)=>(target||focusedWindow())?.close()}]},
   {id:'edit-menu',role:'editMenu'},
   {id:'view-menu',label:'View',submenu:[command('Find…',accelerator('F'),'search','view-search'),command('Show Original / Translation',accelerator('R'),'translation','view-translation'),command('Zoom In',accelerator('='),'zoom-in','view-zoom-in'),command('Zoom Out',accelerator('-'),'zoom-out','view-zoom-out'),command('Fit Width',undefined,'fit-width','view-fit-width'),command('Fit Height',undefined,'fit-height','view-fit-height'),command('Toggle Sidebar',accelerator('B'),'sidebar','view-sidebar'),{type:'separator'},{id:'view-layout',label:'Layout',submenu:['vertical','horizontal'].map(direction=>({id:'layout-'+direction,label:direction==='vertical'?'Vertical':'Horizontal',type:'radio',checked:direction==='vertical',click:(_item,target)=>(target||focusedWindow())?.webContents.send('reader:action','layout:'+direction)}))},{label:'Pages per Row',id:'layout-columns',submenu:[1,2,4].map(columns=>({id:'columns-'+columns,label:({1:'One Side',2:'Two Sides',4:'Quad Side'})[columns],accelerator:accelerator(columns===4?3:columns),type:'radio',checked:columns===1,click:(_item,target)=>(target||focusedWindow())?.webContents.send('reader:action','columns:'+columns)}))},{type:'separator'},{id:'view-fullscreen',role:'togglefullscreen'}]},
   {id:'go-menu',label:'Go',submenu:[command('Previous Page',undefined,'page-previous','go-previous'),command('Next Page',undefined,'page-next','go-next'),{type:'separator'},...Array.from({length:9},(_,i)=>command(`Go to ${(i+1)*10}%`,accelerator('Shift+'+(i+1)),`percent:${(i+1)*10}`,`go-percent-${(i+1)*10}`)),command('Go to 100%',accelerator('Shift+0'),'percent:100','go-percent-100')]},
   {id:'translation-menu',label:'Translation',submenu:[command('Choose Language…',accelerator('L'),'language','translation-language'),command('Choose Kernel…',accelerator('K'),'kernel','translation-kernel')]},...(process.platform==='win32'?[]:[{id:'window-menu',role:'windowMenu'}])];const locale=preferences?.load?.().uiLanguage||'en';const localize=items=>items.map(item=>({...item,...item.label?{label:menuLabel(item.label,locale)}:{},...Array.isArray(item.submenu)?{submenu:localize(item.submenu)}:{}}));const localized=localize(template),actions=new Map(),indexActions=items=>{for(const item of items){if(item.id&&typeof item.click==='function')actions.set(item.id,item.click);if(Array.isArray(item.submenu))indexActions(item.submenu);}};indexActions(localized);menuActions=actions;applicationMenu=Menu.buildFromTemplate(localized);Menu.setApplicationMenu(process.platform==='win32'?null:applicationMenu);if(process.platform==='win32')for(const target of windows.keys())hideNativeMenuBar(target);};rebuildMenu();
  const credentialOptions={path:join(app.getPath('userData'),'openai-key.enc'),safeStorage};
  if(['present','kernels','ux','animation','coverage','search','advanced'].includes(smoke))credentialOptions.environment=()=> 'local-smoke-placeholder';
  const credentialStore=await createCredentials(credentialOptions);
  backendOptions={port:0,development:false,pythonResourcesPath:process.resourcesPath,cacheDir:join(app.getPath('userData'),'translations'),token,smoke,diagnostics:!!smoke,credentials:{getKey:credentialStore.getKey,status:credentialStore.status},onCrash:handleBackendFailure,...(['kernels','animation','layout-region','advanced'].includes(smoke)?{enginesRoot:join(app.getPath('appData'),'PDFMathReader','engines'),runtimeHomeRoot:join(tmpdir(),'preview-kernel-test-homes')}: {})};
  credentials={
   getKey:credentialStore.getKey,
   status:credentialStore.status,
   save:async key=>{const status=await credentialStore.save(key);await Promise.all([...windows.values()].map(state=>state.backend.setCredentials(credentialStore.getKey(),status)));return status;},
   clear:async()=>{const status=await credentialStore.clear();await Promise.all([...windows.values()].map(state=>state.backend.setCredentials(credentialStore.getKey(),status)));return status;}
  };
  ipcMain.handle('documents:next',async event=>{
   const window=trustedWindow(event);
   const state=windows.get(window),path=state.documents.shift();if(!path)return null;if(typeof path!=='string')return path;
   try{const document=await readSystemPDF(path);const ticket=randomBytes(16).toString('hex');windows.get(window).tickets.set(ticket,path);return {...document,ticket};}catch{return {error:'Could not open this PDF. Check file access and the 50 MB limit.'};}
  });
  ipcMain.handle('clipboard:write-text',async(event,text)=>{trustedWindow(event);if(typeof text!=='string'||text.length>1000000)throw Error('Invalid clipboard text');await clipboard.writeText(text);return true;});
  ipcMain.handle('window:menu',event=>{const target=trustedWindow(event);updateMenu(target);return serializeApplicationMenu(applicationMenu);});
  ipcMain.handle('window:menu-action',(event,path)=>{
   const target=trustedWindow(event),items=menuPathItems(applicationMenu,normalizeMenuPath(path));
   if(!items||items.some(item=>item.visible===false||item.enabled===false))throw Error('Menu item is disabled.');
   activateMenuItem(items.at(-1),target);updateMenu(target);return true;
  });
  ipcMain.handle('window:minimize',event=>{const target=trustedWindow(event);target.minimize();return true;});
  ipcMain.handle('window:maximize',event=>{const target=trustedWindow(event);if(target.isMaximized())target.unmaximize();else target.maximize();return target.isMaximized();});
  ipcMain.handle('window:close',event=>{const target=trustedWindow(event);target.close();return true;});
  ipcMain.handle('window:header-hidden',(event,hidden)=>{const target=trustedWindow(event);if(typeof hidden!=='boolean')throw Error('Invalid header state');windows.get(target).headerHidden=hidden;updateWindowButtons(target);});
  ipcMain.handle('window:fullscreen',event=>{const window=trustedWindow(event);return window.isFullScreen();});
  ipcMain.handle('window:activity',event=>{const window=trustedWindow(event);return windowActive(window);});
  ipcMain.handle('previewPerformance:sample',event=>{
   return samplePerformance(trustedWindow(event));
  });
  ipcMain.handle('previewPerformance:reset',event=>{const window=trustedWindow(event),state=windows.get(window);state.performance.peaks.clear();state.performance.hasDocument=true;updatePerformanceSampling(window);return {reset:true};});
  ipcMain.handle('previewPerformance:end',event=>{const window=trustedWindow(event),state=windows.get(window);state.performance.hasDocument=false;stopPerformanceSampling(window);return {ended:true};});
  ipcMain.handle('previewPerformance:save',async(event,value)=>{
   trustedWindow(event);
   const report=validatePerformanceReport(value);
   const operation=performanceWrite.then(async()=>{performanceReports=appendPerformanceReport(performanceReports,report);await writePerformanceReports(join(app.getPath('userData'),'performance.json'),performanceReports);return {saved:true,count:performanceReports.length,maxReports:MAX_PERFORMANCE_REPORTS};});
   performanceWrite=operation.catch(()=>{});return operation;
  });
  ipcMain.handle('previewResize:capture',async(event,value)=>{
   const window=trustedWindow(event);if(window.isDestroyed()||window.isMinimized())return null;
   const [contentWidth,contentHeight]=window.getContentSize();const input=value&&typeof value==='object'?value:{};
   const rawX=input.x===undefined?0:Number(input.x),rawY=input.y===undefined?0:Number(input.y),rawWidth=input.width===undefined?contentWidth:Number(input.width),rawHeight=input.height===undefined?contentHeight:Number(input.height);
   if(![rawX,rawY,rawWidth,rawHeight].every(Number.isFinite)||rawX<0||rawY<0||rawWidth<=0||rawHeight<=0)throw Error('Invalid resize capture bounds.');
   const x=Math.min(contentWidth,Math.floor(rawX)),y=Math.min(contentHeight,Math.floor(rawY)),width=Math.min(contentWidth-x,Math.floor(rawWidth)),height=Math.min(contentHeight-y,Math.floor(rawHeight));
   if(!width||!height)return null;
   let image=await window.webContents.capturePage({x,y,width,height}),size=image.getSize();const maxPixels=4*1024*1024;if(size.width*size.height>maxPixels){const scale=Math.sqrt(maxPixels/(size.width*size.height));size={width:Math.max(1,Math.floor(size.width*scale)),height:Math.max(1,Math.floor(size.height*scale))};image=image.resize({...size,quality:'good'});}let png=image.toPNG();const maxDataUrlBytes=10*1024*1024;
   for(let attempt=0;Buffer.byteLength(`data:image/png;base64,${png.toString('base64')}`,'utf8')>maxDataUrlBytes&&attempt<16;attempt++){
    const scale=Math.max(.1,Math.min(.8,Math.sqrt(maxDataUrlBytes/Math.max(1,Buffer.byteLength(`data:image/png;base64,${png.toString('base64')}`,'utf8')))*.9));
    size={width:Math.max(1,Math.floor(size.width*scale)),height:Math.max(1,Math.floor(size.height*scale))};image=image.resize({...size,quality:'good'});png=image.toPNG();
   }
   const dataUrl=`data:image/png;base64,${png.toString('base64')}`;if(Buffer.byteLength(dataUrl,'utf8')>maxDataUrlBytes)throw Error('Resize capture exceeds the 10 MiB limit.');return {width:size.width,height:size.height,dataUrl};
  });
  ipcMain.handle('haptics:tick',event=>{const window=trustedWindow(event);if(!window.isFocused())return false;return haptics.tick();});
  ipcMain.handle('appearance:current',event=>{
   const window=trustedWindow(event);
   return appearance();
  });
  nativeTheme.on('updated',updateAppearance);
  if(process.platform==='darwin'){
   for(const notification of ['AppleColorPreferencesChangedNotification','AppleAquaColorVariantChanged'])systemPreferences.subscribeNotification(notification,updateAppearance);
   systemPreferences.subscribeLocalNotification('NSSystemColorsDidChangeNotification',updateAppearance);
  }
  for(const action of ['status','save','clear'])ipcMain.handle(`credentials:${action}`,async(event,value)=>{
   const window=trustedWindow(event);
   if(action==='status')return credentials.status();
   return action==='save'?credentials.save(value):credentials.clear();
  });
  preferences=await createReaderPreferences(join(app.getPath('userData'),'reader-preferences.json'));
  nativeTheme.themeSource=preferences.load().appearance;rebuildMenu();
  for(const action of ['load','save'])ipcMain.handle(`preferences:${action}`,async(event,value)=>{
   const window=trustedWindow(event);
   if(action==='load')return windows.get(window).preferences;
   const previous=preferences.load(),write=preferences.save(value),next=preferences.load();
   nativeTheme.themeSource=next.appearance;if(previous.uiLanguage!==next.uiLanguage)rebuildMenu();
   for(const [target,state] of windows){
    state.preferences=mergeWindowPreferences(next,state.preferences,value,target===window);
    setWindowVibrancy(target,state.preferences.reduceTransparency);
   }
   if(!samePreferences(preferenceSnapshot(previous),preferenceSnapshot(next)))updateAppearance();
   if(SETTINGS_PREFERENCES.some(key=>key==='kernelAdvancedOptions'?JSON.stringify(previous[key])!==JSON.stringify(next[key]):previous[key]!==next[key]))for(const target of windows.keys())if(target!==window)target.webContents.send('preferences:changed',Object.fromEntries(SETTINGS_PREFERENCES.map(key=>[key,next[key]])));
   if(window===focusedWindow())updateMenu(window);
   return write;
  });
  recents=await createRecents(join(app.getPath('userData'),'recent-documents.json'));
  performanceReports=await loadPerformanceReports(join(app.getPath('userData'),'performance.json'));
  for(const action of ['list','open','openWindow','remember','clear','preview','setThumbnail','setView'])ipcMain.handle('recents:'+action,async(event,value)=>{
   const window=trustedWindow(event);
   if(action==='list')return recents.list();if(action==='clear'){app.clearRecentDocuments();return recents.clear();}
   if(action==='openWindow'){const path=recents.path(value);if(!path)throw Error('Document no longer in history.');await validateSystemPDF(path);await createWindow(path);return true;}
   if(action==='open'){const path=recents.path(value);if(!path)throw Error('Document no longer in history.');const document=await readSystemPDF(path);const ticket=randomBytes(16).toString('hex');windows.get(window).tickets.set(ticket,path);const recent=recents.list().find(entry=>entry.id===value);return {...document,ticket,recentId:value,view:recent?.view};}
   if(action==='preview'){const path=recents.path(value);if(!path)throw Error('Document no longer in history.');const document=await readSystemPDF(path);return {bytes:document.bytes};}
   if(action==='setThumbnail')return recents.setThumbnail(value?.id,value?.thumbnail);
   if(action==='setView')return recents.setView(value?.id,value?.view);
   const path=value?.ticket?windows.get(window).tickets.get(value.ticket):value?.path;if(!path)return {entries:recents.list(),recentId:null};if(smoke&&!['A quieter way to read.pdf','Portrait and landscape.pdf'].includes(path.split('/').pop()))throw Error('Test document rejected.');await validateSystemPDF(path);if(value?.ticket)windows.get(window).tickets.delete(value.ticket);if(!smoke)app.addRecentDocument(path);const entries=await recents.remember(path,value?.thumbnail),first=entries[0];return {entries,recentId:first?.id??null,view:first?.view};
  });
  ipcMain.handle('documents:open',async(event,value)=>{trustedWindow(event);if(typeof value?.path==='string'){await validateSystemPDF(value.path);await createWindow(value.path);}else{if(!value||typeof value.name!=='string'||!(value.bytes instanceof Uint8Array)||value.bytes.byteLength>50*1024*1024)throw Error('Invalid PDF.');await createWindow({name:value.name,bytes:value.bytes});}return true;});
  ipcMain.handle('window:new',async event=>{trustedWindow(event);await createWindow();});
  window=await createWindow(pendingFiles.shift());backend=windows.get(window).backend;documentsReady=true;await deliverPendingFiles();
  if(smoke){const checks=await import('./smoke.mjs');if(smoke==='locales')await (await import('./locales-smoke.mjs')).verifyLocales(window);else if(smoke==='advanced')await (await import('./advanced-smoke.mjs')).verifyAdvanced(window);else if(smoke==='fluent')await (await import('./fluent-smoke.mjs')).verifyFluent(window);else if(smoke==='search')await (await import('./search-smoke.mjs')).verifySearch(window);else if(smoke==='multi-window')await (await import('./multi-window-smoke.mjs')).verifyMultiWindow(window,windows,createWindow);else if(smoke==='fit-width')await (await import('./fit-width-smoke.mjs')).verifyFitWidth(window,recents);else if(smoke==='reading-view')await (await import('./reading-view-smoke.mjs')).verifyReadingView(window,recents);else if(smoke==='performance')await (await import('./performance-smoke.mjs')).verifyPerformance(window);else if(smoke==='benchmark')await (await import('./benchmark-smoke.mjs')).verifyBenchmark(window);else if(smoke==='coverage')await (await import('./coverage-smoke.mjs')).verifyCoverage(window,backend,token);else if(smoke==='resize'){await (await import('./recents-smoke.mjs')).verifyRecents(window,recents);await (await import('./resize-smoke.mjs')).verifyResize(window);}else if(smoke==='animation')await (await import('./animation-smoke.mjs')).verifyAnimation(window);else if(smoke==='ux')await (await import('./ux-smoke.mjs')).verifyUX(window,recents);else if(smoke==='layout-region')await (await import('./layout-region-smoke.mjs')).verifyLayoutRegion(window);else if(smoke==='kernel-choice')await (await import('./kernel-choice-smoke.mjs')).verifyKernelChoice(window);else if(smoke==='kernels')await (await import('./kernel-smoke.mjs')).verifyKernelUI(window);else if(smoke==='file-open')await checks.verifySystemOpen(window);else await checks.verify(window,backend,token,smoke,credentials);}
 }).catch(async error=>{if(smoke){await backend?.close();console.error('Desktop smoke failed:',error.stack||error.message);if(smoke==='file-open')await writeFile('/tmp/preview-system-open-result.json',JSON.stringify({passed:false,error:error.message}));app.exit(1);return;}dialog.showErrorBox('PDFMathReader',`The local reader could not start.\n\n${error?.message||'The backend utility process did not become ready.'}\n\nQuit and reopen PDFMathReader.`);app.quit();});
 app.on('before-quit',event=>{
  if(!backend || quitting)return;
  event.preventDefault();quitting=true;
  void Promise.allSettled([...windows.keys()].map(saveWindowReadingView)).finally(()=>Promise.allSettled([...windows.values()].map(state=>state.backend.close()).concat([...closingBackends,preferences?.flush(),recents?.flush()])).finally(()=>app.quit()));
 });
}
