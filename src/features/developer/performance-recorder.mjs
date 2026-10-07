// Content-free, bounded per-document measurements. All times are monotonic milliseconds.
export function createPerformanceRecorder({
  native = globalThis.window?.previewPerformance,
  fetchStats = async () => null,
  now = () => performance.now(),
} = {}) {
  let current = null,
    timer,
    observer,
    generation = 0,
    resetInitialization = Promise.resolve(),
    active = true;
  try {
    observer = new PerformanceObserver((list) => {
      const state = current;
      if (!state || state.closed) return;
      for (const entry of list.getEntries())
        if (
          state.scrollUntil > 0 &&
          entry.startTime + entry.duration >= state.start &&
          entry.startTime <= state.scrollUntil &&
          entry.startTime + entry.duration >= state.scrollUntil - 1000
        ) {
          const tasks = state.report.scrollLongTasks;
          tasks.count++;
          tasks.totalMs += entry.duration;
          tasks.maxMs = Math.max(tasks.maxMs, entry.duration);
          if (tasks.samples.length < 40)
            tasks.samples.push({
              startMs: Math.max(0, entry.startTime - state.start),
              durationMs: entry.duration,
            });
        }
    });
    observer.observe({ type: 'longtask', buffered: false });
  } catch {}
  function owns(state) {
    return !!state && state === current && state.token === generation;
  }
  function isCurrent(state) {
    return owns(state) && !state.closed;
  }
  function sample(state = current) {
    if (!state || !isCurrent(state)) return Promise.resolve();
    if (state.samplePromise) return state.samplePromise;
    state.samplePromise = (async () => {
      try {
        const memory = await native?.sample();
        if (isCurrent(state) && memory) state.report.memory = memory;
      } catch {}
    })().finally(() => {
      state.samplePromise = null;
    });
    return state.samplePromise;
  }
  async function snapshot(state = current) {
    if (!state) return null;
    if (state.closed) return structuredClone(state.report);
    await state.baselineReady;
    await sample(state);
    if (!isCurrent(state)) return structuredClone(state.report);
    try {
      const total = await fetchStats();
      if (isCurrent(state) && total) {
        const scoped = state.transportBaselineValid && state.transportBase;
        state.report.transport = {
          ...total,
          scope: scoped ? 'since-document-open' : 'window-session',
          timingScope: 'window-session',
        };
        if (scoped)
          for (const key of ['requests', 'requestBodyBytes', 'responseBodyBytes', 'uploadBytes'])
            state.report.transport[key] = Math.max(
              0,
              total[key] - (state.transportBase?.[key] || 0),
            );
      }
    } catch {}
    return structuredClone(state.report);
  }
  function schedule() {
    clearInterval(timer);
    if (active && current) timer = setInterval(() => sample(), 5000);
  }
  function initialize(state) {
    const reset = resetInitialization
      .catch(() => {})
      .then(async () => {
        if (!isCurrent(state)) return;
        try {
          await native?.reset?.();
        } catch {}
      });
    resetInitialization = reset.catch(() => {});
    const baseline = Promise.resolve()
      .then(async () => {
        try {
          const value = await fetchStats();
          if (isCurrent(state)) {
            state.transportBase = value;
            state.transportBaselineValid = !!value && !state.transportBaselineMissed;
          }
        } catch {
          if (isCurrent(state)) {
            state.transportBase = null;
            state.transportBaselineValid = false;
          }
        } finally {
          if (isCurrent(state)) state.transportBaselineReady = true;
        }
      })
      .catch(() => {});
    state.baselineReady = Promise.all([reset, baseline]).catch(() => {});
    void state.baselineReady.then(() => {
      if (isCurrent(state)) void sample(state);
    });
  }
  return {
    setActive(value) {
      active = !!value;
      schedule();
    },
    start(bytes) {
      const token = ++generation;
      clearInterval(timer);
      const state = (current = {
        token,
        start: now(),
        scrollUntil: 0,
        samplePromise: null,
        baselineReady: Promise.resolve(),
        transportBase: null,
        transportBaselineReady: false,
        transportBaselineValid: false,
        transportStarted: false,
        transportBaselineMissed: false,
        closed: false,
        finishPromise: null,
        marks: {},
        report: {
          schemaVersion: 1,
          openedAt: new Date().toISOString(),
          fileBytes: bytes,
          pageCount: 0,
          firstScreenMs: null,
          stages: {},
          scrollLongTasks: { count: 0, totalMs: 0, maxMs: 0, samples: [] },
          memory: null,
          transport: null,
          resize: { count: 0, layoutCommits: 0, snapshotTransitions: 0 },
        },
      });
      schedule();
      initialize(state);
    },
    beginTransport() {
      if (!isCurrent(current)) return;
      current.transportStarted = true;
      if (!current.transportBaselineReady) {
        current.transportBaselineMissed = true;
        current.transportBaselineValid = false;
      }
    },
    mark(name) {
      if (isCurrent(current)) current.report.stages[name] = now() - current.start;
    },
    pages(count) {
      if (isCurrent(current)) current.report.pageCount = count;
    },
    painted() {
      const state = current;
      if (!isCurrent(state) || state.report.firstScreenMs !== null || state.marks.paint) return;
      state.marks.paint = true;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (isCurrent(state)) {
            state.report.firstScreenMs = now() - state.start;
            void snapshot(state)
              .then((value) => {
                if (value && isCurrent(state)) return native?.save(value);
                return undefined;
              })
              .catch(() => {});
          }
        }),
      );
    },
    scroll() {
      if (isCurrent(current)) current.scrollUntil = now() + 1000;
    },
    resize(name) {
      if (isCurrent(current) && name in current.report.resize) current.report.resize[name]++;
    },
    snapshot,
    async finish() {
      const state = current,
        token = state?.token;
      if (!state) return null;
      if (state.finishPromise) return state.finishPromise;
      // Freeze before detached baseline/stats work can outlive this document.
      state.closed = true;
      clearInterval(timer);
      const result = structuredClone(state.report);
      let saved = Promise.resolve(),
        ended = Promise.resolve();
      if (owns(state) && token === generation) {
        try {
          saved = Promise.resolve(native?.save?.(result)).catch(() => {});
        } catch {}
        try {
          ended = Promise.resolve(native?.end?.()).catch(() => {});
        } catch {}
      }
      state.finishPromise = Promise.all([saved, ended]).then(() => result);
      return state.finishPromise;
    },
    destroy() {
      clearInterval(timer);
      observer?.disconnect();
      generation++;
    },
  };
}
