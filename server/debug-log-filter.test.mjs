import test from 'node:test';
import assert from 'node:assert/strict';
import {filterDebugLogLines,formatDebugLog} from '../src/debug-log-filter.mjs';
test('regex filters displayed log lines, supports flags, and resets stateful expressions per row',()=>{
 const lines=['INFO worker ready','ERROR network timeout','error authorization','done'];
 assert.deepEqual(filterDebugLogLines(lines,'error|timeout'),[1,2]);
 assert.deepEqual(filterDebugLogLines(lines,'/^ERROR/'),[1]);
 assert.deepEqual(filterDebugLogLines(lines,'/error/ig'),[1,2]);
 assert.deepEqual(filterDebugLogLines(lines,''),[0,1,2,3]);
 assert.deepEqual(filterDebugLogLines(lines,'not present'),[]);
});
test('malformed and excessively long regex patterns fail without a misleading empty result',()=>{
 assert.throws(()=>filterDebugLogLines(['log'],'['),SyntaxError);
 assert.throws(()=>filterDebugLogLines(['log'],'x'.repeat(1001)),/too long/);
});
test('log format preserves timestamps, categories, process details and literal text',()=>{
 const line=formatDebugLog({time:'2026-10-05T12:00:00Z',kernel:'pdf_math_fast',kind:'kernel-stderr',pid:123,message:'x < y; regex [sample]'});
 assert.equal(line,'2026-10-05T12:00:00Z [pdf_math_fast] [kernel-stderr] PID 123 x < y; regex [sample]');
 assert.deepEqual(filterDebugLogLines([line],'^2026.*kernel-stderr'),[0]);
});
