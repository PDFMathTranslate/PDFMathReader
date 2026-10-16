import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { validateQuickLinks } from '../../../shared/quick-links.mjs';
export function createQuickLinkStore(root) {
  const path = (key) => {
    if (typeof key !== 'string' || !key || key.length > 1024) throw Error('Invalid document key');
    return join(root, createHash('sha256').update(key).digest('hex') + '.json');
  };
  let writes = Promise.resolve();
  let lastWriteError;
  return {
    async load(key) {
      await writes;
      try {
        return JSON.parse(await readFile(path(key), 'utf8'));
      } catch (e) {
        if (e.code === 'ENOENT') return [];
        throw e;
      }
    },
    async has(key) {
      await writes;
      try {
        await access(path(key));
        return true;
      } catch (e) {
        if (e.code === 'ENOENT') return false;
        throw e;
      }
    },
    save(key, links) {
      const target = path(key);
      validateQuickLinks(links);
      const snapshot = JSON.stringify(links);
      const operation = writes.then(async () => {
        try {
          await mkdir(root, { recursive: true });
          await writeFile(target + '.tmp', snapshot);
          await rename(target + '.tmp', target);
          lastWriteError = undefined;
        } catch (error) {
          lastWriteError = error;
          throw error;
        }
      });
      writes = operation.catch(() => {});
      return operation;
    },
    flush() {
      return writes.then(() => {
        if (lastWriteError) throw lastWriteError;
      });
    },
  };
}
