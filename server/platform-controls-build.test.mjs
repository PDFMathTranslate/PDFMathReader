import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';

test('Windows adapter does not statically depend on its awaiting platform module',async()=>{
 const result=await build({build:{write:false},logLevel:'silent'});
 const chunks=result.output.filter(item=>item.type==='chunk');
 const platform=chunks.find(chunk=>Object.keys(chunk.modules).some(id=>id.endsWith('/src/platform-controls.mjs')));
 const fluent=chunks.find(chunk=>Object.keys(chunk.modules).some(id=>id.endsWith('/src/platform-controls/fluent-windows.mjs')));
 assert.ok(platform);assert.ok(fluent);
 assert.ok(platform.dynamicImports.includes(fluent.fileName));
 const byName=new Map(chunks.map(chunk=>[chunk.fileName,chunk]));
 const visited=new Set();
 function reachesPlatform(name){
  if(name===platform.fileName)return true;
  if(visited.has(name))return false;
  visited.add(name);
  return byName.get(name)?.imports.some(reachesPlatform)||false;
 }
 assert.equal(reachesPlatform(fluent.fileName),false,'A static return path deadlocks the platform module top-level await');
});
