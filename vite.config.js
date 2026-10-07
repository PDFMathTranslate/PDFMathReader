import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
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

export default defineConfig({
  plugins: [vue(), buildInfoPlugin()],
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
