import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createEngineRuntime,
  prepareKernelAssets,
} from '../../../server/kernels/engine-runtime.mjs';

test('existing Fast environment repairs missing OCR without replacing the kernel', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fast-ocr-repair-'));
  let repaired = false;
  const installs = [];
  const runtime = createEngineRuntime({
    root,
    cacheDir: join(root, 'cache'),
    findUvImpl: async () => ({ available: true, path: 'uv' }),
    execImpl: async (file, args) => {
      if (file === 'uv') {
        assert.equal(args[0], 'pip');
        installs.push(args);
        repaired = true;
        return { stdout: '' };
      }
      if (args[0] === '-c') return { stdout: `1.9.12\nocr:${repaired ? 'yes' : 'no'}\n` };
      return { stdout: '[]' };
    },
  });
  try {
    await mkdir(join(root, 'pdf_math_fast'));
    assert.equal((await runtime.check('pdf_math_fast')).ocrAvailable, false);
    const state = await runtime.install('pdf_math_fast');
    assert.equal(state.ocrAvailable, true);
    assert.equal(state.version, '1.9.12');
    assert.equal(installs.length, 1);
    assert.equal(installs[0].at(-1), 'pooch>=1.8,<2');
    await runtime.install('pdf_math_fast');
    assert.equal(installs.length, 1);
  } finally {
    await runtime.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('OCR language data survives cleanup of isolated page homes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fast-ocr-cache-'));
  try {
    const assets = join(root, 'assets'),
      first = join(root, 'first'),
      second = join(root, 'second');
    await prepareKernelAssets(assets, first, join(root, 'shared'));
    await mkdir(join(first, '.cache/pdf2zh/tessdata/4.1.0'));
    await writeFile(join(first, '.cache/pdf2zh/tessdata/4.1.0/eng.traineddata'), 'cached model');
    await rm(first, { recursive: true });
    await prepareKernelAssets(assets, second, join(root, 'shared'));
    assert.equal(
      await readFile(join(second, '.cache/pdf2zh/tessdata/4.1.0/eng.traineddata'), 'utf8'),
      'cached model',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
