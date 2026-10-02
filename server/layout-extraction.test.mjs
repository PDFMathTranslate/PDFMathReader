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

test('reports one native duration for a coalesced group and one per raw request',async()=>{
 let nativeCalls=0;const service=createLayoutExtraction({onNativeExtraction:()=>{nativeCalls++;},extractor:async(_bytes,pages)=>pages.map(page=>({page}))});const entry={id:'timing',bytes:Buffer.from('%PDF')};
 await Promise.all([service.extractPage(entry,1),service.extractPage(entry,2),service.extractPage(entry,1)]);assert.equal(nativeCalls,1);
 await Promise.all([service.extractPage(entry.bytes,1),service.extractPage(entry.bytes,2)]);assert.equal(nativeCalls,3);
});

test('same-page arrivals join an in-flight native call after pending is drained',async()=>{
 let release;let calls=0;const service=createLayoutExtraction({extractor:async(_bytes,pages)=>{calls++;return new Promise(resolve=>{release=()=>resolve(pages.map(page=>({page,text:'joined'})));});}});const entry={id:'inflight',bytes:Buffer.from('%PDF')};
 const first=service.extractPage(entry,1);await pause(8);const second=service.extractPage(entry,1);assert.equal(calls,1);release();assert.deepEqual(await Promise.all([first,second]),[[{page:1,text:'joined'}],[{page:1,text:'joined'}]]);assert.equal(calls,1);
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

test('raw legacy requests bypass coalescing and cache',async()=>{
 const calls=[];const service=createLayoutExtraction({extractor:async(_bytes,pages)=>{calls.push(pages);return pages.map(page=>({page}));}});const bytes=Buffer.from('%PDF');
 await Promise.all([service.extractPage(bytes,2),service.extractPage(bytes,1)]);assert.deepEqual(calls,[[2],[1]]);assert.deepEqual(service.stats(bytes),{pages:0,bytes:0,pendingPages:0});
});

test('a failed native group clears pending state and a missing page has no per-page error',async()=>{
 let failures=1;const calls=[];const service=createLayoutExtraction({extractor:async(_bytes,pages)=>{calls.push([...pages]);if(failures-- >0)throw Error('synthetic extraction failure');return [{page:pages[0],text:'only first'}];}});const entry={id:'failure',bytes:Buffer.from('%PDF')};
 await assert.rejects(Promise.all([service.extractPage(entry,1),service.extractPage(entry,2)]),/synthetic extraction failure/);assert.equal(service.stats(entry).pendingPages,0);
 const [first,missing]=await Promise.all([service.extractPage(entry,1),service.extractPage(entry,2)]);assert.deepEqual(first,[{page:1,text:'only first'}]);assert.deepEqual(missing,[]);assert.equal(service.stats(entry).pendingPages,0);assert.equal(calls.length,2);
 service.cleanup(entry);assert.deepEqual(service.stats(entry),{pages:0,bytes:0,pendingPages:0});
});

test('native extractor receives display frame and real document fixture items',async()=>{
 const source=await PDFDocument.create();const font=await source.embedFont(StandardFonts.Helvetica);const page=source.addPage([612,792]);page.drawText('Batched extraction fixture',{x:48,y:700,size:16,font});const bytes=Buffer.from(await source.save());
 const service=createLayoutExtraction({extractor:extractTextWithPositionsAsync});const entry={id:'native-fixture',bytes};const items=await service.extractPage(entry,1);assert.ok(items.some(item=>item.page===1&&item.text.includes('Batched extraction fixture')));assert.ok(service.stats(entry).bytes>0);service.cleanup(entry);
});

function jsonSize(value){return Buffer.byteLength(JSON.stringify(value),'utf8');}
