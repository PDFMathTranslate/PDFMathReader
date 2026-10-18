import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ref } from 'vue';
import { createProviderState } from '../../src/features/settings/provider-state.mjs';

function providerState(language = 'English', sourceLanguage = 'English') {
  const preferences = {
    language: ref(language),
    sourceLanguage: ref(sourceLanguage),
    glossaries: ref({}),
    translationServices: ref({}),
    customTranslationServices: ref([]),
    translationServiceHistory: ref({}),
  };
  return {
    state: createProviderState({
      preferences,
      engine: ref('pdf_math_fast'),
      configured: ref(false),
    }),
    preferences,
  };
}

test('native menu language choices include selected custom codes', () => {
  const { state } = providerState('pt-BR', 'zh-Hant');
  const { language, sourceLanguage } = state.registeredMenuOptions.value;

  assert.equal(language.selected, 'pt-BR');
  assert.deepEqual(language.options.at(-1), { value: 'pt-BR', label: 'pt-BR' });
  assert.equal(sourceLanguage.selected, 'zh-Hant');
  assert.deepEqual(sourceLanguage.options.at(-1), { value: 'zh-Hant', label: 'zh-Hant' });
});

test('native menu language choices omit custom codes after selecting a standard language', () => {
  const { state, preferences } = providerState();
  const baseline = state.registeredMenuOptions.value;
  const targetCount = baseline.language.options.length;
  const sourceCount = baseline.sourceLanguage.options.length;

  preferences.language.value = 'pt-BR';
  preferences.sourceLanguage.value = 'zh-Hant';
  assert.equal(
    state.registeredMenuOptions.value.language.options.some(({ value }) => value === 'pt-BR'),
    true,
  );
  assert.equal(
    state.registeredMenuOptions.value.sourceLanguage.options.some(
      ({ value }) => value === 'zh-Hant',
    ),
    true,
  );
  preferences.language.value = 'French';
  preferences.sourceLanguage.value = 'French';
  const options = state.registeredMenuOptions.value;
  assert.equal(options.language.options.length, targetCount);
  assert.equal(options.sourceLanguage.options.length, sourceCount);
  assert.equal(
    options.language.options.some(({ value }) => value === 'French'),
    true,
  );
});
