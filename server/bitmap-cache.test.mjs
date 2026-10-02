import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BitmapCache} from '../src/bitmap-cache.mjs';

const canvas=(width,height)=>({width,height});

test('tracks bitmap bytes and replacement accounting',()=>{
 const cache=new BitmapCache({maxBytes:1000,maxEntries:4});
 const first=canvas(10,5);
 assert.equal(cache.set('page',first),true);
 assert.deepEqual(cache.stats(),{bytes:200,entries:1,maxBytes:1000,maxEntries:4});
 const replacement=canvas(5,5);
 assert.equal(cache.set('page',replacement),true);
 assert.deepEqual(cache.stats(),{bytes:100,entries:1,maxBytes:1000,maxEntries:4});
 assert.equal(cache.get('page'),replacement);
});

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

test('preserves a live canvas on same-key replacement and clears the cache',()=>{
 const cache=new BitmapCache({maxBytes:1000,maxEntries:2});
 const live=canvas(4,4);
 cache.set('page',live);
 assert.equal(cache.set('page',live),true);
 assert.deepEqual([live.width,live.height],[4,4]);
 const replacement=canvas(3,2);
 assert.equal(cache.set('page',replacement),true);
 assert.deepEqual([live.width,live.height],[0,0]);
 cache.clear();
 assert.deepEqual([replacement.width,replacement.height],[0,0]);
 assert.deepEqual(cache.stats(),{bytes:0,entries:0,maxBytes:1000,maxEntries:2});
});
