import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEngineRuntime, kernelPythonPath } from '../../../server/kernels/engine-runtime.mjs';
import { advancedOptionsToArgs } from '../../../server/kernels/kernel-options.mjs';

for (const platform of ['win32', 'darwin']) {
  test(`${platform} GPU setup repairs the selected uv environment and reuses it`, async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'gpu-environment-'));
    await mkdir(join(root, 'pdf_math_fast'));
    let ready = false;
    const calls = [];
    const runtime = createEngineRuntime({
      root,
      platform,
      cacheDir: join(root, 'cache'),
      findUvImpl: async () => ({ available: true, path: 'uv' }),
      execImpl: async (file, args) => {
        if (file === 'uv') {
          calls.push(args);
          if (args[1] === 'install') ready = true;
          return { stdout: '' };
        }
        if (args[0] === '-c' && args[1].includes('get_available_providers')) {
          assert.match(
            args[1],
            platform === 'win32' ? /DmlExecutionProvider/ : /CoreMLExecutionProvider/,
          );
          return { stdout: ready ? 'True\n' : 'False\n' };
        }
        return { stdout: args[0] === '-c' ? '1.9.12\nocr:yes\n' : '[]' };
      },
    });
    t.after(async () => {
      await runtime.close();
      await rm(root, { recursive: true, force: true });
    });
    await runtime.install('pdf_math_fast', { preferGpu: true });
    assert.equal(calls.length, platform === 'win32' ? 2 : 1);
    assert.equal(
      calls.at(-1).at(-1),
      platform === 'win32' ? 'onnxruntime-directml' : 'onnxruntime',
    );
    assert.ok(calls.at(-1).includes(kernelPythonPath(join(root, 'pdf_math_fast'))));
    const count = calls.length;
    await runtime.install('pdf_math_fast', { preferGpu: true });
    assert.equal(calls.length, count);
  });
}

test('GPU preference is validated and becomes a worker command option for both kernels', () => {
  for (const id of ['pdf_math_fast', 'pdf_math_precise']) {
    const result = advancedOptionsToArgs(id, { prefer_gpu: true }, []);
    assert.deepEqual(result, { overrides: { prefer_gpu: true }, args: ['--prefer-gpu'] });
    assert.throws(() => advancedOptionsToArgs(id, { prefer_gpu: 'true' }, []), /boolean/);
  }
});
