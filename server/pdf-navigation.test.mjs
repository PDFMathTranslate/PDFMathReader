import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePDFDestination,destinationPoint,destinationScale} from '../src/pdf-navigation.mjs';
test('named and explicit PDF destinations resolve page references and reject missing targets',async()=>{
 const ref={num:9,gen:0},dest=[ref,{name:'XYZ'},25,600,null];
 const pdf={numPages:4,getDestination:async name=>name==='note'?dest:null,getPageIndex:async target=>{assert.equal(target,ref);return 2;}};
 assert.deepEqual(await resolvePDFDestination(pdf,'note'),{pageNumber:3,dest});
 assert.equal((await resolvePDFDestination(pdf,[1,{name:'Fit'}])).pageNumber,2);
 assert.equal(await resolvePDFDestination(pdf,'missing'),null);
 assert.equal(await resolvePDFDestination(pdf,[9,{name:'Fit'}]),null);
});
