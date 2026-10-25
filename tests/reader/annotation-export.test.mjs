import assert from 'node:assert/strict';
import test from 'node:test';
import {
  annotationExportName,
  formatAnnotations,
} from '../../src/features/annotations/annotation-export.mjs';

const at = (id, page, y, text, comment = '') => ({
  id,
  page,
  kind: comment ? 'comment' : 'highlight',
  text,
  comment,
  rects: [{ x: 10, y, width: 5, height: 5 }],
  createdAt: '2026-10-01T00:00:00Z',
});
const annotations = [
  at('c', 5, 20, 'Methods\nsentence', 'check this'),
  at('a', 1, 50, 'Preface remark'),
  at('b', 3, 10, 'Background claim'),
  at('d', 5, 10, '', 'standalone note'),
];
const outline = [
  { id: '0', title: 'Introduction', depth: 0, page: 2 },
  { id: '0.0', title: 'Background', depth: 1, page: 3 },
  { id: '0.1', title: 'Unused', depth: 1, page: 4 },
  { id: '1', title: 'Methods', depth: 0, page: 5 },
  { id: '1.0', title: 'Empty', depth: 1, page: 9 },
];

test('flat markdown lists annotations in reading order with nested comments', () => {
  assert.equal(
    formatAnnotations(annotations, { format: 'markdown', title: 'Paper.pdf' }),
    [
      '# Paper.pdf',
      '',
      '- Preface remark (p. 1)',
      '- Background claim (p. 3)',
      '- standalone note (p. 5)',
      '- Methods sentence (p. 5)',
      '  - check this',
      '',
    ].join('\n'),
  );
});

test('outline markdown nests annotations under their enclosing headings', () => {
  assert.equal(
    formatAnnotations(annotations, { format: 'markdown-outline', outline }),
    [
      '- Preface remark (p. 1)',
      '- **Introduction**',
      '  - **Background**',
      '    - Background claim (p. 3)',
      '- **Methods**',
      '  - standalone note (p. 5)',
      '  - Methods sentence (p. 5)',
      '    - check this',
      '',
    ].join('\n'),
  );
});

test('plain text separates annotations with blank lines', () => {
  assert.equal(
    formatAnnotations(annotations.slice(0, 1), { format: 'text', title: 'Paper' }),
    'Paper\n\np. 5\nMethods sentence\nComment: check this\n',
  );
  assert.throws(() => formatAnnotations([], { format: 'docx' }));
});

test('export file names drop the document extension', () => {
  assert.equal(annotationExportName('A/B.pdf', 'text'), 'A-B annotations.txt');
  assert.equal(annotationExportName('', 'markdown'), 'Document annotations.md');
});
