import { nextTick } from 'vue';
import { clearTranslationServiceSchemaCache } from '../translation/translation-services.mjs';

export function createKernelSettings({
  preferences,
  session,
  kernel,
  feedback,
  provider,
  runtime,
  shell,
  actions,
}) {
  function reportKernelFailure(message, id = preferences.engine.value) {
    if (!message || id !== preferences.engine.value) return;
    kernel.kernelFailure.value = { id, message };
    if (!kernel.kernelIgnored.value && !kernel.kernelDocumentIgnored.value)
      actions.rootActions.revealHeader();
  }

  function resetKernelIgnore() {
    clearTimeout(runtime.kernelIgnoreTimer);
    kernel.kernelIgnored.value = false;
    kernel.kernelIgnoreUsed.value = false;
    kernel.kernelDocumentIgnored.value = false;
    kernel.kernelFailure.value = null;
  }

  function ignoreKernelFailure() {
    clearTimeout(runtime.kernelIgnoreTimer);
    if (kernel.offerDocumentIgnore.value) {
      kernel.kernelDocumentIgnored.value = true;
      return;
    }
    kernel.kernelIgnoreUsed.value = true;
    kernel.kernelIgnored.value = true;
    runtime.kernelIgnoreTimer = setTimeout(
      () => {
        kernel.kernelIgnored.value = false;
        if (kernel.kernelErrorVisible.value) actions.rootActions.revealHeader();
      },
      5 * 60 * 1000,
    );
  }

  function dismissKernelFailureFromDocument() {
    if (!kernel.kernelErrorVisible.value) return;
    clearTimeout(runtime.kernelIgnoreTimer);
    kernel.kernelIgnored.value = true;
    runtime.kernelIgnoreTimer = setTimeout(
      () => {
        kernel.kernelIgnored.value = false;
        if (kernel.kernelErrorVisible.value) actions.rootActions.revealHeader();
      },
      5 * 60 * 1000,
    );
  }

  async function recoverKernel(source) {
    if (kernel.engineBusy.value) return;
    kernel.kernelFailure.value = null;
    kernel.kernelIgnored.value = false;
    clearTimeout(runtime.kernelIgnoreTimer);
    if (source) await installEngine(true, source);
    else await checkEngine();
    if (!kernel.kernelFailure.value && kernel.engineState.value?.available) {
      for (const p of session.pages.value) {
        if (p.status === 'error') {
          p.status = 'idle';
          p.message = '';
        }
        for (const b of p.blocks)
          if (b.status === 'error') {
            b.status = 'idle';
            b.error = '';
          }
      }
      actions.readerScroll.settle();
    }
  }

  async function checkEngine() {
    const id = preferences.engine.value;
    kernel.engineState.value = null;
    kernel.engineBusy.value = true;
    try {
      const state = await actions.backendRequests.api('/api/engines/' + id);
      if (preferences.engine.value === id) kernel.engineState.value = state;
    } catch (e) {
      feedback.error.value = e.message;
      reportKernelFailure(e.message, id);
    } finally {
      if (preferences.engine.value === id) {
        kernel.engineBusy.value = false;
        if (runtime.kernelFocusPending) {
          runtime.kernelFocusPending = false;
          await nextTick();
          shell.kernelInput.value?.el
            ?.querySelector(
              '.macvue-pop-up-button,.macvue-segment[data-state="on"],[role=radio][aria-checked=true]',
            )
            ?.focus();
        }
      }
    }
  }

  async function finishKernelSetup() {
    await checkEngine();
    const startup = await actions.backendRequests.api('/api/engines');
    kernel.uvState.value = startup.uv;
    kernel.discoveredEngines.value = startup.engines;
    clearTranslationServiceSchemaCache(preferences.engine.value, kernel.engineState.value?.version);
    provider.translationServiceCatalogRevision.value++;
    actions.readerScroll.settle();
  }

  async function installEngine(reinstall = false, source = 'release') {
    if (kernel.engineBusy.value) return;
    const id = preferences.engine.value;
    kernel.engineBusy.value = true;
    try {
      const state = await actions.backendRequests.api('/api/engines/' + id + '/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reinstall: reinstall === true, source }),
      });
      clearTranslationServiceSchemaCache(id, state?.version);
      provider.translationServiceCatalogRevision.value++;
      kernel.discoveredEngines.value = kernel.discoveredEngines.value
        .filter((item) => item.id !== id)
        .concat(state);
      if (preferences.engine.value === id) kernel.engineState.value = state;
    } catch (e) {
      feedback.error.value = e.message;
      reportKernelFailure(e.message, id);
    } finally {
      if (preferences.engine.value === id) kernel.engineBusy.value = false;
    }
  }
  return {
    reportKernelFailure,
    resetKernelIgnore,
    ignoreKernelFailure,
    dismissKernelFailureFromDocument,
    recoverKernel,
    checkEngine,
    finishKernelSetup,
    installEngine,
  };
}
