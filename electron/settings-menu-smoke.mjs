import assert from 'node:assert/strict';
import {app} from 'electron';
export async function verifySettingsMenu(reader,windows){
 const evaluate=(target,code)=>target.webContents.executeJavaScript(code);
 const wait=async predicate=>{for(let n=0;n<240;n++){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Settings menu timed out');};
 await wait(()=>evaluate(reader,'window.previewReady===true'));reader.show();reader.focus();
 const state=()=>windows.get(reader);
 await wait(()=>state().menuOptions?.provider?.options.some(x=>x.value==='auto'));
 assert.deepEqual(state().menuOptions.engine.options.map(x=>x.label),['Ultra fast','Fast','Precise']);
 assert(!state().menuOptions.provider.options.some(x=>x.value==='openai'),'unconfigured provider excluded');
 const choose=async(target,group,value)=>{
  await wait(()=>windows.get(target).menuOptions?.[group]?.options.some(x=>x.value===value));
  const index=windows.get(target).menuOptions[group].options.findIndex(x=>x.value===value);
  await evaluate(target,`window.previewWindow.menuAction(['translation-menu','translation-options-${group}','translation-choice-${group}-${index}'])`);
  await wait(()=>windows.get(target).menuOptions[group].selected===value);
 };
 await choose(reader,'language','Japanese');assert.equal(state().preferences.language,'Japanese');
 await choose(reader,'sourceLanguage','French');assert.equal(state().preferences.sourceLanguage,'French');
 await choose(reader,'engine','pdf_math_fast');assert.equal(state().preferences.engine,'pdf_math_fast');
 assert.equal(state().menuOptions.language.options.length,10,'language list follows Fast kernel');
 await choose(reader,'engine','pdf_inspector');
 await evaluate(reader,`window.previewPreferences.save({translationServices:{pdf_inspector:{id:'auto',values:{},profiles:{openai:{values:{model:'saved-menu-model'}}}}}})`);
 // Preference writes notify other renderers; use settings window for independent activation.
 await evaluate(reader,`window.previewWindow.settings('providers')`);
 await wait(()=>windows.size===2);
 const settings=[...windows.keys()].find(x=>windows.get(x).settingsOwner===reader);
 await wait(()=>evaluate(settings,'window.previewReady===true'));settings.show();settings.focus();
 await evaluate(settings,`window.previewServiceCredentials.save({engine:'pdf_inspector',service:'openai',values:{key:'menu-smoke-placeholder'}})`);
 await wait(()=>windows.get(settings).menuOptions.provider.options.some(x=>x.value==='openai'));
 assert(!JSON.stringify(windows.get(settings).menuOptions).includes('menu-smoke-placeholder'));
 await choose(settings,'provider','openai');
 await wait(()=>state().preferences.translationServices.pdf_inspector.id==='openai');
 assert.equal(state().preferences.translationServices.pdf_inspector.values.model,'saved-menu-model','provider activation restores saved profile');
 await evaluate(settings,`window.previewServiceCredentials.clear({engine:'pdf_inspector',service:'openai'})`);
 await wait(()=>!windows.get(settings).menuOptions.provider.options.some(x=>x.value==='openai'));
 await choose(settings,'provider','auto');
 await choose(settings,'uiLanguage','zh-CN');
 const menu=await evaluate(settings,'window.previewWindow.menu()');
 assert.equal(menu.find(x=>x.id==='translation-menu').label,'翻译');
 assert.equal(menu.find(x=>x.id==='translation-menu').submenu.find(x=>x.id==='translation-options-provider').label,'服务提供商');
 settings.close();await wait(()=>settings.isDestroyed());reader.focus();
 await wait(()=>state().menuOptions.uiLanguage.selected==='zh-CN');
 const current=await evaluate(reader,'window.previewWindow.menu()');
 assert.equal(current.find(x=>x.id==='translation-menu').submenu.find(x=>x.id==='translation-options-language').submenu.filter(x=>x.checked).length,1);
 console.log('Settings menu passed: real kernel/language choices, credential filtering, saved provider profile activation, live settings synchronization, localization and radio state.');app.quit();
}
