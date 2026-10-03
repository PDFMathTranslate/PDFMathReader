import assert from 'node:assert/strict';
import test from 'node:test';
import {towardSubmenu} from '../src/menu-intent.mjs';
test('menu intent retains a diagonal path to either side and allows movement away',()=>{
 const right={left:300,right:580,top:100,bottom:400};
 assert.equal(towardSubmenu({x:100,y:150},{x:180,y:210},right),true);
 assert.equal(towardSubmenu({x:100,y:150},{x:90,y:170},right),false);
 assert.equal(towardSubmenu({x:100,y:150},{x:180,y:410},right),false);
 const left={left:10,right:290,top:100,bottom:400};
 assert.equal(towardSubmenu({x:490,y:150},{x:410,y:210},left),true);
 assert.equal(towardSubmenu({x:490,y:150},{x:510,y:150},left),false);
});
