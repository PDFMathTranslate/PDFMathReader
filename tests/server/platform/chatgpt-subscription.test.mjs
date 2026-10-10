import test from 'node:test';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { connect } from 'node:net';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createChatGPTSubscription } from '../../../electron/main/services/chatgpt-subscription.mjs';

const issuer = 'https://auth.openai.com';
const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
const jwksUrl = `${issuer}/.well-known/jwks.json`;
const tokenUrl = `${issuer}/api/accounts/oauth/token`;
const revokeUrl = `${issuer}/api/accounts/oauth/revoke`;
const scopes = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function signIDToken(
  privateKey,
  {
    clientId,
    nonce,
    subject,
    email,
    expired = false,
    issuerOverride = issuer,
    audienceOverride = clientId,
    nonceOverride = nonce,
    signingKey = privateKey,
  },
) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', kid: 'fixture-key', typ: 'JWT' }),
  ).toString('base64url');
  const claims = Buffer.from(
    JSON.stringify({
      iss: issuerOverride,
      aud: audienceOverride,
      sub: subject,
      email,
      nonce: nonceOverride,
      exp: Math.floor(Date.now() / 1000) + (expired ? -60 : 3600),
    }),
  ).toString('base64url');
  const input = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(input);
  signer.end();
  return `${input}.${signer.sign(signingKey).toString('base64url')}`;
}

function safeStorageFixture() {
  return {
    isEncryptionAvailable: () => true,
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async (value) =>
      Buffer.from(`encrypted:${Buffer.from(value).toString('base64')}`),
    decryptStringAsync: async (value) => ({
      result: Buffer.from(String(value).replace(/^encrypted:/, ''), 'base64').toString(),
    }),
  };
}

class FakeCallbackServer extends EventEmitter {
  constructor(handler, port, delayListen = false) {
    super();
    this.handler = handler;
    this.port = port;
    this.delayListen = delayListen;
    this.listening = false;
  }

  listen() {
    this.listening = true;
    if (!this.delayListen) queueMicrotask(() => this.emit('listening'));
  }

  start() {
    this.delayListen = false;
    queueMicrotask(() => this.emit('listening'));
  }

  address() {
    return { address: '127.0.0.1', family: 'IPv4', port: this.port };
  }

  close(callback) {
    this.listening = false;
    queueMicrotask(() => callback?.());
  }

  dispatch(url) {
    return new Promise((resolve) => {
      const response = {
        statusCode: 200,
        headers: {},
        setHeader: (name, value) => {
          response.headers[name] = value;
        },
        end: (body = '') =>
          resolve(new Response(body, { status: response.statusCode, headers: response.headers })),
      };
      this.handler({ method: 'GET', url }, response);
    });
  }
}

async function waitFor(predicate, message) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw Error(message);
}

function fixture({
  authExpiresIn = 3600,
  responseHandler,
  delayListen = false,
  tokenScope = scopes,
  idTokenOptions,
  idTokenTransform,
  invalidGrantOnce = false,
} = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = publicKey.export({ format: 'jwk' });
  const opened = [];
  const requests = [];
  const refreshes = [];
  const responses = [];
  const servers = [];
  let authorizationExchanges = 0;
  let nextPort = 41000;
  const fetcher = async (url, options = {}) => {
    requests.push({ url, options });
    if (url === discoveryUrl)
      return jsonResponse({
        issuer,
        authorization_endpoint: `${issuer}/api/accounts/authorize`,
        token_endpoint: tokenUrl,
        revocation_endpoint: revokeUrl,
        jwks_uri: jwksUrl,
      });
    if (url === jwksUrl)
      return jsonResponse({ keys: [{ ...key, kid: 'fixture-key', alg: 'RS256', use: 'sig' }] });
    if (url === tokenUrl) {
      const form = new URLSearchParams(options.body);
      if (form.get('grant_type') === 'authorization_code') {
        authorizationExchanges++;
        if (invalidGrantOnce && authorizationExchanges === 1)
          return jsonResponse({ error: 'invalid_grant' }, 400);
        const auth = new URL(opened.at(-1));
        const clientId = form.get('client_id');
        const optionsForToken =
          typeof idTokenOptions === 'function'
            ? idTokenOptions({ clientId, exchange: authorizationExchanges })
            : idTokenOptions || {};
        const subject = optionsForToken.subjectOverride || `subject-${clientId}`;
        let idToken = signIDToken(privateKey, {
          clientId,
          nonce: auth.searchParams.get('nonce'),
          subject,
          email: `${clientId}@example.test`,
          ...optionsForToken,
        });
        if (typeof idTokenTransform === 'function')
          idToken = idTokenTransform(idToken, {
            clientId,
            exchange: authorizationExchanges,
          });
        return jsonResponse({
          access_token: `access-${clientId}`,
          refresh_token: `refresh-${clientId}`,
          id_token: idToken,
          token_type: 'Bearer',
          expires_in: authExpiresIn,
          scope:
            typeof tokenScope === 'function'
              ? tokenScope({ clientId, exchange: authorizationExchanges })
              : tokenScope,
        });
      }
      if (form.get('grant_type') === 'refresh_token') {
        refreshes.push(form.get('client_id'));
        return jsonResponse({
          access_token: `refreshed-${form.get('client_id')}`,
          refresh_token: `rotated-${form.get('client_id')}`,
          token_type: 'Bearer',
          expires_in: 3600,
          scope: scopes,
        });
      }
      return jsonResponse({ error: 'invalid_grant' }, 400);
    }
    if (url === revokeUrl) return new Response('', { status: 200 });
    if (url === 'https://api.openai.com/v1/models') {
      return jsonResponse({
        models: [
          { slug: 'hidden-model', display_name: 'Hidden', visibility: 'private' },
          { slug: 'visible-model', display_name: 'Visible', visibility: 'list' },
        ],
      });
    }
    if (url === 'https://api.openai.com/v1/responses') {
      if (responseHandler) return responseHandler(options, responses);
      const stream = [
        'event: response.output_text.delta\n',
        'data: {"type":"response.output_text.delta","delta":"hello"}\n\n',
        'event: response.completed\n',
        'data: {"type":"response.completed","response":{"model":"visible-model","usage":{"input_tokens":2,"output_tokens":1,"total_tokens":3}}}\n\n',
      ].join('');
      return new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }
    throw Error(`unexpected fixture URL ${url}`);
  };
  const openExternal = async (url) => {
    opened.push(url);
    return true;
  };
  const serverFactory = (handler) => {
    const server = new FakeCallbackServer(handler, nextPort++, delayListen);
    servers.push(server);
    return server;
  };
  return {
    fetcher,
    openExternal,
    opened,
    requests,
    refreshes,
    responses,
    servers,
    serverFactory,
    authorizationExchanges: () => authorizationExchanges,
  };
}

async function signInFixture(service, fixtureState, clientId, options, callbackOptions = {}) {
  const index = fixtureState.opened.length;
  const pending = service.signIn(options);
  await waitFor(() => fixtureState.opened.length > index, 'authorization URL was not opened');
  const authorization = new URL(fixtureState.opened[index]);
  const callback = new URL(authorization.searchParams.get('redirect_uri'));
  callback.searchParams.set('code', `authorization-code-${clientId}`);
  if (callbackOptions.state !== null)
    callback.searchParams.set(
      'state',
      callbackOptions.state ?? authorization.searchParams.get('state'),
    );
  if (callbackOptions.clientId !== null)
    callback.searchParams.set('client_id', callbackOptions.clientId ?? clientId);
  const callbackResponse = await fixtureState.servers[index].dispatch(
    `${callback.pathname}${callback.search}`,
  );
  assert.equal(callbackResponse.status, callbackOptions.expectedStatus ?? 200);
  return pending;
}

test(
  'real callback completes and broadcasts despite an unused browser preconnection',
  { timeout: 8000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'chatgpt-subscription-preconnect-'));
    const state = fixture();
    const changes = [];
    let service;
    let socket;
    try {
      service = await createChatGPTSubscription({
        path: join(directory, 'chatgpt.enc'),
        safeStorage: safeStorageFixture(),
        openExternal: state.openExternal,
        fetcher: state.fetcher,
        platform: 'darwin',
        onChange: (status) => changes.push(status),
      });
      const pending = service.signIn();
      await waitFor(() => state.opened.length === 1, 'authorization URL was not opened');
      const authorization = new URL(state.opened[0]);
      const callback = new URL(authorization.searchParams.get('redirect_uri'));
      socket = connect(Number(callback.port), '127.0.0.1');
      await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('error', reject);
      });
      callback.searchParams.set('code', 'authorization-code-oaiapp_preconnect');
      callback.searchParams.set('state', authorization.searchParams.get('state'));
      callback.searchParams.set('client_id', 'oaiapp_preconnect');
      const response = await fetch(callback);
      assert.equal(response.status, 200);
      await response.text();
      const result = await pending;
      assert.equal(result.signedIn, true);
      assert.equal(result.pending, false);
      assert.ok(changes.some((status) => status.signedIn && !status.pending));
    } finally {
      socket?.destroy();
      await service?.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test('sign-in reserves pending before listener setup and cancellation closes startup cleanly', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'chatgpt-subscription-pending-'));
  const state = fixture({ delayListen: true });
  let service;
  try {
    service = await createChatGPTSubscription({
      path: join(directory, 'chatgpt.enc'),
      safeStorage: safeStorageFixture(),
      openExternal: state.openExternal,
      fetcher: state.fetcher,
      platform: 'darwin',
      serverFactory: state.serverFactory,
      authTimeoutMs: 1000,
    });
    const signIn = service.signIn();
    await waitFor(() => service.status().pending, 'sign-in did not reserve pending state');
    await assert.rejects(service.signIn(), /already in progress/i);
    await service.cancel();
    await assert.rejects(signIn, /cancelled/i);
    assert.equal(service.status().pending, false);
    assert.equal(state.servers[0].listening, false);
    assert.equal(state.opened.length, 0);
  } finally {
    await service?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('sign-in refuses to use a transient host ID when stable host persistence fails', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'chatgpt-subscription-host-'));
  const blocked = join(directory, 'blocked');
  await writeFile(blocked, 'file');
  const state = fixture();
  let service;
  try {
    service = await createChatGPTSubscription({
      path: join(blocked, 'chatgpt.enc'),
      safeStorage: safeStorageFixture(),
      openExternal: state.openExternal,
      fetcher: state.fetcher,
      platform: 'darwin',
      serverFactory: state.serverFactory,
    });
    await assert.rejects(service.signIn(), /secure ChatGPT credentials/i);
    assert.equal(service.status().pending, false);
    assert.equal(state.opened.length, 0);
  } finally {
    await service?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('ChatGPT sign-in uses loopback PKCE, validates a signed ID token, and reloads encrypted accounts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'chatgpt-subscription-'));
  const path = join(directory, 'chatgpt.enc');
  const state = fixture();
  let service;
  let reopened;
  try {
    service = await createChatGPTSubscription({
      path,
      safeStorage: safeStorageFixture(),
      openExternal: state.openExternal,
      fetcher: state.fetcher,
      platform: 'darwin',
      serverFactory: state.serverFactory,
    });
    const signedIn = await signInFixture(service, state, 'oaiapp_primary');
    assert.equal(signedIn.signedIn, true);
    assert.deepEqual(signedIn.accounts, [
      {
        clientId: 'oaiapp_primary',
        email: 'oaiapp_primary@example.test',
        subject: 'subject-oaiapp_primary',
        signedIn: true,
      },
    ]);
    assert.equal(signedIn.activeClientId, 'oaiapp_primary');
    assert.equal(signedIn.pending, false);
    assert.equal(JSON.stringify(signedIn).includes('access-oaiapp_primary'), false);

    const authorization = new URL(state.opened[0]);
    assert.equal(authorization.searchParams.get('client_id'), 'dynamic_agent_client');
    assert.equal(authorization.searchParams.get('agent_name_hint'), 'PDFMathReader');
    assert.match(authorization.searchParams.get('ext_agent_host_id'), /^urn:uuid:/);
    assert.equal(authorization.searchParams.get('redirect_uri').includes('/auth/callback'), true);
    assert.equal(authorization.searchParams.get('redirect_uri').includes('localhost'), false);
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(authorization.searchParams.get('code_challenge'));
    const tokenRequest = state.requests.find(
      ({ url, options }) =>
        url === tokenUrl &&
        new URLSearchParams(options.body).get('grant_type') === 'authorization_code',
    );
    assert.equal(new URLSearchParams(tokenRequest.options.body).get('client_id'), 'oaiapp_primary');
    assert.equal(
      new URLSearchParams(tokenRequest.options.body).get('resource'),
      'https://api.openai.com/v1',
    );
    assert.ok(new URLSearchParams(tokenRequest.options.body).get('code_verifier'));

    const saved = await readFile(path, 'utf8');
    assert.equal(saved.includes('access-oaiapp_primary'), false);
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    const host = await readFile(`${path}.host`, 'utf8');
    assert.match(host.trim(), /^urn:uuid:/);
    assert.equal((await stat(`${path}.host`)).mode & 0o777, 0o600);

    await service.close();
    reopened = await createChatGPTSubscription({
      path,
      safeStorage: safeStorageFixture(),
      openExternal: state.openExternal,
      fetcher: state.fetcher,
      platform: 'darwin',
      serverFactory: state.serverFactory,
    });
    assert.equal(reopened.status().signedIn, true);
    assert.equal(reopened.status().activeClientId, 'oaiapp_primary');
    await reopened.close();
  } finally {
    await reopened?.close();
    await service?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects invalid callbacks and tokens without replacing the active persisted account', async () => {
  const missingDirectScope = scopes
    .split(' ')
    .filter((scope) => scope !== 'chatgpt.tokens.use.direct')
    .join(' ');
  const cases = [
    {
      name: 'state',
      clientId: 'oaiapp_bad_state',
      error: /callback/i,
      callbackOptions: { state: 'wrong-state', expectedStatus: 400 },
    },
    {
      name: 'nonce',
      clientId: 'oaiapp_bad_nonce',
      error: /identity/i,
      idTokenOptions: { nonceOverride: 'wrong-nonce' },
    },
    {
      name: 'audience',
      clientId: 'oaiapp_bad_audience',
      error: /identity/i,
      idTokenOptions: { audienceOverride: 'oaiapp_other' },
    },
    {
      name: 'expired token',
      clientId: 'oaiapp_expired',
      error: /identity/i,
      idTokenOptions: { expired: true },
    },
    {
      name: 'invalid signature',
      clientId: 'oaiapp_bad_signature',
      error: /identity/i,
      idTokenTransform: (token, { exchange }) => {
        if (exchange !== 2) return token;
        const [header, payload, signature] = token.split('.');
        const replacement = signature.startsWith('A') ? 'B' : 'A';
        return `${header}.${payload}.${replacement}${signature.slice(1)}`;
      },
    },
    {
      name: 'missing direct permission',
      clientId: 'oaiapp_no_direct_scope',
      error: /permission/i,
      tokenScope: ({ exchange }) => (exchange === 1 ? scopes : missingDirectScope),
    },
    {
      name: 'returning mismatched client',
      clientId: 'oaiapp_other',
      error: /callback/i,
      signInOptions: { clientId: 'oaiapp_prior' },
      callbackOptions: { clientId: 'oaiapp_other' },
    },
    {
      name: 'returning mismatched identity',
      clientId: 'oaiapp_prior',
      error: /identity/i,
      signInOptions: { clientId: 'oaiapp_prior' },
      idTokenOptions: ({ exchange }) =>
        exchange === 1 ? {} : { subjectOverride: 'subject-different' },
    },
  ];

  for (const scenario of cases) {
    const directory = await mkdtemp(
      join(tmpdir(), `chatgpt-subscription-negative-${scenario.name}-`),
    );
    const path = join(directory, 'chatgpt.enc');
    const state = fixture({
      idTokenOptions: scenario.idTokenOptions
        ? ({ exchange }) =>
            exchange === 1
              ? {}
              : typeof scenario.idTokenOptions === 'function'
                ? scenario.idTokenOptions({ exchange })
                : scenario.idTokenOptions
        : undefined,
      idTokenTransform: scenario.idTokenTransform,
      tokenScope: scenario.tokenScope,
    });
    let service;
    try {
      service = await createChatGPTSubscription({
        path,
        safeStorage: safeStorageFixture(),
        openExternal: state.openExternal,
        fetcher: state.fetcher,
        platform: 'darwin',
        serverFactory: state.serverFactory,
      });
      await signInFixture(service, state, 'oaiapp_prior');
      const attempt = signInFixture(
        service,
        state,
        scenario.clientId,
        scenario.signInOptions || { clientId: '' },
        scenario.callbackOptions,
      );
      await assert.rejects(attempt, scenario.error, scenario.name);
      assert.equal(service.status().pending, false);
      assert.equal(service.status().activeClientId, 'oaiapp_prior');
      assert.deepEqual(
        service.status().accounts.map(({ clientId }) => clientId),
        ['oaiapp_prior'],
      );
      const saved = await safeStorageFixture().decryptStringAsync(await readFile(path));
      const persisted = JSON.parse(saved.result);
      assert.deepEqual(Object.keys(persisted.accounts), ['oaiapp_prior']);
      if (scenario.clientId === 'oaiapp_prior') {
        assert.equal(persisted.accounts.oaiapp_prior.subject, 'subject-oaiapp_prior');
        assert.equal(persisted.accounts.oaiapp_prior.accessToken, 'access-oaiapp_prior');
      } else {
        assert.equal(JSON.stringify(persisted).includes(scenario.clientId), false);
      }
    } finally {
      await service?.close();
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test('retries dynamic invalid_grant with the issued client ID without persisting unvalidated credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'chatgpt-subscription-invalid-grant-'));
  const state = fixture({ invalidGrantOnce: true });
  let service;
  try {
    service = await createChatGPTSubscription({
      path: join(directory, 'chatgpt.enc'),
      safeStorage: safeStorageFixture(),
      openExternal: state.openExternal,
      fetcher: state.fetcher,
      platform: 'darwin',
      serverFactory: state.serverFactory,
    });
    const pending = signInFixture(service, state, 'oaiapp_retry');
    await waitFor(() => state.opened.length === 2, 'fresh authorization was not opened');
    const retryAuthorization = new URL(state.opened[1]);
    assert.equal(retryAuthorization.searchParams.get('client_id'), 'oaiapp_retry');
    assert.equal(retryAuthorization.searchParams.has('agent_name_hint'), false);
    const callback = new URL(retryAuthorization.searchParams.get('redirect_uri'));
    callback.searchParams.set('code', 'authorization-code-oaiapp_retry-2');
    callback.searchParams.set('state', retryAuthorization.searchParams.get('state'));
    callback.searchParams.set('client_id', 'oaiapp_retry');
    const response = await state.servers[0].dispatch(`${callback.pathname}${callback.search}`);
    assert.equal(response.status, 200);
    const signedIn = await pending;
    assert.equal(signedIn.signedIn, true);
    assert.equal(state.authorizationExchanges(), 2);
    assert.equal(service.status().accounts[0].clientId, 'oaiapp_retry');
  } finally {
    await service?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('models and complete serialize refreshes and adapt Chat Completions to Responses SSE', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'chatgpt-subscription-refresh-'));
  const state = fixture({ authExpiresIn: 0 });
  let service;
  try {
    service = await createChatGPTSubscription({
      path: join(directory, 'chatgpt.enc'),
      safeStorage: safeStorageFixture(),
      openExternal: state.openExternal,
      fetcher: state.fetcher,
      platform: 'darwin',
      serverFactory: state.serverFactory,
    });
    await signInFixture(service, state, 'oaiapp_refresh');
    const [firstModels, secondModels] = await Promise.all([service.models(), service.models()]);
    assert.deepEqual(firstModels, [{ slug: 'visible-model', display_name: 'Visible' }]);
    assert.deepEqual(secondModels, firstModels);
    assert.deepEqual(state.refreshes, ['oaiapp_refresh']);

    const result = await service.complete(
      {
        model: 'visible-model',
        messages: [
          { role: 'system', content: 'Be concise.' },
          { role: 'user', content: 'Say hello.' },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'answer', strict: true, schema: { type: 'object' } },
        },
        max_tokens: 17,
        temperature: 0,
        top_p: 0.9,
      },
      undefined,
      { clientId: 'oaiapp_refresh' },
    );
    assert.deepEqual(result, {
      choices: [{ message: { content: 'hello' } }],
      model: 'visible-model',
      usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
    });
    const request = state.requests.find(({ url }) => url === 'https://api.openai.com/v1/responses');
    assert.equal(request.options.headers.authorization, 'Bearer refreshed-oaiapp_refresh');
    const payload = JSON.parse(request.options.body);
    assert.equal(payload.store, false);
    assert.equal(payload.stream, true);
    assert.deepEqual(payload.input, [
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: 'Say hello.' },
    ]);
    assert.deepEqual(payload.text, {
      format: {
        type: 'json_schema',
        name: 'answer',
        strict: true,
        schema: { type: 'object' },
      },
    });
    assert.equal(payload.max_output_tokens, 17);
    await service.close();
  } finally {
    await service?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('select and sign-out abort in-flight inference and prevent stale success', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'chatgpt-subscription-abort-'));
  let started = 0;
  let aborted = 0;
  const state = fixture({
    responseHandler: (options) =>
      new Promise((resolve, reject) => {
        started++;
        const onAbort = () => {
          aborted++;
          reject(Object.assign(Error('aborted'), { name: 'AbortError' }));
        };
        options.signal.addEventListener('abort', onAbort, { once: true });
        options.signal.addEventListener('abort', () => resolve(), { once: true });
      }),
  });
  let service;
  try {
    service = await createChatGPTSubscription({
      path: join(directory, 'chatgpt.enc'),
      safeStorage: safeStorageFixture(),
      openExternal: state.openExternal,
      fetcher: state.fetcher,
      platform: 'darwin',
      serverFactory: state.serverFactory,
    });
    await signInFixture(service, state, 'oaiapp_abort');
    const body = { model: 'visible-model', messages: [{ role: 'user', content: 'wait' }] };
    const switched = assert.rejects(
      service.complete(body, undefined, { clientId: 'oaiapp_abort' }),
      /account changed|interrupted/i,
    );
    await waitFor(() => started === 1, 'inference did not start');
    await service.select(null);
    await switched;
    assert.equal(aborted, 1);
    assert.equal(service.status().activeClientId, null);

    await service.select('oaiapp_abort');
    const signedOut = assert.rejects(
      service.complete(body, undefined, { clientId: 'oaiapp_abort' }),
      /account changed|interrupted/i,
    );
    await waitFor(() => started === 2, 'second inference did not start');
    const signOutResult = await service.signOut('oaiapp_abort');
    await signedOut;
    assert.equal(aborted, 2);
    assert.equal(signOutResult.signedIn, false);
    assert.deepEqual(signOutResult.accounts, [
      {
        clientId: 'oaiapp_abort',
        email: 'oaiapp_abort@example.test',
        subject: 'subject-oaiapp_abort',
        signedIn: false,
      },
    ]);
    await service.close();
  } finally {
    await service?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('cancels a response body that stays open after headers on abort and sign-out', async () => {
  for (const mode of ['abort', 'signOut']) {
    const directory = await mkdtemp(join(tmpdir(), `chatgpt-subscription-stalled-${mode}-`));
    let started = 0;
    let cancelled = 0;
    const state = fixture({
      responseHandler: () => {
        started++;
        const body = new ReadableStream({ cancel: () => cancelled++ });
        return new Response(body, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      },
    });
    let service;
    try {
      service = await createChatGPTSubscription({
        path: join(directory, 'chatgpt.enc'),
        safeStorage: safeStorageFixture(),
        openExternal: state.openExternal,
        fetcher: state.fetcher,
        platform: 'darwin',
        serverFactory: state.serverFactory,
      });
      await signInFixture(service, state, `oaiapp_stalled_${mode}`);
      const clientId = `oaiapp_stalled_${mode}`;
      const abortController = new AbortController();
      const request = assert.rejects(
        service.complete(
          { model: 'visible-model', messages: [{ role: 'user', content: 'wait' }] },
          mode === 'abort' ? abortController.signal : undefined,
          { clientId },
        ),
        /interrupted|changed/i,
      );
      await waitFor(() => started === 1, 'stalled inference did not start');
      const startedAt = Date.now();
      if (mode === 'abort') abortController.abort();
      else await service.signOut(clientId);
      await request;
      assert.ok(Date.now() - startedAt < 500);
      assert.equal(cancelled, 1);
    } finally {
      await service?.close();
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test('network deadlines cover JSON response bodies that stay open after headers', async () => {
  for (const endpoint of ['discovery', 'models']) {
    const directory = await mkdtemp(
      join(tmpdir(), `chatgpt-subscription-json-timeout-${endpoint}-`),
    );
    const state = fixture();
    let stallModels = false;
    const stalledJSON = () =>
      new Response(new ReadableStream(), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    const fetcher = async (url, options) => {
      if (endpoint === 'discovery' && url === discoveryUrl) return stalledJSON();
      if (endpoint === 'models' && stallModels && url === 'https://api.openai.com/v1/models')
        return stalledJSON();
      return state.fetcher(url, options);
    };
    const watchdog = setTimeout(() => {}, 1000);
    let service;
    try {
      service = await createChatGPTSubscription({
        path: join(directory, 'chatgpt.enc'),
        safeStorage: safeStorageFixture(),
        openExternal: state.openExternal,
        fetcher,
        platform: 'darwin',
        serverFactory: state.serverFactory,
        fetchTimeoutMs: 40,
      });
      if (endpoint === 'discovery') {
        const startedAt = Date.now();
        await assert.rejects(service.signIn(), /unavailable/i);
        assert.ok(Date.now() - startedAt < 500);
      } else {
        await signInFixture(service, state, 'oaiapp_json_timeout');
        stallModels = true;
        const startedAt = Date.now();
        await assert.rejects(service.models(), /models/i);
        assert.ok(Date.now() - startedAt < 500);
      }
    } finally {
      clearTimeout(watchdog);
      await service?.close();
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test('HTTP inference failures retain safe status and supported parameter diagnostics', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'chatgpt-subscription-http-error-'));
  let failure = { detail: 'Unsupported parameter: temperature' };
  let status = 400;
  const state = fixture({ responseHandler: () => jsonResponse(failure, status) });
  let service;
  try {
    service = await createChatGPTSubscription({
      path: join(directory, 'chatgpt.enc'),
      safeStorage: safeStorageFixture(),
      openExternal: state.openExternal,
      fetcher: state.fetcher,
      platform: 'darwin',
      serverFactory: state.serverFactory,
    });
    await signInFixture(service, state, 'oaiapp_http');
    const body = { model: 'visible-model', messages: [{ role: 'user', content: 'Hello' }] };
    await assert.rejects(service.complete(body), /request parameter: temperature/);
    failure = { error: { message: 'secret-server-content', code: 'unknown' } };
    status = 403;
    await assert.rejects(service.complete(body), {
      message: 'ChatGPT Subscription request failed (HTTP 403).',
    });
    failure = { error: { code: 'subscription_sharing_usage_limit_exceeded' } };
    status = 429;
    await assert.rejects(service.complete(body), /usage limit/i);
  } finally {
    await service?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
