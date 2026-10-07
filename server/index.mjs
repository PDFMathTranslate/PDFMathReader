import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startServer } from './app.mjs';

export { startServer } from './app.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const backend = await startServer();
  console.log(`PDFMathReader: ${backend.origin}`);
}
