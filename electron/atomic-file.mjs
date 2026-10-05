import { rename } from 'node:fs/promises';

// A scanner or reader can briefly hold the destination open on Windows.
// Keep the old file intact and retry replacement rather than deleting it.
export async function replaceFile(
  source,
  target,
  {
    platform = process.platform,
    renameFile = rename,
    pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  for (let attempt = 0; ; attempt++) {
    try {
      await renameFile(source, target);
      return;
    } catch (error) {
      if (
        platform !== 'win32' ||
        !['EPERM', 'EACCES', 'EBUSY'].includes(error.code) ||
        attempt >= 7
      )
        throw error;
      await pause(Math.min(250, 25 * 2 ** attempt));
    }
  }
}
