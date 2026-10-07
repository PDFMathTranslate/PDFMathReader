import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';

// CodeGraph defaults omit the project's ESM/CommonJS sources and treat any
// build/ directory as generated, including the checked-in Electron scripts.
const path = '.codegraph/config.json';
let config;
try {
  config = JSON.parse(await readFile(path, 'utf8'));
} catch (error) {
  if (error.code === 'ENOENT') throw Error('Initialize CodeGraph with codegraph init -i first.');
  throw error;
}
config.include = [...new Set([...config.include, '**/*.mjs', '**/*.cjs'])];
config.exclude = config.exclude.map((pattern) =>
  pattern === '**/build/**' ? 'build/**' : pattern,
);
const savedConfig = JSON.stringify(config, null, 2) + '\n';
// CodeGraph's Git scanner includes tracked paths deleted by a pending rename.
// Omit only those absent files during this run without changing the Git index.
const deleted = execFileSync('git', ['ls-files', '--deleted', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
await writeFile(
  path,
  JSON.stringify({ ...config, exclude: [...config.exclude, ...deleted] }, null, 2) + '\n',
);
try {
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn('codegraph', ['index', '--force', '--quiet'], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
} finally {
  await writeFile(path, savedConfig);
}
