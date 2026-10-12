import { nextTick } from 'vue';

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

export function createTranslationVersions({ session, preferences, actions }) {
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

  async function applyVersion(version) {
    if (sameVersion(version, current())) return;
    // The kernel and language observers reset translations and cancel the document
    // that is opening. Setting both while preferences are loading skips them.
    preferences.loadingPreferences = true;
    try {
      preferences.engine.value = version.engine;
      preferences.language.value = version.language;
      await nextTick();
    } finally {
      preferences.loadingPreferences = false;
    }
    void actions.kernelSettings.checkEngine();
  }

  // Selects the cached version a newly opened document should show, if any.
  async function openCachedVersion(documentId, token) {
    let versions;
    try {
      versions = (
        await actions.backendRequests.api(`/api/documents/${documentId}/translation-versions`)
      ).versions;
    } catch {
      return null;
    }
    for (const version of openOrder(versions, current())) {
      if (token !== session.epoch) return null;
      if (!(await usable(version, token))) continue;
      await applyVersion(version);
      return token === session.epoch ? version : null;
    }
    return null;
  }

  return { openCachedVersion, currentTranslationVersion: current };
}
