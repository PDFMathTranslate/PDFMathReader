import { t } from '../../i18n/index.mjs';

export function createCredentialSettings({ preferences, credentials, actions }) {
  function applyConfig(c) {
    credentials.configured.value = c.configured;
    credentials.keySource.value = c.keySource || 'none';
    credentials.keyStorageAvailable.value = !!c.keyStorageAvailable;
    if (c.keyStorageError) credentials.keyInvalid.value = true;
  }

  async function updateKey(clear = false) {
    if (credentials.keyBusy.value || (!clear && !credentials.keyEntry.value.trim())) return;
    credentials.keyBusy.value = true;
    credentials.keyMessage.value = '';
    try {
      const c = await (clear
        ? credentials.desktopCredentials.clear()
        : credentials.desktopCredentials.save(credentials.keyEntry.value));
      credentials.keyEntry.value = '';
      credentials.keyInvalid.value = false;
      applyConfig(c);
      for (const kernel of ['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise'])
        actions.translationHistory.resetServiceHistory(kernel, 'openai');
      if (preferences.reuseTranslations.value) {
        actions.documentLifecycle.cancel();
        actions.readerScroll.settle();
      } else {
        actions.mathTranslation.resetTranslations();
        actions.readerScroll.settle();
      }
    } catch {
      credentials.keyEntry.value = '';
      credentials.keyMessage.value = t('key.saveFailed');
    } finally {
      credentials.keyBusy.value = false;
    }
  }
  return { applyConfig, updateKey };
}
