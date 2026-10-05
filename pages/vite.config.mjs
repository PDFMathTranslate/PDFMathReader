import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const pagesRoot = fileURLToPath(new URL('./', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

function websiteTranslationCache() {
  const moduleId = 'virtual:website-translation-cache';
  return {
    name: 'website-translation-cache',
    resolveId(id) {
      if (id === moduleId) return '\0' + moduleId;
    },
    load(id) {
      if (id !== '\0' + moduleId) return null;
      const loadData = (name) => {
        const path = fileURLToPath(new URL(`./data/${name}.json`, import.meta.url));
        this.addWatchFile(path);
        return JSON.parse(readFileSync(path, 'utf8'));
      };
      const layout = loadData('layout');
      const translations = loadData('translations');
      const cache = {};
      for (const [page, blocks] of layout.entries()) {
        for (const [index, block] of blocks.entries()) {
          cache['English:' + block.text] = block.text;
          for (const [language, pages] of Object.entries(translations)) {
            const text = pages[page]?.[index];
            if (typeof text !== 'string' || !text.trim())
              throw new Error(
                `Missing website translation: ${language}, page ${page + 1}, paragraph ${index + 1}`,
              );
            cache[language + ':' + block.text] = text;
          }
        }
      }
      return `export default ${JSON.stringify(cache)};`;
    },
  };
}

function relativeSymbolPaths() {
  return {
    name: 'relative-symbol-paths',
    enforce: 'pre',
    transform(source, id) {
      if (!id.includes('/src/') || !id.endsWith('.vue')) return null;
      const code = source
        .replaceAll('/symbols/', './symbols/')
        .replaceAll('/kernel-modes/', './kernel-modes/');
      return code === source ? null : { code, map: null };
    },
  };
}

export default defineConfig({
  root: pagesRoot,
  base: './',
  plugins: [websiteTranslationCache(), relativeSymbolPaths(), vue()],
  publicDir: fileURLToPath(new URL('../public/', import.meta.url)),
  server: {
    fs: {
      allow: [repositoryRoot],
    },
  },
  build: {
    target: 'esnext',
    outDir: fileURLToPath(new URL('../dist-pages/', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        website: fileURLToPath(new URL('./index.html', import.meta.url)),
        reader: fileURLToPath(new URL('./reader.html', import.meta.url)),
      },
      output: {
        manualChunks(id) {
          // Keep the awaited platform adapter independent of the application entry.
          if (id.includes('/src/platform-controls.mjs')) return 'platform-controls';
          // Dynamic adapters use Vite's preload helper. Keeping it in the awaited
          // adapter avoids an adapter -> Fluent -> adapter import cycle.
          if (id.includes('vite/preload-helper')) return 'preload-helper';
        },
      },
    },
  },
});
