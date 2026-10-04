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
test('destination coordinates use the PDF viewport including nonzero page origins',()=>{
 const page={view:[10,20,510,720],getViewport:({scale})=>({width:500*scale,height:700*scale,convertToViewportPoint:(x,y)=>[(x-10)*scale,(720-y)*scale]})};
 for(const [dest,point] of [ [[0,{name:'XYZ'},40,600,null],{x:60,y:240}],[[0,{name:'FitH'},600],{x:0,y:240}],[[0,{name:'FitV'},40],{x:60,y:0}],[[0,{name:'FitR'},40,100,300,600],{x:60,y:240}],[[0,{name:'Fit'}],{x:0,y:0}],[[0,{name:'XYZ'},null,null,null],{x:0,y:0}] ])assert.deepEqual(destinationPoint(page,dest,2),point);
});

test('PDF fit and explicit zoom destinations select the destination scale',()=>{
 const page={getViewport:()=>({width:500,height:700,convertToViewportPoint:(x,y)=>[x,700-y]})};
 assert.equal(destinationScale(page,[0,{name:'XYZ'},0,500,2],1,1000,700),2);
 assert.equal(destinationScale(page,[0,{name:'Fit'}],2,1000,700),1);
 assert.equal(destinationScale(page,[0,{name:'FitH'},650],1,1000,700),2);
 assert.equal(destinationScale(page,[0,{name:'FitR'},0,0,250,350],1,1000,700),2);
});
