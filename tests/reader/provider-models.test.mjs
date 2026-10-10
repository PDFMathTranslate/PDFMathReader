import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer, ref, nextTick } from 'vue';
import { useProviderModels } from '../../src/features/settings/useProviderModels.mjs';

function fixture({ id = 'OpenAICompatible', shared = false } = {}) {
  const fields = [{ id: 'model' }, { id: 'api_key', secret: true }, { id: 'base_url' }];
  const values = ref({
    api_key: 'test-key',
    base_url: 'http://localhost:7314/v1',
    model: 'manual-model',
  });
  let result;
  const renderer = createRenderer({
    createComment: () => ({}),
    createElement: () => ({}),
    createText: () => ({}),
    insert() {},
    remove() {},
    setText() {},
    setElementText() {},
    patchProp() {},
    parentNode: () => null,
    nextSibling: () => null,
  });
  const app = renderer.createApp({
    setup() {
      result = useProviderModels({
        service: ref({ id, fields }),
        fieldValue: (f) => values.value[f.id],
        engine: ref('pdf2zh'),
        providerId: ref(id),
        sharedKey: ref(shared),
      });
      return () => null;
    },
  });
  app.mount({});
  return { result, values, cleanup: () => app.unmount() };
}

test('fetches model options using current endpoint and credentials without changing manual model', async () => {
  const original = globalThis.fetch;
  const f = fixture();
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/providers/models');
      assert.deepEqual(JSON.parse(options.body), {
        baseUrl: 'http://localhost:7314/v1',
        apiKey: 'test-key',
        useSharedKey: false,
      });
      return Response.json({ models: ['a', 'b'] });
    };
    await f.result.refresh();
    assert.deepEqual(f.result.models.value, ['a', 'b']);
    assert.equal(f.values.value.model, 'manual-model');
    f.values.value.api_key = '';
    await nextTick();
    assert.equal(f.result.available.value, false);
    assert.deepEqual(f.result.models.value, []);
  } finally {
    f.cleanup();
    globalThis.fetch = original;
  }
});

test('endpoint changes abort outstanding discovery and discard stale responses', async () => {
  const original = globalThis.fetch;
  const f = fixture();
  let resolve, signal;
  try {
    globalThis.fetch = (_url, options) => {
      signal = options.signal;
      return new Promise((r) => {
        resolve = r;
      });
    };
    const pending = f.result.refresh();
    f.values.value.base_url = 'http://localhost:9999/v1';
    assert.equal(signal.aborted, true);
    resolve(Response.json({ models: ['wrong-provider'] }));
    await pending;
    assert.deepEqual(f.result.models.value, []);
    assert.equal(f.result.loading.value, false);
  } finally {
    f.cleanup();
    globalThis.fetch = original;
  }
});

test('failed discovery preserves the manually configured model and permits retry', async () => {
  const original = globalThis.fetch;
  const f = fixture();
  try {
    globalThis.fetch = async () =>
      Response.json({ error: 'Could not retrieve models (HTTP 401).' }, { status: 502 });
    await f.result.refresh();
    assert.match(f.result.error.value, /401/);
    assert.equal(f.values.value.model, 'manual-model');
    assert.equal(f.result.loading.value, false);
    globalThis.fetch = async () => Response.json({ models: ['retry-model'] });
    await f.result.refresh();
    assert.equal(f.result.error.value, '');
    assert.deepEqual(f.result.models.value, ['retry-model']);
  } finally {
    f.cleanup();
    globalThis.fetch = original;
  }
});

test('shared key fallback applies only to the OpenAI provider', () => {
  const openai = fixture({ id: 'openai', shared: true });
  const compatible = fixture({ shared: true });
  try {
    openai.values.value.api_key = '';
    compatible.values.value.api_key = '';
    assert.equal(openai.result.available.value, true);
    assert.equal(compatible.result.available.value, false);
  } finally {
    openai.cleanup();
    compatible.cleanup();
  }
});
