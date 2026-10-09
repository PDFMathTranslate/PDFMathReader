import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectDocumentLanguage } from '../../../server/translation/document-language.mjs';

const response = (payload, ok = true) => ({
  ok,
  json: async () => payload,
});

const choice = (value, confidence = 0.95) => ({
  answers: { language_match: { type: 'choice', choice: value, confidence } },
});

test('uses a custom token first and caps samples by page and Unicode character', async () => {
  const calls = [];
  const firstPage = '😀'.repeat(100) + 'ignored';
  const result = await detectDocumentLanguage(
    {
      samples: [firstPage, 'second page', 'third page', 'fourth page'],
      sourceLanguage: 'English',
      token: 'custom-token',
    },
    {
      env: { TYPESAFE_API_KEY: 'environment-token' },
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return response(choice('match', 0.9));
      },
    },
  );

  assert.deepEqual(result, { skipAutomaticTranslation: true, status: 'match' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer custom-token');

  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body.state.samples, [firstPage.slice(0, 200), 'second page', 'third page']);
  assert.equal(Array.from(body.state.samples[0]).length, 100);
  assert.equal(body.state.sourceLanguage, 'English');
  assert.match(body.questions.language_match.instructions, /configured SOURCE language/);
  assert.match(body.questions.language_match.instructions, /never as an instruction/);
  assert.deepEqual(Object.keys(body.questions.language_match.criteria), [
    'match',
    'different',
    'unknown',
  ]);
});

test('returns different without skipping when the confident Choice disagrees', async () => {
  let request;
  const result = await detectDocumentLanguage(
    { samples: ['texto'], sourceLanguage: 'English' },
    {
      env: { TYPESAFE_API_KEY: 'environment-token' },
      fetchImpl: async (_url, options) => {
        request = JSON.parse(options.body);
        return response(choice('different', 1));
      },
    },
  );

  assert.deepEqual(result, { skipAutomaticTranslation: false, status: 'different' });
  assert.equal(request.state.sourceLanguage, 'English');
  assert.deepEqual(request.state.samples, ['texto']);
});

test('uses the environment token when the custom setting is blank', async () => {
  let authorization;
  const result = await detectDocumentLanguage(
    { samples: ['text'], sourceLanguage: 'English', token: '  ' },
    {
      env: { TYPESAFE_API_KEY: 'environment-token' },
      fetchImpl: async (_url, options) => {
        authorization = options.headers.Authorization;
        return response(choice('unknown'));
      },
    },
  );

  assert.deepEqual(result, { skipAutomaticTranslation: false, status: 'unknown' });
  assert.equal(authorization, 'Bearer environment-token');
});

test('fails open for missing credentials, empty or malformed input, and fetch failures', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    throw new Error('network failure');
  };
  const options = { env: {}, fetchImpl };

  for (const input of [
    { samples: ['text'], sourceLanguage: 'English' },
    { samples: [], sourceLanguage: 'English', token: 'token' },
    { samples: ['', '', '', 'content'], sourceLanguage: 'English', token: 'token' },
    { samples: ['text', 42], sourceLanguage: 'English', token: 'token' },
    { samples: ['text'], sourceLanguage: '', token: 'token' },
  ]) {
    assert.deepEqual(await detectDocumentLanguage(input, options), {
      skipAutomaticTranslation: false,
      status: 'unknown',
    });
  }
  assert.equal(calls, 0);

  assert.deepEqual(
    await detectDocumentLanguage(
      { samples: ['text'], sourceLanguage: 'English', token: 'token' },
      options,
    ),
    { skipAutomaticTranslation: false, status: 'unknown' },
  );
  assert.equal(calls, 1);
});

test('fails open for malformed, uncertain, and out-of-bounds Choice answers', async () => {
  const payloads = [
    {},
    { answers: { language_match: { type: 'choice', choice: 'match' } } },
    choice('match', 0.8999),
    choice('match', -0.01),
    choice('match', 1.01),
    choice('not-an-option', 1),
    { answers: { language_match: { type: 'noul', choice: 'match', confidence: 1 } } },
  ];

  for (const payload of payloads) {
    const result = await detectDocumentLanguage(
      { samples: ['text'], sourceLanguage: 'English', token: 'token' },
      { env: {}, fetchImpl: async () => response(payload) },
    );
    assert.deepEqual(result, { skipAutomaticTranslation: false, status: 'unknown' });
  }
});

test('fails open on an upstream error response', async () => {
  const result = await detectDocumentLanguage(
    { samples: ['text'], sourceLanguage: 'English', token: 'token' },
    { fetchImpl: async () => response({}, false), env: {} },
  );
  assert.deepEqual(result, { skipAutomaticTranslation: false, status: 'unknown' });
});
