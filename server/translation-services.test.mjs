import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clearTranslationServiceSchemaCache,cloneTranslationServices,loadTranslationServiceSchema,normalizeTranslationServiceSchema,translationServiceSchemaCacheSize} from '../src/translation-services.mjs';

test('service schemas cache by engine and version and preserve field metadata',async()=>{
 clearTranslationServiceSchemaCache();let calls=0;
 const fetcher=async()=>{calls++;return Response.json({id:'pdf_math_fast',version:'fixture',services:[{id:'302ai',label:'302 AI',fields:[{id:'OPENAI_API_KEY',label:'API key',type:'text',secret:true,required:true},{id:'OPENAI_BASE_URL',label:'Base URL',type:'url',choices:['one'],min:1,max:9,integer:true}]}]});};
 const first=await loadTranslationServiceSchema('pdf_math_fast','fixture',fetcher),second=await loadTranslationServiceSchema('pdf_math_fast','fixture',fetcher);
 assert.equal(calls,1);assert.equal(first,second);assert.equal(first.services[0].id,'302ai');assert.deepEqual(first.services[0].fields[1],{id:'OPENAI_BASE_URL',label:'Base URL',type:'url',secret:false,default:undefined,required:false,choices:['one'],min:1,max:9,integer:true});
 assert.equal(translationServiceSchemaCacheSize(),1);clearTranslationServiceSchemaCache('pdf_math_fast','fixture');
});

test('failed and unavailable catalog probes retry instead of becoming permanent cache entries',async()=>{
 clearTranslationServiceSchemaCache();let failures=0;
 const failing=async()=>{failures++;return Response.json({reason:'Kernel is installing'},{status:200});};
 const first=await loadTranslationServiceSchema('pdf_math_precise','retry',failing),second=await loadTranslationServiceSchema('pdf_math_precise','retry',failing);
 assert.equal(first.reason,'Kernel is installing');assert.equal(second.reason,'Kernel is installing');assert.equal(failures,2);
 let attempts=0;const rejected=async()=>{attempts++;return Response.json({reason:'not ready'},{status:503});};
 await assert.rejects(loadTranslationServiceSchema('pdf_inspector','failure',rejected));await assert.rejects(loadTranslationServiceSchema('pdf_inspector','failure',rejected));assert.equal(attempts,2);
 clearTranslationServiceSchemaCache();
});

test('preference cloning excludes secret-shaped fields while retaining service profiles',()=>{
 const cloned=cloneTranslationServices({pdf_inspector:{id:'openai',values:{OPENAI_BASE_URL:'https://example.test',OPENAI_API_KEY:'secret',model:'fixture'},profiles:{'302ai':{values:{AUTH_KEY:'secret',ACCESS_TOKEN:'secret',model:'302'}}}}});
 assert.deepEqual(cloned,{pdf_inspector:{id:'openai',values:{OPENAI_BASE_URL:'https://example.test',model:'fixture'},profiles:{'302ai':{values:{model:'302'}}}}});
});

test('schema normalization accepts the compact and full provider field id forms',()=>{
 const schema=normalizeTranslationServiceSchema({services:[{id:'fast',fields:[{id:'api_key',type:'string'},{id:'openai_api_key',type:'string'},{id:'model',type:'string'}]}]},'pdf_math_precise');
 assert.deepEqual(schema.services[0].fields.map(field=>field.id),['api_key','openai_api_key','model']);
});
