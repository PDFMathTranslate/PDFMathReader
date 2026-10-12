import test from 'node:test';
import assert from 'node:assert/strict';
import { createParagraphContinuation } from '../../src/features/translation/paragraph-continuation.mjs';
import {
  orderedParagraphBlocks,
  paragraphContinuationCandidate,
  combineParagraphText,
  splitParagraphTranslation,
} from '../../shared/translation/paragraph-fragments.mjs';
import {
  topicSentenceParagraphs,
  topicParagraphBoxes,
} from '../../src/features/translation/topic-sentences.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));
const block = (id, text, x = 40, y = 70) => ({
  id,
  text,
  x,
  y,
  width: 220,
  height: 30,
  fontSize: 12,
});
const page = (number, blocks) => ({ number, blocks, width: 600, height: 800 });
function fixture(pages, api, options = {}) {
  const state = { epoch: 1, enabled: true, token: 'synthetic' };
  const reads = [];
  const service = createParagraphContinuation({
    context: () => state,
    pages: () => pages,
    ensureLayout: async (p) => {
      reads.push(p.number);
    },
    api,
    ...options,
  });
  return { service, state, reads };
}

test('reading order follows columns and retains spanning headings as barriers', () => {
  const a = block(1, 'First column begins.', 40, 100),
    b = block(2, 'First column continues.', 40, 350),
    c = block(3, 'Second column begins.', 320, 100),
    d = block(4, 'Second column continues.', 320, 350),
    title = { ...block(0, 'A spanning heading', 40, 40), width: 520, bold: true },
    footer = { ...block(5, '1', 40, 778), height: 10, fontSize: 8 };
  assert.deepEqual(
    orderedParagraphBlocks(page(1, [c, footer, b, title, d, a])).map((b) => b.id),
    [0, 1, 2, 3, 4],
  );
  assert.equal(
    paragraphContinuationCandidate(
      { page: page(1, []), block: title },
      { page: page(1, []), block: a },
    ),
    false,
  );
  assert.equal(
    paragraphContinuationCandidate(
      { page: page(1, []), block: b },
      { page: page(1, []), block: c },
    ),
    true,
  );
  assert.equal(
    paragraphContinuationCandidate(
      { page: page(1, []), block: a },
      { page: page(1, []), block: c },
    ),
    true,
  );
});

test('small author notes cannot interrupt a body paragraph continued in the next column', async () => {
  const left = block(1, 'Main body discussion '.repeat(10), 40, 470),
    right = block(2, 'continues in the next column.', 320, 440),
    author = { ...block(3, 'Author contact', 40, 680), fontSize: 10.2 },
    email = { ...block(4, 'Contact address', 65, 715), fontSize: 10.2 },
    p = page(1, [right, author, left, email]);
  assert.deepEqual(
    orderedParagraphBlocks(p).map((b) => b.id),
    [1, 2],
  );
  const calls = [];
  const f = fixture([p], async (_path, options) => {
    calls.push(JSON.parse(options.body));
    return { combine: true, status: 'classified' };
  });
  try {
    const group = await f.service.groupFor(p, left);
    assert.deepEqual(
      group.members.map((m) => m.block.id),
      [1, 2],
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].after, right.text);
    assert.equal(p.blocks.length, 4, 'author notes remain available to the reader');
  } finally {
    f.service.invalidate();
  }
});

test('rejects mathematical regions, captions, lists and mismatched type', () => {
  const a = block(1, 'The main idea continues'),
    p = page(1, []);
  for (const b of [
    { ...block(2, 'with more evidence', 40, 140), math: true },
    block(2, 'Figure 2. Different content.', 40, 140),
    block(2, '2. An intentional list entry', 40, 140),
    { ...block(2, 'A heading', 40, 140), bold: true },
    { ...block(2, 'A tiny note', 40, 140), fontSize: 8 },
  ])
    assert.equal(
      paragraphContinuationCandidate({ page: p, block: a }, { page: p, block: b }),
      false,
    );
});

test('resolves one logical paragraph across columns and pages from either end with shared judgments', async () => {
  const a = block(1, 'A paragraph begins and', 40, 620),
    b = block(2, 'continues in the second column with', 320, 80),
    c = block(1, 'evidence on the next page.', 40, 60);
  const pages = [page(1, [b, a]), page(2, [c])];
  const calls = [];
  const f = fixture(pages, async (path, options) => {
    assert.equal(path, '/api/paragraph-continuation');
    calls.push(JSON.parse(options.body));
    return { combine: true, status: 'classified' };
  });
  try {
    const [first, last] = await Promise.all([
      f.service.groupFor(pages[0], a),
      f.service.groupFor(pages[1], c),
    ]);
    assert.equal(first, last);
    assert.deepEqual(
      first.members.map((m) => [m.page.number, m.block.id]),
      [
        [1, 1],
        [1, 2],
        [2, 1],
      ],
    );
    assert.equal(
      first.text,
      'A paragraph begins and continues in the second column with evidence on the next page.',
    );
    assert.equal(calls.length, 2);
    assert.ok(calls.every((call) => call.token === 'synthetic'));
  } finally {
    f.service.invalidate();
  }
});

test('disabled feature makes no requests or neighbor layout reads', async () => {
  const p = page(1, [block(1, 'An independent paragraph.')]);
  const f = fixture([p], () => assert.fail('request'));
  f.state.enabled = false;
  assert.equal((await f.service.groupFor(p, p.blocks[0])).members.length, 1);
  assert.deepEqual(f.reads, []);
});

test('uncertain and failed replies keep original fragments separate', async () => {
  for (const result of [
    { combine: false, status: 'classified' },
    { combine: true, status: 'fallback' },
    null,
    new Error('offline'),
  ]) {
    const p = page(1, [
      block(1, 'The sentence begins', 40, 80),
      block(2, 'and continues.', 40, 140),
    ]);
    const f = fixture([p], async () => {
      if (result instanceof Error) throw result;
      return result;
    });
    const group = await f.service.groupFor(p, p.blocks[0]);
    assert.equal(group.members.length, 1);
    assert.equal(group.members[0].block, p.blocks[0]);
    f.service.invalidate();
  }
});

test('four lanes classify separate boundaries while a slow request is pending', async () => {
  const p = page(
    1,
    Array.from({ length: 8 }, (_, i) =>
      block(i, `Fragment number ${i} starts here`, 40, 50 + i * 70),
    ),
  );
  const pending = [];
  const f = fixture([p], () => new Promise((resolve) => pending.push(resolve)));
  const tasks = p.blocks.map((b) => f.service.groupFor(p, b));
  await tick();
  assert.equal(pending.length, 4);
  pending[1]({ combine: false, status: 'classified' });
  await tick();
  assert.equal(pending.length, 5);
  f.service.invalidate();
  await Promise.all(tasks);
});

test('stale and timed-out requests cannot combine fragments', async () => {
  const p = page(1, [
    block(1, 'A sentence begins', 40, 80),
    block(2, 'with its continuation.', 40, 140),
  ]);
  let resolve, signal;
  const f = fixture([p], (_path, options) => {
    signal = options.signal;
    return new Promise((done) => (resolve = done));
  });
  const task = f.service.groupFor(p, p.blocks[0]);
  await tick();
  f.state.epoch++;
  resolve({ combine: true, status: 'classified' });
  assert.equal((await task).members.length, 1);
  f.service.invalidate();
  const timeout = fixture(
    [p],
    (_path, options) => {
      signal = options.signal;
      return new Promise(() => {});
    },
    { timeoutMs: 20 },
  );
  assert.equal((await timeout.service.groupFor(p, p.blocks[0])).members.length, 1);
  assert.equal(signal.aborted, true);
  timeout.service.invalidate();
});

test('joining heals wrap hyphens and translation splitting preserves every character in order', () => {
  assert.equal(
    combineParagraphText(['An inter-', 'rupted paragraph.']),
    'An interrupted paragraph.',
  );
  assert.equal(combineParagraphText(['这是被拆开的', '段落。']), '这是被拆开的段落。');
  const fragments = [
    { text: 'First source fragment' },
    { text: 'second fragment' },
    { text: 'last source fragment' },
  ];
  for (const translated of [
    'This is one complete translated paragraph.',
    '这是一段完整且连续的译文，用来验证中文分词。',
  ]) {
    const parts = splitParagraphTranslation(translated, fragments);
    assert.equal(parts.join(''), translated);
    assert.ok(parts.every((part) => part.length > 0));
  }
});

test('topic emphasis uses the full combined paragraph across original regions', () => {
  const a = block(1, 'The first sentence crosses this layout break', 40, 80);
  const b = block(
    2,
    'and finishes here. ' + 'Additional evidence supports the central claim. '.repeat(15),
    40,
    140,
  );
  const full = a.text + ' ' + b.text;
  for (const [index, item] of [a, b].entries()) {
    item.paragraphGroupId = '1:1';
    item.paragraphSourceText = full;
    item.paragraphSourceOffset = index === 0 ? 0 : a.text.length + 1;
  }
  const result = topicSentenceParagraphs(
    [a, b].map((b) => ({ ...b })),
    topicParagraphBoxes([a, b]),
  );
  assert.equal(result.length, 2);
  assert.ok(
    result.every(
      (p) =>
        p.text === full &&
        p.firstSentence === 'The first sentence crosses this layout break and finishes here.',
    ),
  );
  assert.equal(result[0].ranges[0].end, a.text.length);
  assert.equal(result[1].ranges[0].end, 'and finishes here.'.length);
  const nativeRuns = [a, b].map((item) => ({
    ...item,
    text: item.text.replace('finishes', 'fin-ishes'),
  }));
  const nativeResult = topicSentenceParagraphs(nativeRuns, topicParagraphBoxes([a, b]));
  assert.equal(
    nativeResult[1].ranges[0].end,
    'and fin-ishes here.'.length,
    'logical source offsets account for native wrap hyphens',
  );
});
