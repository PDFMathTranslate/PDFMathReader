import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
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
        child.spawnArgs = args;
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
    root,
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

for (const id of ['pdf_math_fast', 'pdf_math_precise']) {
  test(`${id} reopened page uses disk cache without kernel discovery`, async (t) => {
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = Buffer.from(await pdf.save());
    let checks = 0;
    const data = await fixture(
      t,
      async (child) => {
        const dir = dirname(child.spawnArgs[2]);
        await writeFile(join(dir, 'result.mono.pdf'), bytes);
        await writeFile(join(dir, 'layout.json'), JSON.stringify({ paragraphs: [] }));
        child.emit('close', 0, null);
      },
      {
        getState: async () => {
          checks++;
          if (checks > 1) throw Error('Kernel discovery must not run');
          return { available: true, version: 'test' };
        },
      },
    );
    const first = await data.translate({ id, bytes });
    assert.equal(first.cached, false);
    const runner = createTranslationRunner({
      root: data.root,
      baseCacheDir: join(data.root, 'cache'),
      getState: async () => {
        throw Error('Kernel is unavailable');
      },
    });
    const request = {
      id,
      bytes,
      page: 1,
      language: 'English',
      model: 'different-model',
      cacheOnly: true,
    };
    const hit = await runner.translate(request);
    assert.equal(hit.cached, true);
    assert.equal(hit.layoutKey, first.layoutKey);
    assert.equal(hit.translationModel, 'test-model');
    assert.deepEqual(Buffer.from(hit), Buffer.from(first));
    for (const change of [
      { language: 'Chinese' },
      { page: 2 },
      { glossary: [{ source: 'a', target: 'b' }] },
      { advancedOptions: { debug: true } },
      { forceRetranslation: true },
      { reuseTranslations: false },
      { cacheScope: 'a'.repeat(64) + ':new-generation' },
    ]) {
      assert.equal(await runner.translate({ ...request, ...change }), null);
      await assert.rejects(
        runner.translate({ ...request, ...change, cacheOnly: false }),
        /Kernel is unavailable/,
      );
    }
    const files = await readdir(join(data.root, 'cache'));
    const layout = files.find((name) => name.endsWith('.layout.json'));
    await writeFile(join(data.root, 'cache', layout), '{broken');
    assert.equal(await runner.translate(request), null);
    await assert.rejects(
      runner.translate({ ...request, cacheOnly: false }),
      /Kernel is unavailable/,
    );
  });
}

for (const id of ['pdf_math_fast', 'pdf_math_precise']) {
  test(`${id} cache-only miss never probes Python, services, options or workers`, async (t) => {
    const unexpected = async () => {
      throw Error('Unexpected kernel work during cache lookup');
    };
    const data = await fixture(t, () => assert.fail('Worker must not start'), {
      getState: unexpected,
      advanced: unexpected,
      serviceCatalog: { get: unexpected },
    });
    const result = await data.translate({
      id,
      cacheOnly: true,
      translationService: { id: 'openai', values: { model: 'test' } },
      runWorker: unexpected,
    });
    assert.equal(result, null);
    assert.deepEqual(await readdir(data.root), []);
  });
}
