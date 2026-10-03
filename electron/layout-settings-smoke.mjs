import assert from 'node:assert/strict';
import {app} from 'electron';
export async function verifyLayoutSettings(window){
 const evaluate=code=>window.webContents.executeJavaScript(code);
 const wait=async code=>{for(let n=0;n<200;n++){try{if(await evaluate(code))return;}catch{}await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Layout settings timed out: '+code);};
 const open=async()=>{window.show();window.focus();await new Promise(resolve=>setTimeout(resolve,150));await wait('window.previewReady===true');await evaluate(`if(!document.querySelector('.settings'))document.querySelector('.toolbar-actions fluent-button:last-child').click()`);await wait(`!!document.querySelector('.settings .mac-mode-control')`);};
 await wait('window.previewReady===true');
 await evaluate(`window.previewPreferences.save({engine:'pdf_math_precise',translationMode:'reading',interactionMode:'comparison',sourceLanguage:'Japanese',pageConcurrency:7,reduceMotion:true,kernelAdvancedOptions:{pdf_math_fast:{},pdf_math_precise:{custom_system_prompt:'Keep mathematics unchanged'}}})`);
 await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload();});
 await wait(`window.previewReady===true`);
 await new Promise(resolve=>setTimeout(resolve,600));
 const expected=await evaluate('window.previewPreferences.load()');
 for(const direction of ['horizontal','vertical']){
  await evaluate(`(async()=>{const menu=await window.previewWindow.menu();const find=items=>{for(const item of items){if(item.id==='layout-${direction}')return item.path;const path=item.submenu&&find(item.submenu);if(path)return path;}};await window.previewWindow.menuAction(find(menu));})()`);
  await wait(`(async()=> (await window.previewPreferences.load()).direction==='${direction}')()`);
  await open();
  await new Promise(resolve=>setTimeout(resolve,300));
  const actual=await evaluate('window.previewPreferences.load()');
  for(const key of ['engine','translationMode','interactionMode','sourceLanguage','pageConcurrency','reduceMotion','kernelAdvancedOptions'])assert.deepEqual(actual[key],expected[key],key+' survives layout and settings remount');
  await evaluate(`document.querySelector('.settings-heading fluent-button').click()`);
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 await open();
 await wait(`!document.querySelector('.mac-mode-control').disabled`);
 await evaluate(`document.querySelector('.mac-mode-control fluent-tab[data-segment-value="pdf_math_fast"]').click()`);
 await wait(`(async()=> (await window.previewPreferences.load()).engine==='pdf_math_fast')()`);
 await wait(`!!document.querySelector('.mac-mode-control')&&!document.querySelector('.mac-mode-control').disabled`);
 await evaluate(`document.querySelector('.mac-mode-control fluent-tab[data-segment-value="pdf_math_fast"]').focus()`);
 window.webContents.sendInputEvent({type:'keyDown',keyCode:'Right'});window.webContents.sendInputEvent({type:'keyUp',keyCode:'Right'});
 await wait(`(async()=> (await window.previewPreferences.load()).engine==='pdf_math_precise')()`);
 console.log('Layout regression passed: saved kernel, modes and advanced settings survive remount; mouse and keyboard kernel selection still work.');
 app.quit();
}
