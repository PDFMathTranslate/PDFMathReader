import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
export function createHaptics({
  platform = process.platform,
  resourcesPath = process.resourcesPath,
  packaged = false,
} = {}) {
  let child,
    lastTick = 0;
  const path = packaged
    ? join(resourcesPath, 'haptic-feedback')
    : fileURLToPath(new URL('../.cache/haptic-feedback', import.meta.url));
  return {
    tick() {
      if (platform !== 'darwin' || Date.now() - lastTick < 30 || !existsSync(path)) return false;
      lastTick = Date.now();
      if (!child) {
        child = spawn(path, [], { stdio: ['pipe', 'ignore', 'ignore'] });
        const current = child;
        current.on('error', () => {
          if (child === current) child = null;
        });
        current.on('exit', () => {
          if (child === current) child = null;
        });
        current.stdin.on('error', () => {});
      }
      if (child.stdin.destroyed) return false;
      child.stdin.write('tick\n');
      return true;
    },
    close() {
      child?.stdin.end();
      child?.kill();
      child = null;
    },
  };
}
