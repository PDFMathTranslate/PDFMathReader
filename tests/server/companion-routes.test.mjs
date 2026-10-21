import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import {
  createPairingCode,
  normalizePairingCode,
  registerCompanionRoutes,
} from '../../server/http/companion-routes.mjs';

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

async function serve({
  token = createPairingCode(),
  translate,
  check,
  computer,
  companionTranslationOptions,
  providerFor,
  documents,
} = {}) {
  const calls = [];
  const proxyJobs = new Map();
  const app = express();
  const routes = registerCompanionRoutes(app, {
    token,
    engines: {
      check: check || (async (id) => ({ id, available: id === 'pdf_math_fast', version: '1.0' })),
      translate:
        translate ||
        (async (options) => {
          calls.push(options);
          options.onProgress({ stage: 'Translating', percent: 40 });
          return Buffer.from('%PDF-translated');
        }),
    },
    providerRuntime: {
      companionTranslationOptions:
        companionTranslationOptions ||
        (async () => ({
          services: [
            { id: 'auto', name: 'Use Computer Settings' },
            { id: 'siliconflow-free', name: 'SiliconFlow free' },
            { id: 'apple-local', name: 'Apple Translation (on device)' },
          ],
        })),
      providerFor:
        providerFor ||
        (async (selection) => ({
          id: selection?.id || 'siliconflow-free',
          model: 'model',
          identity: {},
        })),
    },
    pageLimiter: { run: (fn) => fn() },
    proxyJobs,
    origin: () => 'http://127.0.0.1:1',
    appVersion: '9.9.9',
    maxDocumentBytes: 1024 * 1024,
    computer,
    documents,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/companion/v1`;
  const request = (path, { code = token, ...options } = {}) =>
    fetch(base + path, {
      ...options,
      headers: {
        ...(code ? { Authorization: `Bearer ${code}` } : {}),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  const close = async () => {
    routes.cancelAll();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  };
  return { token, calls, proxyJobs, request, port: server.address().port, close };
}

const job = (overrides = {}) =>
  JSON.stringify({
    engine: 'pdf_math_fast',
    language: 'Simplified Chinese',
    pdf: PDF.toString('base64'),
    ...overrides,
  });

async function settle(request, id) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const status = await (await request(`/jobs/${id}`)).json();
    if (status.state !== 'running') return status;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw Error('Job did not finish');
}

test('pairing codes are readable and normalize loosely', () => {
  const code = createPairingCode();
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.doesNotMatch(code, /[01IOL]/);
  assert.equal(
    normalizePairingCode(code.toLowerCase().replaceAll('-', ' ')),
    code.replaceAll('-', ''),
  );
});

test('companion routes require the pairing code and lock out guessing', async () => {
  const { request, token, close } = await serve();
  try {
    assert.equal((await request('/health', { code: '' })).status, 401);
    assert.equal((await request('/health', { code: 'WRONG-CODE' })).status, 401);
    // Spacing and case do not matter when the code is typed on a phone.
    const loose = token.toLowerCase().replaceAll('-', ' ');
    assert.equal((await request('/health', { code: loose })).status, 200);
    for (let attempt = 0; attempt < 10; attempt++) await request('/health', { code: 'nope' });
    assert.equal((await request('/health')).status, 429);
  } finally {
    await close();
  }
});

test('document imports stay behind pairing authentication and return the desktop identity', async () => {
  const calls = [];
  const token = createPairingCode();
  const receipt = {
    documentID: 'desktop-import-1',
    revision: 'a'.repeat(64),
    sha256: 'a'.repeat(64),
    byteCount: PDF.length,
    pageCount: 1,
  };
  const { request, close } = await serve({
    token,
    documents: {
      importDocument: async (body) => {
        calls.push(body);
        return { created: true, response: receipt };
      },
    },
  });
  const body = {
    sourceID: 'ios-local-document-1',
    title: 'Imported reading copy.pdf',
    pdf: PDF.toString('base64'),
    sha256: receipt.sha256,
    byteCount: PDF.length,
    pageCount: 1,
  };
  try {
    assert.equal(
      (
        await request('/documents/import', {
          code: 'WRONG-CODE',
          method: 'POST',
          body: JSON.stringify(body),
        })
      ).status,
      401,
    );
    assert.equal(calls.length, 0);

    const response = await request('/documents/import', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), receipt);
    assert.deepEqual(calls, [body]);
  } finally {
    await close();
  }
});

test('legacy pairing codes still authenticate without accepting a shortened prefix', async () => {
  const { request, close } = await serve({ token: 'ABCD-EFGH-JKMN-PQRS' });
  try {
    assert.equal((await request('/health')).status, 200);
    assert.equal((await request('/health', { code: 'ABCD-EFGH' })).status, 401);
  } finally {
    await close();
  }
});

test('health reports both local kernels', async () => {
  const { request, close } = await serve();
  try {
    const health = await (await request('/health')).json();
    assert.equal(health.status, 'ok');
    assert.equal(health.protocol, 1);
    assert.equal(health.version, '9.9.9');
    assert.deepEqual(
      health.kernels.map((kernel) => [kernel.id, kernel.available]),
      [
        ['pdf_math_fast', true],
        ['pdf_math_precise', false],
      ],
    );
    assert.ok(health.kernels[1].reason);
  } finally {
    await close();
  }
});

test('health exposes public translation services and kernel language capabilities', async () => {
  const companionTranslationOptions = async () => ({
    services: [
      {
        id: 'siliconflow-free',
        label: 'SiliconFlow free',
        fields: [{ id: 'api_key', secret: true }],
      },
      {
        id: 'custom-0a1b2c3d4e5f',
        label: 'Research endpoint',
        fields: [{ id: 'api_key', secret: true }],
      },
    ],
  });
  const { request, close } = await serve({ companionTranslationOptions });
  try {
    const health = await (await request('/health')).json();
    assert.deepEqual(
      health.translation.services.map(({ id, name, ...rest }) => ({ id, name, ...rest })),
      [
        { id: 'auto', name: 'Use Computer Settings' },
        { id: 'siliconflow-free', name: 'SiliconFlow free' },
        { id: 'custom-0a1b2c3d4e5f', name: 'Research endpoint' },
      ],
    );
    assert.equal(JSON.stringify(health.translation).includes('api_key'), false);
    assert.deepEqual(health.translation.kernels[0].sourceLanguages[0], {
      name: 'Simplified Chinese',
      code: 'zh',
    });
    assert.equal(
      health.translation.kernels.find((kernel) => kernel.id === 'pdf_math_fast').targetLanguages
        .length,
      10,
    );
    assert.equal(
      health.translation.kernels.find((kernel) => kernel.id === 'pdf_math_precise').targetLanguages
        .length,
      47,
    );
  } finally {
    await close();
  }
});

test('health preserves sanitized per-kernel service capabilities without credentials', async () => {
  const companionTranslationOptions = async () => ({
    services: [
      {
        id: 'custom-0a1b2c3d4e5f',
        name: 'Research endpoint',
        api_key: 'do-not-expose',
        kernels: [
          {
            id: 'pdf_math_fast',
            sourceLanguages: [
              { name: 'English', code: 'en', api_key: 'do-not-expose' },
              'Simplified Chinese',
              { name: 'Missing code' },
            ],
            targetLanguages: [{ name: 'Simplified Chinese', code: 'zh' }],
          },
          { id: 'unsupported-engine', sourceLanguages: ['English'] },
          { id: 'pdf_math_fast', sourceLanguages: ['Japanese'] },
        ],
      },
    ],
  });
  const { request, close } = await serve({ companionTranslationOptions });
  try {
    const health = await (await request('/health')).json();
    const service = health.translation.services.find((entry) => entry.id === 'custom-0a1b2c3d4e5f');
    assert.deepEqual(service.kernels, [
      {
        id: 'pdf_math_fast',
        sourceLanguages: [
          { name: 'English', code: 'en' },
          { name: 'Simplified Chinese', code: 'zh' },
        ],
        targetLanguages: [{ name: 'Simplified Chinese', code: 'zh' }],
      },
    ]);
    assert.equal(JSON.stringify(service).includes('do-not-expose'), false);
    assert.equal(JSON.stringify(service).includes('unsupported-engine'), false);
  } finally {
    await close();
  }
});

test('jobs enforce the selected service kernel restrictions', async () => {
  const companionTranslationOptions = async () => ({
    kernels: [
      {
        id: 'pdf_math_fast',
        sourceLanguages: [{ name: 'Simplified Chinese', code: 'zh' }],
        targetLanguages: [{ name: 'Simplified Chinese', code: 'zh' }],
      },
    ],
    services: [
      {
        id: 'restricted-service',
        name: 'Restricted service',
        kernels: [
          {
            id: 'pdf_math_fast',
            sourceLanguages: [{ name: 'Simplified Chinese', code: 'zh' }],
            targetLanguages: [{ name: 'Simplified Chinese', code: 'zh' }],
          },
        ],
      },
      {
        id: 'global-only-service',
        name: 'Global-only service',
        kernels: [
          {
            id: 'pdf_math_fast',
            sourceLanguages: [{ name: 'English', code: 'en' }],
            targetLanguages: [{ name: 'English', code: 'en' }],
          },
        ],
      },
    ],
  });
  const { request, close } = await serve({ companionTranslationOptions });
  try {
    const accepted = await request('/jobs', {
      method: 'POST',
      body: job({ service: 'restricted-service' }),
    });
    assert.equal(accepted.status, 202);
    await settle(request, (await accepted.json()).id);

    for (const body of [
      job({ service: 'restricted-service', language: 'English' }),
      job({ service: 'restricted-service', sourceLanguage: 'English' }),
      job({ service: 'restricted-service', engine: 'pdf_math_precise' }),
      job({ service: 'global-only-service', language: 'English' }),
    ])
      assert.equal((await request('/jobs', { method: 'POST', body })).status, 400, body);
  } finally {
    await close();
  }
});

test('configured service ids are accepted and passed to the provider runtime', async () => {
  const selections = [];
  const companionTranslationOptions = async () => ({
    services: [{ id: 'custom-0a1b2c3d4e5f', label: 'Research endpoint', fields: [] }],
  });
  const { request, close } = await serve({
    companionTranslationOptions,
    providerFor: async (selection) => {
      selections.push(selection);
      return { id: 'custom-0a1b2c3d4e5f', model: 'model', identity: {} };
    },
  });
  try {
    const created = await request('/jobs', {
      method: 'POST',
      body: job({ service: 'custom-0a1b2c3d4e5f' }),
    });
    assert.equal(created.status, 202);
    const { id } = await created.json();
    await settle(request, id);
    assert.deepEqual(selections, [{ id: 'custom-0a1b2c3d4e5f', values: {} }]);
  } finally {
    await close();
  }
});

test('health reports validated tailnet URLs using the companion listener port', async () => {
  const { request, port, close } = await serve({
    computer: {
      name: 'Rongxins-MacBook-Pro',
      tailscaleAddresses: [
        '100.113.193.105',
        'fd7a:115c:a1e0:0:0:0:643b:c169',
        '100.63.1.1',
        'fd68:115c:a1e0::1',
      ],
    },
  });
  try {
    const health = await (await request('/health')).json();
    assert.deepEqual(health.computer, {
      name: 'Rongxins-MacBook-Pro',
      addresses: [`http://100.113.193.105:${port}`, `http://[fd7a:115c:a1e0::643b:c169]:${port}`],
    });
  } finally {
    await close();
  }
});

test('a page job translates a one-page PDF and returns the result', async () => {
  const { request, calls, proxyJobs, close } = await serve();
  try {
    const created = await request('/jobs', { method: 'POST', body: job() });
    assert.equal(created.status, 202);
    const { id } = await created.json();
    const status = await settle(request, id);
    assert.equal(status.state, 'done');
    assert.equal(status.percent, 100);
    const result = await request(`/jobs/${id}/result`);
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('content-type'), 'application/pdf');
    assert.equal(Buffer.from(await result.arrayBuffer()).toString(), '%PDF-translated');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].id, 'pdf_math_fast');
    assert.equal(calls[0].page, 1);
    assert.equal(calls[0].language, 'Simplified Chinese');
    assert.deepEqual(calls[0].bytes, PDF);
    assert.match(calls[0].proxy.url, /\/kernel-proxy\/v1$/);
    assert.equal(proxyJobs.size, 0);
    assert.equal((await request(`/jobs/${id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await request(`/jobs/${id}`)).status, 404);
  } finally {
    await close();
  }
});

test('invalid page requests are rejected', async () => {
  const { request, close } = await serve();
  try {
    for (const body of [
      job({ engine: 'pdf_inspector' }),
      job({ language: 'Not a language' }),
      job({ service: 'openai' }),
      job({ glossary: [{ source: '', target: 'x' }] }),
      job({ pdf: Buffer.from('not a pdf').toString('base64') }),
      job({ pdf: undefined }),
    ])
      assert.equal((await request('/jobs', { method: 'POST', body })).status, 400, body);
  } finally {
    await close();
  }
});

test('failed and cancelled jobs report their state', async () => {
  let release;
  const { request, close } = await serve({
    translate: (options) =>
      options.language === 'English'
        ? Promise.reject(Error('Provider unavailable'))
        : new Promise((_resolve, reject) => {
            release = () => reject(Error('Cancelled'));
            options.signal.addEventListener('abort', release, { once: true });
          }),
  });
  try {
    const failed = await (
      await request('/jobs', { method: 'POST', body: job({ language: 'English' }) })
    ).json();
    const failure = await settle(request, failed.id);
    assert.equal(failure.state, 'failed');
    assert.equal(failure.error, 'Provider unavailable');
    assert.equal((await request(`/jobs/${failed.id}/result`)).status, 422);

    const running = await (await request('/jobs', { method: 'POST', body: job() })).json();
    assert.equal((await request(`/jobs/${running.id}/result`)).status, 409);
    assert.equal((await request(`/jobs/${running.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await settle(request, running.id)).state, 'cancelled');
  } finally {
    await close();
  }
});
