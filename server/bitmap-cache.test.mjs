import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BitmapCache} from '../src/bitmap-cache.mjs';

const canvas=(width,height)=>({width,height});

test('touches entries on get and evicts the oldest entry',()=>{
 const cache=new BitmapCache({maxBytes:1000,maxEntries:2});
 const first=canvas(5,5),second=canvas(5,5),third=canvas(5,5);
 cache.set('first',first);cache.set('second',second);
 assert.equal(cache.get('first'),first);
 assert.equal(cache.set('third',third),true);
 assert.equal(cache.get('second'),undefined);
 assert.deepEqual([second.width,second.height],[0,0]);
 assert.deepEqual(cache.stats(),{bytes:200,entries:2,maxBytes:1000,maxEntries:2});
});


test('rejects an oversized canvas without changing it or evicting entries',()=>{
 const cache=new BitmapCache({maxBytes:100,maxEntries:2});
 const kept=canvas(2,2),oversized=canvas(6,6);
 cache.set('kept',kept);
 assert.equal(cache.set('oversized',oversized),false);
 assert.deepEqual([oversized.width,oversized.height],[6,6]);
 assert.equal(cache.get('kept'),kept);
 assert.deepEqual(cache.stats(),{bytes:16,entries:1,maxBytes:100,maxEntries:2});
});
