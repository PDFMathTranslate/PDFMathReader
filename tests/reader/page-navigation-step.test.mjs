import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReaderLayout } from '../../src/features/reader/reader-layout.mjs';
import { createPageNavigation } from '../../src/features/reader/page-navigation.mjs';

function navigation(count, columns, active) {
  const pages = Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    width: 600,
    height: 800,
  }));
  const view = {
    active: { value: active },
    pageLayout: { value: buildReaderLayout(pages, 1, 'vertical', columns) },
  };
  return createPageNavigation({ session: { pages: { value: pages } }, view });
}

test('pager steps one page in single-column layout', () => {
  const nav = navigation(5, 1, 3);
  assert.equal(nav.stepTarget(-1), 2);
  assert.equal(nav.stepTarget(1), 4);
  assert.equal(navigation(5, 1, 5).canStep(1), false);
});

test('pager steps two pages per switch in two-page layout', () => {
  assert.equal(navigation(6, 2, 1).stepTarget(1), 3);
  assert.equal(navigation(6, 2, 2).stepTarget(1), 3);
  assert.equal(navigation(6, 2, 4).stepTarget(-1), 1);
  assert.equal(navigation(6, 2, 2).canStep(-1), false);
  assert.equal(navigation(6, 2, 6).canStep(1), false);
});

test('pager steps four pages per switch in four-page layout', () => {
  assert.equal(navigation(10, 4, 1).stepTarget(1), 5);
  assert.equal(navigation(10, 4, 6).stepTarget(1), 9);
  assert.equal(navigation(10, 4, 10).stepTarget(-1), 5);
  assert.equal(navigation(10, 4, 9).canStep(1), false);
});
