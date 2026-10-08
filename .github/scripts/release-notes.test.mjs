import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previousRelease, releaseNotes } from './release-notes.mjs';

test('baseline is the highest published lower semantic version, excluding drafts', () => {
  assert.equal(
    previousRelease('0.2.0', [
      { tag_name: 'v0.1.9' },
      { tag_name: 'v0.1.10' },
      { tag_name: 'v0.2.0-beta.1', draft: true },
      { tag_name: 'nightly' },
      { tag_name: 'v0.2.0' },
      { tag_name: 'v0.3.0' },
    ]).tag_name,
    'v0.1.10',
  );
  assert.equal(previousRelease('0.1.0', []), undefined);
});

const commit = (sha, message) => ({ sha, commit: { message } });
const options = {
  repo: 'PDFMathTranslate/PDFMathReader',
  version: '0.1.3',
  sha: 'a'.repeat(40),
  previous: { tag_name: 'v0.1.2' },
  assets: [
    'artifacts/PDFMathReader-darwin-arm64.zip',
    'artifacts/PDFMathReader-linux-armv7l.tar.gz',
  ],
};
test('notes group user changes, retain details, omit internal commits and trailers', () => {
  const feature = commit(
    'b'.repeat(40),
    'feat(reader): Formula OCR\n\nRecognize and copy LaTeX.\n\nCo-authored-by: Bot <bot@example.com>',
  );
  const notes = releaseNotes({
    ...options,
    commits: [
      feature,
      feature,
      commit('c'.repeat(40), 'ux: Improve error dialog'),
      commit('d'.repeat(40), 'fix: Preserve preferences'),
      commit('e'.repeat(40), 'ci: Cache dependencies'),
      commit('f'.repeat(40), 'release: 0.1.3'),
    ],
  });
  assert.match(notes, /1 new features and 2 fixes/);
  assert.match(notes, /\*\*Formula OCR\*\* — Recognize and copy LaTeX\./);
  assert.match(notes, /### Fixes and improvements/);
  assert.doesNotMatch(notes, /Bot|Cache dependencies|release: 0/);
  assert.match(notes, /releases\/download\/v0.1.3\/PDFMathReader-darwin-arm64.zip/);
  assert.match(notes, /Linux ARMv7/);
  assert.match(notes, /compare\/v0.1.2\.\.\.a{40}/);
});
test('first release and maintenance-only changes still have useful notes', () => {
  const notes = releaseNotes({ ...options, previous: undefined, commits: [] });
  assert.match(notes, /maintenance updates/);
  assert.match(notes, /commits\/a{40}/);
  assert.match(notes, /## Update/);
});
test('commit text cannot inject HTML or Markdown headings', () => {
  const notes = releaseNotes({
    ...options,
    commits: [commit('b'.repeat(40), 'fix: <script>\n\n# heading')],
  });
  assert.doesNotMatch(notes, /<script>/);
  assert.match(notes, /\\# heading/);
});
