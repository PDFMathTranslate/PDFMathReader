import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { test } from 'node:test';
import { createPairingCode, registerCompanionRoutes } from '../../server/http/companion-routes.mjs';

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

function documentStore(overrides = {}) {
  return {
    list: async () => ({ documents: [] }),
    acquire: async (_id, body) => ({
      response: { sessionID: body.sessionID || 'session-1' },
    }),
    heartbeat: async (_id, sessionID) => ({ sessionID }),
    update: async (_id, sessionID) => ({ sessionID, revision: 'revision-1' }),
    release: async (_id, sessionID) => ({ released: true, sessionID }),
    claimDesktop: async () => ({ claimed: true }),
    releaseDesktop: async () => ({ released: true }),
    ...overrides,
  };
}

async function serve({ documents = documentStore(), translate, now = () => 0 } = {}) {
  const token = createPairingCode();
  const proxyJobs = new Map();
  const app = express();
  const routes = registerCompanionRoutes(app, {
    token,
    engines: {
      check: async (id) => ({ id, available: true, version: '1.0' }),
      translate: translate || (async () => Buffer.from('%PDF-translated')),
    },
    providerRuntime: {
      companionTranslationOptions: async () => ({
        services: [{ id: 'auto', name: 'Use Computer Settings' }],
      }),
      providerFor: async () => ({ id: 'siliconflow-free', model: 'model', identity: {} }),
    },
    pageLimiter: { run: (fn) => fn() },
    proxyJobs,
    origin: () => 'http://127.0.0.1:1',
    maxDocumentBytes: 1024 * 1024,
    documents,
    now,
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/companion/v1`;
  const request = (path, { code = token, ...options } = {}) =>
    fetch(base + path, {
      ...options,
      headers: {
        ...(code ? { Authorization: `Bearer ${code}` } : {}),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
  const close = async () => {
    routes.cancelAll();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  };
  return { request, routes, close };
}

async function finish(response) {
  await response.arrayBuffer();
  await new Promise((resolve) => setImmediate(resolve));
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw Error('Condition did not become true');
}

function job() {
  return JSON.stringify({
    engine: 'pdf_math_fast',
    language: 'Simplified Chinese',
    pdf: PDF.toString('base64'),
  });
}

test('unauthorized requests do not create a connection presence record', async () => {
  const { request, routes, close } = await serve();
  try {
    const response = await request('/health', { code: 'WRONG-CODE' });
    assert.equal(response.status, 401);
    await finish(response);
    assert.deepEqual(routes.connections(), []);
  } finally {
    await close();
  }
});

test('a successful document acquisition records bounded client identity', async () => {
  const { request, routes, close } = await serve();
  try {
    const name = `\u0001${'N'.repeat(150)}\u007f`;
    const userAgent = `PDFMathReader/${'U'.repeat(300)}`;
    const response = await request('/documents/document-1/session', {
      method: 'POST',
      headers: { 'User-Agent': userAgent },
      body: JSON.stringify({
        deviceID: 'ios-device-1',
        deviceName: name,
        sessionID: 'session-1',
      }),
    });
    assert.equal(response.status, 200);
    await finish(response);

    const [connection] = routes.connections();
    assert.ok(connection);
    assert.match(connection.id, /^[0-9a-f-]{36}$/);
    assert.equal(connection.address, '127.0.0.1');
    assert.equal(connection.name, 'N'.repeat(128));
    assert.equal(connection.userAgent, userAgent.slice(0, 256));
    assert.equal(connection.connectedAt, 0);
    assert.equal(connection.lastSeenAt, 0);
    assert.equal(connection.activeJobs, 0);
  } finally {
    await close();
  }
});

test('an authenticated non-2xx response does not create a connection presence record', async () => {
  const documents = documentStore({
    acquire: async () => {
      const error = Error('Document is locked');
      error.status = 409;
      throw error;
    },
  });
  const { request, routes, close } = await serve({ documents });
  try {
    const response = await request('/documents/document-1/session', {
      method: 'POST',
      body: JSON.stringify({ deviceID: 'ios-device-1', sessionID: 'session-1' }),
    });
    assert.equal(response.status, 409);
    await finish(response);
    assert.deepEqual(routes.connections(), []);
  } finally {
    await close();
  }
});

test('idle connections expire at 90 seconds', async () => {
  let time = 0;
  const { request, routes, close } = await serve({ now: () => time });
  try {
    const response = await request('/documents/document-1/session', {
      method: 'POST',
      body: JSON.stringify({ deviceID: 'ios-device-1', sessionID: 'session-1' }),
    });
    await finish(response);
    assert.equal(routes.connections().length, 1);

    time = 89_999;
    assert.equal(routes.connections().length, 1);
    time = 90_000;
    assert.deepEqual(routes.connections(), []);
  } finally {
    await close();
  }
});

test('desktop-session requests do not create a remote connection presence record', async () => {
  const { request, routes, close } = await serve();
  try {
    const response = await request('/documents/document-1/desktop-session', {
      method: 'POST',
      body: JSON.stringify({ sessionID: 'desktop-session-1', deviceName: 'This Mac' }),
    });
    assert.equal(response.status, 200);
    await finish(response);
    assert.deepEqual(routes.connections(), []);
  } finally {
    await close();
  }
});

test('a running translation keeps an idle connection present until the job completes', async () => {
  let time = 0;
  let releaseTranslation;
  let translationStarted;
  const translationReady = new Promise((resolve) => {
    translationStarted = resolve;
  });
  const translationHold = new Promise((resolve) => {
    releaseTranslation = resolve;
  });
  const { request, routes, close } = await serve({
    now: () => time,
    translate: async () => {
      translationStarted();
      await translationHold;
      return Buffer.from('%PDF-translated');
    },
  });
  try {
    const response = await request('/jobs', { method: 'POST', body: job() });
    assert.equal(response.status, 202);
    const { id } = await response.json();
    await translationReady;
    await new Promise((resolve) => setImmediate(resolve));

    time = 90_000;
    const whileRunning = routes.connections();
    assert.equal(whileRunning.length, 1);
    assert.equal(whileRunning[0].activeJobs, 1);

    releaseTranslation();
    await waitFor(() => routes.jobs() === 0);
    assert.equal(routes.jobs(), 0);
    assert.equal(id.length > 0, true);
    assert.deepEqual(routes.connections(), []);
  } finally {
    await close();
  }
});

test('iPad identifies itself on the initial health connection', async () => {
  const { request, routes, close } = await serve();
  try {
    const response = await request('/health', {
      headers: { 'X-PDFMathReader-Device-Name': 'iPad' },
    });
    assert.equal(response.status, 200);
    await finish(response);
    assert.equal(routes.connections()[0].name, 'iPad');

    const acquired = await request('/documents/document-1/session', {
      method: 'POST',
      headers: { 'X-PDFMathReader-Device-Name': 'iPad' },
      body: JSON.stringify({
        deviceID: 'ios-device-1',
        deviceName: 'Custom name',
        sessionID: 'session-1',
      }),
    });
    assert.equal(acquired.status, 200);
    await finish(acquired);
    assert.equal(routes.connections()[0].name, 'iPad');
  } finally {
    await close();
  }
});
