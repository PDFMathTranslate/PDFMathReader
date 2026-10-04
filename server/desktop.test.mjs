import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from './index.mjs';
test('desktop backend has private origin, authenticates API, and releases its port',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'preview-backend-'));
 const backend=await startServer({port:0,development:false,cacheDir:dir,token:'test-only-token'});
 try{
  assert.equal((await fetch(backend.origin+'/api/config')).status,403);
  const headers={'X-Preview-Token':'test-only-token'};
  assert.equal((await fetch(backend.origin+'/api/config',{headers})).status,200);
  assert.equal((await fetch(backend.origin+'/api/config',{headers:{...headers,Origin:'https://example.com'}})).status,403);
 }finally{await backend.close();await rm(dir,{recursive:true,force:true});}
 await assert.rejects(fetch(backend.origin));
});
