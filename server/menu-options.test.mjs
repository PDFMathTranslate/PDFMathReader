import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configuredMenuServices} from '../src/menu-options.mjs';
test('native provider menu excludes incomplete profiles and never exposes credentials',()=>{
 const schema={services:[{id:'auto',label:'Automatic',fields:[]},{id:'apple-local',label:'Apple',fields:[]},{id:'openai',label:'OpenAI',fields:[{id:'key',secret:true,required:true},{id:'model',required:true,default:'default-model'}]},{id:'custom',label:'Custom',fields:[{id:'url',required:true}]}]};
 assert.deepEqual(configuredMenuServices(schema).map(x=>x.value),['auto','apple-local']);
 const config={id:'custom',values:{url:' '},profiles:{openai:{values:{model:'saved-model'}}}},credentials={openai:{key:'private-fixture'}};
 assert.deepEqual(configuredMenuServices(schema,config,credentials),[{value:'auto',label:'Automatic'},{value:'apple-local',label:'Apple'},{value:'openai',label:'OpenAI'}]);
 config.values.url='https://example.test';assert.equal(configuredMenuServices(schema,config,credentials).at(-1).value,'custom');
 assert(!JSON.stringify(configuredMenuServices(schema,config,credentials)).includes('private-fixture'));
 assert(!configuredMenuServices(schema,config,{}).some(x=>x.value==='openai'));
});
