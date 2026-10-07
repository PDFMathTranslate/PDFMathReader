import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export async function installUvRuntime({
  directory,
  platform = process.platform,
  fetchImpl = fetch,
  run,
  detect,
}) {
  const existing = await detect();
  if (existing.available) return existing;
  const windows = platform === 'win32';
  const response = await fetchImpl(`https://astral.sh/uv/install.${windows ? 'ps1' : 'sh'}`, {
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw Error('uv installer download failed. Check your connection and retry.');
  const script = await response.text();
  if (!script.trim()) throw Error('The uv installer is empty. Please retry.');
  const temporary = await mkdtemp(join(tmpdir(), 'pdfmathreader-uv-'));
  try {
    await mkdir(directory, { recursive: true });
    const path = join(temporary, windows ? 'install.ps1' : 'install.sh');
    await writeFile(path, script, { mode: 0o600 });
    await run(
      windows ? 'powershell.exe' : '/bin/sh',
      windows
        ? ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path]
        : [path],
      {
        env: { ...process.env, UV_INSTALL_DIR: directory, UV_NO_MODIFY_PATH: '1' },
        timeout: 300000,
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true,
      },
    );
    const result = await detect();
    if (!result.available) throw Error('uv installation could not be verified. Please retry.');
    return result;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
