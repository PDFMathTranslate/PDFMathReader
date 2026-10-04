import assert from 'node:assert/strict';
import {app} from 'electron';
export async function verifyStartup(window){
 const evaluate=code=>window.webContents.executeJavaScript(code);
 const wait=async code=>{for(let i=0;i<300;i++){if(await evaluate(code))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Startup smoke timed out: '+code);};
 await wait('window.previewReady===true');
 const resources=await evaluate('performance.getEntriesByType("resource").map(entry=>entry.name)');
 assert.ok(resources.some(url=>url.endsWith('/api/engines/pdf_inspector')));
 assert.ok(!resources.some(url=>url.endsWith('/api/engines')),'Full kernel discovery blocks startup');
 assert.ok(!resources.some(url=>/\/(AppearanceSettings|AdvancedSettings|TranslationServiceOptions|pdf)-[^/]+\.js$/.test(url)),'Optional code loaded before use');
 const processReadyMs=Math.round(process.uptime()*1000);
 const readyMs=await evaluate('performance.now()');
 await evaluate('window.previewPreferences.save({automatic:false})');
 await evaluate('document.querySelector(".sample-button").click()');
 await wait('document.querySelector(".page canvas")?.width>0 && window.previewRenderDiagnostics?.().metrics.firstPageMs!==null');
 const firstPageMs=await evaluate('performance.now()');
 await evaluate('document.querySelector(\'[aria-label="Translation settings"]\').click()');
 await wait('!!document.querySelector("[data-setting=restore-documents]") && performance.getEntriesByType("resource").some(entry=>/AppearanceSettings-/.test(entry.name))');
 await wait('performance.getEntriesByType("resource").some(entry=>entry.name.endsWith("/api/engines"))');
 console.log('Startup smoke passed',JSON.stringify({processReadyMs,rendererReadyMs:Math.round(readyMs),sampleFirstPageMs:Math.round(firstPageMs-readyMs)}));
 app.exit(0);
}
