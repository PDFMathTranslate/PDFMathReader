import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernelProgressParser } from '../../shared/translation/kernel-progress.mjs';

test('kernel progress parser preserves stages without a measurable percentage', () => {
  const progress = [];
  const consume = createKernelProgressParser((value) => progress.push(value));
  consume('PDFMATH_PROGRESS:{"stage":"Finalize PDF","completed":0,"total":1,"percent":null}\n');
  assert.deepEqual(progress, [{ stage: 'Finalize PDF', completed: 0, total: 1, percent: null }]);
});

test('kernel progress parser joins split stdout chunks and ignores ordinary output', () => {
  const progress = [];
  const consume = createKernelProgressParser((value) => progress.push(value));

  consume('worker output\nPDFMATH_PROGRESS:{"stage":"pages","completed":');
  consume('2,"total":4,"percent":50}\r\nother output\n');

  assert.deepEqual(progress, [{ stage: 'pages', completed: 2, total: 4, percent: 50 }]);
});

test('kernel progress parser drops malformed records and out-of-bounds values', () => {
  const progress = [];
  const consume = createKernelProgressParser((value) => progress.push(value));

  consume(
    [
      'PDFMATH_PROGRESS:not-json',
      'PDFMATH_PROGRESS:{"stage":"pages","completed":-1,"total":4,"percent":0}',
      'PDFMATH_PROGRESS:{"stage":"pages","completed":5,"total":4,"percent":125}',
      'PDFMATH_PROGRESS:{"stage":"pages","completed":1,"total":0,"percent":0}',
      'PDFMATH_PROGRESS:{"stage":"pages","completed":1,"total":4,"percent":25}',
    ].join('\n') + '\n',
  );

  assert.deepEqual(progress, [{ stage: 'pages', completed: 1, total: 4, percent: 25 }]);
});

test('kernel progress parser accepts native fractional percent within bounds', () => {
  const progress = [];
  const consume = createKernelProgressParser((value) => progress.push(value));

  consume('PDFMATH_PROGRESS:{"stage":"typeset","completed":3,"total":7,"percent":42.857}\n');

  assert.equal(progress.length, 1);
  assert.equal(progress[0].percent, 42.857);
});
