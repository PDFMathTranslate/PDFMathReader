export function createMeasuredIPC({ ipcMain, operationMetrics }) {
  return (channel, handler) => {
    ipcMain.handle(channel, async (...args) => {
      const started = performance.now();
      try {
        return await handler(...args);
      } finally {
        if (
          !/^(developer:|performance:|activity:|appearance:)/.test(channel) &&
          !/(?:current|load|status|enabled|fullscreen|maximized|progress)$/.test(channel)
        )
          operationMetrics.operation(performance.now() - started);
      }
    });
  };
}
