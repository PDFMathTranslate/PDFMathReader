const {contextBridge,ipcRenderer,webUtils}=require('electron');
contextBridge.exposeInMainWorld('previewCredentials',Object.freeze({
 status:()=>ipcRenderer.invoke('credentials:status'),
 save:key=>ipcRenderer.invoke('credentials:save',key),
 clear:()=>ipcRenderer.invoke('credentials:clear')
}));

contextBridge.exposeInMainWorld('previewAppearance',Object.freeze({
 platform:process.argv.includes('--preview-test-mode')&&process.argv.includes('--preview-ui-platform=win32')?'win32':process.platform,
 contentGlass:process.platform==='darwin',
 windowsGlass:process.platform==='win32'&&process.argv.includes('--preview-windows-glass'),
 current:()=>ipcRenderer.invoke('appearance:current'),
 onChange:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('appearance:changed',listener);return ()=>ipcRenderer.removeListener('appearance:changed',listener);}
}));

contextBridge.exposeInMainWorld('previewDocuments',Object.freeze({
 next:()=>ipcRenderer.invoke('documents:next'),
 closed:()=>ipcRenderer.invoke('documents:closed'),
 saveView:view=>ipcRenderer.invoke('documents:view',view),
 open:async file=>{const path=webUtils.getPathForFile(file);return ipcRenderer.invoke('documents:open',path?{path}:{name:file.name,bytes:new Uint8Array(await file.arrayBuffer())});},
 onAvailable:callback=>{const listener=()=>callback();ipcRenderer.on('documents:available',listener);return ()=>ipcRenderer.removeListener('documents:available',listener);}
}));

contextBridge.exposeInMainWorld('previewTestMode',process.argv.includes('--preview-test-mode'));

contextBridge.exposeInMainWorld('previewAnnotations',Object.freeze({
 palette:()=>ipcRenderer.invoke('previewAnnotations:palette'),
 markDeleteHint:()=>ipcRenderer.invoke('previewAnnotations:markDeleteHint'),
 prepare:bytes=>ipcRenderer.invoke('previewAnnotations:prepare',bytes),
 loadState:key=>ipcRenderer.invoke('previewAnnotations:loadState',key),
 load:key=>ipcRenderer.invoke('previewAnnotations:load',key),
 save:value=>ipcRenderer.invoke('previewAnnotations:save',value),
 clean:bytes=>ipcRenderer.invoke('previewAnnotations:clean',bytes),
 handover:text=>ipcRenderer.invoke('previewAnnotations:handover',text),
 share:text=>ipcRenderer.invoke('previewAnnotations:share',text)
}));

contextBridge.exposeInMainWorld('previewActions',Object.freeze({onAction:callback=>{const listener=(_event,action)=>callback(action);ipcRenderer.on('reader:action',listener);return ()=>ipcRenderer.removeListener('reader:action',listener);}}));

contextBridge.exposeInMainWorld('previewPreferences',Object.freeze({load:()=>ipcRenderer.invoke('preferences:load'),save:value=>ipcRenderer.invoke('preferences:save',value),onChange:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('preferences:changed',listener);return ()=>ipcRenderer.removeListener('preferences:changed',listener);}}));

contextBridge.exposeInMainWorld('previewWindow',Object.freeze({
 new:()=>ipcRenderer.invoke('window:new'),
 menu:()=>ipcRenderer.invoke('window:menu'),
 menuAction:path=>ipcRenderer.invoke('window:menu-action',path),
 minimize:()=>ipcRenderer.invoke('window:minimize'),
 maximize:()=>ipcRenderer.invoke('window:maximize'),
 maximized:()=>ipcRenderer.invoke('window:maximized'),
 onMaximized:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('window:maximized',listener);return ()=>ipcRenderer.removeListener('window:maximized',listener);},
 close:()=>ipcRenderer.invoke('window:close'),
 closeStartPage:()=>ipcRenderer.invoke('window:close-start-page'),
 fullscreen:()=>ipcRenderer.invoke('window:fullscreen'),
 setHeaderHidden:hidden=>ipcRenderer.invoke('window:header-hidden',hidden),
 onFullscreen:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('window:fullscreen',listener);return ()=>ipcRenderer.removeListener('window:fullscreen',listener);}
}));

contextBridge.exposeInMainWorld('previewRecents',Object.freeze({list:()=>ipcRenderer.invoke('recents:list'),clear:()=>ipcRenderer.invoke('recents:clear'),open:id=>ipcRenderer.invoke('recents:open',id),openWindow:id=>ipcRenderer.invoke('recents:openWindow',id),preview:id=>ipcRenderer.invoke('recents:preview',id),setThumbnail:(id,thumbnail)=>ipcRenderer.invoke('recents:setThumbnail',{id,thumbnail}),setView:(id,view)=>ipcRenderer.invoke('recents:setView',{id,view}),remember:(file,ticket,thumbnail)=>ipcRenderer.invoke('recents:remember',ticket?{ticket,thumbnail}:{path:webUtils.getPathForFile(file),thumbnail})}));

contextBridge.exposeInMainWorld('previewActivity',Object.freeze({current:()=>ipcRenderer.invoke('window:activity'),onChange:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('activity:changed',listener);return ()=>ipcRenderer.removeListener('activity:changed',listener);}}));

contextBridge.exposeInMainWorld('previewRenderInBackground',process.argv.includes('--preview-background-render'));

contextBridge.exposeInMainWorld('previewPerformance',Object.freeze({
 sample:()=>ipcRenderer.invoke('previewPerformance:sample'),
 reset:()=>ipcRenderer.invoke('previewPerformance:reset'),
 end:()=>ipcRenderer.invoke('previewPerformance:end'),
 save:report=>ipcRenderer.invoke('previewPerformance:save',report)
}));

contextBridge.exposeInMainWorld('previewResize',Object.freeze({
 capture:bounds=>ipcRenderer.invoke('previewResize:capture',bounds),
 onStart:callback=>{const listener=()=>callback();ipcRenderer.on('window:resize-start',listener);return ()=>ipcRenderer.removeListener('window:resize-start',listener);},
 onEnd:callback=>{const listener=()=>callback();ipcRenderer.on('window:resize-end',listener);return ()=>ipcRenderer.removeListener('window:resize-end',listener);}
}));

contextBridge.exposeInMainWorld('previewClipboard',Object.freeze({writeText:text=>ipcRenderer.invoke('clipboard:write-text',text)}));

contextBridge.exposeInMainWorld('previewHaptics',Object.freeze({tick:()=>ipcRenderer.invoke('haptics:tick')}));
