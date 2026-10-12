import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLines,
  generateToc,
  numberingDepth,
  titleKey,
} from '../../src/features/reader/toc-generator.mjs';

const text = (value, x, y, size = 10, width = value.length * size * 0.5) => ({
  text: value,
  x,
  y,
  size,
  width,
});
const body = (page, from = 120, count = 8) =>
  Array.from({ length: count }, (_, i) =>
    text(`Body sentence ${page}-${i} with some ordinary words`, 72, from + i * 14),
  );
const document = (pages) => ({
  numPages: pages.length,
  getPageLines: async (number) =>
    buildLines(pages[number - 1], { number, width: 612, height: 792 }),
});

test('numbering depth and title keys ignore enumeration', () => {
  assert.equal(numberingDepth('2.3.1 Estimation'), 2);
  assert.equal(numberingDepth('1 Introduction'), 0);
  assert.equal(numberingDepth('第三章 方法'), 0);
  assert.equal(numberingDepth('2023 results were strong'), null);
  assert.equal(titleKey('Chapter 2 Related Work'), 'relatedwork');
  assert.equal(titleKey('1.2 Data and Methods'), 'dataandmethods');
});

test('lines group items by baseline and detect gap-separated page numbers', () => {
  const [line] = buildLines([text('Methods', 72, 100), text('14', 500, 100)], { number: 3 });
  assert.equal(line.page, 3);
  assert.equal(line.body, 'Methods');
  assert.equal(line.printed, '14');
});

test('a printed contents page is parsed and mapped to physical pages', async () => {
  const entries = [
    ['Introduction', 1, 72],
    ['Background', 5, 72],
    ['Prior work', 6, 96],
    ['Method', 9, 72],
    ['Experiments', 12, 72],
    ['Conclusion', 15, 72],
  ];
  const pages = Array.from({ length: 24 }, (_, i) => body(i + 1));
  pages[0] = [text('A Study of Things', 150, 300, 24)];
  pages[1] = [
    text('Contents', 72, 80, 16),
    ...entries.map(([title, page, x], i) =>
      text(`${title} ${'.'.repeat(30)} ${page}`, x, 120 + i * 18),
    ),
  ];
  // Printed page 1 sits on physical page 3, so the offset is +2.
  entries.forEach(([title, page]) => pages[page + 1].unshift(text(title, 72, 90, 14)));
  const result = await generateToc(document(pages));
  assert.equal(result.source, 'toc-page');
  assert.deepEqual(
    result.items.map(({ id, title, depth, page }) => [id, title, depth, page]),
    [
      ['0', 'Introduction', 0, 3],
      ['1', 'Background', 0, 7],
      ['1.0', 'Prior work', 1, 8],
      ['2', 'Method', 0, 11],
      ['3', 'Experiments', 0, 14],
      ['4', 'Conclusion', 0, 17],
    ],
  );
});

test('a contents page without dot leaders uses the right-aligned numbers', async () => {
  const names = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
  const pages = Array.from({ length: 14 }, (_, i) => body(i + 1));
  pages[1] = [
    text('Table of Contents', 72, 80, 16),
    ...names.flatMap((name, i) => [
      text(`${i + 1} ${name} theory`, 72, 120 + i * 18),
      text(String(1 + i * 3), 520, 120 + i * 18),
    ]),
  ];
  names.forEach((name, i) => pages[i * 3 + 2].unshift(text(`${i + 1} ${name} theory`, 72, 90, 14)));
  const result = await generateToc(document(pages));
  assert.equal(result.source, 'toc-page');
  assert.deepEqual(
    result.items.map((item) => item.page),
    [3, 6, 9, 12],
  );
});

test('without a contents page, headings come from font size and numbering', async () => {
  const pages = Array.from({ length: 10 }, (_, i) => [
    text('Journal of Examples', 72, 30, 9),
    ...body(i + 1),
    text(String(i + 1), 300, 760, 9),
  ]);
  pages[0].unshift(text('The Title of the Paper', 120, 70, 22));
  pages[0].push(text('Introduction', 72, 110, 15));
  pages[2].push(text('Related Work', 72, 300, 15));
  pages[2].push(text('Prior surveys', 72, 340, 12));
  pages[5].push(text('Method', 72, 300, 15));
  pages[5].push(text('Estimation', 72, 340, 12));
  pages[8].push(text('Conclusion', 72, 300, 15));
  const result = await generateToc(document(pages));
  assert.equal(result.source, 'heuristic');
  assert.deepEqual(
    result.items.map(({ title, depth, page }) => [title, depth, page]),
    [
      ['Introduction', 0, 1],
      ['Related Work', 0, 3],
      ['Prior surveys', 1, 3],
      ['Method', 0, 6],
      ['Estimation', 1, 6],
      ['Conclusion', 0, 9],
    ],
  );
});

test('plain prose produces no contents and reports progress', async () => {
  const pages = Array.from({ length: 6 }, (_, i) => body(i + 1));
  const progress = [];
  const result = await generateToc({
    ...document(pages),
    onProgress: (state) => progress.push(state),
  });
  assert.deepEqual(result, { items: [], source: null });
  assert.equal(progress.at(-1).phase, 'headings');
  assert.deepEqual(progress.at(-1), { phase: 'headings', done: 6, total: 6 });
});

test('generation stops when cancelled', async () => {
  const controller = new AbortController();
  const pages = Array.from({ length: 6 }, (_, i) => body(i + 1));
  const source = document(pages);
  await assert.rejects(
    generateToc({
      ...source,
      signal: controller.signal,
      getPageLines: async (number) => {
        if (number === 3) controller.abort();
        return source.getPageLines(number);
      },
    }),
    { name: 'AbortError' },
  );
});

test('running headers and unnumbered lines are not joined into wrapped contents titles', async () => {
  const pages = Array.from({ length: 14 }, (_, i) => body(i + 1));
  pages[1] = [
    text('viii Contents', 72, 50, 9),
    text('Preface xm', 72, 100),
    ...['One', 'Two', 'Three', 'Four', 'Five'].map((name, i) =>
      text(`${name} topic ${'.'.repeat(25)} ${i * 2 + 1}`, 72, 140 + i * 18),
    ),
    // A title wrapped over two lines: the first line ends mid-phrase.
    text('A very long title that continues and', 72, 240),
    text(`wraps here ${'.'.repeat(25)} 11`, 90, 254),
  ];
  // Printed page 1 is physical page 3.
  [
    ['One topic', 1],
    ['Two topic', 3],
    ['Three topic', 5],
    ['Four topic', 7],
    ['Five topic', 9],
    ['A very long title that continues and wraps here', 11],
  ].forEach(([title, printed]) => pages[printed + 1].unshift(text(title, 72, 90, 14)));
  const { items } = await generateToc(document(pages));
  assert.deepEqual(
    items.map((item) => item.title),
    [
      'One topic',
      'Two topic',
      'Three topic',
      'Four topic',
      'Five topic',
      'A very long title that continues and wraps here',
    ],
  );
});

test('a contents list continues across pages whose running header repeats the heading', async () => {
  const entry = (name, page, y) => text(`${name} ${'.'.repeat(25)} ${page}`, 72, y);
  const pages = Array.from({ length: 12 }, (_, i) => body(i + 1));
  pages[1] = [
    text('Contents', 72, 80, 16),
    ...['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) =>
      entry(`Chapter ${n} title`, i + 1, 120 + i * 18),
    ),
  ];
  pages[2] = [
    text('iv Contents', 72, 50, 9),
    entry('Chapter G title', 7, 120),
    entry('Chapter H title', 8, 138),
  ];
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach((n, i) =>
    pages[i + 3].unshift(text(`Chapter ${n} title`, 72, 90, 14)),
  );
  const { items, source } = await generateToc(document(pages));
  assert.equal(source, 'toc-page');
  assert.equal(items.length, 8);
  assert.deepEqual(items.at(-1), {
    id: '7',
    title: 'Chapter H title',
    depth: 0,
    page: 11,
    source: 'toc-page',
  });
});

test('two-column pages keep each column on its own lines', () => {
  const left = Array.from({ length: 12 }, (_, i) =>
    text(`left column line ${i}`, 60, 100 + i * 12, 10, 200),
  );
  const right = Array.from({ length: 12 }, (_, i) =>
    text(`right column line ${i}`, 330, 100 + i * 12, 10, 200),
  );
  const lines = buildLines([...right, ...left], { width: 612, height: 792 });
  assert.equal(lines.length, 24);
  assert.deepEqual(
    lines.slice(0, 2).map((line) => line.text),
    ['left column line 0', 'left column line 1'],
  );
  assert.equal(lines[12].text, 'right column line 0');
});

test('first-page front matter is not reported as sections', async () => {
  const pages = Array.from({ length: 8 }, (_, i) => body(i + 1));
  pages[0].unshift(
    text('Journal of Health Communication', 72, 60, 16),
    text('A. Author, B. Author, C. Author', 72, 100, 13),
  );
  pages[0].push(text('Introduction', 72, 250, 14));
  [2, 4, 6].forEach((i) => pages[i].push(text(`Section ${i}`, 72, 250, 14)));
  const { items } = await generateToc(document(pages));
  assert.deepEqual(
    items.map((item) => item.title),
    ['Introduction', 'Section 2', 'Section 4', 'Section 6'],
  );
});

test('a contents page of short titles and right-hand page numbers is not split into columns', () => {
  const titles = Array.from({ length: 14 }, (_, i) => text(`Topic ${i}`, 72, 100 + i * 16, 10, 60));
  const numbers = Array.from({ length: 14 }, (_, i) =>
    text(String(i + 1), 500, 100 + i * 16, 10, 12),
  );
  const lines = buildLines([...titles, ...numbers], { width: 612, height: 792 });
  assert.equal(lines.length, 14);
  assert.deepEqual([lines[0].body, lines[0].printed], ['Topic 0', '1']);
});
