import { execFile, spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const runFile = promisify(execFile);
const PASS_MARKER = 'PDFMATHREADER_CI_LAUNCH_CHECK_PASS';
const DEFAULT_TIMEOUT_MS = 90000;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  let platform = process.platform,
    arch = process.arch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    noSandbox = false;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    const value = (prefix) => (argument.startsWith(prefix) ? argument.slice(prefix.length) : null);
    if (argument === '--no-sandbox') {
      noSandbox = true;
      continue;
    }
    if (argument === '--platform' || argument === '--arch' || argument === '--timeout-ms') {
      const next = argv[++index];
      if (next === undefined) throw Error(`${argument} requires a value.`);
      if (argument === '--platform') platform = next;
      else if (argument === '--arch') arch = next;
      else timeoutMs = Number(next);
      continue;
    }
    const platformValue = value('--platform='),
      archValue = value('--arch='),
      timeoutValue = value('--timeout-ms=');
    if (platformValue !== null) {
      platform = platformValue;
      continue;
    }
    if (archValue !== null) {
      arch = archValue;
      continue;
    }
    if (timeoutValue !== null) {
      timeoutMs = Number(timeoutValue);
      continue;
    }
    if (argument === '--ci-launch-check') continue;
    throw Error(`Unknown launch-check argument: ${argument}`);
  }
  if (arch === 'primaryarch') arch = process.arch;
  if (!['darwin', 'win32', 'linux'].includes(platform))
    throw Error(`Unsupported target platform: ${platform}`);
  if (!/^[a-z\d_-]+$/i.test(arch)) throw Error(`Invalid target architecture: ${arch}`);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw Error(`Invalid launch-check timeout: ${timeoutMs}`);
  return { platform, arch, timeoutMs, noSandbox };
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function resolveExecutable(platform, arch) {
  const releaseRoot = join(repoRoot, 'release'),
    name = `PDFMathReader-${platform}-${arch}`,
    packageRoot = join(releaseRoot, name);
  const candidates =
    platform === 'darwin'
      ? [
          join(packageRoot, 'PDFMathReader.app', 'Contents', 'MacOS', 'PDFMathReader'),
          join(releaseRoot, `${name}.app`, 'Contents', 'MacOS', 'PDFMathReader'),
        ]
      : platform === 'win32'
        ? [join(releaseRoot, `${name}.exe`), join(packageRoot, 'PDFMathReader.exe')]
        : [join(packageRoot, 'PDFMathReader')];
  for (const candidate of candidates) if (await isFile(candidate)) return candidate;
  throw Error(
    `Production executable not found. Expected an extracted package at ${packageRoot} or ${join(releaseRoot, `${name}.exe`)}.`,
  );
}

async function findXvfb() {
  try {
    return (await runFile('which', ['xvfb-run'])).stdout.trim() || null;
  } catch {
    return null;
  }
}

function terminate(child) {
  if (!child || child.exitCode !== null || child.signalCode) return Promise.resolve();
  if (process.platform === 'win32')
    return new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.once('close', () => resolve());
      killer.once('error', () => resolve());
    });
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {}
  }
  const force = setTimeout(() => {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      try {
        child.kill('SIGKILL');
      } catch {}
    }
  }, 2000);
  force.unref?.();
  return Promise.resolve();
}

async function run() {
  const { platform, arch, timeoutMs, noSandbox } = parseArgs(process.argv.slice(2));
  const executable = await resolveExecutable(platform, arch);
  const childArguments = ['--ci-launch-check'];
  if (noSandbox) childArguments.push('--no-sandbox');
  let command = executable,
    args = childArguments;
  if (platform === 'linux' && !process.env.DISPLAY) {
    const xvfb = await findXvfb();
    if (!xvfb) throw Error('Linux launch check requires DISPLAY or xvfb-run.');
    command = xvfb;
    args = ['--auto-servernum', executable, ...childArguments];
  }
  const child = spawn(command, args, {
    cwd: dirname(executable),
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    windowsHide: true,
  });
  let stdout = '',
    stderr = '',
    timedOut = false;
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
    process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
    process.stderr.write(chunk);
  });
  const exit = new Promise((resolveExit) => {
    child.once('error', (error) => resolveExit({ error }));
    child.once('close', (code, signal) => resolveExit({ code, signal }));
  });
  const timer = setTimeout(() => {
    timedOut = true;
    void terminate(child);
  }, timeoutMs);
  timer.unref?.();
  const result = await exit;
  clearTimeout(timer);
  if (result.error) throw Error(`Could not launch ${executable}: ${result.error.message}`);
  if (timedOut) throw Error(`Production launch check timed out after ${timeoutMs} ms.`);
  if (!stdout.includes(PASS_MARKER))
    throw Error(
      `Production app exited before emitting ${PASS_MARKER} (exit=${result.code}, signal=${result.signal || 'none'}).`,
    );
  if (result.code !== 0 || result.signal)
    throw Error(
      `Production app emitted the launch marker but exited unsuccessfully (exit=${result.code}, signal=${result.signal || 'none'}).`,
    );
  console.log(`${PASS_MARKER} host_verified`, JSON.stringify({ platform, arch, executable }));
}

run().catch((error) => {
  console.error(`PDFMATHREADER_CI_LAUNCH_CHECK_FAIL ${error.stack || error.message}`);
  process.exitCode = 1;
});
