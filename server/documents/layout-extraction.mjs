const DEFAULT_COALESCE_MS = 5;
const DEFAULT_MAX_PAGES = 32;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const MAX_GROUP_PAGES = 4;
function defaultClock() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function validPage(page) {
  return Number.isInteger(page) && page >= 1;
}
function asError(error) {
  return error instanceof Error ? error : Error(String(error || 'Layout extraction failed.'));
}
function cacheableEntry(entry) {
  return (
    !!entry &&
    typeof entry === 'object' &&
    !Array.isArray(entry) &&
    entry.id !== undefined &&
    entry.bytes !== undefined
  );
}
function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

export function createLayoutExtraction({
  extractor,
  coalesceMs = DEFAULT_COALESCE_MS,
  maxPages = DEFAULT_MAX_PAGES,
  maxBytes = DEFAULT_MAX_BYTES,
  onNativeExtraction,
  now = defaultClock,
} = {}) {
  if (typeof extractor !== 'function') throw Error('A layout extractor is required.');
  if (!Number.isInteger(coalesceMs) || coalesceMs < 0)
    throw Error('Invalid layout coalescing window.');
  if (!Number.isInteger(maxPages) || maxPages < 1) throw Error('Invalid layout page cache limit.');
  if (!Number.isInteger(maxBytes) || maxBytes < 1) throw Error('Invalid layout byte cache limit.');
  const states = new WeakMap();

  function stateFor(entry) {
    let state = states.get(entry);
    if (state) return state;
    state = {
      cache: new Map(),
      cacheBytes: 0,
      pending: new Map(),
      inflight: new Map(),
      timer: null,
      flushing: false,
      closed: false,
    };
    states.set(entry, state);
    return state;
  }

  function removeCached(state, page) {
    const value = state.cache.get(page);
    if (value === undefined) return;
    state.cache.delete(page);
    state.cacheBytes -= value.bytes;
  }

  function cachePage(state, page, items) {
    const bytes = jsonBytes(items);
    removeCached(state, page);
    if (bytes > maxBytes) return;
    while (state.cache.size >= maxPages || state.cacheBytes + bytes > maxBytes) {
      const oldest = state.cache.keys().next().value;
      if (oldest === undefined) break;
      removeCached(state, oldest);
    }
    state.cache.set(page, { items, bytes });
    state.cacheBytes += bytes;
  }

  function cachedPage(state, page) {
    const value = state.cache.get(page);
    if (!value) return undefined;
    state.cache.delete(page);
    state.cache.set(page, value);
    return value.items;
  }

  function resolveGroup(entry, state, pages, items) {
    if (state.closed || states.get(entry) !== state) return;
    const byPage = new Map(pages.map((page) => [page, []]));
    for (const item of Array.isArray(items) ? items : []) {
      const page = Number(item?.page);
      if (byPage.has(page)) byPage.get(page).push(item);
    }
    for (const page of pages) {
      const pageItems = byPage.get(page) || [],
        waiters = state.inflight.get(page) || [];
      state.inflight.delete(page);
      cachePage(state, page, pageItems);
      for (const waiter of waiters) waiter.resolve(pageItems);
    }
  }

  function rejectGroup(entry, state, pages, error) {
    if (state.closed || states.get(entry) !== state) return;
    for (const page of pages) {
      const waiters = state.inflight.get(page) || [];
      state.inflight.delete(page);
      for (const waiter of waiters) waiter.reject(error);
    }
  }

  async function runGroup(entry, state, pages) {
    try {
      const started = now();
      let items;
      try {
        items = await extractor(entry.bytes, pages, { frame: 'display' });
      } finally {
        onNativeExtraction?.(now() - started);
      }
      resolveGroup(entry, state, pages, items);
    } catch (error) {
      rejectGroup(entry, state, pages, asError(error));
    }
  }

  async function flush(entry, state) {
    if (state.flushing || state.closed) return;
    state.flushing = true;
    const groups = [];
    while (state.pending.size) {
      const pages = [...state.pending.keys()].sort((a, b) => a - b).slice(0, MAX_GROUP_PAGES),
        waiters = new Map();
      for (const page of pages) {
        waiters.set(page, state.pending.get(page));
        state.pending.delete(page);
      }
      for (const page of pages) state.inflight.set(page, waiters.get(page));
      groups.push(runGroup(entry, state, pages));
    }
    await Promise.all(groups);
    state.flushing = false;
    if (!state.closed && state.pending.size && !state.timer)
      state.timer = setTimeout(() => {
        state.timer = null;
        void flush(entry, state);
      }, coalesceMs);
  }

  function schedule(entry, state) {
    if (state.timer || state.flushing) return;
    state.timer = setTimeout(() => {
      state.timer = null;
      void flush(entry, state);
    }, coalesceMs);
  }

  function extractLegacy(bytes, page) {
    return Promise.resolve().then(async () => {
      const started = now();
      let items;
      try {
        items = await extractor(bytes, [page], { frame: 'display' });
      } finally {
        onNativeExtraction?.(now() - started);
      }
      const pageItems = [];
      for (const item of Array.isArray(items) ? items : [])
        if (Number(item?.page) === page) pageItems.push(item);
      return pageItems;
    });
  }

  function extractPage(entryOrBytes, page) {
    if (!validPage(page)) return Promise.reject(Error('Invalid layout page.'));
    if (!cacheableEntry(entryOrBytes)) return extractLegacy(entryOrBytes, page);
    const state = stateFor(entryOrBytes),
      cached = cachedPage(state, page);
    if (cached !== undefined) return Promise.resolve(cached);
    const active = state.inflight.get(page);
    if (active) return new Promise((resolve, reject) => active.push({ resolve, reject }));
    return new Promise((resolve, reject) => {
      const waiters = state.pending.get(page) || [];
      waiters.push({ resolve, reject });
      state.pending.set(page, waiters);
      schedule(entryOrBytes, state);
    });
  }

  function cleanup(entry) {
    if (!cacheableEntry(entry)) return false;
    const state = states.get(entry);
    if (!state) return false;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    const error = Error('Layout extraction was cleaned up.');
    state.closed = true;
    for (const waiters of [...state.pending.values(), ...state.inflight.values()])
      for (const waiter of waiters) waiter.reject(error);
    state.pending.clear();
    state.inflight.clear();
    state.cache.clear();
    state.cacheBytes = 0;
    state.flushing = false;
    states.delete(entry);
    return true;
  }

  function stats(entry) {
    if (!cacheableEntry(entry)) return { pages: 0, bytes: 0, pendingPages: 0 };
    const state = states.get(entry);
    return state
      ? { pages: state.cache.size, bytes: state.cacheBytes, pendingPages: state.pending.size }
      : { pages: 0, bytes: 0, pendingPages: 0 };
  }

  return {
    extractPage,
    cleanup,
    clear: cleanup,
    stats,
    maxGroupPages: MAX_GROUP_PAGES,
    maxPages,
    maxBytes,
    coalesceMs,
  };
}
