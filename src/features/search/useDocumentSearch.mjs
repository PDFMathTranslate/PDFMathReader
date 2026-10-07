import { ref, shallowRef, computed, reactive, watch, nextTick } from 'vue';
import { searchSegments, pdfSearchSegments } from './document-search.mjs';
import { t } from '../../i18n/index.mjs';

export function useDocumentSearch({
  pages,
  reader,
  settings,
  zoom,
  showTranslations,
  getDocument,
  getEpoch,
  getPageHost,
  readingView,
  renderPages,
  go,
  viewportPages,
  scheduleViewport,
  scheduleReadingSave,
  navigation,
}) {
  const searchOpen = ref(false),
    searchQuery = ref(''),
    searchInput = ref(),
    searchResults = shallowRef([]),
    searchIndex = ref(-1),
    searchBusy = ref(false),
    searchFailure = ref('');
  // Keep translation presentation stable while navigating a search session.
  const searchPages = shallowRef(null);
  function displayedPage(p) {
    return searchPages.value?.get(p.number) || p;
  }
  function captureSearchPages() {
    searchPages.value = new Map(
      pages.value.map((p) => [p.number, { ...p, blocks: p.blocks.map((b) => reactive({ ...b })) }]),
    );
  }
  const searchPageCount = computed(() => new Set(searchResults.value.map((hit) => hit.page)).size);
  const searchHit = computed(() => searchResults.value[searchIndex.value] || null);
  const searchTextCache = new WeakMap();
  let searchGeneration = 0,
    searchTimer,
    searchOrigin = null;
  async function openSearch() {
    if (!pages.value.length) return;
    if (!searchOpen.value) {
      searchOrigin = readingView();
      captureSearchPages();
    }
    settings.value = false;
    searchOpen.value = true;
    await nextTick();
    searchInput.value?.focus();
  }
  function closeSearch() {
    const resume = searchOpen.value;
    searchPages.value = null;
    searchOrigin = null;
    searchOpen.value = false;
    searchResults.value = [];
    searchIndex.value = -1;
    ++searchGeneration;
    searchBusy.value = false;
    clearTimeout(searchTimer);
    if (resume) void nextTick(() => renderPages());
  }
  async function indexedText(document, number) {
    let cache = searchTextCache.get(document);
    if (!cache) {
      cache = new Map();
      searchTextCache.set(document, cache);
    }
    if (!cache.has(number)) cache.set(number, pdfSearchSegments(await document.getPage(number)));
    return cache.get(number);
  }
  async function runSearch() {
    const generation = ++searchGeneration,
      token = getEpoch(),
      query = searchQuery.value;
    searchResults.value = [];
    searchIndex.value = -1;
    searchFailure.value = '';
    if (!searchOpen.value || !query.trim() || !getDocument()) {
      searchBusy.value = false;
      return;
    }
    searchBusy.value = true;
    const translated = showTranslations.value;
    try {
      for (const source of pages.value) {
        const p = displayedPage(source);
        if (generation !== searchGeneration || token !== getEpoch()) return;
        let segments;
        if (!translated) segments = await indexedText(getDocument(), p.number);
        else if (p.mathDocument) segments = await indexedText(p.mathDocument, 1);
        else
          segments = p.blocks
            .filter((b) => b.translation && !b.math)
            .map((b) => ({
              text: b.translation,
              block: b,
              box: { x: b.x, y: b.y, width: b.width, height: b.height },
            }));
        if (generation !== searchGeneration || token !== getEpoch()) return;
        if (p.blocks?.length)
          segments = segments.map((segment) => {
            if (segment.block) return segment;
            const { x, y, width, height } = segment.box;
            const block = p.blocks.find(
              (b) =>
                x + width / 2 >= b.x &&
                x + width / 2 <= b.x + b.width &&
                y + height / 2 >= b.y &&
                y + height / 2 <= b.y + b.height,
            );
            return { ...segment, paragraph: block || segment.paragraph || segment };
          });
        const matches = searchSegments(segments, query).map((match) => ({
          ...match,
          page: p.number,
        }));
        if (matches.length) {
          searchResults.value = [...searchResults.value, ...matches];
          if (searchIndex.value < 0) {
            searchIndex.value = 0;
            await locateSearch();
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } catch {
      if (generation === searchGeneration) searchFailure.value = t('error.searchDocument');
    } finally {
      if (generation === searchGeneration) searchBusy.value = false;
    }
  }
  function scheduleSearch() {
    clearTimeout(searchTimer);
    ++searchGeneration;
    searchBusy.value = false;
    searchTimer = setTimeout(runSearch, 180);
  }
  async function locateSearch() {
    const hit = searchHit.value,
      origin = searchOrigin;
    if (!hit) return;
    const token = getEpoch(),
      generation = searchGeneration,
      request = navigation.begin();
    try {
      for (const block of hit.blocks) block.translated = showTranslations.value;
      await go(hit.page);
      if (
        token !== getEpoch() ||
        generation !== searchGeneration ||
        !navigation.isCurrent(request) ||
        hit !== searchHit.value ||
        !searchOpen.value
      )
        return;
      const host = getPageHost(hit.page),
        el = reader.value,
        box = hit.boxes[0];
      if (host && el && box) {
        const bounds = el.getBoundingClientRect(),
          rect = host.getBoundingClientRect();
        el.scrollTop += rect.top + box.y * zoom.value - bounds.top - el.clientHeight * 0.35;
        el.scrollLeft += rect.left + box.x * zoom.value - bounds.left - el.clientWidth * 0.25;
      }
      if (origin) navigation.record(origin, hit.page);
      viewportPages();
      scheduleViewport();
      scheduleReadingSave();
    } finally {
      navigation.finish(request);
    }
  }
  function nextSearch(delta = 1) {
    if (!searchResults.value.length) return;
    searchIndex.value =
      (searchIndex.value + delta + searchResults.value.length) % searchResults.value.length;
    void locateSearch();
  }
  watch([searchQuery, showTranslations], scheduleSearch);

  watch(searchOpen, (value) => {
    if (value) scheduleSearch();
  });

  return {
    searchOpen,
    searchQuery,
    searchInput,
    searchResults,
    searchIndex,
    searchBusy,
    searchFailure,
    searchPages,
    searchPageCount,
    searchHit,
    displayedPage,
    openSearch,
    closeSearch,
    scheduleSearch,
    nextSearch,
  };
}
