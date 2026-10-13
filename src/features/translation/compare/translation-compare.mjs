import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { createCompareLane, ULTRA_FAST_KERNEL } from './compare-lane.mjs';
import { loadTranslationServiceSchema } from '../translation-services.mjs';
import { normalizeTranslationLanguage } from '../../../../shared/translation/languages.mjs';

const KERNELS = ['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise'];
const ORIGINAL_CACHE_SIZE = 8;

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

/**
 * Experimental side-by-side comparison of two translation configurations. The
 * left lane starts from the reader's current kernel and service; the right lane
 * starts empty. Either side can be changed here without touching reader settings.
 */
export function createTranslationCompare({ session, preferences, provider, kernel }) {
  const compareOpen = ref(false);
  const left = shallowRef(null);
  const right = shallowRef(null);
  const leftSelection = ref(null);
  const rightSelection = ref(null);
  const selections = { left: leftSelection, right: rightSelection };
  const laneKeys = new WeakMap();
  const kernelCatalog = reactive(
    Object.fromEntries(
      KERNELS.map((id) => [id, { status: 'unknown', version: '', services: [], message: '' }]),
    ),
  );
  let visible = [];
  let focus = 1;
  let layoutController = new AbortController();
  const layouts = new Map();
  const originals = new Map();

  function remoteKernel(id) {
    const url = preferences.remoteKernelUrl.value.trim();
    return id !== ULTRA_FAST_KERNEL && preferences.remoteKernelEnabled.value && url
      ? { url, service: preferences.remoteKernelService.value.trim() }
      : undefined;
  }

  function configFor(id, service) {
    return {
      kernel: id,
      service,
      language: normalizeTranslationLanguage(id, preferences.language.value, 'Simplified Chinese'),
      sourceLanguage: normalizeTranslationLanguage(
        id,
        preferences.sourceLanguage.value,
        'English',
        'source',
      ),
      glossary: provider.activeGlossary.value,
      reuseTranslations: preferences.reuseTranslations.value,
      advancedOptions:
        id === ULTRA_FAST_KERNEL ? {} : plainObject(preferences.kernelAdvancedOptions.value?.[id]),
      remoteKernel: remoteKernel(id),
      jevApiToken: preferences.jevApiToken.value,
      paragraphContinuationDetection: preferences.paragraphContinuationDetection.value,
    };
  }

  function selectionConfig(selection) {
    if (!selection) return null;
    const config = configFor(
      selection.kernel,
      provider.translationServiceFor(selection.kernel, selection.service),
    );
    // The reader already validated its own languages; keep them exactly.
    if (selection.kernel === preferences.engine.value) {
      config.language = preferences.language.value;
      config.sourceLanguage = preferences.sourceLanguage.value;
    }
    return config;
  }
  const leftConfig = computed(() => selectionConfig(leftSelection.value));
  const rightConfig = computed(() => selectionConfig(rightSelection.value));

  // Paragraph boxes are shared by both lanes, and reuse the reader's own boxes when
  // it already laid the page out with the same kernel.
  function layoutFor(number) {
    const page = session.pages.value[number - 1];
    if (!page) return Promise.reject(Error('Page is unavailable.'));
    if (
      preferences.engine.value === ULTRA_FAST_KERNEL &&
      page.blocks?.length &&
      page.blocks.every((block) => !block.math)
    )
      return Promise.resolve(page.blocks);
    let task = layouts.get(number);
    if (task) return task;
    task = fetch('/api/layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: session.documentId, page: number, height: page.height }),
      signal: layoutController.signal,
    }).then(async (response) => {
      const body = await response.json().catch(() => null);
      if (!response.ok) throw Error(body?.error || 'Layout failed.');
      return Array.isArray(body?.paragraphs) ? body.paragraphs : [];
    });
    layouts.set(number, task);
    task.catch(() => {
      if (layouts.get(number) === task) layouts.delete(number);
    });
    return task;
  }

  function createLane(config) {
    const lane = createCompareLane({
      config,
      documentId: session.documentId,
      getDocument: (source) => session.getDocument(source),
      layoutFor,
      limits: {
        pages: () => preferences.pageConcurrency.value,
        paragraphs: () => preferences.concurrency.value,
        pageCount: () => session.pages.value.length,
      },
    });
    if (visible.length) lane.want(visible, focus);
    return lane;
  }

  // A lane restarts only when its settings change by value.
  function replace(side, config, force = false) {
    const key = config && compareOpen.value ? JSON.stringify(config) : '';
    if (!force && side.value && laneKeys.get(side.value) === key) return;
    side.value?.dispose();
    side.value = key ? createLane(config) : null;
    if (side.value) laneKeys.set(side.value, key);
  }

  // Original pages are rendered once per width and drawn into both columns.
  function originalPage(number, pixelWidth) {
    const key = `${number}:${pixelWidth}`;
    let task = originals.get(key);
    if (task) {
      originals.delete(key);
      originals.set(key, task);
      return task;
    }
    const pdf = session.pdf;
    task = (async () => {
      const page = await pdf.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: pixelWidth / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
        background: '#ffffff',
      }).promise;
      return canvas;
    })();
    originals.set(key, task);
    task.catch(() => {
      if (originals.get(key) === task) originals.delete(key);
    });
    while (originals.size > ORIGINAL_CACHE_SIZE) {
      const oldest = originals.keys().next().value;
      originals.delete(oldest);
    }
    return task;
  }

  async function loadKernel(id) {
    const entry = kernelCatalog[id];
    if (!entry || entry.status === 'loading' || entry.status === 'ready') return;
    entry.status = 'loading';
    try {
      let version = '';
      if (id === preferences.engine.value && kernel.engineState.value?.available)
        version = kernel.engineState.value.version || '';
      else {
        const response = await fetch('/api/engines/' + encodeURIComponent(id));
        const state = await response.json().catch(() => null);
        if (!response.ok || !state?.available) {
          entry.status = 'missing';
          return;
        }
        version = state.version || '';
      }
      const schema = await loadTranslationServiceSchema(id, version);
      entry.version = version;
      entry.services = schema.services || [];
      entry.status = 'ready';
    } catch (error) {
      entry.status = 'error';
      entry.message = error.message;
    }
  }

  function serviceOptions(id) {
    const entry = kernelCatalog[id];
    return entry?.status === 'ready' ? provider.serviceOptionsFor(id, entry.services) : [];
  }

  function serviceLabel(id, serviceId) {
    const option = serviceOptions(id).find((item) => item.value === serviceId);
    return option?.label || (serviceId === 'auto' ? '' : serviceId);
  }

  function defaultService(id) {
    const options = serviceOptions(id);
    const preferred = provider.selectedServiceId(id);
    return !options.length || options.some((item) => item.value === preferred)
      ? preferred
      : options[0].value;
  }

  function openCompare() {
    if (compareOpen.value || !session.pages.value.length || !session.documentId) return;
    layoutController = new AbortController();
    compareOpen.value = true;
    visible = [];
    for (const id of KERNELS) {
      // Availability can change between openings.
      if (kernelCatalog[id].status !== 'loading') kernelCatalog[id].status = 'unknown';
      void loadKernel(id);
    }
    // The left side starts from the reader's current choice on every opening.
    leftSelection.value = {
      kernel: preferences.engine.value,
      service: provider.selectedServiceId(preferences.engine.value),
    };
    replace(left, leftConfig.value, true);
    replace(right, rightConfig.value, true);
  }

  function closeCompare() {
    if (!compareOpen.value) return;
    compareOpen.value = false;
    left.value?.dispose();
    right.value?.dispose();
    left.value = null;
    right.value = null;
    layoutController.abort();
    layouts.clear();
    originals.clear();
    visible = [];
  }

  function toggleCompare() {
    if (compareOpen.value) closeCompare();
    else openCompare();
  }

  function choose(side, kernelId, service) {
    if (!selections[side] || !KERNELS.includes(kernelId)) return;
    selections[side].value = {
      kernel: kernelId,
      service: typeof service === 'string' && service ? service : defaultService(kernelId),
    };
  }

  function clearRight() {
    rightSelection.value = null;
  }

  function showPages(numbers, focusPage) {
    visible = numbers;
    focus = focusPage ?? numbers[0] ?? focus;
    left.value?.want(visible, focus);
    right.value?.want(visible, focus);
  }

  // Settings are compared by value so unrelated reactive churn does not restart a lane.
  watch(
    () => JSON.stringify(leftConfig.value),
    () => replace(left, leftConfig.value),
  );
  watch(
    () => JSON.stringify(rightConfig.value),
    () => replace(right, rightConfig.value),
  );
  // Opening or closing a document replaces the page list.
  watch(session.pages, closeCompare);
  watch(preferences.translationCompareEnabled, (enabled) => {
    if (!enabled) closeCompare();
  });

  return {
    compareOpen,
    compareLeft: left,
    compareRight: right,
    compareSelections: selections,
    compareRightSelection: rightSelection,
    compareKernels: kernelCatalog,
    compareKernelIds: KERNELS,
    openCompare,
    closeCompare,
    toggleCompare,
    chooseCompare: choose,
    chooseCompareRight: (kernelId, service) => choose('right', kernelId, service),
    clearCompareRight: clearRight,
    compareServiceOptions: serviceOptions,
    compareServiceLabel: serviceLabel,
    compareDefaultService: defaultService,
    showComparePages: showPages,
    compareOriginalPage: originalPage,
  };
}
