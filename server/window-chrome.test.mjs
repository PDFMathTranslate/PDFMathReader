import assert from 'node:assert/strict';
import test from 'node:test';
import {windowChromeOptions,commandAccelerator,closeWindowAccelerator,shortcutAction,serializeApplicationMenu,menuItemAtPath,menuPathItems} from '../electron/window-chrome.mjs';

test('window chrome keeps the macOS inset and vibrancy policy exact',()=>{
 assert.deepEqual(windowChromeOptions('darwin'),{titleBarStyle:'hiddenInset',trafficLightPosition:{x:18,y:24},vibrancy:'sidebar',visualEffectState:'active',backgroundColor:'#00000000'});
});

test('Windows and Linux use frameless windows with hidden native menu bars',()=>{
 const windows=windowChromeOptions('win32');
 assert.equal(windows.frame,false);
 assert.equal(windows.autoHideMenuBar,true);
 assert.match(windows.backgroundColor,/^#[\da-f]{6}$/i);
 for(const platform of ['win32','linux']){
  const options=windowChromeOptions(platform);
  assert.equal(options.titleBarStyle,undefined);
  assert.equal(options.trafficLightPosition,undefined);
  assert.equal(options.vibrancy,undefined);
  assert.equal(options.visualEffectState,undefined);
  assert.match(options.backgroundColor,/^#[\da-f]{6}$/i);
 }
 assert.equal(windowChromeOptions('linux').frame,false);
 assert.equal(windowChromeOptions('linux').autoHideMenuBar,true);
});

test('Windows Acrylic requires a supported build and respects reduced transparency',()=>{
 assert.equal(windowChromeOptions('win32',{windowsBuild:22621}).backgroundMaterial,'acrylic');
 assert.equal(windowChromeOptions('win32',{windowsBuild:22621}).backgroundColor,'#00000000');
 assert.equal(windowChromeOptions('win32',{windowsBuild:19045}).backgroundMaterial,undefined);
 assert.equal(windowChromeOptions('win32',{windowsBuild:22621,reduceTransparency:true}).backgroundMaterial,undefined);
 assert.equal(windowChromeOptions('linux',{windowsBuild:22621}).backgroundMaterial,undefined);
});

test('accelerators and before-input shortcuts follow each platform',()=>{
 assert.equal(commandAccelerator('darwin','W'),'Command+W');
 assert.equal(commandAccelerator('linux','W'),'CommandOrControl+W');
 assert.equal(closeWindowAccelerator('darwin'),'Ctrl+W');
 assert.equal(closeWindowAccelerator('win32'),'CommandOrControl+Shift+W');
 assert.equal(shortcutAction('darwin',{type:'keyDown',key:'W',control:true,meta:false,alt:false,shift:false}),'close-window');
 assert.equal(shortcutAction('darwin',{type:'keyDown',key:'W',control:false,meta:true,alt:false,shift:false}),'close-document');
 assert.equal(shortcutAction('win32',{type:'keyDown',key:'W',control:true,meta:false,alt:false,shift:false}),'close-document');
 assert.equal(shortcutAction('linux',{type:'keyDown',key:'W',control:true,meta:false,alt:false,shift:true}),'close-window');
 assert.equal(shortcutAction('linux',{type:'keyDown',key:'O',control:true,meta:false,alt:false,shift:false}),'open');
 assert.equal(shortcutAction('win32',{type:'keyDown',key:'N',control:true,meta:false,alt:false,shift:false}),'new-window');
 assert.equal(shortcutAction('win32',{type:'keyDown',key:'F11',control:false,meta:false,alt:false,shift:false}),'toggle-fullscreen');
});

test('page navigation supports dedicated keys and shift arrows on every platform',()=>{for(const platform of ['darwin','win32','linux'])for(const [key,shift,expected] of [['PageUp',false,'page-previous'],['PageDown',false,'page-next'],['ArrowUp',true,'page-previous'],['ArrowLeft',true,'page-previous'],['ArrowDown',true,'page-next'],['ArrowRight',true,'page-next']])assert.equal(shortcutAction(platform,{type:'keyDown',key,shift}),expected);assert.equal(shortcutAction('darwin',{type:'keyDown',key:'ArrowDown'}),null);});

test('fit shortcuts preserve shifted percentage navigation on every platform',()=>{
 for(const platform of ['darwin','win32','linux']){
  const modifier=platform==='darwin'?{meta:true}:{control:true};
  for(const [digit,action] of [['0','fit-width'],['9','fit-height']]){
   const input={type:'keyDown',key:digit,code:'Digit'+digit,...modifier};
   assert.equal(shortcutAction(platform,input),action);
   assert.equal(shortcutAction(platform,{...input,shift:true}),'percent:'+(digit==='0'?100:90));
   assert.equal(shortcutAction(platform,{...input,alt:true}),null);
   assert.equal(shortcutAction(platform,{type:'keyDown',key:digit}),null);
  }
 }
});

test('serialized menu entries expose numeric paths and preserve nested metadata',()=>{
 const open={id:'file-open',label:'Open PDF…',type:'normal',enabled:true,checked:false,accelerator:'Ctrl+O'};
 const menu={items:[{id:'file-menu',label:'File',type:'submenu',enabled:true,checked:false,accelerator:null,submenu:{items:[{type:'separator'},open]}}]};
 const serialized=serializeApplicationMenu(menu);
 assert.deepEqual(serialized[0].path,[0]);
 assert.equal(serialized[0].id,'file-menu');
 assert.deepEqual(serialized[0].submenu[0].path,[0,0]);
 assert.equal(serialized[0].submenu[0].type,'separator');
 assert.deepEqual(serialized[0].submenu[1],{path:[0,1],id:'file-open',label:'Open PDF…',type:'normal',enabled:true,checked:false,accelerator:'Ctrl+O'});
 assert.equal(menuItemAtPath(menu,[0,1]),open);
 assert.deepEqual(menuPathItems(menu,[0,1]),[menu.items[0],open]);
});
