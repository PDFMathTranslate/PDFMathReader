// Standalone, isolated developer bridge smoke. All provider traffic is simulated.
import { app, BrowserWindow, nativeTheme } from 'electron';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../server/index.mjs';
import { createDeveloperMonitor } from '../../electron/main/services/developer-monitor.mjs';
let backend, reader, cache, monitorController;
const token = 'isolated-developer-quick-test';
let providerCalls = 0;
const wait = async (predicate) => {
  for (let i = 0; i < 160; i++) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error('Developer quick-test condition timed out');
};
async function verify() {
  let exitCode = 0;
  try {
    cache = await mkdtemp(join(tmpdir(), 'pdfmathreader-dev-quick-'));
    backend = await startServer({
      port: 0,
      development: false,
      token,
      cacheDir: cache,
      enginesRoot: join(cache, 'engines'),
      getApiKey: () => 'synthetic-only',
      providerFetch: async (_url, { body }) => {
        providerCalls++;
        assert.ok(body);
        await new Promise((resolve) => setTimeout(resolve, 150));
        return Response.json({ choices: [{ message: { content: 'Exemple de traduction.' } }] });
      },
      localTranslationImpl: { available: async () => false, close: async () => {} },
    });
    reader = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: fileURLToPath(new URL('../../electron/preload.cjs', import.meta.url)),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const preferences = {
      engine: 'pdf_inspector',
      language: 'French',
      sourceLanguage: 'English',
      concurrency: 2,
      pageConcurrency: 2,
      uiLanguage: 'en',
      translationServices: {
        pdf_inspector: {
          id: 'openai',
          values: { model: 'synthetic-model', base_url: 'https://api.openai.com/v1' },
        },
      },
      kernelAdvancedOptions: {},
    };
    const windows = new Map([[reader, { backend, preferences }]]);
    monitorController = createDeveloperMonitor({
      windows,
      token,
      loadServiceCredentials: async () => ({
        pdf_inspector: { openai: { key: 'synthetic-only' } },
      }),
    });
    reader.webContents.session.webRequest.onBeforeSendHeaders(
      { urls: [backend.origin + '/*'] },
      (details, reply) =>
        reply({ requestHeaders: { ...details.requestHeaders, 'X-Preview-Token': token } }),
    );
    await reader.loadURL(backend.origin + '/api/config');
    await reader.webContents.executeJavaScript('window.previewDeveloper.open()');
    const monitor = BrowserWindow.getAllWindows().find((target) => target !== reader);
    assert.ok(monitor);
    const evaluate = (code) => monitor.webContents.executeJavaScript(code);
    await wait(() => evaluate('!!document.querySelector(".developer-quick-tests")'));
    assert.equal(
      await reader.webContents.executeJavaScript(
        'window.previewDeveloper.testContext().then(()=>false,()=>true)',
      ),
      true,
      'Readers cannot invoke test bridge',
    );
    const context = await evaluate('window.previewDeveloper.testContext()');
    assert.equal(context.engine, 'pdf_inspector');
    assert.equal(context.providerId, 'openai');
    assert.ok(!JSON.stringify(context).includes('synthetic-only'));
    await wait(() =>
      evaluate(
        'document.querySelectorAll(".test-action").length===3 && !document.querySelector(".test-action").disabled',
      ),
    );
    await evaluate('document.querySelectorAll(".test-action")[0].click()');
    await wait(async () => {
      const run = await evaluate('window.previewDeveloper.testStatus()');
      return run?.kind === 'kernel' && !run.running;
    });
    assert.equal(
      (await evaluate('window.previewDeveloper.testStatus()')).results[0].status,
      'success',
    );
    assert.equal(providerCalls, 0, 'Kernel test performs no external provider call');
    await wait(() => evaluate('!document.querySelector(".test-action").disabled'));
    await evaluate('document.querySelectorAll(".test-action")[1].click()');
    await wait(async () => {
      const run = await evaluate('window.previewDeveloper.testStatus()');
      return run?.kind === 'provider' && !run.running;
    });
    assert.equal(
      (await evaluate('window.previewDeveloper.testStatus()')).results[0].status,
      'success',
    );
    assert.equal(providerCalls, 1);
    await wait(() => evaluate('!document.querySelector(".test-action").disabled'));
    await evaluate('document.querySelectorAll(".test-action")[2].click()');
    await wait(async () => {
      const run = await evaluate('window.previewDeveloper.testStatus()');
      return run?.kind === 'batch' && !run.running;
    });
    await wait(() => evaluate('document.querySelectorAll(".result-status--success").length===2'));
    const batch = await evaluate('window.previewDeveloper.testStatus()');
    assert.equal(batch.results.length, 2);
    assert.ok(batch.results.every((result) => result.status === 'success'));
    assert.equal(providerCalls, 3);
    assert.equal(preferences.translationServices.pdf_inspector.id, 'openai');
    // Reload also verifies restoration of existing run results in the component.
    await monitor.webContents.reload();
    await wait(() => evaluate('!!document.querySelector(".developer-quick-tests")'));
    await new Promise((resolve) => setTimeout(resolve, 650));
    for (const mode of ['light', 'dark']) {
      nativeTheme.themeSource = mode;
      await new Promise((resolve) => setTimeout(resolve, 150));
      await writeFile(
        `/tmp/pdfmathreader-developer-tests-${mode}.png`,
        (await monitor.webContents.capturePage()).toPNG(),
      );
    }
    monitor.setSize(780, 600);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const overflow = await evaluate(
      '(()=>{const el=document.querySelector(".developer-window");return el.scrollWidth>el.clientWidth;})()',
    );
    assert.equal(
      overflow,
      false,
      'Developer content does not overflow horizontally at minimum width',
    );
    await evaluate('window.previewDeveloper.runTest({kind:"batch"})');
    await evaluate('window.previewDeveloper.cancelTest()');
    await wait(async () => !(await evaluate('window.previewDeveloper.testStatus()')).running);
    assert.ok(
      (await evaluate('window.previewDeveloper.testStatus()')).results.some(
        (result) => result.status === 'cancelled',
      ),
    );
    console.log(
      'Developer quick tests passed: authorized IPC, frozen settings, kernel PDF extraction, current provider, batch, cancellation, no credential exposure, compact layout.',
    );
  } catch (error) {
    exitCode = 1;
    console.error(error.stack || error);
  } finally {
    monitorController?.close();
    reader?.destroy();
    await backend?.close();
    if (cache) await rm(cache, { recursive: true, force: true });
    app.exit(exitCode);
  }
}
app
  .whenReady()
  .then(verify)
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
