import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addQuickGlossaryTerm,
  normalizeGlossaryTerm,
} from '../../src/features/settings/quick-glossary.mjs';
import { glossaryEntries } from '../../shared/translation/glossary.mjs';

test('quick glossary creates an active library usable by translation', () => {
  const result = addQuickGlossaryTerm([], {
    libraryId: '',
    source: ' causal effect ',
    target: ' 因果效应 ',
    newLibraryName: 'English → Chinese',
  });
  assert.equal(result[0].name, 'English → Chinese');
  assert.deepEqual(glossaryEntries(result), [{ source: 'causal effect', target: '因果效应' }]);
});

test('quick glossary replaces a duplicate and enables its library without mutating preferences', () => {
  const original = [
    { id: 'a', name: 'Terms', enabled: false, entries: [{ source: 'term', target: 'old' }] },
  ];
  const result = addQuickGlossaryTerm(original, { libraryId: 'a', source: 'term', target: 'new' });
  assert.deepEqual(glossaryEntries(result), [{ source: 'term', target: 'new' }]);
  assert.equal(original[0].enabled, false);
  assert.equal(original[0].entries[0].target, 'old');
});

test('quick glossary rejects empty terms, stale library choices and capacity overflow', () => {
  assert.throws(() => addQuickGlossaryTerm([], { source: 'term', target: ' ' }));
  assert.throws(() =>
    addQuickGlossaryTerm([], { libraryId: 'deleted', source: 'term', target: 'value' }),
  );
  const full = [
    {
      id: 'a',
      name: 'Terms',
      enabled: true,
      entries: Array.from({ length: 1000 }, (_, i) => ({ source: String(i), target: 'value' })),
    },
  ];
  assert.throws(() =>
    addQuickGlossaryTerm(full, { libraryId: 'a', source: 'extra', target: 'value' }),
  );
  assert.equal(full[0].entries.length, 1000);
});

test('PDF selection whitespace preserves word boundaries and trims excess whitespace', () => {
  assert.equal(normalizeGlossaryTerm('  public\n opinion\t '), 'public opinion');
  assert.equal(normalizeGlossaryTerm('public\u00a0\u00a0opinion'), 'public opinion');
  const result = addQuickGlossaryTerm([], {
    libraryId: '',
    source: ' public\n opinion ',
    target: ' 公共意见 ',
    newLibraryName: 'Terms',
  });
  assert.deepEqual(glossaryEntries(result), [{ source: 'public opinion', target: '公共意见' }]);
});
