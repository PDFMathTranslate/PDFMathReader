import assert from 'node:assert/strict';
import test from 'node:test';
import {windowChromeOptions,commandAccelerator,closeWindowAccelerator,shortcutAction} from '../electron/window-chrome.mjs';

test('window chrome keeps the macOS inset and vibrancy policy exact',()=>{
 assert.deepEqual(windowChromeOptions('darwin'),{titleBarStyle:'hiddenInset',trafficLightPosition:{x:18,y:24},vibrancy:'sidebar',visualEffectState:'active',backgroundColor:'#00000000'});
});

test('Windows and Linux use opaque native titlebars',()=>{
 for(const platform of ['win32','linux']){
  const options=windowChromeOptions(platform);
  assert.equal(options.titleBarStyle,undefined);
  assert.equal(options.trafficLightPosition,undefined);
  assert.equal(options.vibrancy,undefined);
  assert.equal(options.visualEffectState,undefined);
  assert.match(options.backgroundColor,/^#[\da-f]{6}$/i);
 }
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
});
