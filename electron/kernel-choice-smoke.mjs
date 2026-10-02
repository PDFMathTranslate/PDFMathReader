import assert from 'node:assert/strict';
import {BrowserWindow,Menu} from 'electron';
export async function verifyKernelChoice(window){
 const evaluate=(target,code)=>target.webContents.executeJavaScript(code);
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function wait(target,code){for(let n=0;n<200;n++){try{if(await evaluate(target,code))return;}catch{}await pause(50);}throw Error('Kernel preference UI timed out: '+code);}
 async function open(target){target.show();target.focus();await wait(target,`!!document.querySelector('[aria-label="Translation settings"]')`);await evaluate(target,`(()=>{const b=document.querySelector('[aria-label="Translation settings"]');b.focus();if(!document.querySelector('.settings'))b.click();})()`);await wait(target,`!!document.querySelector('.kernel-switcher button')`);}
 for(const [id,label] of [['pdf_math_fast','Fast'],['pdf_math_precise','Precise'],['pdf_inspector','Ultra fast']]){
  await open(window);await wait(window,`!document.querySelector('.kernel-switcher button').disabled`);
  await evaluate(window,`(()=>{const b=[...document.querySelectorAll('.kernel-switcher button')].find(b=>b.textContent===${JSON.stringify(label)});b.focus();b.click();})()`);
  await wait(window,`(async()=>{const p=await window.previewPreferences.load();return p.engine===${JSON.stringify(id)};})()`);
  await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload();});
  await open(window);await wait(window,`document.querySelector('.kernel-switcher button[aria-checked="true"]')?.textContent===${JSON.stringify(label)}`);
  assert.equal((await evaluate(window,'window.previewPreferences.load()')).engine,id);
  if(id==='pdf_math_precise'){
   const existing=new Set(BrowserWindow.getAllWindows());const menu=Menu.getApplicationMenu().items.find(item=>item.label==='File').submenu.items.find(item=>item.label==='New Window');menu.click();let other;for(let n=0;n<200&&!other;n++){other=BrowserWindow.getAllWindows().find(item=>!existing.has(item));await pause(50);}assert.ok(other);await open(other);await wait(other,`document.querySelector('.kernel-switcher button[aria-checked="true"]')?.textContent==='Precise'`);other.close();
  }
 }
 console.log('Kernel choice: all three selections persisted across reload; Precise restored in a new window.');window.close();
}
