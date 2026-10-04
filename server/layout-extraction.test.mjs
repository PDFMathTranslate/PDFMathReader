import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {extractTextWithPositionsAsync} from '@firecrawl/pdf-inspector';
import {createLayoutExtraction} from './layout-extraction.mjs';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('cleanup cancels pending and in-flight waiters and ignores late native results',async()=>{
 let release;let calls=0;const service=createLayoutExtraction({extractor:async(_bytes,pages)=>{calls++;return new Promise(resolve=>{release=()=>resolve(pages.map(page=>({page})));});}});const entry={id:'cleanup-inflight',bytes:Buffer.from('%PDF')};
 const pendingEntry={id:'cleanup-pending',bytes:Buffer.from('%PDF')};const pending=service.extractPage(pendingEntry,1);assert.equal(service.cleanup(pendingEntry),true);await assert.rejects(pending,/cleaned up/);
 const waiting=service.extractPage(entry,1);await pause(8);const oldRelease=release;assert.equal(typeof oldRelease,'function');assert.equal(service.cleanup(entry),true);await assert.rejects(waiting,/cleaned up/);oldRelease();await pause(2);assert.deepEqual(service.stats(entry),{pages:0,bytes:0,pendingPages:0});
 const next=service.extractPage(entry,1);await pause(8);assert.equal(calls,2);const newRelease=release;assert.equal(typeof newRelease,'function');newRelease();assert.deepEqual(await next,[{page:1}]);
});
