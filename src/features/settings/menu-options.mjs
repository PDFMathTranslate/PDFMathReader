import { setUILanguage } from '../../i18n/index.mjs';
import { cloneTranslationServices } from '../translation/translation-services.mjs';

export function createNativeMenuOptions({ preferences, provider }) {
  function applyMenuOption(choice) {
    if (
      !choice ||
      !provider.registeredMenuOptions.value[choice.group]?.options.some(
        (item) => item.value === choice.value,
      )
    )
      return;
    if (choice.group === 'engine') preferences.engine.value = choice.value;
    else if (choice.group === 'language') preferences.language.value = choice.value;
    else if (choice.group === 'sourceLanguage') preferences.sourceLanguage.value = choice.value;
    else if (choice.group === 'uiLanguage') setUILanguage(choice.value);
    else if (choice.group === 'provider') {
      const next = cloneTranslationServices(preferences.translationServices.value),
        config = next[preferences.engine.value] || {},
        values =
          config.profiles?.[choice.value]?.values ||
          (config.id === choice.value ? config.values : {}) ||
          {};
      next[preferences.engine.value] = { ...config, id: choice.value, values: { ...values } };
      preferences.translationServices.value = next;
    }
  }
  return { applyMenuOption };
}
