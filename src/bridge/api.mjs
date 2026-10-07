import { t } from '../i18n/index.mjs';

export function createBackendRequests({ session, translationState, provider, actions }) {
  async function api(url, options = {}) {
    const { translationJob, ...requestOptions } = options;
    const controller = new AbortController();
    const historyRequest =
      url === '/api/translate'
        ? provider.historyTracker.begin({
            kernel: 'pdf_inspector',
            service: JSON.parse(requestOptions.body || '{}').translationService?.id || 'auto',
            epoch: session.epoch,
          })
        : null;
    if (translationJob) translationState.translationRequests.set(controller, translationJob);
    if (url === '/api/translate' || url.startsWith('/api/layout'))
      translationState.controllers.add(controller);
    try {
      const response = await fetch(url, { ...requestOptions, signal: controller.signal });
      actions.rootActions.noteTranslationService(response);
      if (historyRequest)
        actions.translationHistory.recordServiceOutcome(
          response,
          historyRequest,
          controller.signal,
        );
      if (response.status === 204) return null;
      const body = await response.json();
      if (!response.ok) throw Error(body.error || t('error.requestFailed'));
      return body;
    } finally {
      translationState.controllers.delete(controller);
      translationState.translationRequests.delete(controller);
    }
  }
  return { api };
}
