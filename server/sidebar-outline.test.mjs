import test from 'node:test';
import assert from 'node:assert/strict';
import {readOutline} from '../src/sidebar-navigation.mjs';

test('NUL-padded PDF bookmarks retain their titles, hierarchy and destinations',async()=>{
 const pdf={numPages:8,getOutline:async()=>[
  {title:'Cover\0\0',dest:[0],items:[]},
  {title:'1 Introduction\0'.padEnd(72,'\0'),dest:'chapter',items:[
   {title:'1.1 中文 — Résumé 😀\0\0',dest:[3],items:[]}
  ]},
  {title:'Unpadded title',dest:[7],items:[]}
 ],getDestination:async()=>[{num:42}],getPageIndex:async()=>2};
 assert.deepEqual(await readOutline(pdf),[
  {id:'0',title:'Cover',depth:0,page:1},
  {id:'1',title:'1 Introduction',depth:0,page:3},
  {id:'1.0',title:'1.1 中文 — Résumé 😀',depth:1,page:4},
  {id:'2',title:'Unpadded title',depth:0,page:8}
 ]);
});
