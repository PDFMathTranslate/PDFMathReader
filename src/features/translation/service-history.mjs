export function createTranslationHistory({ preferences, session, provider }) {
  function persistServiceHistory(kernel, service, entry) {
    if (window.previewPreferences) {
      // Vue proxies cannot cross Electron's structured-clone IPC boundary.
      const snapshot = entry === null ? null : { status: entry.status, updatedAt: entry.updatedAt };
      // Keep synchronous bridge failures out of the translation request path too.
      void Promise.resolve()
        .then(() =>
          window.previewPreferences.save({
            translationServiceHistory: { [kernel]: { [service]: snapshot } },
          }),
        )
        .then(() => window.previewPreferences.load())
        .then((saved) => {
          preferences.translationServiceHistory.value = provider.historyTracker.load(
            saved.translationServiceHistory,
          );
        })
        .catch(() => {});
    } else
      try {
        localStorage.setItem(
          'translationServiceHistory',
          JSON.stringify(preferences.translationServiceHistory.value),
        );
      } catch {}
  }

  function recordServiceOutcome(response, request, signal) {
    if (signal?.aborted) return;
    const outcome = response.headers.get('X-Translation-Outcome');
    if (!provider.historyTracker.record(request, outcome, session.epoch)) return;
    preferences.translationServiceHistory.value = provider.historyTracker.snapshot();
    persistServiceHistory(
      request.kernel,
      request.service,
      preferences.translationServiceHistory.value[request.kernel][request.service],
    );
  }

  function resetServiceHistory(kernel, service) {
    if (provider.historyTracker.reset(kernel, service)) {
      preferences.translationServiceHistory.value = provider.historyTracker.snapshot();
      persistServiceHistory(kernel, service, null);
    }
  }

  function serviceProfileSnapshot(configs, credentials) {
    const snapshots = {};
    for (const kernel of ['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise']) {
      const config = configs?.[kernel] || {},
        secrets = credentials?.[kernel] || {};
      const ids = new Set([
        config.id || 'auto',
        ...Object.keys(config.profiles || {}),
        ...Object.keys(secrets),
      ]);
      snapshots[kernel] = {};
      for (const service of ids)
        snapshots[kernel][service] = JSON.stringify([
          config.profiles?.[service]?.values || (config.id === service ? config.values : {}) || {},
          secrets[service] || {},
        ]);
    }
    return snapshots;
  }
  return {
    persistServiceHistory,
    recordServiceOutcome,
    resetServiceHistory,
    serviceProfileSnapshot,
  };
}
