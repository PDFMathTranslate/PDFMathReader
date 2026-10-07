export function registerPerformanceIPC({
  handle,
  trustedWindow,
  registry,
  windowPerformance,
  updateMenu,
  performanceReports,
  performanceReportPath,
  appendPerformanceReport,
  validatePerformanceReport,
  writePerformanceReports,
  maxPerformanceReports,
  haptics,
  appearance,
}) {
  handle('previewPerformance:sample', (event) => windowPerformance.sample(trustedWindow(event)));
  handle('previewPerformance:reset', (event) => {
    const target = trustedWindow(event);
    const state = registry.stateFor(target);
    state.performance.peaks.clear();
    state.performance.hasDocument = true;
    windowPerformance.update(target);
    updateMenu(target);
    return { reset: true };
  });
  handle('previewPerformance:end', (event) => {
    const target = trustedWindow(event);
    const state = registry.stateFor(target);
    state.performance.hasDocument = false;
    windowPerformance.stop(target);
    updateMenu(target);
    return { ended: true };
  });
  handle('previewPerformance:save', async (event, value) => {
    trustedWindow(event);
    const report = validatePerformanceReport(value);
    const operation = performanceReports.write.then(async () => {
      performanceReports.items = appendPerformanceReport(performanceReports.items, report);
      await writePerformanceReports(performanceReportPath, performanceReports.items);
      return {
        saved: true,
        count: performanceReports.items.length,
        maxReports: maxPerformanceReports,
      };
    });
    performanceReports.write = operation.catch(() => {});
    return operation;
  });
  handle('previewResize:capture', async (event, value) => {
    const target = trustedWindow(event);
    if (target.isDestroyed() || target.isMinimized()) return null;
    const [contentWidth, contentHeight] = target.getContentSize();
    const input = value && typeof value === 'object' ? value : {};
    const rawX = input.x === undefined ? 0 : Number(input.x);
    const rawY = input.y === undefined ? 0 : Number(input.y);
    const rawWidth = input.width === undefined ? contentWidth : Number(input.width);
    const rawHeight = input.height === undefined ? contentHeight : Number(input.height);
    if (
      ![rawX, rawY, rawWidth, rawHeight].every(Number.isFinite) ||
      rawX < 0 ||
      rawY < 0 ||
      rawWidth <= 0 ||
      rawHeight <= 0
    )
      throw Error('Invalid resize capture bounds.');
    const x = Math.min(contentWidth, Math.floor(rawX));
    const y = Math.min(contentHeight, Math.floor(rawY));
    const width = Math.min(contentWidth - x, Math.floor(rawWidth));
    const height = Math.min(contentHeight - y, Math.floor(rawHeight));
    if (!width || !height) return null;
    let image = await target.webContents.capturePage({ x, y, width, height });
    let size = image.getSize();
    const maxPixels = 4 * 1024 * 1024;
    if (size.width * size.height > maxPixels) {
      const scale = Math.sqrt(maxPixels / (size.width * size.height));
      size = {
        width: Math.max(1, Math.floor(size.width * scale)),
        height: Math.max(1, Math.floor(size.height * scale)),
      };
      image = image.resize({ ...size, quality: 'good' });
    }
    let png = image.toPNG();
    const maxDataUrlBytes = 10 * 1024 * 1024;
    for (
      let attempt = 0;
      Buffer.byteLength(`data:image/png;base64,${png.toString('base64')}`, 'utf8') >
        maxDataUrlBytes && attempt < 16;
      attempt++
    ) {
      const scale = Math.max(
        0.1,
        Math.min(
          0.8,
          Math.sqrt(
            maxDataUrlBytes /
              Math.max(
                1,
                Buffer.byteLength(`data:image/png;base64,${png.toString('base64')}`, 'utf8'),
              ),
          ) * 0.9,
        ),
      );
      size = {
        width: Math.max(1, Math.floor(size.width * scale)),
        height: Math.max(1, Math.floor(size.height * scale)),
      };
      image = image.resize({ ...size, quality: 'good' });
      png = image.toPNG();
    }
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
    if (Buffer.byteLength(dataUrl, 'utf8') > maxDataUrlBytes)
      throw Error('Resize capture exceeds the 10 MiB limit.');
    return { width: size.width, height: size.height, dataUrl };
  });
  handle('haptics:tick', (event) => {
    const target = trustedWindow(event);
    if (!target.isFocused()) return false;
    return haptics.tick();
  });
  handle('appearance:current', (event) => {
    trustedWindow(event);
    return appearance();
  });
}
