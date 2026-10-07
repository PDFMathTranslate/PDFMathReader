import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKernelServiceConfig } from '../../../server/kernels/kernel-services.mjs';

function field(id, env, type = 'string', extra = {}) {
  return { id, label: id, type, secret: false, default: null, required: false, env, ...extra };
}

function fakeCatalog(kernel = 'pdf_math_fast') {
  return {
    id: kernel,
    version: 'fixture',
    services: [
      {
        id: 'openai',
        label: 'OpenAI',
        fields: [
          field('base_url', 'OPENAI_BASE_URL', 'string', { default: 'https://api.openai.com/v1' }),
          field('api_key', 'OPENAI_API_KEY', 'string', { secret: true, required: true }),
          field('model', 'OPENAI_MODEL', 'string', { default: 'gpt-4o-mini' }),
          field('stop_tokens', 'OPENAI_STOP_TOKENS', 'string', { default: '' }),
          field('max_tokens', 'OPENAI_MAX_TOKENS', 'number', {
            default: -1,
            integer: true,
            min: -1,
          }),
        ],
      },
    ],
  };
}

function fakePreciseCatalog() {
  return {
    id: 'pdf_math_precise',
    version: 'fixture',
    services: [
      {
        id: 'openai',
        label: 'OpenAI',
        fields: [
          field('openai_model', 'PDF2ZH_OPENAI_MODEL', 'string', { default: 'gpt-4o-mini' }),
          field('openai_base_url', 'PDF2ZH_OPENAI_BASE_URL', 'string'),
          field('openai_api_key', 'PDF2ZH_OPENAI_API_KEY', 'string', {
            secret: true,
            required: true,
          }),
          field('openai_enable_json_mode', 'PDF2ZH_OPENAI_ENABLE_JSON_MODE', 'boolean'),
        ],
      },
    ],
  };
}

test('kernel configuration maps Fast and Precise fields without secrets in cache identity', () => {
  const config = buildKernelServiceConfig(
    'pdf_math_fast',
    {
      id: 'openai',
      values: {
        api_key: 'fixture-secret',
        base_url: 'http://127.0.0.1:9001/v1',
        model: 'fixture-model',
        stop_tokens: '{v0}',
        max_tokens: 128,
      },
    },
    fakeCatalog(),
  );
  assert.deepEqual(config.args, ['-s', 'openai:fixture-model']);
  assert.equal(config.env.OPENAI_API_KEY, 'fixture-secret');
  assert.equal(config.env.OPENAI_BASE_URL, 'http://127.0.0.1:9001/v1');
  assert.equal(config.env.OPENAI_MODEL, 'fixture-model');
  assert.equal(config.env.OPENAI_STOP_TOKENS, '{v0}');
  assert.equal(config.env.OPENAI_MAX_TOKENS, '128');
  assert.deepEqual(config.secrets, ['fixture-secret']);
  assert.equal(JSON.stringify(config.cacheIdentity).includes('fixture-secret'), false);
  assert.deepEqual(config.cacheIdentity, {
    service: 'openai',
    values: {
      base_url: 'http://127.0.0.1:9001/v1',
      model: 'fixture-model',
      stop_tokens: '{v0}',
      max_tokens: 128,
    },
  });

  {
    const config = buildKernelServiceConfig(
      'pdf_math_precise',
      {
        id: 'openai',
        values: {
          openai_api_key: 'fixture-secret',
          openai_base_url: 'http://127.0.0.1:9001/v1',
          openai_model: 'fixture-model',
          openai_enable_json_mode: false,
        },
      },
      fakePreciseCatalog(),
    );
    assert.deepEqual(config.args, ['--openai']);
    assert.equal(config.env.PDF2ZH_OPENAI_API_KEY, 'fixture-secret');
    assert.equal(config.env.PDF2ZH_OPENAI_BASE_URL, 'http://127.0.0.1:9001/v1');
    assert.equal(config.env.PDF2ZH_OPENAI_MODEL, 'fixture-model');
    assert.equal(config.env.PDF2ZH_OPENAI_ENABLE_JSON_MODE, 'false');
    assert.deepEqual(config.secrets, ['fixture-secret']);
    assert.equal(JSON.stringify(config.cacheIdentity).includes('fixture-secret'), false);
  }
});

test('configuration validates required fields, values, choices, bounds, URLs, and unknown fields', () => {
  const catalog = {
    id: 'pdf_math_fast',
    version: 'fixture',
    services: [
      {
        id: 'fixture',
        label: 'Fixture',
        fields: [
          field('api_key', 'FIXTURE_API_KEY', 'string', { secret: true, required: true }),
          field('mode', 'FIXTURE_MODE', 'string', { choices: ['yes', 'no'], default: 'yes' }),
          field('count', 'FIXTURE_COUNT', 'number', { integer: true, min: 1, max: 3 }),
          field('enabled', 'FIXTURE_ENABLED', 'boolean'),
          field('base_url', 'FIXTURE_BASE_URL', 'string', { default: 'https://example.test' }),
        ],
      },
    ],
  };
  const config = buildKernelServiceConfig(
    'pdf_math_fast',
    { id: 'fixture', values: { api_key: 'key', mode: 'no', count: 2, enabled: false } },
    catalog,
  );
  assert.equal(config.env.FIXTURE_COUNT, '2');
  assert.equal(config.env.FIXTURE_ENABLED, 'false');
  assert.throws(
    () => buildKernelServiceConfig('pdf_math_fast', { id: 'fixture', values: {} }, catalog),
    /api_key is required/,
  );
  assert.throws(
    () =>
      buildKernelServiceConfig(
        'pdf_math_fast',
        { id: 'fixture', values: { api_key: 'key', mode: 'maybe' } },
        catalog,
      ),
    /Invalid choice/,
  );
  assert.throws(
    () =>
      buildKernelServiceConfig(
        'pdf_math_fast',
        { id: 'fixture', values: { api_key: 'key', count: 4 } },
        catalog,
      ),
    /Invalid numeric/,
  );
  assert.throws(
    () =>
      buildKernelServiceConfig(
        'pdf_math_fast',
        { id: 'fixture', values: { api_key: 'key', enabled: 'false' } },
        catalog,
      ),
    /must be a boolean/,
  );
  assert.throws(
    () =>
      buildKernelServiceConfig(
        'pdf_math_fast',
        { id: 'fixture', values: { api_key: 'key', base_url: 'file:///tmp' } },
        catalog,
      ),
    /Invalid URL/,
  );
  assert.throws(
    () =>
      buildKernelServiceConfig(
        'pdf_math_fast',
        { id: 'fixture', values: { api_key: 'key', unknown: 'x' } },
        catalog,
      ),
    /Unknown translation service field/,
  );
});
