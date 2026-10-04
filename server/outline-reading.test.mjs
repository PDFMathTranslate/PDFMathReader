import test from 'node:test';
import assert from 'node:assert/strict';
import {chaptersAtPage} from '../src/sidebar-navigation.mjs';
const outline=[
 {id:'0',page:1,depth:0},
 {id:'0.0',page:2,depth:1},
 {id:'0.1',page:5,depth:1},
 {id:'1',page:10,depth:0},
 {id:'2',page:null,depth:0},
 {id:'3',page:15,depth:0},
];
test('reading a subsection visits its ancestors without marking skipped siblings',()=>{
 assert.deepEqual(chaptersAtPage(outline,5),['0','0.1']);
 assert.deepEqual(chaptersAtPage(outline,10),['1']);
 assert.deepEqual(chaptersAtPage(outline,15),['3']);
});
test('chapter boundaries include their first page and exclude the next chapter',()=>{
 assert.deepEqual(chaptersAtPage(outline,1),['0']);
 assert.deepEqual(chaptersAtPage(outline,4),['0','0.0']);
 assert.deepEqual(chaptersAtPage(outline,14),['1']);
 assert.deepEqual(chaptersAtPage([],1),[]);
});
