import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readBuildInfo } from './scripts/build-info.mjs';

function buildInfoPlugin() {
  let source;
  return {
    name: 'build-info',
    configResolved(config) {
      source = JSON.stringify(readBuildInfo(config.root), null, 2) + '\n';
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/build-info.json') return next();
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(source);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build-info.json', source });
    },
  };
}

function pdfRuntimeAssetsPlugin() {
  const root = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
  const files = new Map();
  return {
    name: 'pdf-runtime-assets',
    async buildStart() {
      files.clear();
      for (const kind of ['wasm', 'cmaps', 'standard_fonts'])
        for (const name of await readdir(join(root, kind)))
          files.set(`/assets/pdfjs/${kind}/${name}`, join(root, kind, name));
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split('?')[0];
        const file = files.get(path);
        if (!file) return next();
        try {
          response.setHeader(
            'Content-Type',
            path.endsWith('.wasm')
              ? 'application/wasm'
              : path.endsWith('.js')
                ? 'text/javascript'
                : 'application/octet-stream',
          );
          response.end(await readFile(file));
        } catch (error) {
          next(error);
        }
      });
    },
    async generateBundle() {
      for (const [path, file] of files)
        this.emitFile({ type: 'asset', fileName: path.slice(1), source: await readFile(file) });
    },
  };
}

export default defineConfig({
  plugins: [vue(), buildInfoPlugin(), pdfRuntimeAssetsPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep the awaited platform adapter independent of the application entry.
          // Lazy settings otherwise make Rollup share adapter code through that entry,
          // creating a circular top-level await before Vue can mount.
          if (id.includes('/src/ui/controls.mjs') || id.includes('/src/platform/runtime.mjs'))
            return 'platform-controls';
          // Dynamic adapters also use Vite's preload helper. Keeping it in the
          // awaited adapter creates an adapter -> Fluent -> adapter import cycle.
          if (id.includes('vite/preload-helper')) return 'preload-helper';
        },
      },
    },
  },
});
