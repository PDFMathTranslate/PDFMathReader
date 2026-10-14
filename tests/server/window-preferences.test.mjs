import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeWindowPreferences,
  withServiceSelections,
} from '../../electron/main/ipc/window-preferences.mjs';

const shared = {
  pdf_math_fast: {
    id: 'openai',
    values: { model: 'gpt' },
    profiles: { openai: { values: { model: 'gpt' } }, deepl: { values: { formal: true } } },
  },
};
const own = {
  pdf_math_fast: { id: 'deepl', values: { formal: false } },
};

test('another document keeps its own service with the shared profile values', () => {
  const next = { engine: 'pdf_math_fast', zoom: 1, translationServices: shared };
  const current = { engine: 'pdf_math_precise', zoom: 2, translationServices: own };
  const value = { engine: 'pdf_math_fast', translationServices: shared };
  const merged = mergeWindowPreferences(next, current, value, false);
  assert.equal(merged.engine, 'pdf_math_precise');
  assert.equal(merged.zoom, 2);
  assert.deepEqual(merged.translationServices.pdf_math_fast, {
    ...shared.pdf_math_fast,
    id: 'deepl',
    values: { formal: true },
  });
  assert.equal(shared.pdf_math_fast.id, 'openai');
});

test('the sender and the document owning its settings window adopt the selection', () => {
  const next = { engine: 'pdf_math_fast', translationServices: shared };
  const current = { engine: 'pdf_math_fast', translationServices: own };
  const value = { translationServices: shared };
  assert.equal(
    mergeWindowPreferences(next, current, value, true).translationServices.pdf_math_fast.id,
    'openai',
  );
  const owner = mergeWindowPreferences(next, current, value, false, true);
  assert.equal(owner.translationServices.pdf_math_fast.id, 'openai');
  // A save that does not touch services leaves the owner's own selection.
  const untouched = mergeWindowPreferences(next, current, { zoom: 1 }, false, true);
  assert.equal(untouched.translationServices.pdf_math_fast.id, 'deepl');
});

test('missing service maps are tolerated', () => {
  assert.deepEqual(withServiceSelections(undefined, own), own);
  // A document that never chose a service keeps the automatic one.
  assert.deepEqual(withServiceSelections(shared, undefined).pdf_math_fast, {
    ...shared.pdf_math_fast,
    id: 'auto',
    values: {},
  });
  const merged = mergeWindowPreferences({ engine: 'pdf_math_fast' }, {}, {}, false);
  assert.equal(merged.translationServices, undefined);
});
