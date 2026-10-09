// Test dispatch is kept outside the production composition root.
export async function runDesktopSmoke({
  smoke,
  window,
  backend,
  token,
  recents,
  windows,
  createWindow,
  credentials,
}) {
  const checks = await import('./smoke.mjs');
  if (smoke === 'shortcuts')
    await (await import('./shortcuts-smoke.mjs')).verifyShortcuts(window, createWindow);
  else if (smoke === 'operation-performance')
    await (
      await import('./operation-performance-smoke.mjs')
    ).verifyOperationPerformance(window, windows, createWindow);
  else if (smoke === 'kernel-menu-mouse')
    await (
      await import('./kernel-menu-mouse-smoke.mjs')
    ).verifyKernelMenuMouse(window, createWindow);
  else if (smoke === 'app-updates')
    await (await import('./app-updates-smoke.mjs')).verifyAppUpdates(window, createWindow);
  else if (smoke === 'crop-status')
    await (await import('./crop-status-smoke.mjs')).verifyCropStatus(window);
  else if (smoke === 'provider-clone')
    await (await import('./provider-clone-smoke.mjs')).verifyProviderClone(window);
  else if (smoke === 'kernel-error')
    await (await import('./kernel-error-smoke.mjs')).verifyKernelError(window, createWindow);
  else if (smoke === 'about')
    await (await import('./about-smoke.mjs')).verifyAbout(window, createWindow);
  else if (smoke === 'kernel-settings')
    await (await import('./kernel-settings-smoke.mjs')).verifyKernelSettings(window, createWindow);
  else if (smoke === 'provider-history')
    await (
      await import('./settings-workspace-smoke.mjs')
    ).verifyProviderHistory(window, createWindow);
  else if (smoke === 'developer')
    await (
      await import('./developer-smoke.mjs')
    ).verifyDeveloper(window, backend, token, createWindow);
  else if (smoke === 'resource-benchmark')
    await (await import('./resource-benchmark.mjs')).verifyResourceBenchmark(window);
  else if (smoke === 'resource-usage')
    await (await import('./resource-usage-smoke.mjs')).verifyResourceUsage(window);
  else if (smoke === 'information-categories')
    await (
      await import('./information-categories-smoke.mjs')
    ).verifyInformationCategories(window, recents, createWindow);
  else if (smoke === 'information-emphasis')
    await (
      await import('./information-emphasis-smoke.mjs')
    ).verifyInformationEmphasis(window, recents);
  else if (smoke === 'topic-sentences')
    await (await import('./topic-sentences-smoke.mjs')).verifyTopicSentences(window, recents);
  else if (smoke === 'page-edits')
    await (await import('./page-edits-smoke.mjs')).verifyPageEdits(window, recents);
  else if (smoke === 'cache-progress')
    await (await import('./cache-progress-smoke.mjs')).verifyCacheProgress(window);
  else if (smoke === 'quick-links')
    await (await import('./quick-links-smoke.mjs')).verifyQuickLinks(window);
  else if (smoke === 'translation-prefetch')
    await (
      await import('./translation-prefetch-smoke.mjs')
    ).verifyTranslationPrefetch(window, recents);
  else if (smoke === 'pdf-navigation')
    await (await import('./pdf-navigation-smoke.mjs')).verifyPDFNavigation(window, recents);
  else if (['sidebar', 'sidebar-keys', 'sidebar-glass'].includes(smoke))
    await (await import('./sidebar-smoke.mjs')).verifySidebar(window, recents);
  else if (smoke === 'advanced-cache')
    await (await import('./advanced-cache-smoke.mjs')).verifyAdvancedCache(window);
  else if (smoke === 'large-open')
    await (await import('./large-open-smoke.mjs')).verifyLargeOpen(window, recents);
  else if (smoke === 'scanned-sidebar')
    await (await import('./scanned-sidebar-smoke.mjs')).verifyScannedSidebar(window, recents);
  else if (smoke === 'cjk-font')
    await (await import('./cjk-font-smoke.mjs')).verifyCJKFont(window, recents);
  else if (smoke === 'file-menu')
    await (await import('./file-menu-smoke.mjs')).verifyFileMenu(window, recents);
  else if (smoke === 'recent-menu')
    await (await import('./recent-menu-smoke.mjs')).verifyRecentMenu(window, recents);
  else if (smoke === 'recent-view')
    await (await import('./recent-view-smoke.mjs')).verifyRecentView(window, recents);
  else if (smoke === 'startup') await (await import('./startup-smoke.mjs')).verifyStartup(window);
  else if (smoke === 'session')
    await (await import('./session-smoke.mjs')).verifySession(window, windows, createWindow);
  else if (smoke === 'settings-menu')
    await (await import('./settings-menu-smoke.mjs')).verifySettingsMenu(window, windows);
  else if (smoke === 'settings-native')
    await (await import('./settings-native-smoke.mjs')).verifyNativeSettings(window, windows);
  else if (
    [
      'windows-controls',
      'windows-kernel-menu',
      'windows-reader-controls',
      'windows-chrome',
    ].includes(smoke)
  )
    await (await import('./windows-controls-smoke.mjs')).verifyWindowsControls(window);
  else if (smoke === 'settings-workspace')
    await (await import('./settings-workspace-smoke.mjs')).verifySettingsWorkspace(window);
  else if (smoke === 'layout-settings')
    await (await import('./layout-settings-smoke.mjs')).verifyLayoutSettings(window);
  else if (smoke === 'windows-settings')
    await (await import('./windows-settings-smoke.mjs')).verifyWindowsSettings(window);
  else if (smoke === 'locales') await (await import('./locales-smoke.mjs')).verifyLocales(window);
  else if (smoke === 'advanced')
    await (await import('./advanced-smoke.mjs')).verifyAdvanced(window);
  else if (smoke === 'fluent') await (await import('./fluent-smoke.mjs')).verifyFluent(window);
  else if (smoke === 'search') await (await import('./search-smoke.mjs')).verifySearch(window);
  else if (smoke === 'text-selection')
    await (await import('./text-selection-smoke.mjs')).verifyTextSelection(window, recents);
  else if (smoke === 'multi-window')
    await (
      await import('./multi-window-smoke.mjs')
    ).verifyMultiWindow(window, windows, createWindow);
  else if (smoke === 'crop') await (await import('./crop-smoke.mjs')).verifyCrop(window, recents);
  else if (smoke === 'fit-width')
    await (await import('./fit-width-smoke.mjs')).verifyFitWidth(window, recents);
  else if (smoke === 'reading-view')
    await (await import('./reading-view-smoke.mjs')).verifyReadingView(window, recents);
  else if (smoke === 'performance')
    await (await import('./performance-smoke.mjs')).verifyPerformance(window);
  else if (smoke === 'benchmark')
    await (await import('./benchmark-smoke.mjs')).verifyBenchmark(window);
  else if (smoke === 'coverage')
    await (await import('./coverage-smoke.mjs')).verifyCoverage(window, backend, token);
  else if (smoke === 'resize') {
    await (await import('./recents-smoke.mjs')).verifyRecents(window, recents);
    await (await import('./resize-smoke.mjs')).verifyResize(window);
  } else if (smoke === 'animation')
    await (await import('./animation-smoke.mjs')).verifyAnimation(window);
  else if (smoke === 'ux') await (await import('./ux-smoke.mjs')).verifyUX(window, recents);
  else if (smoke === 'layout-region')
    await (await import('./layout-region-smoke.mjs')).verifyLayoutRegion(window);
  else if (smoke === 'kernel-choice')
    await (await import('./kernel-choice-smoke.mjs')).verifyKernelChoice(window);
  else if (smoke === 'kernels') await (await import('./kernel-smoke.mjs')).verifyKernelUI(window);
  else if (['annotations', 'annotation-shortcuts'].includes(smoke))
    await (await import('./annotations-smoke.mjs')).verifyAnnotations(window, recents);
  else if (smoke === 'file-open') await checks.verifySystemOpen(window);
  else await checks.verify(window, backend, token, smoke, credentials);
}
