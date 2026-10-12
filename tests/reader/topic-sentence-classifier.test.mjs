import test from 'node:test';
import assert from 'node:assert/strict';
import { createTopicSentenceClassifier } from '../../src/features/translation/topic-sentence-classifier.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture(api, options = {}) {
  const state = { document: {}, epoch: 1, enabled: true, token: 'custom' };
  let updates = 0;
  const classifier = createTopicSentenceClassifier({
    context: () => state,
    api,
    onUpdate: () => updates++,
    ...options,
  });
  return { classifier, state, updates: () => updates };
}
const check = (f, id = 1) =>
  f.classifier.isTopicSentence(`First ${id}. Supporting text.`, `First ${id}.`);

test('four lanes run independently, duplicate paragraphs share requests and publish decisions', async () => {
  const pending = [];
  const f = fixture((path, options) => {
    assert.equal(path, '/api/topic-sentence');
    assert.equal(JSON.parse(options.body).token, 'custom');
    return new Promise((resolve) => pending.push(resolve));
  });
  try {
    for (let id = 1; id <= 6; id++) assert.equal(check(f, id), true);
    check(f, 1);
    await tick();
    assert.equal(pending.length, 4);
    pending[1]({ isTopicSentence: false, status: 'classified' });
    await tick();
    assert.equal(pending.length, 5, 'another lane continues while first request is slow');
    assert.equal(check(f, 2), false);
    assert.equal(check(f, 1), true);
    assert.equal(f.updates(), 1);
    pending[0]({ isTopicSentence: true, status: 'classified' });
    await tick();
    assert.equal(pending.length, 6);
    assert.equal(check(f, 1), true);
  } finally {
    f.classifier.dispose();
  }
});

test('disabled feature and oversized text never send requests', async () => {
  const f = fixture(() => assert.fail('unexpected request'));
  f.state.enabled = false;
  assert.equal(check(f), true);
  f.state.enabled = true;
  assert.equal(f.classifier.isTopicSentence('A.' + '😀'.repeat(12000), 'A.'), true);
  assert.equal(f.classifier.isTopicSentence('A. Rest.', 'Wrong.'), true);
  await tick();
  f.classifier.dispose();
});

test('errors and malformed replies default to yes and cache the fallback', async () => {
  for (const reply of [
    null,
    {},
    { isTopicSentence: false, status: 'fallback' },
    { isTopicSentence: 'no', status: 'classified' },
    new Error('offline'),
  ]) {
    let calls = 0;
    const f = fixture(async () => {
      calls++;
      if (reply instanceof Error) throw reply;
      return reply;
    });
    assert.equal(check(f), true);
    await tick();
    assert.equal(check(f), true);
    assert.equal(calls, 1);
    assert.equal(f.updates(), 1);
    f.classifier.dispose();
  }
});

test('hung requests expire to yes and release their lane', async () => {
  let calls = 0,
    firstSignal;
  const f = fixture(
    (_path, options) => {
      calls++;
      if (calls === 1) {
        firstSignal = options.signal;
        return new Promise(() => {});
      }
      return { isTopicSentence: false, status: 'classified' };
    },
    { concurrency: 1, timeoutMs: 20 },
  );
  try {
    check(f, 1);
    check(f, 2);
    await new Promise((resolve) => setTimeout(resolve, 45));
    assert.equal(firstSignal.aborted, true);
    assert.equal(check(f, 1), true);
    assert.equal(check(f, 2), false);
    assert.equal(calls, 2);
  } finally {
    f.classifier.dispose();
  }
});

test('document and credential changes discard old results and old queued requests', async () => {
  const requests = [];
  const f = fixture(
    (_path, options) => new Promise((resolve) => requests.push({ options, resolve })),
    { concurrency: 1 },
  );
  try {
    check(f, 1);
    check(f, 2);
    await tick();
    f.state.document = {};
    f.state.epoch++;
    f.state.token = 'new-token';
    check(f, 3);
    await tick();
    assert.equal(requests.length, 2);
    assert.equal(requests[0].options.signal.aborted, true);
    assert.equal(JSON.parse(requests[1].options.body).token, 'new-token');
    requests[0].resolve({ isTopicSentence: false, status: 'classified' });
    await tick();
    assert.equal(f.updates(), 0);
    requests[1].resolve({ isTopicSentence: false, status: 'classified' });
    await tick();
    assert.equal(check(f, 3), false);
    assert.equal(f.updates(), 1);
    check(f, 4);
    await tick();
    f.state.enabled = false;
    assert.equal(check(f, 4), true);
    await tick();
    assert.equal(requests[2].options.signal.aborted, true);
  } finally {
    f.classifier.dispose();
  }
});

test('backlog is bounded when a large document is mounted', async () => {
  let calls = 0;
  const f = fixture(() => {
    calls++;
    return new Promise(() => {});
  });
  for (let id = 0; id < 1000; id++) check(f, id);
  await tick();
  assert.equal(calls, 4);
  f.classifier.dispose();
  await tick();
  assert.equal(calls, 4, 'dispose discards queued document text');
});
