// Exercise actual macOS/Windows secure storage, with synthetic keys in a temporary profile.
import {app,safeStorage} from 'electron';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServiceCredentials} from './service-credentials.mjs';
const directory=mkdtempSync(join(tmpdir(),'pdfmathreader-secure-service-'));
app.setPath('userData',directory);
app.whenReady().then(async()=>{
try{
 const path=join(directory,'service-credentials.enc');
 const store=await createServiceCredentials({path,safeStorage});
 await store.save({engine:'pdf_math_fast',service:'openai',values:{api_key:'synthetic-encrypted-service-key'}});
 await store.flush();
 assert.ok(!(await readFile(path)).includes(Buffer.from('synthetic-encrypted-service-key')));
 const reopened=await createServiceCredentials({path,safeStorage});
 assert.deepEqual(await reopened.load({engine:'pdf_math_fast',service:'openai'}),{api_key:'synthetic-encrypted-service-key'});
 await reopened.clear();assert.deepEqual(await reopened.load(),{});
 console.log('Actual Electron safeStorage: encrypt, restart/decrypt, and clear passed.');
 await rm(directory,{recursive:true,force:true});app.exit(0);
}catch(error){console.error(error.message);await rm(directory,{recursive:true,force:true});app.exit(1);}
});
