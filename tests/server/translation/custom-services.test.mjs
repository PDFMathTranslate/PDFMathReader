import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslationRuntime } from '../../../server/translation/provider-runtime.mjs';
import {
  cloneCustomServices,
  createCustomServiceId,
  customSelectionValues,
  customServiceDescriptors,
  isCustomServiceId,
  isValidCustomServices,
  resolveCustomSelection,
  withCustomCredentials,
  withCustomProfiles,
} from '../../../shared/translation/custom-services.mjs';

const id = 'custom-0a1b2c3d4e5f';
const entry = { id, name: 'Local LLM', base_url: 'http://127.0.0.1:1234/v1', model: 'qwen' };
const selection = { id, values: { key: 'sk-test', base_url: entry.base_url, model: 'qwen' } };

test('custom service lists validate, clone and generate ids', () => {
  assert.ok(isCustomServiceId(createCustomServiceId()));
  assert.ok(isValidCustomServices([entry]));
  assert.ok(!isValidCustomServices([entry, entry]));
  assert.ok(!isValidCustomServices([{ ...entry, id: 'openai' }]));
  assert.ok(!isValidCustomServices([{ ...entry, name: 'a\nb' }]));
  assert.deepEqual(cloneCustomServices([entry, entry, { id: 'bad' }, { ...entry, extra: 1 }]), [
    entry,
  ]);
});

test('custom services project only into kernels that ship an OpenAI-compatible backend', () => {
  assert.equal(customServiceDescriptors('pdf_math_fast', [{ id: 'google' }], [entry]).length, 0);
  const [descriptor] = customServiceDescriptors('pdf_math_fast', [{ id: 'openailiked' }], [entry]);
  assert.equal(descriptor.id, id);
  assert.equal(descriptor.label, 'Local LLM');
  assert.deepEqual(
    descriptor.fields.map((field) => [field.id, !!field.secret]),
    [
      ['key', true],
      ['base_url', false],
      ['model', false],
    ],
  );
  const config = withCustomProfiles({ id, values: {}, profiles: {} }, [entry]);
  assert.deepEqual(config.values, { base_url: entry.base_url, model: 'qwen' });
  const credentials = withCustomCredentials(
    { custom: { [id]: { key: 'sk-test' } } },
    'pdf_inspector',
  );
  assert.equal(credentials.pdf_inspector[id].key, 'sk-test');
  assert.deepEqual(customSelectionValues(id, [entry], credentials), selection.values);
  assert.equal(customSelectionValues('custom-ffffffffffff', [entry], credentials), null);
});

test('custom selections map onto each kernel backend and require complete settings', () => {
  assert.deepEqual(resolveCustomSelection('pdf_math_fast', selection), {
    id: 'openailiked',
    values: { api_key: 'sk-test', base_url: entry.base_url, model: 'qwen' },
  });
  assert.deepEqual(resolveCustomSelection('pdf_math_precise', selection), {
    id: 'openaicompatible',
    values: {
      openai_compatible_api_key: 'sk-test',
      openai_compatible_base_url: entry.base_url,
      openai_compatible_model: 'qwen',
    },
  });
  const other = { id: 'google', values: {} };
  assert.equal(resolveCustomSelection('pdf_math_fast', other), other);
  assert.throws(
    () => resolveCustomSelection('pdf_math_fast', { id, values: { base_url: entry.base_url } }),
    /required/,
  );
});

test('the runtime sends Ultra fast custom services to their own endpoint and model', async () => {
  const runtime = createTranslationRuntime({
    engines: { services: async (kernel) => ({ id: kernel, services: [] }) },
    localTranslator: { available: async () => false },
    sessionId: 'test',
  });
  const provider = await runtime.providerFor(selection, 'pdf_inspector', 'English', 'Japanese');
  assert.equal(provider.id, 'openai');
  assert.equal(provider.key, 'sk-test');
  assert.equal(provider.baseUrl, entry.base_url);
  assert.equal(provider.model, 'qwen');
  const native = await runtime.providerFor(selection, 'pdf_math_fast', 'English', 'Japanese');
  assert.equal(native.native, true);
  assert.equal(native.selection.id, 'openailiked');
  assert.equal(native.selection.values.api_key, 'sk-test');
});
