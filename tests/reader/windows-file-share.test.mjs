import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Exercise the native process boundary on every host without launching PowerShell.
test('Windows share passes a PDF safely and propagates native outcomes after opening', async () => {
  const children = [];
  const calls = [];
  const fixture = {
    stat: async () => ({ isFile: () => true }),
    spawn: (...args) => {
      calls.push(args);
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.exitCode = null;
      child.signalCode = null;
      child.killed = false;
      child.kill = () => {
        child.killed = true;
        queueMicrotask(() => child.emit('close', null, 'SIGTERM'));
      };
      children.push(child);
      return child;
    },
  };
  globalThis.windowsShareTestFixture = fixture;
  try {
    const source = (
      await readFile(
        new URL('../../electron/main/services/windows-file-share.mjs', import.meta.url),
        'utf8',
      )
    )
      .replace(
        "import { spawn } from 'node:child_process';",
        'const { spawn } = globalThis.windowsShareTestFixture;',
      )
      .replace(
        "import { stat } from 'node:fs/promises';",
        'const { stat } = globalThis.windowsShareTestFixture;',
      )
      .replace("process.platform !== 'win32'", 'false');
    const { shareWindowsFile } = await import(
      'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
    );
    const target = new EventEmitter();
    target.isDestroyed = () => false;
    target.getNativeWindowHandle = () => {
      const buffer = Buffer.alloc(8);
      buffer.writeBigUInt64LE(0x123456789n);
      return buffer;
    };
    const file = "C:\\Documents\\引号 ' $value; test.pdf";
    const waitForChild = async (count) => {
      while (children.length < count) await new Promise((resolve) => setImmediate(resolve));
      return children.at(-1);
    };
    const failed = shareWindowsFile(target, file);
    const child = await waitForChild(1);
    assert.equal(calls[0][2].env.PDFMATHREADER_SHARE_PATH, file);
    assert.equal(calls[0][2].env.PDFMATHREADER_SHARE_HWND, String(0x123456789n));
    assert.ok(!calls[0][1].some((argument) => argument.includes(file)));
    child.stdout.write('READY\n');
    child.stderr.write('ERROR\tDataRequested\tAttachment failed');
    child.emit('close', 1, null);
    await assert.rejects(failed, /Attachment failed/);
    assert.equal(target.listenerCount('closed'), 0);

    const completed = shareWindowsFile(target, file);
    const success = await waitForChild(2);
    success.stdout.write('READY\nRESULT\tsuccess\n');
    success.emit('close', 0, null);
    assert.equal(await completed, true);

    const cancelled = shareWindowsFile(target, file);
    const dismissed = await waitForChild(3);
    dismissed.stdout.write('READY\nRESULT\tcancelled\n');
    dismissed.emit('close', 2, null);
    assert.equal(await cancelled, false);

    const closed = shareWindowsFile(target, file);
    const closing = await waitForChild(4);
    target.emit('closed');
    assert.equal(await closed, false);
    assert.equal(closing.killed, true);
    assert.equal(target.listenerCount('closed'), 0);
  } finally {
    delete globalThis.windowsShareTestFixture;
  }
});
