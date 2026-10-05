import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createReaderPreferences } from '../electron/preferences.mjs';
import {
  importantInformationRanges,
  informationRunRanges,
  informationTextSegments,
} from '../src/information-emphasis.mjs';

const NO_CATEGORIES = { research: false, ordinals: false, verbs: false, logic: false };
const informationSummary = (text, ranges) =>
  ranges.map(({ start, end, category }) => ({ text: text.slice(start, end), category }));

test('information category toggles keep legacy match categories for English and Chinese text', () => {
  const text =
    'Results are higher. Second findings support this. However, 研究结果更高，第二项显示。';
  const expected = [
    { text: 'Results', category: 'results' },
    { text: 'higher', category: 'comparison' },
    { text: 'Second', category: 'ordinals' },
    { text: 'findings', category: 'results' },
    { text: 'support', category: 'discovery' },
    { text: 'However', category: 'logic' },
    { text: '研究结果', category: 'results' },
    { text: '更高', category: 'comparison' },
    { text: '第二', category: 'ordinals' },
    { text: '显示', category: 'discovery' },
  ];
  assert.deepEqual(informationSummary(text, importantInformationRanges(text)), expected);
  assert.deepEqual(
    informationSummary(text, importantInformationRanges(text, { research: false })),
    [
      { text: 'Second', category: 'ordinals' },
      { text: 'support', category: 'discovery' },
      { text: 'However', category: 'logic' },
      { text: '第二', category: 'ordinals' },
      { text: '显示', category: 'discovery' },
    ],
  );
  assert.deepEqual(
    informationSummary(text, importantInformationRanges(text, { ordinals: false })),
    [
      { text: 'Results', category: 'results' },
      { text: 'higher', category: 'comparison' },
      { text: 'findings', category: 'results' },
      { text: 'support', category: 'discovery' },
      { text: 'However', category: 'logic' },
      { text: '研究结果', category: 'results' },
      { text: '更高', category: 'comparison' },
      { text: '显示', category: 'discovery' },
    ],
  );
  assert.deepEqual(informationSummary(text, importantInformationRanges(text, { verbs: false })), [
    { text: 'Results', category: 'results' },
    { text: 'higher', category: 'comparison' },
    { text: 'Second', category: 'ordinals' },
    { text: 'findings', category: 'results' },
    { text: 'However', category: 'logic' },
    { text: '研究结果', category: 'results' },
    { text: '更高', category: 'comparison' },
    { text: '第二', category: 'ordinals' },
  ]);
  assert.deepEqual(informationSummary(text, importantInformationRanges(text, { logic: false })), [
    { text: 'Results', category: 'results' },
    { text: 'higher', category: 'comparison' },
    { text: 'Second', category: 'ordinals' },
    { text: 'findings', category: 'results' },
    { text: 'support', category: 'discovery' },
    { text: '研究结果', category: 'results' },
    { text: '更高', category: 'comparison' },
    { text: '第二', category: 'ordinals' },
    { text: '显示', category: 'discovery' },
  ]);
  const segments = informationTextSegments(text, {
    emphasizeInformation: true,
    categories: NO_CATEGORIES,
  });
  assert.deepEqual(importantInformationRanges(text, NO_CATEGORIES), []);
  assert.equal(segments.map((segment) => segment.text).join(''), text);
  assert.equal(
    segments.some((segment) => segment.important),
    false,
  );
});

test('information run ranges map phrases spanning native text runs without changing run text', () => {
  const runs = [
    { text: 'statistical', x: 0, y: 0, width: 55, height: 10 },
    { text: 'significance', x: 65, y: 0, width: 70, height: 10 },
    { text: '研究', x: 0, y: 20, width: 20, height: 10 },
    { text: '结果', x: 20, y: 20, width: 20, height: 10 },
  ];
  assert.deepEqual(informationRunRanges(runs), [
    { index: 0, start: 0, end: 11, category: 'results' },
    { index: 1, start: 0, end: 12, category: 'results' },
    { index: 2, start: 0, end: 2, category: 'results' },
    { index: 3, start: 0, end: 2, category: 'results' },
  ]);
  assert.deepEqual(informationRunRanges(runs, { research: false }), []);
  assert.deepEqual(
    runs.map((run) => run.text),
    ['statistical', 'significance', '研究', '结果'],
  );
});

test('flattened information preferences migrate defaults, persist, reload, and reject invalid booleans', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pdfmathreader-information-preferences-'));
  try {
    const path = join(directory, 'reader.json');
    await writeFile(
      path,
      JSON.stringify({ emphasizeInformation: false, emphasizeTopicSentences: true }),
    );
    const preferences = await createReaderPreferences(path);
    const keys = [
      'emphasizeResearchFindings',
      'emphasizeOrdinals',
      'emphasizeKeyVerbs',
      'emphasizeLogicalConnectives',
    ];
    for (const key of keys) assert.equal(preferences.load()[key], true);
    assert.equal(preferences.load().emphasizeInformation, false);
    const saved = {
      emphasizeResearchFindings: false,
      emphasizeOrdinals: false,
      emphasizeKeyVerbs: true,
      emphasizeLogicalConnectives: false,
    };
    await preferences.save(saved);
    await preferences.flush();
    const reloaded = (await createReaderPreferences(path)).load();
    for (const key of keys) assert.equal(reloaded[key], saved[key]);
    for (const key of keys) {
      for (const value of [0, 1, 'false', null])
        assert.throws(() => preferences.save({ [key]: value }), /Invalid reader preferences/);
      assert.equal(preferences.load()[key], saved[key]);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
