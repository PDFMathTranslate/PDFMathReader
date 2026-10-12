import test from 'node:test';
import assert from 'node:assert/strict';
import {
  openOrder,
  ownsTranslationGeometry,
} from '../../src/features/translation/translation-versions.mjs';

const fast = { engine: 'pdf_math_fast', language: 'Chinese' };
const precise = { engine: 'pdf_math_precise', language: 'Chinese' };
const inspector = { engine: 'pdf_inspector', language: 'Chinese' };

test('translation geometry belongs to the version that drew it', () => {
  const made = { origin: 'translation', translationVersion: fast };
  assert.equal(ownsTranslationGeometry(made, fast), true);
  assert.equal(ownsTranslationGeometry(made, precise), false);
  assert.equal(ownsTranslationGeometry(made, { ...fast, language: 'Japanese' }), false);
  assert.equal(
    ownsTranslationGeometry({ origin: 'source', translationVersion: fast }, precise),
    true,
  );
  assert.equal(ownsTranslationGeometry({ origin: 'translation' }, precise), true);
});

test('a cached current setting is opened before other cached versions', () => {
  assert.deepEqual(openOrder([inspector, fast, precise], precise), [precise, inspector, fast]);
  assert.deepEqual(openOrder([inspector, fast], precise), [inspector, fast]);
  assert.deepEqual(openOrder(undefined, fast), []);
});
