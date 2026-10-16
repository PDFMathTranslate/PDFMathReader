// Keep the native windows (including their Dock entries) and reader backends alive,
// but discard Chromium only after every window group has been minimized.
export function createWindowServiceMode({
  registry,
  activeFor = (target) => target,
  prepare,
  suspend,
  resume,
  enabled = true,
  delayMs = 0,
}) {
  let timer;
  let stopped = false;
  const live = () =>
    [...registry.windows].filter(([target, state]) => !target.isDestroyed() && !state.closing);
  const minimized = (target) => !!target && !target.isDestroyed() && target.isMinimized();
  const allMinimized = () => {
    const entries = live();
    return (
      entries.length > 0 &&
      entries.every(([target, state]) => {
        if (minimized(target)) return true;
        if (state.settingsOwner) {
          if (target.isVisible() || state.settingsOwner.isDestroyed()) return false;
          return minimized(activeFor(state.settingsOwner));
        }
        return minimized(activeFor(target));
      })
    );
  };
  const visible = (target) => target.isVisible() && !target.isMinimized();
  const restore = (target, state) => {
    if (state.serviceMode?.phase !== 'suspended') return;
    const saved = state.serviceMode;
    // Clear before reload so synchronous visibility events cannot reload twice.
    state.serviceMode = null;
    Promise.resolve()
      .then(() => resume(target, saved.snapshot))
      .catch((error) => {
        console.warn('Could not restore window service mode:', error?.message || error);
        if (stopped || target.isDestroyed() || state.closing || state.serviceMode) return;
        state.serviceMode = saved;
        timer = setTimeout(update, 1000);
        timer.unref?.();
      });
  };
  const park = async (target, state) => {
    if (state.serviceMode) return;
    const operation = { phase: 'saving', pending: null };
    state.serviceMode = operation;
    operation.pending = (async () => {
      try {
        const snapshot = await prepare(target, state);
        if (
          !snapshot ||
          stopped ||
          !allMinimized() ||
          target.isDestroyed() ||
          state.closing ||
          registry.stateFor(target) !== state
        )
          return;
        operation.snapshot = snapshot;
        operation.phase = 'suspended';
        suspend(target, snapshot, state);
      } catch (error) {
        // A failed save must never cost the user a live document.
        console.warn('Could not enter window service mode:', error?.message || error);
        operation.phase = 'saving';
      } finally {
        if (operation.phase !== 'suspended' && state.serviceMode === operation)
          state.serviceMode = null;
      }
    })();
    await operation.pending;
    if (!target.isDestroyed() && visible(target)) restore(target, state);
  };
  const update = (retry = false) => {
    clearTimeout(timer);
    if (!enabled || stopped) return;
    for (const [target, state] of live()) if (visible(target)) restore(target, state);
    if (!allMinimized()) return;
    timer = setTimeout(
      async () => {
        if (stopped || !allMinimized()) return;
        await Promise.all(live().map(([target, state]) => park(target, state)));
        // Retry windows that were still loading or whose persistence failed.
        if (live().some(([, state]) => !state.serviceMode)) update(true);
      },
      retry ? Math.max(1000, delayMs) : delayMs,
    );
    timer.unref?.();
  };
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
  };
  const start = () => {
    stopped = false;
    update();
  };
  return { update, stop, start, allMinimized };
}
