import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyParagraphContinuation } from '../../../server/translation/paragraph-continuation.mjs';

const response = (payload, ok = true) => ({
  ok,
  json: async () => payload,
});

const answer = (value) => ({
  answers: { paragraph_continuation: { type: 'noul', noul: value } },
});

const input = {
  before: 'The policy changed investment incentives',
  after: 'and firms consequently shifted capital toward cleaner technologies.',
};

test('classifies continuation at the conservative threshold and sends the documented request', async () => {
  let request;
  const result = await classifyParagraphContinuation(
    { ...input, token: 'custom-token' },
    {
      env: { TYPESAFE_API_KEY: 'environment-token' },
      fetchImpl: async (url, options) => {
        request = { url, options };
        return response(answer(0.8));
      },
    },
  );

  assert.deepEqual(result, { combine: true, status: 'classified' });
  assert.equal(request.url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Authorization, 'Bearer custom-token');
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body, {
    model: 'jev-latest',
    state: input,
    questions: {
      paragraph_continuation: {
        type: 'noul',
        instructions:
          'Are `before` and `after` consecutive fragments of one paragraph that was split by the document layout?',
        criteria: {
          true: 'The fragments are semantically and grammatically continuous parts of one paragraph separated by an artificial document-layout boundary.',
          false:
            'The fragments mark an intentional paragraph boundary, a new topic, a list entry, a heading, a caption, or a footnote.',
        },
      },
    },
  });
});

test('keeps fragments separate below the conservative threshold', async () => {
  const result = await classifyParagraphContinuation(input, {
    env: { TYPESAFE_API_KEY: 'environment-token' },
    fetchImpl: async () => response(answer(0.7999)),
  });

  assert.deepEqual(result, { combine: false, status: 'classified' });
});

test('uses the environment token when the custom token is blank', async () => {
  let authorization;
  const result = await classifyParagraphContinuation(
    { ...input, token: '  ' },
    {
      env: { TYPESAFE_API_KEY: 'environment-token' },
      fetchImpl: async (_url, options) => {
        authorization = options.headers.Authorization;
        return response(answer(1));
      },
    },
  );

  assert.deepEqual(result, { combine: true, status: 'classified' });
  assert.equal(authorization, 'Bearer environment-token');
});

test('falls back false for missing credentials, invalid input, and oversized Unicode input without sending', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return response(answer(1));
  };
  const options = { env: {}, fetchImpl };

  for (const value of [
    {},
    { ...input, token: 42 },
    { ...input, before: '', token: 'token' },
    { ...input, after: '   ', token: 'token' },
    { ...input, before: 42, token: 'token' },
    { ...input, after: null, token: 'token' },
    { ...input, before: '😀'.repeat(6001), token: 'token' },
    { ...input, after: '😀'.repeat(6001), token: 'token' },
  ]) {
    assert.deepEqual(await classifyParagraphContinuation(value, options), {
      combine: false,
      status: 'fallback',
    });
  }
  assert.equal(calls, 0);
});

test('falls back false for network, HTTP, malformed, and out-of-bounds answers', async () => {
  assert.deepEqual(
    await classifyParagraphContinuation(
      { ...input, token: 'token' },
      {
        env: {},
        fetchImpl: async () => {
          throw new Error('network failure');
        },
      },
    ),
    { combine: false, status: 'fallback' },
  );

  for (const payload of [
    {},
    { answers: { paragraph_continuation: { type: 'choice', noul: 1 } } },
    answer(-0.01),
    answer(1.01),
    { answers: { paragraph_continuation: { type: 'noul', noul: Number.NaN } } },
  ]) {
    assert.deepEqual(
      await classifyParagraphContinuation(
        { ...input, token: 'token' },
        { env: {}, fetchImpl: async () => response(payload) },
      ),
      { combine: false, status: 'fallback' },
    );
  }

  assert.deepEqual(
    await classifyParagraphContinuation(
      { ...input, token: 'token' },
      { env: {}, fetchImpl: async () => response({}, false) },
    ),
    { combine: false, status: 'fallback' },
  );
});

test('does not log or expose credentials while classifying', async () => {
  const logs = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => logs.push(args);
  console.error = (...args) => logs.push(args);
  try {
    const result = await classifyParagraphContinuation(
      { ...input, token: 'secret-custom-token' },
      {
        env: { TYPESAFE_API_KEY: 'secret-environment-token' },
        fetchImpl: async () => response(answer(1)),
      },
    );
    assert.deepEqual(result, { combine: true, status: 'classified' });
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  assert.deepEqual(logs, []);
});

test('falls back false when response JSON misses the five second deadline', async () => {
  const started = Date.now();
  const result = await classifyParagraphContinuation(
    { ...input, token: 'token' },
    {
      env: {},
      fetchImpl: async () => ({
        ok: true,
        json: () => new Promise(() => {}),
      }),
    },
  );

  assert.deepEqual(result, { combine: false, status: 'fallback' });
  assert.ok(Date.now() - started >= 4900);
  assert.ok(Date.now() - started < 6500);
});
