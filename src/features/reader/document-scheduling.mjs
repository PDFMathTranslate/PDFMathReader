export function yieldToPaint({
  requestFrame = globalThis.requestAnimationFrame,
  cancelFrame = globalThis.cancelAnimationFrame,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  timeoutMs = 50,
} = {}) {
  if (typeof requestFrame !== 'function') return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false,
      firstFrame,
      continuationTimer,
      fallbackTimer;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (typeof clearTimer === 'function') {
        clearTimer(continuationTimer);
        clearTimer(fallbackTimer);
      }
      if (typeof cancelFrame === 'function') {
        if (firstFrame !== undefined) cancelFrame(firstFrame);
      }
      resolve();
    };
    const finishAfterPaint = () => {
      if (settled) return;
      if (typeof setTimer === 'function') continuationTimer = setTimer(finish, 0);
      else finish();
    };
    try {
      firstFrame = requestFrame(finishAfterPaint);
      if (typeof setTimer === 'function') fallbackTimer = setTimer(finish, timeoutMs);
    } catch {
      finish();
    }
  });
}

export function scheduleAfterPaint(task, { afterCommit = () => {}, ...options } = {}) {
  return Promise.resolve()
    .then(afterCommit)
    .then(() => yieldToPaint(options))
    .then(task);
}

export function scheduleTaskCleanup(tasks, options) {
  return scheduleAfterPaint(
    () =>
      Promise.allSettled(
        [...new Set(tasks)].filter(Boolean).map((task) => {
          try {
            return task.destroy();
          } catch {
            return Promise.resolve();
          }
        }),
      ),
    options,
  );
}
