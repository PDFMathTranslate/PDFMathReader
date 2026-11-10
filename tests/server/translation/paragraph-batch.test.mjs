import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BATCH_MAX_ITEMS,
  parseBatchTranslations,
  planBatches,
} from '../../../server/translation/paragraph-batch.mjs';
import { createAdaptiveLimits } from '../../../server/translation/adaptive-limits.mjs';

const items = (lengths) => lengths.map((length, index) => ({ index, text: 'x'.repeat(length) }));

test('batch plan keeps order, bounds size and isolates long paragraphs', () => {
  const plan = planBatches(items([100, 100, 100, 3000, 100, 100]), 2);
  assert.deepEqual(
    plan.map((batch) => batch.map((item) => item.index)),
    [[0, 1, 2], [3], [4, 5]],
  );
  const many = planBatches(items(Array(20).fill(10)), 1);
  assert.ok(many.every((batch) => batch.length <= BATCH_MAX_ITEMS));
  assert.deepEqual(
    many.flat().map((item) => item.index),
    [...Array(20).keys()],
  );
});

test('batch replies parse fenced JSON and reject missing or duplicated ids', () => {
  const content =
    '```json\n{"translations":[{"id":0,"text":"甲"},{"id":2,"text":"丙"},{"id":2,"text":"重复"},{"id":9,"text":"越界"}]}\n```';
  assert.deepEqual(parseBatchTranslations(content, 3), ['甲', null, null]);
  assert.deepEqual(parseBatchTranslations('not json', 2), [null, null]);
});

test('adaptive limits halve on 429, retry once and grow after a clean window', async () => {
  let clock = 0;
  const waits = [];
  const limits = createAdaptiveLimits({
    now: () => clock,
    wait: async (ms) => waits.push(ms),
  });
  const provider = { id: 'openai', identity: { service: 'openai', model: 'm' } };
  const responses = [new Response('{}', { status: 429, headers: { 'Retry-After': '1' } })];
  const ok = () => responses.shift() || Response.json({});
  assert.equal((await limits.run(provider, 4, ok)).status, 200);
  assert.deepEqual(waits, [1000]);
  assert.equal(limits.limit(provider), 2);
  clock = 60_000;
  await limits.run(provider, 4, ok);
  await limits.run(provider, 4, ok);
  assert.equal(limits.limit(provider), 3);
  await assert.rejects(
    limits.run(provider, 4, async () => {
      throw Error('ChatGPT Subscription request failed (HTTP 429).');
    }),
    /HTTP 429/,
  );
  assert.equal(limits.limit(provider), 1);
});

test('batch route shares the paragraph cache and falls back for missing items', async () => {
  const { startServer } = await import('../../../server/index.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'pmr-batch-api-'));
  const calls = [];
  const backend = await startServer({
    port: 0,
    development: false,
    cacheDir: directory,
    providerFetch: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push(body);
      const user = body.messages.at(-1).content;
      if (body.messages[0].content.includes('{"translations"')) {
        // Drop the second paragraph so the route must translate it alone.
        const translations = JSON.parse(user)
          .paragraphs.filter((paragraph) => paragraph.id !== 1)
          .map((paragraph) => ({ id: paragraph.id, text: `译:${paragraph.text}` }));
        return Response.json({
          choices: [{ message: { content: JSON.stringify({ translations }) } }],
        });
      }
      return Response.json({ choices: [{ message: { content: `单:${user}` } }] });
    },
  });
  const service = {
    id: 'openai',
    values: { key: 'test-key', model: 'test-model', base_url: 'http://provider.test/v1' },
  };
  const post = async (path, body) =>
    (
      await fetch(backend.origin + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'Simplified Chinese',
          translationService: service,
          ...body,
        }),
      })
    ).json();
  try {
    const texts = ['first paragraph', 'second paragraph', 'treatment effect here'];
    const glossary = [{ source: 'treatment effect', target: '处理效应' }];
    const first = await post('/api/translate-batch', {
      items: texts.map((text) => ({ text })),
      glossary,
    });
    assert.deepEqual(
      first.results.map((result) => result.translation),
      ['译:first paragraph', '单:second paragraph', '译:处理效应 here'],
    );
    assert.equal(calls.length, 2);
    const single = await post('/api/translate', { text: texts[0], glossary });
    assert.equal(single.cached, true);
    assert.equal(single.translation, '译:first paragraph');
    const again = await post('/api/translate-batch', {
      items: texts.map((text) => ({ text })),
      glossary,
    });
    assert.ok(again.results.every((result) => result.cached === true));
    assert.equal(calls.length, 2);
    const invalid = await fetch(backend.origin + '/api/translate-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'Simplified Chinese', items: [] }),
    });
    assert.equal(invalid.status, 400);
  } finally {
    await backend.close();
    await rm(directory, { recursive: true, force: true });
  }
});
