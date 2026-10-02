const MACOS_WINDOW_CHROME = Object.freeze({
 titleBarStyle:'hiddenInset',
 trafficLightPosition:{x:18,y:24},
 vibrancy:'sidebar',
 // Keep the behind-window material visible while another app has focus.
 visualEffectState:'active',
 backgroundColor:'#00000000'
});
const NATIVE_WINDOW_CHROME = Object.freeze({backgroundColor:'#f7f7f9'});
const SHORTCUT_ACTIONS=Object.freeze({w:'close-document',o:'open',r:'translation',b:'sidebar',',':'settings',l:'language',k:'kernel','+':'zoom-in','=':'zoom-in','-':'zoom-out'});

export function windowChromeOptions(platform){
 return platform==='darwin'?{...MACOS_WINDOW_CHROME,trafficLightPosition:{...MACOS_WINDOW_CHROME.trafficLightPosition}}:{...NATIVE_WINDOW_CHROME};
}

export function commandAccelerator(platform,key){return `${platform==='darwin'?'Command':'CommandOrControl'}+${key}`;}
export function closeWindowAccelerator(platform){return platform==='darwin'?'Ctrl+W':'CommandOrControl+Shift+W';}

export function shortcutAction(platform,input){
 if(!input||input.type!=='keyDown')return null;
 const key=String(input.key||'').toLowerCase();
 if(platform==='darwin'){
  if(key==='w'&&input.control&&!input.meta&&!input.alt&&!input.shift)return 'close-window';
  if(!input.meta||input.control||input.alt)return null;
 }else{
  if(key==='w'&&input.control&&!input.meta&&!input.alt&&input.shift)return 'close-window';
  if(!input.control||input.meta||input.alt)return null;
 }
 return SHORTCUT_ACTIONS[key]||(/^\d$/.test(key)?'percent:'+(key==='0'?100:Number(key)*10):null);
}
