import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translationPages} from '../src/translation-scope.mjs';
test('reading scope includes two pages each side and bounds the document',()=>{assert.deepEqual(translationPages('reading',5,12),[5,6,4,7,3]);assert.deepEqual(translationPages('reading',1,12),[1,2,3]);assert.deepEqual(translationPages('reading',12,12),[12,11,10]);});
test('full scope queues every page including documents of one or zero pages',()=>{assert.deepEqual(translationPages('full',5,4),[1,2,3,4]);assert.deepEqual(translationPages('full',1,1),[1]);assert.deepEqual(translationPages('full',1,0),[]);});
