import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
export function createQuickLinkStore(root) {
  const path = (key) => {
    if (typeof key !== 'string' || !key || key.length > 1024) throw Error('Invalid document key');
    return join(root, createHash('sha256').update(key).digest('hex') + '.json');
  };
  let writes = Promise.resolve();
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
    save(key, links) {
      const target = path(key);
      if (
        !Array.isArray(links) ||
        links.length > 10000 ||
        links.some(
          (l) =>
            typeof l.id !== 'string' ||
            ['origin', 'result'].some(
              (side) =>
                !Number.isInteger(l[side]?.page) ||
                l[side].page < 1 ||
                !['x', 'y', 'width', 'height'].every((k) => Number.isFinite(l[side].box?.[k])),
            ),
        )
      )
        throw Error('Invalid quick links');
      const snapshot = JSON.stringify(links);
      const operation = writes.then(async () => {
        await mkdir(root, { recursive: true });
        await writeFile(target + '.tmp', snapshot);
        await rename(target + '.tmp', target);
      });
      writes = operation.catch(() => {});
      return operation;
    },
  };
}
