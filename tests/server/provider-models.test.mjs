import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { registerProviderModelRoutes } from '../../server/http/provider-model-routes.mjs';

async function createServer(options = {}) {
  const app = express();
  registerProviderModelRoutes(app, options);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/api/providers/models`,
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function request(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('model discovery normalizes the endpoint, authenticates, and deduplicates sorted ids', async () => {
  const calls = [];
  const server = await createServer({
    providerFetch: async (url, options) => {
      calls.push({ url, options });
      return Response.json({ data: [{ id: 'z-model' }, { id: 'a-model' }, { id: 'z-model' }] });
    },
  });
  try {
    const response = await request(server.url, {
      baseUrl: 'http://localhost:11434/v1/',
      apiKey: 'test-secret',
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { models: ['a-model', 'z-model'] });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://localhost:11434/v1/models');
    assert.equal(calls[0].options.method, 'GET');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer test-secret');
    assert.equal(calls[0].options.redirect, 'error');
    assert.ok(calls[0].options.signal instanceof AbortSignal);
  } finally {
    await server.close();
  }
});

test('model discovery uses the shared key only when explicitly requested', async () => {
  const calls = [];
  let sharedKeyReads = 0;
  const server = await createServer({
    getApiKey: () => {
      sharedKeyReads++;
      return 'shared-secret';
    },
    providerFetch: async (_url, options) => {
      calls.push(options.headers.Authorization);
      return Response.json({ data: [{ id: 'local-model' }] });
    },
  });
  try {
    const withoutFallback = await request(server.url, { baseUrl: 'http://127.0.0.1:11434/v1' });
    assert.equal(withoutFallback.status, 400);
    assert.deepEqual(await withoutFallback.json(), { error: 'A provider API key is required.' });
    assert.equal(sharedKeyReads, 0);

    const withFallback = await request(server.url, {
      baseUrl: 'http://127.0.0.1:11434/v1',
      useSharedKey: true,
    });
    assert.equal(withFallback.status, 200);
    assert.deepEqual(await withFallback.json(), { models: ['local-model'] });
    assert.deepEqual(calls, ['Bearer shared-secret']);
    assert.equal(sharedKeyReads, 1);
  } finally {
    await server.close();
  }
});

test('model discovery rejects unsafe urls and oversized credentials before fetching', async () => {
  let calls = 0;
  const server = await createServer({
    providerFetch: async () => {
      calls++;
      return Response.json({ data: [{ id: 'should-not-run' }] });
    },
  });
  try {
    for (const baseUrl of [
      'ftp://provider.example/v1',
      'https://user:password@provider.example/v1',
      'https://@provider.example/v1',
      'https://provider.example/v1?key=secret',
      'https://provider.example/v1#fragment',
      'not-a-url',
      `https://provider.example/${'a'.repeat(2_040)}`,
    ]) {
      const response = await request(server.url, { baseUrl, apiKey: 'test-secret' });
      assert.equal(response.status, 400, baseUrl);
      assert.deepEqual(await response.json(), { error: 'Invalid provider model request.' });
    }
    const oversizedKey = await request(server.url, {
      baseUrl: 'https://provider.example/v1',
      apiKey: 'k'.repeat(8_193),
    });
    assert.equal(oversizedKey.status, 400);
    assert.deepEqual(await oversizedKey.json(), { error: 'Invalid provider model request.' });
    assert.equal(calls, 0);
  } finally {
    await server.close();
  }
});

test('model discovery hides upstream failures and rejects invalid or empty results', async () => {
  let mode = 'failure';
  const server = await createServer({
    providerFetch: async () => {
      if (mode === 'failure')
        return new Response('upstream body with test-secret', { status: 401 });
      if (mode === 'empty') return Response.json({ data: [] });
      if (mode === 'invalid') return Response.json({ data: [{ id: 42 }] });
      return Response.json({
        data: Array.from({ length: 1_001 }, (_, index) => ({ id: String(index) })),
      });
    },
  });
  try {
    for (const expected of [
      { mode: 'failure', status: 502, error: 'Unable to load provider models.' },
      { mode: 'empty', status: 502, error: 'Provider returned no models.' },
      { mode: 'invalid', status: 502, error: 'Provider returned an invalid model list.' },
      { mode: 'too-many', status: 502, error: 'Provider returned an invalid model list.' },
    ]) {
      mode = expected.mode;
      const response = await request(server.url, {
        baseUrl: 'https://provider.example/v1',
        apiKey: 'test-secret',
      });
      assert.equal(response.status, expected.status);
      const body = await response.json();
      assert.deepEqual(body, { error: expected.error });
      assert.doesNotMatch(JSON.stringify(body), /test-secret|upstream body/);
    }
  } finally {
    await server.close();
  }
});

test('model discovery times out with a generic error', async () => {
  let aborted = false;
  const server = await createServer({
    timeoutMs: 15,
    providerFetch: (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener(
          'abort',
          () => {
            aborted = true;
            reject(new Error('provider secret should not be reflected'));
          },
          { once: true },
        );
      }),
  });
  try {
    const response = await request(server.url, {
      baseUrl: 'https://provider.example/v1',
      apiKey: 'test-secret',
    });
    assert.equal(response.status, 504);
    assert.deepEqual(await response.json(), { error: 'Provider model request timed out.' });
    assert.equal(aborted, true);
  } finally {
    await server.close();
  }
});
