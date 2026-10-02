import test from 'node:test';
import assert from 'node:assert/strict';
import {pageNote} from '../src/page-note.mjs';
test('page status works independently of renderer component state',()=>{
 assert.equal(pageNote({status:'detecting',blocks:[]},'pdf_inspector').label,'Detecting layout…');
 assert.equal(pageNote({status:'detecting',blocks:[]},'pdf_math_fast').label,'Translating…');
 assert.equal(pageNote({status:'queued',blocks:[]}).label,'Queued…');
 assert.equal(pageNote({status:'ready',blocks:[]}),null);
 assert.equal(pageNote({status:'ready',blocks:[{error:'Retry needed',status:'error'}]}).detail,'Retry needed');
});
