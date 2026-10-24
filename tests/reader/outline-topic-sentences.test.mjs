import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  outlineTopicSentences,
  pageParagraphs,
} from '../../src/features/reader/outline-topic-sentences.mjs';

const line = (text, y, { x = 72, size = 10, right = 520 } = {}) => ({ text, x, y, size, right });
const filler = 'The model uses ordinary words to fill this line of the paragraph';
// Three long sentences wrapped over six lines, with an indented first line.
const paragraph = (topic, y) => [
  line(`${topic} across many observed`, y, { x: 84 }),
  line(`settings and samples. ${filler}`, y + 12),
  line(`${filler}. ${filler}`, y + 24),
  line(`${filler} again for good`, y + 36),
  line(`measure. ${filler} while the`, y + 48),
  line('section closes here.', y + 60, { right: 200 }),
];

test('splits indented paragraphs and rejoins hyphenated words', () => {
  const lines = [
    line('Results show a stable effect of the treat-', 100),
    line('ment. Another sentence.', 112, { right: 300 }),
    line('A new paragraph starts here.', 124, { x: 84 }),
  ];
  assert.deepEqual(
    pageParagraphs(lines).map((item) => item.text),
    [
      'Results show a stable effect of the treatment. Another sentence.',
      'A new paragraph starts here.',
    ],
  );
});

test('attaches topic sentences to the deepest preceding outline entry', () => {
  const outline = [
    { id: '0', title: '1 Introduction', depth: 0, page: 1 },
    { id: '0.0', title: '1.1 Background', depth: 1, page: 1 },
    { id: '0.1', title: '1.2 Method', depth: 1, page: 2 },
  ];
  const pages = new Map([
    [
      1,
      [
        line('1 Introduction', 60, { size: 14 }),
        ...paragraph('Intro claims hold', 80),
        line('1.1 Background', 160, { size: 12 }),
        ...paragraph('Earlier work finds effects', 180),
      ],
    ],
    [
      2,
      [
        ...paragraph('Background continues here', 60),
        line('1.2 Method', 140, { size: 12 }),
        ...paragraph('We estimate effects', 160),
      ],
    ],
  ]);
  const result = outlineTopicSentences(outline, pages);
  const sentences = (id) => result.get(id)?.map((item) => item.sentence);
  assert.deepEqual(sentences('0'), [
    'Intro claims hold across many observed settings and samples.',
  ]);
  assert.deepEqual(sentences('0.0'), [
    'Earlier work finds effects across many observed settings and samples.',
    'Background continues here across many observed settings and samples.',
  ]);
  assert.deepEqual(sentences('0.1'), [
    'We estimate effects across many observed settings and samples.',
  ]);
  assert.equal(result.get('0.1')[0].page, 2);
  assert.ok(result.get('0.1')[0].paragraph.startsWith(result.get('0.1')[0].sentence));
});

test('skips short paragraphs and text before the first heading', () => {
  const outline = [{ id: '0', title: 'Methods', depth: 0, page: 1 }];
  const pages = new Map([
    [
      1,
      [
        ...paragraph('Front matter text', 40),
        line('Methods', 120, { size: 14 }),
        line('Short paragraph. Two sentences.', 140, { right: 300 }),
      ],
    ],
  ]);
  assert.equal(outlineTopicSentences(outline, pages).size, 0);
});
