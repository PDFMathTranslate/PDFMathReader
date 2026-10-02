const MACOS_WINDOW_CHROME = Object.freeze({
 titleBarStyle:'hiddenInset',
 trafficLightPosition:{x:18,y:24},
 vibrancy:'sidebar',
 // Keep the behind-window material visible while another app has focus.
 visualEffectState:'active',
 backgroundColor:'#00000000'
});
// Windows owns its titlebar in the renderer. Keeping this window frameless
// also means immersive header hiding cannot leave a native title overlay
// behind the hidden toolbar.
const WINDOWS_WINDOW_CHROME = Object.freeze({frame:false,autoHideMenuBar:true,backgroundColor:'#f7f7f9'});
const NATIVE_WINDOW_CHROME = Object.freeze({backgroundColor:'#f7f7f9'});
const SHORTCUT_ACTIONS=Object.freeze({f:'search',w:'close-document',o:'open',n:'new-window',r:'translation',b:'sidebar',',':'settings',l:'language',k:'kernel','+':'zoom-in','=':'zoom-in','-':'zoom-out'});

export function windowChromeOptions(platform,{windowsBuild=0,reduceTransparency=false}={}){
 if(platform==='darwin')return {...MACOS_WINDOW_CHROME,trafficLightPosition:{...MACOS_WINDOW_CHROME.trafficLightPosition}};
 if(platform==='win32'&&windowsBuild>=22621&&!reduceTransparency)return {...WINDOWS_WINDOW_CHROME,backgroundMaterial:'acrylic',backgroundColor:'#00000000'};
 return platform==='win32'?{...WINDOWS_WINDOW_CHROME}:{...NATIVE_WINDOW_CHROME};
}

function menuItems(menu){return Array.isArray(menu)?menu:Array.isArray(menu?.items)?menu.items:[];}
function menuItemId(item,prefix,index){
 const id=typeof item?.id==='string'?item.id.trim():'';
 return id||`menu-${[...prefix,index].join('-')}`;
}

function serializeMenuItem(item,prefix,index){
 if(item?.visible===false)return null;
 const id=menuItemId(item,prefix,index),children=menuItems(item?.submenu);
 const path=[...prefix,index];
 const serialized={
  path,
  id,
  label:typeof item?.label==='string'?item.label:'',
  type:typeof item?.type==='string'&&item.type?item.type:(children.length?'submenu':'normal'),
  enabled:item?.enabled!==false,
  checked:item?.checked===true,
  accelerator:typeof item?.accelerator==='string'?item.accelerator:null
 };
 if(item?.submenu)serialized.submenu=children.map((child,childIndex)=>serializeMenuItem(child,path,childIndex)).filter(Boolean);
 return serialized;
}

/*
 * Return the application menu in a renderer-safe data shape. MenuItem
 * instances and click callbacks never cross the context bridge; the result
 * carries numeric index paths so the renderer can return the exact entry it
 * displayed, while ids remain available for inspection and accessibility.
 */
export function serializeApplicationMenu(menu){
 return menuItems(menu).map((item,index)=>serializeMenuItem(item,[],index)).filter(Boolean);
}

function findMenuItem(items,prefix,segment){
 const key=String(segment);
 let index=items.findIndex((item,itemIndex)=>menuItemId(item,prefix,itemIndex)===key);
 if(index<0&&Number.isInteger(segment)&&segment>=0&&segment<items.length)index=segment;
 if(index<0&&/^\d+$/.test(key)){const candidate=Number(key);if(candidate<items.length)index=candidate;}
 return index<0?null:{item:items[index],index};
}

/* Resolve only ids or numeric indices. Labels are deliberately not accepted
 * as selectors because a localized label is neither stable nor authoritative.
 */
export function menuPathItems(menu,path){
 if(!Array.isArray(path)||path.length===0)return null;
 let items=menuItems(menu),prefix=[],result=[];
 for(let depth=0;depth<path.length;depth++){
  const segment=path[depth];
  if(typeof segment!=='string'&&!Number.isInteger(segment))return null;
  const found=findMenuItem(items,prefix,segment);if(!found)return null;
  result.push(found.item);
  if(depth===path.length-1)return result;
  items=menuItems(found.item?.submenu);prefix=[...prefix,found.index];
 }
 return null;
}

export function menuItemAtPath(menu,path){return menuPathItems(menu,path)?.at(-1)||null;}

export function commandAccelerator(platform,key){return `${platform==='darwin'?'Command':'CommandOrControl'}+${key}`;}
export function closeWindowAccelerator(platform){return platform==='darwin'?'Ctrl+W':'CommandOrControl+Shift+W';}

export function shortcutAction(platform,input){
 if(!input||input.type!=='keyDown')return null;
 const key=String(input.key||'').toLowerCase();
 if(!input.meta&&!input.control&&!input.alt){if(key==='pageup'||input.shift&&['arrowup','arrowleft'].includes(key))return 'page-previous';if(key==='pagedown'||input.shift&&['arrowdown','arrowright'].includes(key))return 'page-next';}
 if(key==='f11'&&!input.meta&&!input.control&&!input.alt)return 'toggle-fullscreen';
 if(platform==='darwin'){
  if(key==='w'&&input.control&&!input.meta&&!input.alt&&!input.shift)return 'close-window';
  if(!input.meta||input.control||input.alt)return null;
 }else{
  if(key==='w'&&input.control&&!input.meta&&!input.alt&&input.shift)return 'close-window';
  if(!input.control||input.meta||input.alt)return null;
 }
 const digit=/^Digit[0-9]$/.test(input.code||'')?input.code.slice(-1):/^\d$/.test(key)?key:null;
 if(digit!==null)return input.shift?'percent:'+(digit==='0'?100:Number(digit)*10):({'1':'columns:1','2':'columns:2','3':'columns:4'}[digit]||null);
 return SHORTCUT_ACTIONS[key]||null;
}
