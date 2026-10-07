import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Source modules and bundled entry points have different depths. Resolve
// resources from the application package, never from an assumed module depth.
function findApplicationRoot(moduleURL) {
  let directory = dirname(fileURLToPath(moduleURL));
  for (;;) {
    const metadata = join(directory, 'package.json');
    if (existsSync(metadata)) {
      const { name } = JSON.parse(readFileSync(metadata, 'utf8'));
      if (name === 'pdf-math-reader') return directory;
    }
    const parent = dirname(directory);
    if (parent === directory) throw Error('Cannot locate PDFMathReader application resources');
    directory = parent;
  }
}

const root = findApplicationRoot(import.meta.url);
export const applicationPath = (...segments) => join(root, ...segments);
