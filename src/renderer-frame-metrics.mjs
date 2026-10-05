const MAX_SAMPLES = 120;

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function hiddenValue(documentRef) {
  return documentRef?.hidden === true;
}

function emptySnapshot(documentRef) {
  return {
    fps: null,
    frameIntervalMs: null,
    latencyMs: null,
    sampledAt: null,
    hidden: hiddenValue(documentRef),
  };
}

function startRendererFrameMetrics({windowRef = globalThis.window} = {}) {
  const documentRef = windowRef?.document;
  const developer = windowRef?.previewDeveloper;
  const requestFrame = windowRef?.requestAnimationFrame?.bind(windowRef);
  const cancelFrame = windowRef?.cancelAnimationFrame?.bind(windowRef);

  if (!windowRef || !documentRef || !developer || typeof developer.enabled !== 'function' || typeof requestFrame !== 'function') {
    if (windowRef) windowRef.previewRendererFrameMetrics = emptySnapshot(documentRef);
    return () => {};
  }

  let disposed = false;
  let running = false;
  let frameHandle = null;
  let generation = 0;
  let syncRevision = 0;
  let unsubscribe = null;
  let previousTimestamp = null;
  const intervals = [];
  const latencies = [];

  const publish = () => {
    const frameIntervalMs = intervals.length ? intervals.reduce((total, value) => total + value, 0) / intervals.length : null;
    const latencyMs = latencies.length ? latencies.reduce((total, value) => total + value, 0) / latencies.length : null;
    windowRef.previewRendererFrameMetrics = {
      fps: frameIntervalMs === null ? null : 1000 / frameIntervalMs,
      frameIntervalMs,
      latencyMs,
      sampledAt: Date.now(),
      hidden: hiddenValue(documentRef),
    };
  };

  const resetSnapshot = () => {
    previousTimestamp = null;
    intervals.length = 0;
    latencies.length = 0;
    windowRef.previewRendererFrameMetrics = emptySnapshot(documentRef);
  };

  const resetFrameTiming = () => {
    previousTimestamp = null;
    intervals.length = 0;
    if (running) publish();
  };

  const stopFrames = () => {
    generation++;
    if (frameHandle !== null && typeof cancelFrame === 'function') cancelFrame(frameHandle);
    frameHandle = null;
    running = false;
    resetSnapshot();
  };

  const schedule = token => {
    if (!running || disposed || token !== generation) return;
    frameHandle = requestFrame(timestamp => {
      frameHandle = null;
      if (!running || disposed || token !== generation) return;
      const now = windowRef.performance?.now?.() ?? performance.now();
      const rafTimestamp = Number.isFinite(timestamp) ? timestamp : now;
      if (previousTimestamp !== null) {
        const interval = rafTimestamp - previousTimestamp;
        if (Number.isFinite(interval) && interval > 0) {
          intervals.push(interval);
          if (intervals.length > MAX_SAMPLES) intervals.shift();
        }
      }
      previousTimestamp = rafTimestamp;
      const latency = now - rafTimestamp;
      const nonNegativeLatency = finiteNonNegative(latency);
      if (nonNegativeLatency !== null) {
        latencies.push(nonNegativeLatency);
        if (latencies.length > MAX_SAMPLES) latencies.shift();
      }
      publish();
      schedule(token);
    });
  };

  const startFrames = () => {
    if (disposed || running) return;
    running = true;
    generation++;
    resetSnapshot();
    schedule(generation);
  };

  const sync = async value => {
    const revision = ++syncRevision;
    if (disposed) return;
    let enabled = value;
    if (typeof enabled !== 'boolean') {
      try {
        enabled = await developer.enabled();
      } catch {
        enabled = false;
      }
    }
    if (disposed || revision !== syncRevision) return;
    if (enabled === true) startFrames();
    else if (running) stopFrames();
    else windowRef.previewRendererFrameMetrics = emptySnapshot(documentRef);
  };

  try {
    if (typeof developer.onChange === 'function') unsubscribe = developer.onChange(value => { void sync(value); });
  } catch {
    unsubscribe = null;
  }
  void sync();

  const onVisibilityChange = () => {
    if (!disposed && windowRef.previewRendererFrameMetrics) {
      windowRef.previewRendererFrameMetrics = {
        ...windowRef.previewRendererFrameMetrics,
        hidden: hiddenValue(documentRef),
      };
      resetFrameTiming();
    }
  };
  documentRef.addEventListener?.('visibilitychange', onVisibilityChange, {passive: true});

  return () => {
    if (disposed) return;
    disposed = true;
    stopFrames();
    unsubscribe?.();
    documentRef.removeEventListener?.('visibilitychange', onVisibilityChange);
  };
}

export {startRendererFrameMetrics};
