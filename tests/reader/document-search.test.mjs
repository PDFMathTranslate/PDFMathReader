import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchSegments } from '../../src/features/search/document-search.mjs';

const segment = (text, paragraph = 1, x = 0) => ({
  text,
  paragraph,
  box: { x, y: 0, width: text.length * 5, height: 10 },
});
test('fuzzy remains the default and ignores word order and whitespace', () => {
  assert.equal(searchSegments([segment('Beta and ALPHA')], 'alpha beta').length, 1);
  assert.equal(searchSegments([segment('a l p h a')], 'alpha').length, 1);
});
test('exact search matches literal phrases in order, case insensitively', () => {
  const segments = [segment('Alpha beta. Alpha beta.')];
  assert.equal(searchSegments(segments, 'alpha beta.', 'exact').length, 2);
  assert.equal(searchSegments(segments, 'beta alpha', 'exact').length, 0);
  assert.equal(searchSegments([segment('aXb')], 'a.b', 'exact').length, 0);
  assert.equal(searchSegments([segment('a b')], 'ab', 'exact').length, 0);
  assert.equal(searchSegments([segment('İ alpha')], 'alpha', 'exact').length, 1);
});
test('phrase and regex matches retain boxes across PDF text items', () => {
  const segments = [segment('Alpha'), segment('beta', 1, 30)];
  for (const mode of ['exact', 'regex']) {
    const hits = searchSegments(segments, 'alpha beta', mode);
    assert.deepEqual(
      hits[0].boxes,
      segments.map((s) => s.box),
    );
    assert.equal(
      searchSegments([segment('Alpha'), segment('beta', 2)], 'alpha beta', mode).length,
      0,
    );
  }
  assert.equal(searchSegments([segment('Al'), segment('pha', 1, 10)], 'Alpha', 'exact').length, 1);
});
test('regex supports patterns, repeats, and safely skips empty matches', () => {
  assert.equal(searchSegments([segment('A12 B34')], '\\b[a-z]\\d+\\b', 'regex').length, 2);
  assert.equal(searchSegments([segment('abc')], '(?=a)', 'regex').length, 0);
  assert.equal(searchSegments([segment('abc')], 'a*', 'regex').length, 1);
  assert.throws(() => searchSegments([], '[', 'regex'), SyntaxError);
  for (const mode of ['fuzzy', 'exact', 'regex']) {
    assert.deepEqual(searchSegments([segment('abc')], '', mode), []);
  }
});

test('invalid regex reports an error and changing modes reruns search', async () => {
  const { ref, nextTick, effectScope } = await import('vue');
  const { useDocumentSearch } = await import('../../src/features/search/useDocumentSearch.mjs');
  const scope = effectScope();
  const search = scope.run(() =>
    useDocumentSearch({
      pages: ref([]),
      showTranslations: ref(false),
      getDocument: () => ({}),
      getEpoch: () => 1,
      renderPages: () => {},
    }),
  );
  try {
    search.searchOpen.value = true;
    search.searchMode.value = 'regex';
    search.searchQuery.value = '[';
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 230));
    assert.equal(search.searchFailure.value, 'Invalid regular expression');
    assert.equal(search.searchBusy.value, false);
    assert.deepEqual(search.searchResults.value, []);
    search.searchMode.value = 'exact';
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 230));
    assert.equal(search.searchFailure.value, '');
  } finally {
    search.closeSearch();
    scope.stop();
  }
});
