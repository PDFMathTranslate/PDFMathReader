import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createTranslationRuntime } from '../../../server/translation/provider-runtime.mjs';
import { registerKernelRoutes } from '../../../server/http/kernel-routes.mjs';
import { registerProxyRoutes } from '../../../server/http/proxy-routes.mjs';
import { normalizeTranslationServiceSchema } from '../../../shared/translation/service-schema.mjs';
import { configuredMenuServices } from '../../../shared/commands/menu-options.mjs';

function fixture() {
  let signedIn = true;
  const calls = [];
  const subscription = {
    status: async () => ({ signedIn, activeClientId: 'oaiapp_fixture' }),
    complete: async (body, signal, options) => {
      signal.throwIfAborted();
      calls.push({ body, options });
      return { model: body.model, choices: [{ message: { content: '译文 {{v0}}' } }] };
    },
  };
  const engines = { services: async (id) => ({ id, services: [] }) };
  const runtime = createTranslationRuntime({
    engines,
    localTranslator: { available: async () => false },
    chatGPTSubscription: subscription,
    providerFetch: () => {
      throw Error('Must not fall back to another provider');
    },
    sessionId: 'test',
  });
  return {
    runtime,
    engines,
    calls,
    setSignedIn: (value) => {
      signedIn = value;
    },
  };
}

test('subscription catalog and completions work for every kernel without exposing credentials', async () => {
  const { runtime, calls, setSignedIn } = fixture();
  for (const kernel of ['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise']) {
    const catalog = normalizeTranslationServiceSchema(
      await runtime.translationServices(kernel),
      kernel,
    );
    const service = catalog.services.find((item) => item.id === 'chatgpt-subscription');
    assert.equal(service.available, true);
    assert.equal(
      service.fields.some((field) => field.secret),
      false,
    );
    const provider = await runtime.providerFor(
      { id: service.id, values: { model: 'account-model' } },
      kernel,
      'English',
      'Simplified Chinese',
    );
    assert.equal(provider.native, undefined);
    assert.equal(provider.key, undefined);
    const result = await (
      await runtime.complete(
        provider,
        {
          messages: [{ role: 'user', content: 'Translate {{v0}}' }],
          sourceText: 'unused',
        },
        new AbortController().signal,
      )
    ).json();
    assert.equal(result.choices[0].message.content, '译文 {{v0}}');
    assert.deepEqual(calls.at(-1).options, { clientId: 'oaiapp_fixture' });
    assert.equal(calls.at(-1).body.model, 'account-model');
    assert.equal(calls.at(-1).body.sourceText, undefined);
  }
  setSignedIn(false);
  const signedOutCatalog = await runtime.translationServices('pdf_inspector');
  assert.equal(
    configuredMenuServices(signedOutCatalog, {
      id: 'chatgpt-subscription',
      values: { model: 'account-model' },
    }).some((item) => item.value === 'chatgpt-subscription'),
    false,
  );
  await assert.rejects(
    runtime.providerFor({ id: 'chatgpt-subscription', values: { model: 'x' } }, 'pdf_inspector'),
    /Sign in/,
  );
  setSignedIn(true);
  await assert.rejects(
    runtime.providerFor({ id: 'chatgpt-subscription' }, 'pdf_inspector'),
    /Choose/,
  );
});

test('Fast and Precise use the authenticated OpenAI proxy for subscription translations', async (t) => {
  const { runtime, engines, calls } = fixture();
  const app = express();
  const jobs = new Map();
  const limiter = { setMax() {}, run: (fn) => fn() };
  let origin;
  engines.translate = async (options) => {
    assert.equal(options.translationService, undefined);
    assert.equal(options.model, 'account-model');
    assert.deepEqual(options.serviceIdentity, {
      service: 'chatgpt-subscription',
      clientId: 'oaiapp_fixture',
      model: 'account-model',
    });
    assert.match(options.proxy.token, /^[a-f0-9]{64}$/);
    const response = await fetch(options.proxy.url + '/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + options.proxy.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Translate {{v0}}' }],
        stream: true,
      }),
    });
    assert.equal(response.status, 200);
    const events = await response.text();
    assert.match(events, /译文/);
    assert.match(events, /\[DONE\]/);
    const bytes = Buffer.from('%PDF-fixture');
    Object.assign(bytes, { layoutKey: 'layout', cached: false, translationModel: options.model });
    return bytes;
  };
  registerProxyRoutes(app, { limiter, proxyJobs: jobs, providerClient: runtime.providerClient });
  registerKernelRoutes(app, {
    engines,
    providerRuntime: runtime,
    cacheManager: { runTask: (_label, task) => task() },
    documentRequest: () => ({ bytes: Buffer.from('%PDF-test') }),
    documentCache: { scope: async () => '' },
    limiter,
    pageLimiter: limiter,
    proxyJobs: jobs,
    origin: () => origin,
    kernelReports: [],
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((resolve) => server.close(resolve)));
  for (const engine of ['pdf_math_fast', 'pdf_math_precise']) {
    const response = await fetch(
      `${origin}/api/math-page?engine=${engine}&page=1&language=English`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          translationService: { id: 'chatgpt-subscription', values: { model: 'account-model' } },
        }),
      },
    );
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get('X-Translation-Service'), 'chatgpt-subscription');
    assert.equal(response.headers.get('X-Translation-Outcome'), 'success');
    assert.equal(jobs.size, 0);
  }
  assert.equal(calls.length, 2);
});
