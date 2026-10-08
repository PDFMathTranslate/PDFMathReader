import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTranslationRunner } from '../../../server/kernels/translation-runner.mjs';

class Child extends EventEmitter {
  constructor(finish) {
    super();
    this.pid = 12345;
    this.stderr = new PassThrough();
    this.stdout = new PassThrough();
    this.finish = finish;
  }
}

async function fixture(t, finish, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'translation-runner-test-'));
  const child = new Child(finish);
  const diagnostics = [];
  const runner = createTranslationRunner({
    root,
    baseCacheDir: join(root, 'cache'),
    processes: {
      spawn: (command, args, options) => {
        child.spawnOptions = options;
        queueMicrotask(() => child.finish(child));
        return child;
      },
      terminate: async () => {},
    },
    python: () => process.execPath,
    pythonResourcePath: () => join(root, 'kernel-worker.py'),
    getState: async () => ({ available: true, version: 'test' }),
    advanced: async () => ({ options: [] }),
    prepareKernelAssets: async () => {},
    onDiagnostic: (message) => diagnostics.push(message),
    ...options,
  });
  t.after(() => rm(root, { recursive: true, force: true }));
  return {
    child,
    diagnostics,
    translate: (translateOptions = {}) =>
      runner.translate({
        id: 'pdf_math_fast',
        bytes: Buffer.from('pdf'),
        page: 1,
        language: 'English',
        threads: 1,
        model: 'test-model',
        proxy: { token: 'test-secret', url: 'https://example.test' },
        ...translateOptions,
      }),
  };
}

test('translation failure uses the final exception and redacts secrets', async (t) => {
  const fixtureData = await fixture(t, (child) => {
    child.stderr.write('Traceback (most recent call last):\n');
    child.stderr.write('ProviderError: token=test-secret\n');
    child.emit('close', 7, null);
  });

  await assert.rejects(fixtureData.translate(), (error) => {
    assert.equal(error.message, 'Kernel translation failed: ProviderError: token=[redacted]');
    assert.equal(error.message.includes('test-secret'), false);
    return true;
  });
  assert.equal(fixtureData.diagnostics.at(-1), 'ProviderError: token=[redacted]\n');
});

test('translation failure bounds stderr details and falls back to exit code', async (t) => {
  const fixtureData = await fixture(t, (child) => {
    child.stderr.write('x'.repeat(10_000));
    child.emit('close', 23, null);
  });

  await assert.rejects(fixtureData.translate(), (error) => {
    assert.match(error.message, /^Kernel translation failed: x+$/);
    assert.ok(error.message.length <= 4 * 1024 + 'Kernel translation failed: '.length);
    return true;
  });

  const noStderr = await fixture(t, (child) => child.emit('close', 23, null));
  await assert.rejects(noStderr.translate(), /Kernel translation failed: exit code 23/);
});

test('translation cancellation remains Cancelled despite stderr', async (t) => {
  const controller = new AbortController();
  const fixtureData = await fixture(t, (child) => {
    child.stderr.write('ProviderError: test-secret\n');
    controller.abort();
    child.emit('close', null, 'SIGTERM');
  });

  await assert.rejects(fixtureData.translate({ signal: controller.signal }), {
    message: 'Cancelled',
  });
});

// Precise logs subprocess failures to stdout and can still exit successfully.
test('precise zero exit without PDF preserves stdout permission error and redacts token', async (t) => {
  const data = await fixture(t, (child) => {
    child.stdout.write('openai.PermissionDenied');
    child.stdout.write('Error: token=test-secret\n');
    child.stdout.write('ERROR Error type: SubprocessError\n');
    child.emit('close', 0, null);
  });
  await assert.rejects(data.translate({ id: 'pdf_math_precise' }), {
    message: 'Kernel translation failed: openai.PermissionDeniedError: token=[redacted]',
  });
});

test('nonzero exit preserves stdout error when stderr is empty', async (t) => {
  const data = await fixture(t, (child) => {
    child.stdout.write('RuntimeError: subprocess initialization failed\n');
    child.emit('close', 1, null);
  });
  await assert.rejects(data.translate({ id: 'pdf_math_precise' }), {
    message: 'Kernel translation failed: RuntimeError: subprocess initialization failed',
  });
});

for (const id of ['pdf_math_fast', 'pdf_math_precise']) {
  test(`${id} native OpenAI without endpoint never inherits the local proxy URL`, async (t) => {
    const prefix = id === 'pdf_math_precise' ? 'PDF2ZH_' : '';
    const data = await fixture(t, (child) => child.emit('close', 1, null), {
      serviceCatalog: {
        get: async () => ({
          services: [
            {
              id: 'openai',
              fields: [
                {
                  id: 'key',
                  env: prefix + 'OPENAI_API_KEY',
                  type: 'string',
                  secret: true,
                  required: true,
                },
                { id: 'base_url', env: prefix + 'OPENAI_BASE_URL', type: 'string', default: null },
                {
                  id: 'model',
                  env: prefix + 'OPENAI_MODEL',
                  type: 'string',
                  default: 'native-model',
                },
              ],
            },
          ],
        }),
      },
    });
    await assert.rejects(
      data.translate({
        id,
        translationService: { id: 'openai', values: { key: 'native-secret' } },
      }),
    );
    const env = data.child.spawnOptions.env;
    assert.equal(env[prefix + 'OPENAI_API_KEY'], 'native-secret');
    assert.equal(env[prefix + 'OPENAI_MODEL'], 'native-model');
    assert.equal(env.OPENAI_BASE_URL, undefined);
    assert.equal(env.PDF2ZH_OPENAI_BASE_URL, undefined);
  });
}
