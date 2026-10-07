export function createWindowPerformance({
  app,
  registry,
  memoryMetricToBytes,
  sumMemoryMetrics,
  smoke,
  backgroundRenderSmoke,
}) {
  const windowActive = (target) =>
    !target.isMinimized() && (backgroundRenderSmoke || (target.isVisible() && target.isFocused()));
  const stop = (target) => {
    const state = registry.stateFor(target);
    if (!state?.performance) return;
    if (state.performance.timer) {
      clearInterval(state.performance.timer);
      state.performance.timer = null;
    }
    state.performance.samples = 0;
  };
  const performanceMemory = (value) => {
    const memory = memoryMetricToBytes(value);
    return {
      ...memory,
      rssEstimateBytes: memory.workingSetBytes,
      workingSetKind: 'rss-estimate',
      processPeakWorkingSetBytes: memory.peakWorkingSetBytes,
    };
  };
  const sample = (target) => {
    const state = registry.stateFor(target);
    if (!state || target.isDestroyed()) return null;
    let metrics = [];
    try {
      metrics = app.getAppMetrics();
    } catch {}
    const rendererPid = target.webContents.getOSProcessId();
    const backendPid = state.backend.processId;
    const find = (pid) => metrics.find((metric) => metric?.pid === pid);
    const observe = (key, value) => {
      const current = value.workingSetBytes || 0;
      const previous = state.performance.peaks.get(key) || 0;
      state.performance.peaks.set(key, Math.max(previous, current));
      return { ...value, peakWorkingSetBytes: Math.max(previous, current) };
    };
    const rendererRaw = performanceMemory(find(rendererPid));
    const backendRaw = performanceMemory(find(backendPid));
    const mainRaw = performanceMemory(find(process.pid));
    const gpuMetrics = metrics.filter((metric) => metric?.type === 'GPU');
    const gpuRaw = gpuMetrics.map(performanceMemory);
    const renderer = observe('renderer', rendererRaw);
    const backend = observe('backend', backendRaw);
    const main = observe('main', mainRaw);
    const gpu = gpuRaw.map((value, index) =>
      observe(`gpu:${gpuMetrics[index]?.pid || index}`, value),
    );
    const scopedCurrent = sumMemoryMetrics([rendererRaw, backendRaw]);
    const sharedCurrent = sumMemoryMetrics([mainRaw, ...gpuRaw]);
    const aggregateCurrent = sumMemoryMetrics([scopedCurrent, sharedCurrent]);
    const scopedTotal = observe('scoped-total', scopedCurrent);
    const sharedTotal = observe('shared-total', sharedCurrent);
    const aggregate = observe('aggregate', aggregateCurrent);
    return {
      schemaVersion: 1,
      sampledAtMs: Date.now(),
      scope: {
        rendererPid,
        backendPid,
        mainPid: process.pid,
        gpuPids: gpuMetrics
          .filter((metric) => Number.isInteger(metric.pid))
          .map((metric) => metric.pid),
      },
      scoped: { renderer, backend, total: scopedTotal },
      shared: { main, gpu, total: sharedTotal },
      aggregate,
    };
  };
  const update = (target) => {
    const state = registry.stateFor(target);
    if (!state?.performance?.hasDocument || !windowActive(target)) {
      stop(target);
      return;
    }
    if (state.performance.timer) return;
    state.performance.samples = 0;
    state.performance.timer = setInterval(
      () => {
        if (
          !registry.windows.has(target) ||
          target.isDestroyed() ||
          !windowActive(target) ||
          state.performance.samples >= 12000
        ) {
          stop(target);
          return;
        }
        state.performance.samples++;
        try {
          sample(target);
        } catch {}
      },
      smoke && smoke !== 'resource-benchmark' ? 250 : 5000,
    );
    state.performance.timer.unref?.();
  };
  return { windowActive, stop, sample, update };
}
