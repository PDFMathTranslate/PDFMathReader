import test from 'node:test';
import assert from 'node:assert/strict';
import { translationPages } from '../../src/features/translation/scope-pages.mjs';
import { createTranslationScope } from '../../src/features/translation/translation-scope.mjs';

test('reading ahead prioritizes visible pages and prefetches six further pages while moving', () => {
  const options = { visible: [10, 11], ahead: [12, 13], direction: 1, moving: true };
  assert.deepEqual(
    translationPages('reading-ahead', 10, 50, options),
    [10, 11, 12, 13, 14, 15, 16, 17, 9, 8],
  );
  assert.deepEqual(translationPages('reading', 10, 50, options), [10, 11]);
  assert.equal(translationPages('full', 10, 50, options).length, 50);
});
test('reading ahead follows backwards browsing and clamps document boundaries', () => {
  assert.deepEqual(
    translationPages('reading-ahead', 10, 50, { visible: [9, 10], direction: -1, moving: true }),
    [10, 9, 8, 7, 6, 5, 4, 3, 11, 12],
  );
  assert.deepEqual(translationPages('reading-ahead', 1, 3), [1, 2, 3]);
  assert.deepEqual(translationPages('reading-ahead', 50, 50, { direction: 1 }), [50, 49, 48]);
  assert.deepEqual(translationPages('reading-ahead', 1, 0), []);
});
test('reading ahead keeps its horizon beyond a multi-page viewport', () => {
  assert.deepEqual(
    translationPages('reading-ahead', 10, 100, { visible: [10, 11, 12, 13], direction: 1 }),
    [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 9, 8],
  );
});
test('scope pruning retains nearby prefetch and manual jobs, cancels distant automatic work', () => {
  const near = new AbortController(),
    far = new AbortController(),
    manual = new AbortController();
  const state = {
    translationDeferred: { value: false },
    readingDirection: 1,
    translationMoving: true,
    translationRequests: new Map([
      [near, { page: 16 }],
      [far, { page: 30 }],
      [manual, { page: 40, manual: true }],
    ]),
    pageQueue: [
      { p: { number: 16, status: 'queued', blocks: [] } },
      { p: { number: 30, status: 'queued', blocks: [] } },
    ],
    queue: [],
  };
  const scope = createTranslationScope({
    translationState: state,
    renderState: { layoutElement: { value: null }, visiblePages: new Set([10]) },
    preferences: { translationMode: { value: 'reading-ahead' } },
    session: { pages: { value: Array(50) } },
    view: { reader: { value: null }, active: { value: 10 } },
  });
  scope.pruneTranslationQueue();
  assert.equal(near.signal.aborted, false);
  assert.equal(far.signal.aborted, true);
  assert.equal(manual.signal.aborted, false);
  assert.deepEqual(
    state.pageQueue.map((j) => j.p.number),
    [16],
  );
});
