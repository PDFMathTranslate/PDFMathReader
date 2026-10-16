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

function companionCatalogs() {
  const field = (id, extra = {}) => ({
    id,
    label: id,
    type: id.includes('url') ? 'url' : 'string',
    required: true,
    ...extra,
  });
  return {
    pdf_math_fast: {
      id: 'pdf_math_fast',
      services: [
        {
          id: 'openailiked',
          label: 'OpenAI compatible (Fast)',
          fields: [field('api_key', { secret: true }), field('base_url'), field('model')],
        },
      ],
    },
    pdf_math_precise: {
      id: 'pdf_math_precise',
      services: [
        {
          id: 'openaicompatible',
          label: 'OpenAI compatible (Precise)',
          fields: [
            field('openai_compatible_api_key', { secret: true }),
            field('openai_compatible_base_url'),
            field('openai_compatible_model'),
          ],
        },
      ],
    },
  };
}

function configuredCompanionRuntime({
  supportedLanguages = ['en-US', 'zh-Hans', 'zh-Hant', 'ar-AE'],
} = {}) {
  const customId = 'custom-0a1b2c3d4e5f';
  const preferences = {
    translationServices: {
      pdf_math_fast: {
        id: 'openailiked',
        values: {
          base_url: 'https://direct-fast.invalid/v1',
          model: 'direct-fast',
        },
        profiles: {
          openailiked: {
            values: {
              base_url: 'https://profile-fast.invalid/v1',
              model: 'profile-fast',
            },
          },
        },
      },
      pdf_math_precise: {
        id: 'openaicompatible',
        profiles: {
          openaicompatible: {
            values: {
              openai_compatible_base_url: 'https://profile-precise.invalid/v1',
              openai_compatible_model: 'profile-precise',
            },
          },
        },
      },
    },
    customTranslationServices: [
      {
        id: customId,
        name: 'Custom Cloud',
        base_url: 'https://custom.invalid/v1',
        model: 'custom-model',
      },
    ],
  };
  const credentials = {
    pdf_math_fast: { openailiked: { api_key: 'fast-secret' } },
    pdf_math_precise: {
      openaicompatible: { openai_compatible_api_key: 'precise-secret' },
    },
    custom: { [customId]: { key: 'custom-secret' } },
  };
  const catalogs = companionCatalogs();
  const runtime = createTranslationRuntime({
    engines: { services: async (kernel) => catalogs[kernel] },
    localTranslator: {
      available: async () => true,
      supportedLanguages: async () => supportedLanguages,
    },
    getCompanionTranslationSettings: async () => ({ preferences, credentials }),
    sessionId: 'companion-test',
  });
  return { runtime, customId };
}

test('companion options resolve saved profiles and custom credentials without health leakage', async () => {
  const { runtime, customId } = configuredCompanionRuntime();
  const options = await runtime.companionTranslationOptions();
  const serviceIds = options.services.map((service) => service.id);
  assert.deepEqual(serviceIds, [
    'auto',
    'siliconflow-free',
    'openailiked',
    customId,
    'apple-local',
    'openaicompatible',
  ]);
  assert.equal(
    options.services.find((service) => service.id === 'auto').name,
    'Use Computer Settings',
  );
  assert.doesNotMatch(
    JSON.stringify({ services: options.services, kernels: options.kernels }),
    /fast-secret|precise-secret|custom-secret|profile-fast|custom\.invalid/,
  );

  const automaticFast = await runtime.companionTranslationSelection(
    'auto',
    'pdf_math_fast',
    'English',
    'Simplified Chinese',
  );
  assert.deepEqual(automaticFast, {
    id: 'openailiked',
    values: {
      base_url: 'https://profile-fast.invalid/v1',
      model: 'profile-fast',
      api_key: 'fast-secret',
    },
  });
  const custom = await runtime.companionTranslationSelection(
    customId,
    'pdf_math_fast',
    'English',
    'Simplified Chinese',
  );
  assert.deepEqual(custom, {
    id: customId,
    values: {
      base_url: 'https://custom.invalid/v1',
      model: 'custom-model',
      key: 'custom-secret',
    },
  });
  const native = await runtime.providerFor(
    custom,
    'pdf_math_fast',
    'English',
    'Simplified Chinese',
  );
  assert.equal(native.id, 'openailiked');
  assert.equal(native.selection.values.api_key, 'custom-secret');
  assert.equal(native.selection.values.base_url, 'https://custom.invalid/v1');
  assert.equal(native.selection.values.model, 'custom-model');

  const apple = options.services.find((service) => service.id === 'apple-local');
  const fastApple = apple.kernels.find((kernel) => kernel.id === 'pdf_math_fast');
  assert.ok(fastApple.sourceLanguages.some((language) => language.code === 'ar'));
  assert.ok(fastApple.targetLanguages.some((language) => language.code === 'zh-TW'));
  assert.equal(
    fastApple.targetLanguages.some((language) => language.code === 'ar'),
    false,
  );
  assert.equal(
    fastApple.sourceLanguages.some((language) => language.code === 'ar-AE'),
    false,
  );
  assert.equal(apple.kernels.length, 2);
  const automaticPrecise = options.services
    .find((service) => service.id === 'auto')
    .kernels.find((kernel) => kernel.id === 'pdf_math_precise');
  assert.equal(
    automaticPrecise.targetLanguages.length,
    options.kernels.find((kernel) => kernel.id === 'pdf_math_precise').targetLanguages.length,
  );
});

test('companion health omits Apple when supported-language enumeration is unavailable', async () => {
  const { runtime } = configuredCompanionRuntime({ supportedLanguages: null });
  const options = await runtime.companionTranslationOptions();
  assert.equal(
    options.services.some((service) => service.id === 'apple-local'),
    false,
  );
});
