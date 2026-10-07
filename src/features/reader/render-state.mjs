import { ref, shallowRef } from 'vue';
import { BitmapCache } from './bitmap-cache.mjs';

export function createRenderState() {
  const renderWindow = ref(new Set());
  const layoutElement = ref();
  const thumbnailList = ref();
  const thumbnailTop = ref(0);
  const thumbnailHeight = ref(800);
  const thumbnailHighlight = ref(null);
  const pageTasks = new Map();
  const bitmapFrames = new BitmapCache({ maxBytes: 64 * 1024 * 1024, maxEntries: 96 });
  const bitmapIds = new WeakMap();
  const bitmapId = 0;
  const thumbnailEpoch = 0;
  const viewportFrame = 0;
  const visibleThumbnails = new Set();
  const visiblePages = new Set();
  const canvasCache = new WeakMap();
  const pageEls = new Map();
  const canvasEls = new Map();
  const thumbEls = new Map();
  const renderEpoch = 0;
  const scheduledViewport = null;
  const renderMetrics = {
    pageFrames: 0,
    thumbnailFrames: 0,
    cacheHits: 0,
    viewportLookups: 0,
    geometryReads: 0,
    openedAt: 0,
    firstPageMs: null,
    peakResidentBytes: 0,
  };
  const revealControllers = new Set();
  const pendingPreview = new Map();
  const previewScrolling = false;
  const previewTimer = undefined;
  const previewFlushing = false;
  const scrollbarTimers = new Map();
  return {
    renderWindow,
    layoutElement,
    thumbnailList,
    thumbnailTop,
    thumbnailHeight,
    thumbnailHighlight,
    pageTasks,
    bitmapFrames,
    bitmapIds,
    bitmapId,
    thumbnailEpoch,
    viewportFrame,
    visibleThumbnails,
    visiblePages,
    canvasCache,
    pageEls,
    canvasEls,
    thumbEls,
    renderEpoch,
    scheduledViewport,
    renderMetrics,
    revealControllers,
    pendingPreview,
    previewScrolling,
    previewTimer,
    previewFlushing,
    scrollbarTimers,
  };
}
