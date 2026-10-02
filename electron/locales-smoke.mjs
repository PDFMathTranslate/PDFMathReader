import assert from 'node:assert/strict';
import {Menu} from 'electron';
import {menuLabel} from './menu-i18n.mjs';
export async function verifyLocales(window){
 const evaluate=code=>window.webContents.executeJavaScript(code);
 const wait=async code=>{for(let i=0;i<400;i++){if(await evaluate(code))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Locale UI timed out: '+code);};
 for(const locale of ['en','zh-CN','zh-TW','fr','es','ja','ko']){
  await evaluate(`window.previewPreferences.save({uiLanguage:${JSON.stringify(locale)}})`);
  await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload();});
  await wait(`document.documentElement.lang===${JSON.stringify(locale)}&&!!document.querySelector('[data-symbol="gearshape"]')`);
  await evaluate(`document.querySelector('[data-symbol="gearshape"]').closest('button').click()`);
  await wait(`!!document.querySelector('.settings #settings-translation')`);
  assert.equal(await evaluate(`document.querySelectorAll('#source-language-label').length`),1);
  assert.equal(await evaluate(`!!document.querySelector('#source-language-label').nextElementSibling`),true);
  assert.equal((await evaluate(`window.previewPreferences.load()`)).uiLanguage,locale);
  assert.ok(Menu.getApplicationMenu().items.some(item=>item.label===menuLabel('File',locale)));
 }
 console.log('Seven locale UI/menu/reload/persistence checks passed.');window.close();
}
