import { app } from 'electron';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startBackendService } from '../../electron/main/backend/backend-service.mjs';
async function main() {
  let smokeExitCode = 0;
  const dir = await mkdtemp(join(tmpdir(), 'pdfmathreader-subscription-broker-'));
  app.setPath('userData', dir);
  let backend;
  let completions = 0;
  let cancelled = false;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    console.error('Broker smoke timed out');
    app.exit(1);
  }, 30000);
  try {
    await app.whenReady();
    backend = await startBackendService({
      port: 0,
      development: false,
      cacheDir: join(dir, 'cache'),
      token: 'test-broker',
      chatGPTSubscription: {
        status: () => ({ signedIn: true, activeClientId: 'oaiapp_broker' }),
        complete: async (body, signal, options) => {
          assert.equal(options.clientId, 'oaiapp_broker');
          assert.equal(body.model, 'broker-model');
          completions++;
          if (completions === 2) {
            controller.abort();
            await new Promise((resolve, reject) => {
              signal.addEventListener(
                'abort',
                () => {
                  cancelled = true;
                  reject(Error('Cancelled fixture'));
                },
                { once: true },
              );
              setTimeout(
                () => reject(Error('Cancellation did not reach main process')),
                3000,
              ).unref();
            });
          }
          return { model: body.model, choices: [{ message: { content: 'Broker translation' } }] };
        },
      },
    });
    const headers = { 'X-Preview-Token': 'test-broker', 'Content-Type': 'application/json' };
    const catalog = await (
      await fetch(backend.origin + '/api/engines/pdf_inspector/services', { headers })
    ).json();
    assert.equal(catalog.services.find((x) => x.id === 'chatgpt-subscription').available, true);
    const body = JSON.stringify({
      text: 'Translate this',
      language: 'English',
      reuseTranslations: false,
      translationService: { id: 'chatgpt-subscription', values: { model: 'broker-model' } },
    });
    const response = await fetch(backend.origin + '/api/translate', {
      method: 'POST',
      headers,
      body,
    });
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal((await response.json()).translation, 'Broker translation');
    await assert.rejects(
      fetch(backend.origin + '/api/translate', {
        method: 'POST',
        headers,
        body: body.replace('Translate this', 'Translate another paragraph'),
        signal: controller.signal,
      }),
    );
    for (let i = 0; i < 30 && !cancelled; i++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(cancelled, true);
    console.log(
      'Electron broker smoke passed: catalog, completion, account binding, and cancellation through real utility-process IPC.',
    );
  } catch (error) {
    console.error(error);
    smokeExitCode = 1;
  } finally {
    await backend?.close();
    await rm(dir, { recursive: true, force: true });
    clearTimeout(timer);
    app.exit(smokeExitCode);
  }
}
void main();
