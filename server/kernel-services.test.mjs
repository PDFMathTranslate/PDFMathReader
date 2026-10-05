import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile as execFileCallback} from 'node:child_process';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {promisify} from 'node:util';
import {join,resolve} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {
  buildKernelServiceConfig,
  createKernelServiceCatalog,
} from './kernel-services.mjs';

const execFile=promisify(execFileCallback);
const root=resolve(new URL('..',import.meta.url).pathname);
const appEnginesRoot=join(homedir(),'Library','Application Support','PDFMathReader','engines');
const sourceHelper=join(root,'electron','kernel-services.py');
const installedHelper=join('/Applications','PDFMathReader.app','Contents','Resources','electron','kernel-services.py');
const helper=[installedHelper,sourceHelper].find(existsSync)||sourceHelper;
const sourceFastPython='/Users/rongxin/Developer/oss/PDFMathTranslate/.venv/bin/python';
const sourcePrecisePython='/Users/rongxin/Developer/oss/PDFMathTranslate/pdf2zh/kernel/PDFMathTranslate-next.git/.venv/bin/python';
const fastPython=[join(appEnginesRoot,'pdf_math_fast','bin','python'),sourceFastPython].find(existsSync)||sourceFastPython;
const precisePython=[join(appEnginesRoot,'pdf_math_precise','bin','python'),sourcePrecisePython].find(existsSync)||sourcePrecisePython;
const haveFast=existsSync(fastPython);
const havePrecise=existsSync(precisePython);

function field(id,env,type='string',extra={}){
 return {id,label:id,type,secret:false,default:null,required:false,env,...extra};
}
function fakeCatalog(kernel='pdf_math_fast'){
 return {id:kernel,version:'fixture',services:[{
  id:'openai',label:'OpenAI',fields:[
   field('base_url','OPENAI_BASE_URL','string',{default:'https://api.openai.com/v1'}),
   field('api_key','OPENAI_API_KEY','string',{secret:true,required:true}),
   field('model','OPENAI_MODEL','string',{default:'gpt-4o-mini'}),
   field('stop_tokens','OPENAI_STOP_TOKENS','string',{default:''}),
   field('max_tokens','OPENAI_MAX_TOKENS','number',{default:-1,integer:true,min:-1}),
  ],
 }]};
}
function fakePreciseCatalog(){
 return {id:'pdf_math_precise',version:'fixture',services:[{
  id:'openai',label:'OpenAI',fields:[
   field('openai_model','PDF2ZH_OPENAI_MODEL','string',{default:'gpt-4o-mini'}),
   field('openai_base_url','PDF2ZH_OPENAI_BASE_URL','string'),
   field('openai_api_key','PDF2ZH_OPENAI_API_KEY','string',{secret:true,required:true}),
   field('openai_enable_json_mode','PDF2ZH_OPENAI_ENABLE_JSON_MODE','boolean'),
  ],
 }]};
}
function validProbeCatalog(version='1.0.0'){
 return {id:'pdf_math_fast',version,services:[{
  id:'openai',label:'OpenAI',fields:[field('api_key','OPENAI_API_KEY','string',{secret:true,required:true})],
 }]};
}
async function temporaryDirectory(){return mkdtemp(join(tmpdir(),'kernel-services-test-'));}
async function isolatedPythonEnvironment(){
 const home=await mkdtemp(join(tmpdir(),'kernel-services-python-home-'));
 const temporary=join(home,'tmp');await mkdir(temporary,{recursive:true});
 // Do not inherit user credentials or upstream configuration.  The parser
 // sees only deterministic fixture values; PATH and locale are the only
 // process values retained because the interpreter and Python diagnostics
 // may need them.
 const env={
  PATH:process.env.PATH||'/usr/bin:/bin',LANG:'C',LC_ALL:'C',PYTHONNOUSERSITE:'1',
  HOME:home,TMPDIR:temporary,TMP:temporary,TEMP:temporary,
  PYTHONPYCACHEPREFIX:join(home,'pycache'),
  XDG_CONFIG_HOME:join(home,'.config'),XDG_CACHE_HOME:join(home,'.cache'),
  OPENAI_API_KEY:'fixture-openai-key',OPENAI_BASE_URL:'http://127.0.0.1:9001/v1',OPENAI_MODEL:'fixture-openai-model',
  PDF2ZH_OPENAI_API_KEY:'fixture-pdf2zh-key',PDF2ZH_OPENAI_BASE_URL:'http://127.0.0.1:9001/v1',PDF2ZH_OPENAI_MODEL:'fixture-pdf2zh-model',
 };
 return {home,env};
}
async function realProbe(pythonPath,kernel){
 const isolated=await isolatedPythonEnvironment();
 try{
  const result=await execFile(pythonPath,[helper,kernel],{cwd:isolated.home,env:isolated.env,maxBuffer:4*1024*1024});
  return JSON.parse(result.stdout);
 }finally{await rm(isolated.home,{recursive:true,force:true});}
}
async function pythonJson(pythonPath,source,args=[]){
 const isolated=await isolatedPythonEnvironment();
 try{
  const result=await execFile(pythonPath,['-c',source,...args],{cwd:isolated.home,env:isolated.env,maxBuffer:4*1024*1024});
  return JSON.parse(result.stdout);
 }finally{await rm(isolated.home,{recursive:true,force:true});}
}

test('catalog probes lazily, deduplicates concurrent work, and reuses memory and disk by version',async()=>{
 const directory=await temporaryDirectory();
 try{
  let calls=0,checks=0,version='1.0.0';
  const runExec=async(_file,_args,options)=>{
   calls++;
   assert.notEqual(options.env.HOME,process.env.HOME);
   assert.equal(options.env.XDG_CONFIG_HOME,join(options.env.HOME,'.config'));
   assert.equal(options.cwd,options.env.HOME);
   return {stdout:JSON.stringify(validProbeCatalog(version)),stderr:''};
  };
  const make=appVersion=>createKernelServiceCatalog({
   root:directory,pythonResourcesPath:root,runExec,python:()=>'/fixture/python',
   check:async()=>{checks++;return {available:true,version}},appVersion,
  });
  const first=make('app-1');
  const [a,b]=await Promise.all([first.get('pdf_math_fast'),first.get('pdf_math_fast')]);
  assert.deepEqual(a,b);
  assert.equal(calls,1,'concurrent callers should share one probe');
  assert.equal(checks,1,'pending lookup should also share one version check');
  assert.deepEqual(await first.get('pdf_math_fast'),a);
  assert.equal(calls,1,'memory cache should avoid a second probe');

  const second=make('app-1');
  assert.deepEqual(await second.get('pdf_math_fast'),a);
  assert.equal(calls,1,'same app and installed version should reuse disk cache');

  const changedApp=make('app-2');
  await changedApp.get('pdf_math_fast');
  assert.equal(calls,2,'app version is part of the disk cache identity');

  version='2.0.0';
  await changedApp.get('pdf_math_fast');
  assert.equal(calls,3,'a newly installed version must bypass the previous cache');
  await changedApp.invalidate('pdf_math_fast');
  assert.equal(existsSync(join(directory,'.translation-services','pdf_math_fast.json')),false);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('catalog invalidation forces a reinstall probe and failed probes can be retried',async()=>{
 const directory=await temporaryDirectory();
 try{
  let calls=0,fail=true;
  const catalog=createKernelServiceCatalog({
   root:directory,pythonResourcesPath:root,python:()=>'/fixture/python',
   check:async()=>({available:true,version:'1.0.0'}),
   runExec:async()=>{calls++;if(fail){fail=false;throw Error('fixture probe failed');}return {stdout:JSON.stringify(validProbeCatalog()),stderr:''};},
  });
  await assert.rejects(catalog.get('pdf_math_fast'),/fixture probe failed/);
  assert.deepEqual((await catalog.get('pdf_math_fast')).services.map(service=>service.id),['openai']);
  assert.equal(calls,2,'a rejected probe must not poison the lazy cache');
  await catalog.invalidate('pdf_math_fast');
  await catalog.get('pdf_math_fast');
  assert.equal(calls,3,'invalidate removes both memory and disk entries');
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('Fast configuration maps compact fields to exact env keys and excludes secrets from cache identity',()=>{
 const config=buildKernelServiceConfig('pdf_math_fast',{id:'openai',values:{
  api_key:'fixture-secret',base_url:'http://127.0.0.1:9001/v1',model:'fixture-model',stop_tokens:'{v0}',max_tokens:128,
 }},fakeCatalog());
 assert.deepEqual(config.args,['-s','openai:fixture-model']);
 assert.equal(config.env.OPENAI_API_KEY,'fixture-secret');
 assert.equal(config.env.OPENAI_BASE_URL,'http://127.0.0.1:9001/v1');
 assert.equal(config.env.OPENAI_MODEL,'fixture-model');
 assert.equal(config.env.OPENAI_STOP_TOKENS,'{v0}');
 assert.equal(config.env.OPENAI_MAX_TOKENS,'128');
 assert.deepEqual(config.secrets,['fixture-secret']);
 assert.equal(JSON.stringify(config.cacheIdentity).includes('fixture-secret'),false);
 assert.deepEqual(config.cacheIdentity,{service:'openai',values:{base_url:'http://127.0.0.1:9001/v1',model:'fixture-model',stop_tokens:'{v0}',max_tokens:128}});
});

test('Precise configuration uses the parser provider flag and PDF2ZH env destinations',()=>{
 const config=buildKernelServiceConfig('pdf_math_precise',{id:'openai',values:{
  openai_api_key:'fixture-secret',openai_base_url:'http://127.0.0.1:9001/v1',openai_model:'fixture-model',openai_enable_json_mode:false,
 }},fakePreciseCatalog());
 assert.deepEqual(config.args,['--openai']);
 assert.equal(config.env.PDF2ZH_OPENAI_API_KEY,'fixture-secret');
 assert.equal(config.env.PDF2ZH_OPENAI_BASE_URL,'http://127.0.0.1:9001/v1');
 assert.equal(config.env.PDF2ZH_OPENAI_MODEL,'fixture-model');
 assert.equal(config.env.PDF2ZH_OPENAI_ENABLE_JSON_MODE,'false');
 assert.deepEqual(config.secrets,['fixture-secret']);
 assert.equal(JSON.stringify(config.cacheIdentity).includes('fixture-secret'),false);
});

test('configuration validates required fields, values, choices, bounds, URLs, and unknown fields',()=>{
 const catalog={id:'pdf_math_fast',version:'fixture',services:[{id:'fixture',label:'Fixture',fields:[
  field('api_key','FIXTURE_API_KEY','string',{secret:true,required:true}),
  field('mode','FIXTURE_MODE','string',{choices:['yes','no'],default:'yes'}),
  field('count','FIXTURE_COUNT','number',{integer:true,min:1,max:3}),
  field('enabled','FIXTURE_ENABLED','boolean'),
  field('base_url','FIXTURE_BASE_URL','string',{default:'https://example.test'}),
 ]}]};
 const config=buildKernelServiceConfig('pdf_math_fast',{id:'fixture',values:{api_key:'key',mode:'no',count:2,enabled:false}},catalog);
 assert.equal(config.env.FIXTURE_COUNT,'2');
 assert.equal(config.env.FIXTURE_ENABLED,'false');
  assert.throws(()=>buildKernelServiceConfig('pdf_math_fast',{id:'fixture',values:{}},catalog),/api_key is required/);
 assert.throws(()=>buildKernelServiceConfig('pdf_math_fast',{id:'fixture',values:{api_key:'key',mode:'maybe'}},catalog),/Invalid choice/);
 assert.throws(()=>buildKernelServiceConfig('pdf_math_fast',{id:'fixture',values:{api_key:'key',count:4}},catalog),/Invalid numeric/);
 assert.throws(()=>buildKernelServiceConfig('pdf_math_fast',{id:'fixture',values:{api_key:'key',enabled:'false'}},catalog),/must be a boolean/);
 assert.throws(()=>buildKernelServiceConfig('pdf_math_fast',{id:'fixture',values:{api_key:'key',base_url:'file:///tmp'}},catalog),/Invalid URL/);
 assert.throws(()=>buildKernelServiceConfig('pdf_math_fast',{id:'fixture',values:{api_key:'key',unknown:'x'}},catalog),/Unknown translation service field/);
});

test('real Fast schema matches every converter-selectable provider and every upstream env field',{skip:!haveFast?'Fast upstream virtualenv is unavailable':false},async()=>{
 const schema=await realProbe(fastPython,'pdf_math_fast');
 const upstream=await pythonJson(fastPython,`import ast,inspect,json,textwrap
import pdf2zh.converter as c
import pdf2zh.translator as t
tree=ast.parse(textwrap.dedent(inspect.getsource(c.TranslateConverter.__init__)))
names=[]
for node in ast.walk(tree):
 if isinstance(node,ast.For) and isinstance(node.iter,(ast.List,ast.Tuple)):
  names=[x.id for x in node.iter.elts if isinstance(x,ast.Name)]
  if names: break
items=[]
for name in names:
 cls=getattr(c,name,getattr(t,name,None))
 if cls is not None: items.append({'id':cls.name,'envs':list(getattr(cls,'envs',{}))})
print(json.dumps(items))`);
 assert.deepEqual(schema.services.map(service=>service.id),upstream.map(service=>service.id));
 for(const expected of upstream){
  const actual=schema.services.find(service=>service.id===expected.id);
  assert.ok(actual,expected.id);
  assert.deepEqual(actual.fields.map(field=>field.env),expected.envs,expected.id);
  assert.equal(new Set(actual.fields.map(field=>field.id)).size,actual.fields.length,expected.id+' field ids');
  for(const field of actual.fields){
   assert.equal(typeof field.env,'string');
   assert.equal(field.id,field.id.toLowerCase(),`${expected.id} should use compact field ids`);
  }
 }
 const openai=schema.services.find(service=>service.id==='openai');
 assert.equal(openai.fields.find(field=>field.env==='OPENAI_STOP_TOKENS').secret,false);
 assert.equal(openai.fields.find(field=>field.env==='OPENAI_MAX_TOKENS').secret,false);
});

test('real Precise schema matches metadata, excludes unsupported providers, and every emitted flag is an accepted parser option',{skip:!havePrecise?'Precise upstream virtualenv is unavailable':false},async()=>{
 const schema=await realProbe(precisePython,'pdf_math_precise');
 const schemaPath=join(await temporaryDirectory(),'precise-schema.json');
 try{
  const {writeFile}=await import('node:fs/promises');
  await writeFile(schemaPath,JSON.stringify(schema));
  const upstream=await pythonJson(precisePython,`import json,sys
from pdf2zh_next.config.main import build_args_parser
from pdf2zh_next.config.translate_engine_model import TRANSLATION_ENGINE_METADATA,NOT_SUPPORTED_TRANSLATION_ENGINE_SETTING_TYPE
parser,_=build_args_parser()
actions={a.dest:a for a in parser._actions}
unsupported=NOT_SUPPORTED_TRANSLATION_ENGINE_SETTING_TYPE
items=[]
for entry in TRANSLATION_ENGINE_METADATA:
 model=entry.setting_model_type
 if entry.cli_flag_name == 'siliconflowfree': continue
 if unsupported not in (None,type(None)):
  try:
   if model is unsupported or isinstance(model(),unsupported): continue
  except (TypeError,ValueError): pass
 if entry.cli_flag_name not in actions or '--'+entry.cli_flag_name not in actions[entry.cli_flag_name].option_strings: continue
 fields=[]
 for field_id in model.model_fields:
  if field_id in ('translate_engine_type','support_llm'): continue
  flag='--'+field_id.replace('_','-')
  if field_id in actions and flag in actions[field_id].option_strings: fields.append({'id':field_id,'flag':flag})
 items.append({'id':entry.cli_flag_name,'fields':fields})
print(json.dumps(items))`,[schemaPath]);
  assert.deepEqual(schema.services.map(service=>service.id),upstream.map(service=>service.id));
  assert.equal(schema.services.some(service=>service.id==='siliconflowfree'),false);
  for(const expected of upstream){
   const actual=schema.services.find(service=>service.id===expected.id);
   assert.ok(actual,expected.id);
   assert.deepEqual(actual.fields.map(field=>({id:field.id,flag:field.flag})),expected.fields,expected.id+' parser fields');
   for(const field of actual.fields){
    assert.equal(field.env,'PDF2ZH_'+field.id.toUpperCase());
    assert.equal(field.flag,'--'+field.id.replaceAll('_','-'));
   }
  }
  const openai=schema.services.find(service=>service.id==='openai');
  assert.ok(openai.fields.some(field=>field.id==='openai_api_key'&&field.required&&field.secret));
  assert.ok(openai.fields.some(field=>field.id==='openai_enable_json_mode'&&field.type==='boolean'));
 }finally{await rm(resolve(schemaPath,'..'),{recursive:true,force:true});}
});
