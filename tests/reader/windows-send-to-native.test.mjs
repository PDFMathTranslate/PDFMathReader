import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POWERSHELL_SCRIPT } from '../../electron/main/services/windows-send-to-script.mjs';

test(
  'Windows Shell exposes the real Send To submenu without sending the file',
  {
    skip: process.platform !== 'win32',
  },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'send-to-native-'));
    try {
      const file = join(directory, "公式 ' $value; test.pdf");
      await writeFile(file, '%PDF-1.7\n');
      const script = POWERSHELL_SCRIPT.replace('::Run(', '::Inspect(');
      const scriptPath = join(directory, 'inspect.ps1');
      await writeFile(scriptPath, script);
      const { stdout } = await promisify(execFile)(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-STA',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          scriptPath,
        ],
        {
          env: { ...process.env, PDFMATHREADER_SHARE_PATH: file, PDFMATHREADER_SHARE_HWND: '0' },
          windowsHide: true,
          timeout: 30_000,
        },
      );
      const count = stdout.match(/NATIVE_MENU\t(\d+)/);
      assert.ok(count, stdout);
      assert.ok(Number(count[1]) > 0, 'The Shell must provide Send To entries');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
