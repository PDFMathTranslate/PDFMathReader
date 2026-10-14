import { nextTick } from 'vue';
import { isCustomServiceId } from '../../../shared/translation/custom-services.mjs';
import { withSelectedService } from './translation-services.mjs';

export const sameVersion = (a, b) =>
  !!a && !!b && a.engine === b.engine && a.language === b.language;

// Translated geometry (paragraph ids, boxes, line rectangles) is produced by one kernel
// for one target language. Source annotations belong to every version; a translation
// annotation belongs to the version that drew it. Records made before versions were
// stored carry no version and keep their previous behaviour.
export function ownsTranslationGeometry(annotation, version) {
  return (
    annotation.origin !== 'translation' ||
    !annotation.translationVersion ||
    sameVersion(annotation.translationVersion, version)
  );
}

// Candidates arrive newest first. The current setting wins when it is cached, so a
// document opened under its own settings is never switched away from them.
export function openOrder(versions, current) {
  const list = Array.isArray(versions) ? versions : [];
  return [
    ...list.filter((v) => sameVersion(v, current)),
    ...list.filter((v) => !sameVersion(v, current)),
  ];
}

// A document reopens with the kernel and service it was last read with. Only that
// kernel's cached versions open, so another kernel's cache cannot switch it.
export function documentOpenOrder(versions, current, remembered) {
  const order = openOrder(versions, current);
  return remembered ? order.filter((v) => v.engine === current.engine) : order;
}

export function createTranslationVersions({ session, preferences, provider, actions }) {
  const current = () => ({
    engine: preferences.engine.value,
    language: preferences.language.value,
  });

  async function usable(version, token) {
    if (version.engine === 'pdf_inspector') return true;
    try {
      const state = await actions.backendRequests.api('/api/engines/' + version.engine);
      return token === session.epoch && state?.available === true;
    } catch {
      return false;
    }
  }

  function knownService(service) {
    return (
      !isCustomServiceId(service) ||
      preferences.customTranslationServices.value.some((item) => item.id === service)
    );
  }

  async function applyVersion({ engine, language = preferences.language.value, service }) {
    const serviceChanged =
      typeof service === 'string' &&
      knownService(service) &&
      provider.selectedServiceId(engine) !== service;
    if (sameVersion({ engine, language }, current()) && !serviceChanged) return;
    // The kernel, language and service observers reset translations and cancel the
    // document that is opening. Setting them while preferences are loading skips them.
    preferences.loadingPreferences = true;
    try {
      if (serviceChanged)
        preferences.translationServices.value = withSelectedService(
          preferences.translationServices.value,
          engine,
          service,
        );
      preferences.engine.value = engine;
      preferences.language.value = language;
      await nextTick();
    } finally {
      preferences.loadingPreferences = false;
    }
    void actions.kernelSettings.checkEngine();
  }

  // Selects the kernel, service and cached version a newly opened document should show.
  async function openCachedVersion(documentId, token, remembered) {
    const restored = !!remembered && (await usable(remembered, token));
    if (token !== session.epoch) return null;
    if (restored) await applyVersion({ engine: remembered.engine, service: remembered.service });
    let versions;
    try {
      versions = (
        await actions.backendRequests.api(`/api/documents/${documentId}/translation-versions`)
      ).versions;
    } catch {
      return null;
    }
    for (const version of documentOpenOrder(versions, current(), restored)) {
      if (token !== session.epoch) return null;
      if (!(await usable(version, token))) continue;
      await applyVersion(version);
      return token === session.epoch ? version : null;
    }
    return null;
  }

  // Records this document's kernel and service so they follow it, not the session.
  function rememberDocumentTranslation() {
    const id = session.currentRecentId;
    if (!id || session.loading.value || !window.previewRecents?.setTranslation) return;
    const engine = preferences.engine.value;
    void window.previewRecents
      .setTranslation(id, { engine, service: provider.selectedServiceId(engine) })
      .catch(() => {});
  }

  return {
    openCachedVersion,
    rememberDocumentTranslation,
    currentTranslationVersion: current,
  };
}
