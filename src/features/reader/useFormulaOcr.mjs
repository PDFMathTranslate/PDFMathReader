import { ref, watch, onBeforeUnmount } from 'vue';
import { formulaOcrLabel } from './formula-ocr-labels.mjs';

export function useFormulaOcr({ enabled, request, notify, save }) {
  const status = ref({ ready: false }),
    busy = ref(false),
    error = ref('');
  let timer,
    disposed = false;
  async function refresh({ signal } = {}) {
    const next = await request('/api/formula-ocr/status', { signal });
    if (!disposed) {
      status.value = next;
      if (next.ready) error.value = '';
    }
    return next;
  }
  function poll() {
    clearTimeout(timer);
    if (disposed) return;
    timer = setTimeout(async () => {
      try {
        await refresh();
      } catch {
        /* Download request reports its own error. */
      }
      if (busy.value || status.value.downloading) poll();
    }, 350);
  }
  async function enable(value) {
    enabled.value = !!value;
    localStorage.setItem('formulaOcrEnabled', String(enabled.value));
    save();
    if (!value || busy.value) return;
    busy.value = true;
    error.value = '';
    poll();
    try {
      status.value = await request('/api/formula-ocr/download', { method: 'POST' });
    } catch (e) {
      error.value = e.message;
    } finally {
      busy.value = false;
      clearTimeout(timer);
      if (!disposed) await refresh().catch(() => {});
    }
  }
  async function recognize(image, { signal } = {}) {
    if (!enabled.value) throw Error(formulaOcrLabel('notReady'));
    const current = await refresh({ signal });
    if (!enabled.value || !current.ready) throw Error(formulaOcrLabel('notReady'));
    signal?.throwIfAborted();
    const result = await request('/api/formula-ocr/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: image,
      signal,
    });
    if (signal?.aborted || disposed || !enabled.value) throw Error(formulaOcrLabel('failed'));
    const latex = String(result.latex || '').trim();
    if (!latex) throw Error(formulaOcrLabel('failed'));
    try {
      if (window.previewClipboard) await window.previewClipboard.writeText(latex);
      else await navigator.clipboard.writeText(latex);
    } catch {
      throw Error(formulaOcrLabel('copyFailed'));
    }
    notify(`${formulaOcrLabel('copied')}\n${latex}`, 4500);
    return latex;
  }
  // Loading a saved opt-in checks the local files; downloads only follow an
  // explicit switch action, including Retry after an interrupted download.
  watch(
    enabled,
    (value) => {
      localStorage.setItem('formulaOcrEnabled', String(value));
      if (value)
        void refresh()
          .then((next) => {
            if (next.downloading) poll();
          })
          .catch((e) => (error.value = e.message));
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    disposed = true;
    clearTimeout(timer);
  });
  return { enabled, status, busy, error, enable, refresh, recognize, notify };
}
