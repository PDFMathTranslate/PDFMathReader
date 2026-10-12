import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyTopicSentence } from '../../../server/translation/topic-sentence.mjs';

const response = (payload, ok = true) => ({
  ok,
  json: async () => payload,
});

const answer = (value) => ({
  answers: { first_sentence_topic: { type: 'noul', noul: value } },
});

const input = {
  paragraph:
    'Climate policy changes investment incentives. Firms therefore shift capital toward lower-emission technologies.',
  firstSentence: 'Climate policy changes investment incentives.',
};

test('classifies yes and sends the documented Jev request shape', async () => {
  let request;
  const result = await classifyTopicSentence(
    { ...input, token: 'custom-token' },
    {
      env: { TYPESAFE_API_KEY: 'environment-token' },
      fetchImpl: async (url, options) => {
        request = { url, options };
        return response(answer(0.5));
      },
    },
  );

  assert.deepEqual(result, { isTopicSentence: true, status: 'classified' });
  assert.equal(request.url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Authorization, 'Bearer custom-token');
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body, {
    model: 'jev-latest',
    state: input,
    questions: {
      first_sentence_topic: {
        type: 'noul',
        instructions:
          'Does `firstSentence` state or introduce the main idea developed by `paragraph`?',
        criteria: {
          true: 'The first sentence states or introduces the central idea developed by the rest of the paragraph.',
          false:
            'The first sentence only provides a transition, example, background detail, or another point rather than the paragraph’s main idea.',
        },
      },
    },
  });
});

test('classifies no below the threshold', async () => {
  const result = await classifyTopicSentence(input, {
    env: { TYPESAFE_API_KEY: 'environment-token' },
    fetchImpl: async () => response(answer(0.4999)),
  });

  assert.deepEqual(result, { isTopicSentence: false, status: 'classified' });
});

test('uses the environment token when the custom token is blank', async () => {
  let authorization;
  const result = await classifyTopicSentence(
    { ...input, token: '  ' },
    {
      env: { TYPESAFE_API_KEY: 'environment-token' },
      fetchImpl: async (_url, options) => {
        authorization = options.headers.Authorization;
        return response(answer(1));
      },
    },
  );

  assert.deepEqual(result, { isTopicSentence: true, status: 'classified' });
  assert.equal(authorization, 'Bearer environment-token');
});

test('does not log or expose tokens while classifying', async () => {
  const logs = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => logs.push(args);
  console.error = (...args) => logs.push(args);
  try {
    const result = await classifyTopicSentence(
      { ...input, token: 'secret-custom-token' },
      {
        env: { TYPESAFE_API_KEY: 'secret-environment-token' },
        fetchImpl: async () => response(answer(1)),
      },
    );
    assert.deepEqual(result, { isTopicSentence: true, status: 'classified' });
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  assert.deepEqual(logs, []);
});

test('falls back yes on missing credentials, invalid input, failures, and malformed answers', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    throw new Error('network failure');
  };
  const options = { env: {}, fetchImpl };

  for (const value of [
    {},
    { ...input, token: 42 },
    { ...input, paragraph: '', token: 'token' },
    { ...input, firstSentence: 'Investment incentives.', token: 'token' },
  ]) {
    assert.deepEqual(await classifyTopicSentence(value, options), {
      isTopicSentence: true,
      status: 'fallback',
    });
  }
  assert.equal(calls, 0);

  for (const payload of [
    {},
    { answers: { first_sentence_topic: { type: 'choice', noul: 1 } } },
    answer(-0.01),
    answer(1.01),
    { answers: { first_sentence_topic: { type: 'noul', noul: Number.NaN } } },
  ]) {
    assert.deepEqual(
      await classifyTopicSentence(
        { ...input, token: 'token' },
        { env: {}, fetchImpl: async () => response(payload) },
      ),
      { isTopicSentence: true, status: 'fallback' },
    );
  }

  assert.deepEqual(
    await classifyTopicSentence(
      { ...input, token: 'token' },
      { env: {}, fetchImpl: async () => response({}, false) },
    ),
    { isTopicSentence: true, status: 'fallback' },
  );
  assert.equal(calls, 0);
});

test('rejects oversized Unicode paragraphs without truncating or sending them', async () => {
  let calls = 0;
  const paragraph = '😀'.repeat(12001);
  const result = await classifyTopicSentence(
    { paragraph, firstSentence: '😀', token: 'token' },
    {
      env: {},
      fetchImpl: async () => {
        calls++;
        return response(answer(1));
      },
    },
  );

  assert.deepEqual(result, { isTopicSentence: true, status: 'fallback' });
  assert.equal(calls, 0);
});

test('falls back when the response JSON misses the five second deadline', async () => {
  const started = Date.now();
  const result = await classifyTopicSentence(
    { ...input, token: 'token' },
    {
      env: {},
      fetchImpl: async () => ({
        ok: true,
        json: () => new Promise(() => {}),
      }),
    },
  );

  assert.deepEqual(result, { isTopicSentence: true, status: 'fallback' });
  assert.ok(Date.now() - started >= 4900);
  assert.ok(Date.now() - started < 6500);
});
