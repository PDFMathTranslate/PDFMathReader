import assert from 'node:assert/strict';
import {app} from 'electron';
export async function verifyAdvancedCache(window){
 const evaluate=code=>window.webContents.executeJavaScript(code);
 const wait=async code=>{for(let i=0;i<400;i++){if(await evaluate(code))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Advanced cache UI timed out: '+code);};
 await wait('window.previewReady===true');
 await evaluate('document.querySelector(\'[aria-label="Translation settings"]\').click()');
 await wait('!!document.querySelector(".mac-mode-control button")');
 await evaluate('[...document.querySelectorAll(".mac-mode-control button")].find(button=>button.textContent.trim()==="Fast").click()');
 await wait('!document.querySelector(".mac-mode-control button").disabled');
 await wait('!!document.querySelector(".advanced-settings summary")');
 // A delayed schema must leave the rest of Settings interactive.
 await evaluate(`(()=>{const upstream=window.fetch;window.__advancedPending=0;window.fetch=(url,options)=>{if(String(url).endsWith('/advanced')&&window.__advancedPending++<2)return Promise.resolve(new Response(JSON.stringify({id:'pdf_math_fast',options:[],pending:true}),{headers:{'Content-Type':'application/json'}}));return upstream(url,options);};document.querySelector('.advanced-settings summary').click();})()`);
 await wait('window.__advancedPending>=1');
 assert.equal(await evaluate('document.querySelector(".advanced-settings").open'),true);
 assert.equal(await evaluate('document.querySelector(".mac-mode-control button").disabled'),false);
 await evaluate('document.querySelector(".advanced-settings summary").click()');
 assert.equal(await evaluate('document.querySelector(".advanced-settings").open'),false,'Settings can collapse during detection');
 await evaluate('document.querySelector(".advanced-settings summary").click()');
 await wait('document.querySelectorAll(".advanced-option").length>0');
 const result=await evaluate(`fetch('/api/engines/pdf_math_fast/advanced').then(response=>response.json())`);
 assert.equal(result.pending,undefined);assert.ok(result.options.length>0);
 const second=await evaluate(`fetch('/api/engines/pdf_math_fast/advanced').then(response=>response.json())`);
 assert.deepEqual(second,result);
 console.log('Advanced cache UI passed: pending detection leaves controls interactive, collapse cancels polling, cached schema renders and repeats.');
 app.exit(0);
}
