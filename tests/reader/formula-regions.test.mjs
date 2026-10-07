import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formulaRegions } from '../../src/features/reader/formula-regions.mjs';

test('formula targets exclude math-backend prose, tables, and equation numbers', () => {
  const box = { x: 10, y: 20, width: 90, height: 30 };
  const blocks = ['text', 'table', 'formula_number', 'isolate_formula', 'formula'].map(
    (layoutLabel, id) => ({ id, math: true, layoutLabel, sourceBox: box }),
  );
  assert.deepEqual(
    formulaRegions(blocks, false).map((r) => r.id),
    [3, 4],
  );
});
test('formula targets follow the displayed PDF coordinates and reject empty boxes', () => {
  const sourceBox = { x: 10, y: 20, width: 90, height: 30 };
  const translatedBox = { ...sourceBox, y: 80 };
  const block = { id: 'eq', isFormula: true, sourceBox, translatedBox };
  assert.deepEqual(formulaRegions([block], true), [
    { id: 'eq', box: translatedBox, translated: true },
  ]);
  assert.deepEqual(formulaRegions([block], false), [
    { id: 'eq', box: sourceBox, translated: false },
  ]);
  assert.deepEqual(
    formulaRegions([{ ...block, sourceBox: { ...sourceBox, width: 0 } }], false),
    [],
  );
});
