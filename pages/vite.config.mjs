import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import application from '../vite.config.js';

// Compile the production renderer. Only demo-inapplicable kernel controls are
// omitted; the desktop source, platform controls and reader styling stay intact.
function preparedDemoUI() {
  const patches = new Map([
    ['src/features/reader/ReaderToolbar.vue', [
      ['v-if="showKernelToolbarShortcut || kernelErrorVisible"', 'v-if="false"'],
    ]],
    ['src/features/settings/NativeSettingsPanel.vue', [
      ['<section class="settings-section" aria-labelledby="settings-engine">', '<section v-if="false" class="settings-section" aria-labelledby="settings-engine">'],
    ]],
    ['src/features/settings/LegacySettingsPanel.vue', [
      ['<section class="settings-section" aria-labelledby="settings-engine">', '<section v-if="false" class="settings-section" aria-labelledby="settings-engine">'],
    ]],
    ['src/features/settings/AppearanceSettings.vue', [
      ['<div class="appearance-row" data-setting="kernel-toolbar-shortcut">', '<div v-if="false" class="appearance-row" data-setting="kernel-toolbar-shortcut">'],
    ]],
  ]);
  const seen = new Set();
  return {
    name: 'prepared-demo-ui',
    enforce: 'pre',
    transform(source, id) {
      const file = id.replaceAll('\\', '/').split('?')[0];
      if (id.includes('?') || !file.includes('/src/')) return null;
      let code = source;
      for (const [suffix, replacements] of patches) {
        if (!file.endsWith('/' + suffix)) continue;
        for (const [before, after] of replacements) {
          if (!code.includes(before)) this.error(`Demo UI marker changed in ${suffix}: ${before}`);
          code = code.replace(before, after);
        }
        seen.add(suffix);
      }
      code = code.replaceAll('/symbols/', './symbols/').replaceAll('/kernel-modes/', './kernel-modes/');
      return code === source ? null : { code, map: null };
    },
    buildEnd(error) {
      if (error) return;
      for (const file of patches.keys())
        if (!seen.has(file)) this.error(`Demo UI patch was not applied: ${file}`);
    },
  };
}

export default defineConfig({
  ...application,
  base: './',
  plugins: [preparedDemoUI(), ...application.plugins],
  build: {
    ...application.build,
    target: 'esnext',
    outDir: fileURLToPath(new URL('../dist-pages/', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      ...application.build.rollupOptions,
      input: fileURLToPath(new URL('./reader.html', import.meta.url)),
    },
  },
});
