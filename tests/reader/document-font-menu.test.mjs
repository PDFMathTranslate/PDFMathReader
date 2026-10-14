import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DOCUMENT_FONT_DEFAULT,
  chosenFont,
  documentFontMenu,
  loadInstalledFonts,
  rememberFont,
} from '../../src/features/settings/document-font-menu.mjs';

const fonts = { sans: ['Avenir Next', 'Helvetica'], serif: ['Georgia'], mono: ['Menlo'] };
const label = (key, values) => (values ? `${key}:${values.name}` : key);
const values = (items) => items.map((item) => item.value);

test('the popup lists recent fonts, then its own style, then the others', () => {
  const items = documentFontMenu({
    fonts,
    style: 'serif',
    value: 'Georgia',
    recent: ['Menlo', 'Removed Font'],
    label,
  });
  assert.deepEqual(values(items), [
    DOCUMENT_FONT_DEFAULT,
    'section:recent',
    'recent:Menlo',
    'section:serif',
    'Georgia',
    'section:sans',
    'Avenir Next',
    'Helvetica',
    'section:mono',
    'Menlo',
  ]);
  assert.deepEqual(
    items.filter((item) => item.header).map((item) => item.label),
    ['recent', 'serif', 'sans', 'mono'],
  );
  assert.equal(items.find((item) => item.value === 'Georgia').family, 'Georgia');
});

test('a saved font that is no longer installed stays selectable', () => {
  const items = documentFontMenu({ fonts, style: 'sans', value: 'Gone Sans', label });
  assert.deepEqual(items[1], {
    value: 'Gone Sans',
    label: 'missing:Gone Sans',
    family: 'Gone Sans',
  });
  assert.ok(!values(items).includes('section:recent'), 'no history, no recent section');
  assert.deepEqual(values(documentFontMenu({ fonts: null, style: 'sans', label })), [
    DOCUMENT_FONT_DEFAULT,
  ]);
});

test('CJK popups list only the families that cover CJK text', () => {
  const withCjk = { ...fonts, serif: ['Georgia', 'Songti SC'], cjk: ['PingFang SC', 'Songti SC'] };
  withCjk.sans = ['Avenir Next', 'PingFang SC'];
  const items = documentFontMenu({
    fonts: withCjk,
    style: 'sans',
    recent: ['Menlo', 'Songti SC'],
    label,
    cjk: true,
  });
  assert.deepEqual(values(items), [
    DOCUMENT_FONT_DEFAULT,
    'section:recent',
    'recent:Songti SC',
    'section:sans',
    'PingFang SC',
    'section:serif',
    'Songti SC',
  ]);
  const latin = documentFontMenu({
    fonts: withCjk,
    style: 'sans',
    value: 'Menlo',
    label,
    cjk: true,
  });
  assert.deepEqual(latin[1], { value: 'Menlo', label: 'Menlo', family: 'Menlo' });
  // Without coverage data every installed family is offered.
  assert.ok(values(documentFontMenu({ fonts, style: 'sans', label, cjk: true })).includes('Menlo'));
});

test('choices decode to font names and update the history', () => {
  assert.equal(chosenFont('recent:Menlo'), 'Menlo');
  assert.equal(chosenFont('Georgia'), 'Georgia');
  assert.equal(chosenFont(DOCUMENT_FONT_DEFAULT), '');
  assert.equal(chosenFont('section:serif'), null);
  assert.deepEqual(rememberFont(['A', 'B', 'C'], 'B'), ['B', 'A', 'C']);
  assert.deepEqual(rememberFont(['A'], ''), ['A']);
  assert.equal(rememberFont(['1', '2', '3', '4', '5', '6', '7', '8'], '9').length, 8);
});

test('installed fonts are fetched once and retried after a failure', async () => {
  let calls = 0;
  const request = async () => {
    calls++;
    return calls === 1
      ? { ok: false, status: 500 }
      : { ok: true, json: async () => ({ sans: ['A'], serif: [], mono: [] }) };
  };
  await assert.rejects(loadInstalledFonts(request));
  assert.deepEqual((await loadInstalledFonts(request)).sans, ['A']);
  await loadInstalledFonts(request);
  assert.equal(calls, 2);
});
