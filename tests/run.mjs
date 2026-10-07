import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

async function testFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await testFiles(path)));
    else if (entry.name.endsWith('.test.mjs')) files.push(path);
  }
  return files.sort();
}

const files = (
  await Promise.all(
    ['server', 'reader'].map((directory) =>
      testFiles(fileURLToPath(new URL(`./${directory}/`, import.meta.url))),
    ),
  )
).flat();
if (!files.length) throw Error('No regression tests found');
const child = spawn(process.execPath, ['--test', ...files], { stdio: 'inherit' });
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
