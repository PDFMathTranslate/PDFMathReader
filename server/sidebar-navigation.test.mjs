import test from 'node:test';
import assert from 'node:assert/strict';
import {readOutline,orderedAnnotations} from '../src/sidebar-navigation.mjs';
test('original outline resolves named and reference destinations to physical pages, preserving hierarchy',async()=>{
 const pdf={numPages:8,getOutline:async()=>[{title:'Chapter',dest:'chapter',items:[{title:'Section',dest:[{num:7}]},{title:'External',url:'https://example.com'},{title:'Invalid',dest:[99]}]}],getDestination:async()=>[2],getPageIndex:async ref=>{assert.equal(ref.num,7);return 5;}};
 assert.deepEqual(await readOutline(pdf),[{id:'0',title:'Chapter',depth:0,page:3},{id:'0.0',title:'Section',depth:1,page:6},{id:'0.1',title:'External',depth:1,page:null},{id:'0.2',title:'Invalid',depth:1,page:null}]);
 assert.deepEqual(await readOutline({...pdf,getOutline:async()=>null}),[]);
});
test('a broken destination does not hide descendants',async()=>{
 const pdf={numPages:3,getOutline:async()=>[{title:'Broken',dest:'missing',items:[{title:'Child',dest:[1]}]}],getDestination:async()=>{throw Error('missing');}};
 assert.deepEqual((await readOutline(pdf)).map(x=>x.page),[null,2]);
});
test('annotations combine both origins in page and coordinate order without changing storage',()=>{
 const items=[{id:'translation',page:2,origin:'translation',kind:'comment',rects:[{y:5,x:0}],createdAt:'2026-01-01'}, {id:'source',page:1,origin:'source',kind:'highlight',rects:[{y:50,x:0}],createdAt:'2026-01-01'}, {id:'early',page:1,origin:'translation',kind:'highlight',rects:[{y:10,x:0}],createdAt:'2026-01-01'}];
 assert.deepEqual(orderedAnnotations(items).map(x=>x.id),['early','source','translation']);assert.equal(items[0].id,'translation');
});
