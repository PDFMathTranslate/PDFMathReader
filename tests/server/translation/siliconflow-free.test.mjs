import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTranslationProvider,
  selectTranslationProvider,
  FREE_ENDPOINTS,
} from '../../../server/translation/translation-provider.mjs';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const marker = ';; Treat next line as plain text input and translate it into';
const signal = () => new AbortController().signal;
const free = (extra = {}) => ({ ...selectTranslationProvider(''), ...extra });
// Fake proxy: /check and /config answer, completions follow `reply` per call.
function proxy({ qps = 10, reply = () => json({ content: '译文' }) } = {}) {
  const sent = [];
  const fetch = async (url, options = {}) => {
    if (url.endsWith('/check')) return json({ status: 'ok' });
    if (url.endsWith('/config')) return json({ qps, max_pool_size: 100, status: 'ok' });
    const body = JSON.parse(options.body);
    sent.push({ url, body, at: Date.now() });
    return reply(sent.length, body);
  };
  return { fetch, sent };
}
const text = async (response) => (await response.json()).choices[0].message.content;

test('free requests are spaced by the qps advertised in /config', async () => {
  const { fetch, sent } = proxy({ qps: 20 });
  const client = createTranslationProvider(fetch);
  const messages = (n) => ({ messages: [{ role: 'user', content: `Paragraph ${n}` }] });
  await Promise.all([0, 1, 2, 3].map((n) => client.complete(free(), messages(n), signal())));
  assert.equal(sent.length, 4);
  const span = sent.at(-1).at - sent[0].at;
  assert.ok(span >= 140, `expected about 150 ms between 4 starts at 20 qps, got ${span}`);
});

test('429 retries until the shared quota clears', async () => {
  const delays = [];
  const { fetch, sent } = proxy({
    reply: (n) =>
      n < 4 ? json({ code: 50602, message: 'TPM limit reached.' }, 429) : json({ content: '好' }),
  });
  const client = createTranslationProvider(fetch, {
    retryDelay: (attempt) => (delays.push(attempt), 1),
  });
  const response = await client.complete(free(), { messages: [{ content: 'Hi' }] }, signal());
  assert.equal(response.status, 200);
  assert.equal(await text(response), '好');
  assert.equal(sent.length, 4);
  assert.deepEqual(delays, [0, 1, 2]);
});

test('aborting stops 429 retries', async () => {
  const controller = new AbortController();
  const { fetch, sent } = proxy({ reply: () => json({ message: 'TPM limit reached.' }, 429) });
  const client = createTranslationProvider(fetch, {
    retryDelay: () => {
      if (sent.length === 2) controller.abort();
      return 1;
    },
  });
  await assert.rejects(
    client.complete(free(), { messages: [{ content: 'Hi' }] }, controller.signal),
  );
  assert.equal(sent.length, 2);
});

test('server errors stop after three attempts across endpoints', async () => {
  const { fetch, sent } = proxy({ reply: () => json({}, 500) });
  const client = createTranslationProvider(fetch, { retryDelay: () => 1 });
  const response = await client.complete(free(), { messages: [{ content: 'Hi' }] }, signal());
  assert.equal(response.status, 500);
  assert.equal(sent.length, 6);
  assert.deepEqual(new Set(sent.map((call) => call.url)), new Set(FREE_ENDPOINTS));
});

test('Precise and custom prompts are framed by the proxy template without JSON mode', async () => {
  const { fetch, sent } = proxy();
  const client = createTranslationProvider(fetch);
  const babeldoc =
    'You are a professional zh_CN native translator who needs to fluently translate text into zh_CN.\n\nFollow all rules strictly.\n\n## Here is the input:\n\n[{"id": 0, "input": "Hi"}]';
  await client.complete(
    free({ kernel: 'pdf_math_precise', language: 'zh_CN' }),
    { messages: [{ role: 'user', content: babeldoc }], response_format: { type: 'json_object' } },
    signal(),
  );
  await client.complete(
    free({ kernel: 'pdf_math_fast', language: 'zh' }),
    { messages: [{ role: 'user', content: 'Translate formally into Chinese:\n\nHi' }] },
    signal(),
  );
  for (const [call, task, language] of [
    [sent[0], babeldoc, 'zh_CN'],
    [sent[1], 'Translate formally into Chinese:\n\nHi', 'zh'],
  ]) {
    assert.ok(call.body.text.includes(`${marker} ${language},`));
    assert.ok(call.body.text.endsWith('\n\n' + task));
    assert.match(call.body.text, /Follow those rules exactly/);
    assert.equal(call.body.requestJsonMode, undefined);
  }
});

test('template prompts are sent unchanged', async () => {
  const { fetch, sent } = proxy();
  const client = createTranslationProvider(fetch);
  await client.complete(
    free({ kernel: 'pdf_math_fast', language: 'zh' }),
    {
      messages: [
        {
          role: 'user',
          content:
            'You are a professional, authentic machine translation engine. Only Output the translated text, do not include any other text.\n\nTranslate the following markdown source text to zh. Keep the formula notation {v*} unchanged. Output translation directly without any additional text.\n\nSource Text: Energy {v0}\n\nTranslated Text:',
        },
      ],
    },
    signal(),
  );
  assert.ok(sent[0].body.text.startsWith('You are a professional,authentic machine'));
  assert.ok(sent[0].body.text.includes(`${marker} zh,`));
  assert.ok(sent[0].body.text.includes('Input:\n\nEnergy {v0}\nPreserve every numbered formula'));
  assert.doesNotMatch(sent[0].body.text, /Follow those rules exactly/);
});
