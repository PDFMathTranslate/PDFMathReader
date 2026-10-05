import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createDeveloperDiagnostics,redactArgv,redactDiagnosticText,summarizeStdinCommand} from './developer-diagnostics.mjs';
import {createKernelProcesses,parseCpuDuration} from './kernel-processes.mjs';

test('developer diagnostics are opt in, bounded, and clear on disable',()=>{
 const diagnostics=createDeveloperDiagnostics({maxEvents:2,now:()=>0,secrets:()=>['live-api-key']});
 diagnostics.record({kind:'before-enable',message:'live-api-key'});
 assert.equal(diagnostics.snapshot().enabled,false);
 diagnostics.setEnabled(true);
 diagnostics.record({kind:'one',kernel:'pdf_math_fast',pid:7,message:"password='very secret phrase' key=live-api-key"});
 diagnostics.record({kind:'two',message:'second'});
 diagnostics.record({kind:'three',message:'third'});
 const snapshot=diagnostics.snapshot({processesStatus:{available:false,reason:'live-api-key was not passed to ps'}});
 assert.equal(snapshot.enabled,true);
 assert.equal(snapshot.events.length,2);
 assert.match(snapshot.events[0].message,/second/);
 assert.match(snapshot.events[1].message,/third/);
 assert.ok(snapshot.events.every(event=>!event.message.includes('live-api-key')));
 assert.ok(!JSON.stringify(snapshot).includes('live-api-key'));
 diagnostics.setEnabled(false);
 assert.deepEqual(diagnostics.snapshot().events,[]);
 assert.deepEqual(diagnostics.snapshot().tasks,[]);
});

test('redaction covers quoted values, generic CLI keys, and stdin payload metadata',()=>{
 const secret='very secret phrase';
 assert.equal(redactDiagnosticText(`password='${secret}' key=${secret}`,{secrets:[secret]}),"password=[redacted] key=[redacted]");
 assert.equal(redactDiagnosticText('{"content":"escaped \\"quoted\\" words"}'),'{"content":[redacted]}');
 assert.deepEqual(redactArgv('/usr/bin/python',['--key',secret,'--token=another-secret'],{secrets:['another-secret']}),['/usr/bin/python','--key','[redacted]','--token=[redacted]']);
 const summary=summarizeStdinCommand(JSON.stringify({text:secret,token:'another-secret',source:'en',target:'fr'}));
 assert.match(summary,/keys=source,target/);
 assert.doesNotMatch(summary,/very secret phrase|another-secret/);
});

test('kernel stream events buffer lines across chunks and never expose split secrets',async()=>{
 const secret='split-secret-value';
 const diagnostics=createDeveloperDiagnostics({secrets:[secret]});diagnostics.setEnabled(true);
 const processes=createKernelProcesses({onEvent:event=>diagnostics.record(event)});
 const child=processes.spawn(process.execPath,['-e',`process.stdout.write("password='split-");setTimeout(()=>process.stdout.write("secret-value'\\n"),10);process.stdin.resume();`],{stdio:['pipe','pipe','pipe']},{kernel:'fixture',name:'fixture-kernel',secrets:[secret]});
 child.stdin.end(JSON.stringify({text:secret,token:secret})+'\n');
 await once(child,'close');
 const messages=diagnostics.snapshot().events.map(event=>event.message).join('\n');
 assert.doesNotMatch(messages,/split-secret-value/);
 assert.match(messages,/password=\[redacted\]/);
 assert.match(messages,/stdin command json/);
 await processes.close();
});

test('kernel process sampling reports command, role, RSS, and interval CPU deltas',async()=>{
 assert.ok(Math.abs(parseCpuDuration('1:23.45')-83.45)<0.001);
 assert.equal(parseCpuDuration('02:03:04'),7384);
 assert.equal(parseCpuDuration('1-02:03:04'),93784);
 let clock=1000;
 let child,sample=0;
 const processes=createKernelProcesses({now:()=>clock,execImpl:async(file)=>{
  assert.equal(file,'ps');
  sample++;
  return {stdout:`${child.pid} ${process.pid} ${sample===1?'00:01.00':'00:01.50'} 20 S fixture\n`};
 }});
 child=processes.spawn(process.execPath,['-e','setInterval(()=>{},1000)','--key','hidden'],{stdio:'ignore'},{kernel:'fixture',name:'fixture-kernel',secrets:['hidden']});
 await once(child,'spawn');
 const first=await processes.snapshot();
 assert.equal(first.available,true);
 assert.equal(first.processes.length,1);
 assert.equal(first.processes[0].role,'kernel');
 assert.equal(first.processes[0].cpuPercent,null);
 assert.equal(first.processes[0].cpuPercentBasis,'interval');
 assert.ok(first.processes[0].command.includes('--key'));
 assert.ok(!first.processes[0].command.includes('hidden'));
 clock=2000;
 const second=await processes.snapshot();
 assert.equal(second.processes[0].cpuPercent,50);
 await processes.close();
});

test('carriage-return progress output is visible before process exit',async()=>{
 const events=[];
 const processes=createKernelProcesses({onEvent:event=>events.push(event)});
 const child=processes.spawn(process.execPath,['-e',`process.stdout.write('progress 10%\\rprogress 20%\\r');setTimeout(()=>{},2000);`],{stdio:['ignore','pipe','pipe']},{kernel:'fixture'});
 try{
  for(let n=0;n<50&&!events.some(event=>event.message==='progress 20%');n++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(events.some(event=>event.message==='progress 10%'));
  assert.ok(events.some(event=>event.message==='progress 20%'));
  assert.equal(child.exitCode,null);
 }finally{await processes.close();}
});

test('developer API shows real queued work and excludes credentials, payloads, and its own polling',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');
 const {join}=await import('node:path');const {tmpdir}=await import('node:os');
 const {startServer}=await import('./index.mjs');
 const directory=await mkdtemp(join(tmpdir(),'developer-api-'));
 const backend=await startServer({port:0,development:false,token:'developer-test-token',cacheDir:directory,getApiKey:()=> 'developer-secret-fixture',providerFetch:async()=>{await new Promise(resolve=>setTimeout(resolve,300));return Response.json({choices:[{message:{content:'Fixture translation'}}]});}});
 const headers={'X-Preview-Token':'developer-test-token','Content-Type':'application/json'};
 const read=async()=>{const response=await fetch(backend.origin+'/api/developer/snapshot',{headers});assert.equal(response.status,200);return response.json();};
 const enable=enabled=>fetch(backend.origin+'/api/developer/enabled',{method:'POST',headers,body:JSON.stringify({enabled})});
 try{
  assert.equal((await read()).enabled,false);
  assert.equal((await fetch(backend.origin+'/api/developer/snapshot')).status,403);
  assert.equal((await fetch(backend.origin+'/api/developer/enabled',{method:'POST',headers,body:'{"enabled":"yes"}'})).status,400);
  await enable(true);
  const translations=[1,2].map(index=>fetch(backend.origin+'/api/translate',{method:'POST',headers,body:JSON.stringify({text:'private source fixture '+index,language:'French',concurrency:1,reuseTranslations:false})}));
  let live;
  for(let n=0;n<50;n++){live=await read();if(live.tasks.some(task=>task.state==='queued')&&live.tasks.some(task=>task.state==='running'))break;await new Promise(resolve=>setTimeout(resolve,10));}
  assert.ok(live.tasks.some(task=>task.state==='queued'));
  assert.ok(live.tasks.some(task=>task.state==='running'));
  assert.deepEqual((await Promise.all(translations)).map(response=>response.status),[200,200]);
  const finished=await read();
  assert.equal(finished.tasks.length,0);
  assert.ok(finished.events.some(event=>event.kind==='http-request'&&event.kernel==='pdf_inspector'));
  assert.ok(finished.events.some(event=>event.kind==='http-response'&&event.message.includes('status=200')));
  assert.ok(!finished.events.some(event=>event.message.includes('/api/developer/')));
  assert.doesNotMatch(JSON.stringify(finished),/developer-secret-fixture|private source fixture/);
  await enable(false);assert.deepEqual((await read()).events,[]);
 }finally{await backend.close();await rm(directory,{recursive:true,force:true});}
});

test('oversized partial output is discarded without exposing credential fragments',async()=>{
 const events=[];
 const processes=createKernelProcesses({onEvent:event=>events.push(event)});
 const child=processes.spawn(process.execPath,['-e',`process.stdout.write('x'.repeat(65540)+'credential-part-');setTimeout(()=>process.stdout.write('two\\nnormal output\\n'),20);`],{stdio:['ignore','pipe','pipe']},{kernel:'fixture',secrets:['credential-part-two']});
 try{
  await once(child,'close');
  const output=events.filter(event=>event.kind==='kernel-stdout').map(event=>event.message).join('\n');
  assert.match(output,/oversized output line omitted/);
  assert.match(output,/normal output/);
  assert.doesNotMatch(output,/credential-part|two/);
 }finally{await processes.close();}
});
