import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCredentials} from '../electron/credentials.mjs';
test('credential override, reload, clearing and secure-storage failure',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'credential-unit-')),path=join(dir,'key.enc');
 const storage={isEncryptionAvailable:()=>true,isAsyncEncryptionAvailable:async()=>true,encryptStringAsync:async s=>Buffer.from(s.split('').reverse().join('')),decryptStringAsync:async b=>({result:b.toString().split('').reverse().join('')})};
 try{
  const c=await createCredentials({path,safeStorage:storage,platform:'darwin',environment:()=> 'synthetic-env'});
  assert.equal(c.status().keySource,'environment');
  await c.save('synthetic-saved');assert.equal(c.getKey(),'synthetic-saved');
  assert.equal(JSON.stringify(c.status()).includes('synthetic-saved'),false);
  const reload=await createCredentials({path,safeStorage:storage,platform:'darwin',environment:()=>''});
  assert.equal(reload.getKey(),'synthetic-saved');
  await c.clear();assert.equal(c.getKey(),'');assert.equal(c.status().keySource,'none');const clearedReload=await createCredentials({path,safeStorage:storage,platform:'darwin',environment:()=> 'synthetic-env'});assert.equal(clearedReload.getKey(),'');await clearedReload.save('replacement');assert.equal(clearedReload.getKey(),'replacement');await clearedReload.clear();await assert.rejects(readFile(path));
  const unavailable=await createCredentials({path,safeStorage:{isEncryptionAvailable:()=>false},platform:'darwin',environment:()=>''});
  await assert.rejects(unavailable.save('synthetic'),/unavailable/);await assert.rejects(readFile(path));
  assert.equal(unavailable.status().keySource,'none');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Windows keys use system encryption, survive replacement and reload, and never save plaintext',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'credential-windows-')),path=join(dir,'key.enc');
 const storage={isEncryptionAvailable:()=>true,encryptString:key=>Buffer.from('encrypted:'+Buffer.from(key).toString('base64')),decryptString:bytes=>Buffer.from(bytes.toString().slice(10),'base64').toString()};
 try{
  const options={path,safeStorage:storage,platform:'win32',environment:()=>''};
  const credentials=await createCredentials(options);
  assert.equal(credentials.status().keyStorageAvailable,true);
  await credentials.save('windows-test-key');
  assert.equal((await readFile(path)).includes(Buffer.from('windows-test-key')),false);
  assert.equal((await createCredentials(options)).getKey(),'windows-test-key');
  await credentials.save('replacement-key');
  assert.equal((await createCredentials(options)).getKey(),'replacement-key');
  assert.equal(JSON.stringify(credentials.status()).includes('replacement-key'),false);
  const unavailable=await createCredentials({...options,safeStorage:{isEncryptionAvailable:()=>false}});
  await assert.rejects(unavailable.save('rejected-key'),/Windows secure storage is unavailable/);
  assert.equal((await createCredentials(options)).getKey(),'replacement-key');
  const broken=await createCredentials({...options,safeStorage:{...storage,encryptString:()=>{throw Error('failure');}}});
  await assert.rejects(broken.save('rejected-key'),/Windows could not encrypt/);
  assert.equal((await createCredentials(options)).getKey(),'replacement-key');
  await credentials.clear();
  assert.equal((await createCredentials(options)).getKey(),'');
  await assert.rejects(readFile(path),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
