import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {extractTextWithPositionsAsync} from '@firecrawl/pdf-inspector';
import {createLayoutExtraction} from './layout-extraction.mjs';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('coalesces same-entry requests, sorts and deduplicates pages, and splits by one-indexed page',async()=>{
 const calls=[];const service=createLayoutExtraction({extractor:async(bytes,pages,options)=>{calls.push({bytes,pages:[...pages],options});return pages.flatMap(page=>[{page,text:`page-${page}`}]);}});
 const entry={id:'fixture',bytes:Buffer.from('%PDF')};
 const values=await Promise.all([service.extractPage(entry,3),service.extractPage(entry,1),service.extractPage(entry,3),service.extractPage(entry,2),service.extractPage(entry,2)]);
 assert.deepEqual(calls,[{bytes:entry.bytes,pages:[1,2,3],options:{frame:'display'}}]);assert.deepEqual(values.map(items=>items[0].page),[3,1,3,2,2]);assert.deepEqual(service.stats(entry),{pages:3,bytes:jsonSize([{page:1,text:'page-1'}])+jsonSize([{page:2,text:'page-2'}])+jsonSize([{page:3,text:'page-3'}]),pendingPages:0});
 const before=calls.length;assert.deepEqual(await service.extractPage(entry,1),[{page:1,text:'page-1'}]);assert.equal(calls.length,before);
});

test('cleanup cancels pending and in-flight waiters and ignores late native results',async()=>{
 let release;let calls=0;const service=createLayoutExtraction({extractor:async(_bytes,pages)=>{calls++;return new Promise(resolve=>{release=()=>resolve(pages.map(page=>({page})));});}});const entry={id:'cleanup-inflight',bytes:Buffer.from('%PDF')};
 const pendingEntry={id:'cleanup-pending',bytes:Buffer.from('%PDF')};const pending=service.extractPage(pendingEntry,1);assert.equal(service.cleanup(pendingEntry),true);await assert.rejects(pending,/cleaned up/);
 const waiting=service.extractPage(entry,1);await pause(8);const oldRelease=release;assert.equal(typeof oldRelease,'function');assert.equal(service.cleanup(entry),true);await assert.rejects(waiting,/cleaned up/);oldRelease();await pause(2);assert.deepEqual(service.stats(entry),{pages:0,bytes:0,pendingPages:0});
 const next=service.extractPage(entry,1);await pause(8);assert.equal(calls,2);const newRelease=release;assert.equal(typeof newRelease,'function');newRelease();assert.deepEqual(await next,[{page:1}]);
});

test('limits cache by exact JSON bytes and page count with LRU eviction',async()=>{
 const service=createLayoutExtraction({maxPages:2,maxBytes:100,extractor:async(_bytes,pages)=>pages.map(page=>({page,text:'x'.repeat(page*20)}))});
 const entry={id:'cache',bytes:Buffer.from('%PDF')};await service.extractPage(entry,1);await service.extractPage(entry,2);assert.deepEqual(service.stats(entry),{pages:1,bytes:jsonSize([{page:2,text:'x'.repeat(40)}]),pendingPages:0});
 await service.extractPage(entry,3);const current=service.stats(entry);assert.ok(current.pages<=2);assert.ok(current.bytes<=100);assert.deepEqual(await service.extractPage(entry,1),[{page:1,text:'x'.repeat(20)}]);
});

function jsonSize(value){return Buffer.byteLength(JSON.stringify(value),'utf8');}
