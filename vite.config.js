import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
 plugins:[vue()],
 build:{rollupOptions:{output:{manualChunks(id){
  // Keep the awaited platform adapter independent of the application entry.
  // Lazy settings otherwise make Rollup share adapter code through that entry,
  // creating a circular top-level await before Vue can mount.
  if(id.includes('/src/platform-controls.mjs'))return 'platform-controls';
 }}}}
});
