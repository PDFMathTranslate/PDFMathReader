import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFormulaOcrSessions } from '../../server/formula/formula-ocr-sessions.mjs';

function runtime(backends, fail = () => false) {
  const calls = [];
  const released = [];
  return {
    calls,
    released,
    listSupportedBackends: () => backends.map((name) => ({ name })),
    InferenceSession: {
      async create(path, options) {
        calls.push({ path, ...options });
        if (fail(path, options)) throw Error('GPU device unavailable');
        return { release: async () => released.push(path) };
      },
    },
  };
}

test('both formula models use the platform GPU when enabled', async () => {
  for (const [platform, provider] of [
    ['win32', 'dml'],
    ['darwin', 'coreml'],
    ['linux', 'cuda'],
  ]) {
    const ort = runtime(['cpu', provider]);
    await createFormulaOcrSessions(ort, '.', { preferGpu: true, platform });
    assert.equal(ort.calls.length, 2);
    for (const options of ort.calls) {
      assert.deepEqual(options.executionProviders, [provider, 'cpu']);
      if (provider === 'dml') {
        assert.equal(options.enableMemPattern, false);
        assert.equal(options.executionMode, 'sequential');
      }
    }
  }
});

test('disabled GPU and missing backends use CPU', async () => {
  for (const preferGpu of [false, true]) {
    const warnings = [];
    const ort = runtime(preferGpu ? ['cpu'] : ['cpu', 'dml']);
    await createFormulaOcrSessions(ort, '.', {
      preferGpu,
      platform: 'win32',
      warn: (message) => warnings.push(message),
    });
    assert.deepEqual(
      ort.calls.map((call) => call.executionProviders),
      [['cpu'], ['cpu']],
    );
    assert.equal(warnings.length, preferGpu ? 1 : 0);
  }
});

test('GPU initialization failure releases partial sessions and retries both models on CPU', async () => {
  for (const failingModel of ['encoder', 'decoder']) {
    const warnings = [];
    const ort = runtime(
      ['cpu', 'dml'],
      (path, options) => path.includes(failingModel) && options.executionProviders.includes('dml'),
    );
    await createFormulaOcrSessions(ort, '.', {
      preferGpu: true,
      platform: 'win32',
      warn: (message) => warnings.push(message),
    });
    assert.deepEqual(
      ort.calls.slice(-2).map((call) => call.executionProviders),
      [['cpu'], ['cpu']],
    );
    assert.equal(ort.released.length, failingModel === 'decoder' ? 1 : 0);
    assert.equal(warnings.length, 1);
  }
});

test('CPU initialization errors propagate after releasing the encoder', async () => {
  const ort = runtime(['cpu'], (path) => path.includes('decoder'));
  await assert.rejects(createFormulaOcrSessions(ort, '.'), /GPU device unavailable/);
  assert.equal(ort.released.length, 1);
});
