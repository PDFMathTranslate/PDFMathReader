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
