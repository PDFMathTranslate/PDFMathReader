import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [mode, ...requested] = process.argv.slice(2);
if (!['check', 'fix'].includes(mode)) throw new Error('Expected check or fix');
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  return result.stdout;
};
const files = requested.length
  ? requested
  : run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
      .split('\0')
      .filter(Boolean);
const python = files.filter((file) => file.endsWith('.py'));
const swift = files.filter((file) => file.endsWith('.swift'));
if (python.length) {
  const ruff = ['tool', 'run', '--from', 'ruff==0.15.7', 'ruff'];
  run('uv', [...ruff, 'format', ...(mode === 'check' ? ['--check'] : []), ...python], {
    stdio: 'inherit',
  });
  run('uv', [...ruff, 'check', ...(mode === 'fix' ? ['--fix'] : []), ...python], {
    stdio: 'inherit',
  });
}
for (const file of swift) {
  const command = process.platform === 'darwin' ? 'xcrun' : 'swift-format';
  const prefix = process.platform === 'darwin' ? ['swift-format'] : [];
  const args = [...prefix, 'format', '--configuration', '.swift-format'];
  if (mode === 'fix') run(command, [...args, '--in-place', file], { stdio: 'inherit' });
  else if (run(command, [...args, file]) !== readFileSync(file, 'utf8')) {
    console.error(`${file}: run npm run style:fix to format Swift`);
    process.exitCode = 1;
  }
}
