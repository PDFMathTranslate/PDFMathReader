import { platform } from '../runtime.mjs';

// Keep GPU/filter work confined to chrome. PDF canvases and text selection never
// enter a filtered layer, and Vue-owned nodes are never moved or replaced.
// The scrolling sidebar switch uses one CSS/native glass material; an SVG
// refraction scene there can retain stale scroll pixels and duplicate its rim.
// Recent-document actions also use the CSS glass material: layering SDK regular
// surfaces beneath their rounded controls exposes a white rectangular substrate.
// The annotation palette changes from a capsule to a rounded comment panel.
// Its CSS glass material owns that outline; an SDK capsule adds a second rim.
const hosts =
  '.app[data-platform="darwin"] .toolbar > .icon-button, .app[data-platform="darwin"] .toolbar-actions > .icon-button, .app[data-platform="darwin"] .toolbar-kernel, .app[data-platform="darwin"] .floating-zoom, .app[data-platform="darwin"] .page-navigator, .annotation-ui.annotation-menu[data-platform="darwin"], .app[data-platform="darwin"] .paragraph-detail, .app[data-platform="darwin"] .page-translation-toast, .app[data-platform="darwin"] .error-banner, .app[data-platform="darwin"] .annotation-note, .app[data-platform="darwin"] .copy-toast, .app[data-platform="darwin"] .kernel-error-popover, .reader-glass-menu[data-platform="darwin"]';

export function installLiquidGlass() {
  if (platform !== 'darwin') return () => {};
  const root = document.documentElement;
  const transparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const contrast = matchMedia('(prefers-contrast: more)');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = new Map();
  let sdk,
    pending = 0,
    stopped = false,
    revision = '',
    generation = 0,
    failed = false;
  function clear() {
    for (const release of scenes.values()) release();
    scenes.clear();
  }
  function schedule() {
    if (pending || stopped) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      void refresh();
    });
  }
  async function refresh() {
    if (stopped) return;
    const enabled = root.dataset.interfaceStyle === 'liquid-glass';
    const accessible =
      root.dataset.reduceTransparency === 'true' || transparency.matches || contrast.matches;
    const next = [
      enabled,
      accessible,
      root.dataset.appearance,
      root.dataset.reduceMotion,
      motion.matches,
      document.hidden,
    ].join(':');
    if (next !== revision) {
      generation++;
      clear();
      revision = next;
      failed = false;
    }
    const currentGeneration = generation;
    if (!enabled || accessible || failed || !scenes.size)
      root.dataset.liquidGlass = enabled ? (accessible ? 'solid' : 'fallback') : 'off';
    if (!enabled || accessible || document.hidden || failed) return;
    if (!navigator.gpu) return;
    try {
      sdk ||= await import('@glass-sdk/liquid-glass/dom');
      if (stopped || currentGeneration !== generation) return;
      for (const [host, release] of scenes) {
        if (!host.isConnected) {
          release();
          scenes.delete(host);
        }
      }
      for (const host of document.querySelectorAll(hosts)) {
        if (scenes.has(host) || host.closest('.document-motion-snapshot, .resize-snapshot'))
          continue;
        const backdrop = document.createElement('div');
        backdrop.className = 'reader-glass-backdrop lg-content';
        backdrop.setAttribute('aria-hidden', 'true');
        const surface = document.createElement('div');
        surface.className = 'reader-glass-material lg-surface';
        surface.setAttribute('aria-hidden', 'true');
        host.classList.add('reader-glass-host');
        // Observe an owned decorative layer, never Vue's changing controls.
        const isolatedLayer = document.createElement('div');
        isolatedLayer.className = 'reader-glass-layer';
        isolatedLayer.setAttribute('aria-hidden', 'true');
        isolatedLayer.append(backdrop, surface);
        host.prepend(isolatedLayer);
        const scene = sdk.createGlassScene(isolatedLayer, {
          maxSurfaces: 2,
          onDiagnostic: ({ error, maps }) => {
            if (stopped || currentGeneration !== generation) return;
            if (error) {
              // Defer teardown out of the renderer callback. CSS stays readable.
              failed = true;
              root.dataset.liquidGlass = 'fallback';
              queueMicrotask(() => {
                if (currentGeneration === generation) clear();
              });
            } else if (maps && !failed) root.dataset.liquidGlass = 'ready';
          },
        });
        scene.setContent(backdrop);
        const remove = scene.addSurface(surface, {
          material: 'regular',
          appearance: root.dataset.appearance === 'dark' ? 'dark' : 'light',
          radius: host.matches(
            '.page-translation-toast, .error-banner, .kernel-error-popover, .reader-glass-menu',
          )
            ? 20
            : 'capsule',
          refraction: 12,
          interactive: false,
          motion: root.dataset.reduceMotion === 'true' || motion.matches ? 'none' : 'reduced',
        });
        scenes.set(host, () => {
          remove();
          scene.dispose();
          backdrop.remove();
          surface.remove();
          isolatedLayer?.remove();
          host.classList.remove('reader-glass-host');
        });
      }
    } catch {
      failed = true;
      clear();
      root.dataset.liquidGlass = 'fallback';
    }
  }
  const observer = new MutationObserver((records) => {
    if (
      records.some(
        (record) =>
          record.type === 'attributes' ||
          [...record.addedNodes, ...record.removedNodes].some(
            (node) => node.nodeType === 1 && (node.matches(hosts) || node.querySelector(hosts)),
          ),
      )
    )
      schedule();
  });
  observer.observe(root, {
    attributes: true,
    attributeFilter: [
      'data-interface-style',
      'data-appearance',
      'data-reduce-motion',
      'data-reduce-transparency',
    ],
  });
  observer.observe(document.body, { childList: true, subtree: true });
  for (const query of [transparency, contrast, motion]) query.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', schedule);
  schedule();
  return () => {
    stopped = true;
    generation++;
    if (pending) cancelAnimationFrame(pending);
    observer.disconnect();
    clear();
    for (const query of [transparency, contrast, motion])
      query.removeEventListener('change', schedule);
    document.removeEventListener('visibilitychange', schedule);
    delete root.dataset.liquidGlass;
  };
}
