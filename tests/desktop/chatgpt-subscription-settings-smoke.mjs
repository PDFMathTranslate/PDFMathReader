import { app, BrowserWindow, ipcMain } from 'electron';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startBackendService } from '../../electron/main/backend/backend-service.mjs';
async function main() {
  let smokeExitCode = 0;
  const signInRequests = [];
  const directory = await mkdtemp(join(tmpdir(), 'pdfmathreader-subscription-ui-'));
  app.setPath('userData', directory);
  let backend,
    window,
    signedIn = true,
    authPending = false,
    modelRequests = 0;
  const status = () => ({
    available: true,
    signedIn,
    pending: authPending,
    storageAvailable: true,
    activeClientId: 'oaiapp_ui',
    accounts: [{ clientId: 'oaiapp_ui', email: 'fixture@example.test', signedIn }],
  });
  const timeout = setTimeout(() => {
    console.error('UI smoke timed out');
    app.exit(1);
  }, 30000);
  try {
    await app.whenReady();
    backend = await startBackendService({
      port: 0,
      development: false,
      cacheDir: join(directory, 'cache'),
      token: 'ui-test',
      chatGPTSubscription: {
        status,
        complete: async () => {
          throw Error('No inference during UI test');
        },
      },
    });
    ipcMain.handle('fixture:status', status);
    ipcMain.handle('fixture:models', () => {
      modelRequests++;
      return [
        { slug: 'fixture-model', display_name: 'Fixture Model Display Name' },
        { slug: 'fixture-model-2', display_name: 'Second Model' },
      ];
    });
    ipcMain.handle('fixture:signOut', () => {
      signedIn = false;
      window.webContents.send('fixture:changed');
      return status();
    });
    ipcMain.handle('fixture:signIn', async (_event, value) => {
      signInRequests.push(value);
      authPending = true;
      window.webContents.send('fixture:changed');
      await new Promise((resolve) => setTimeout(resolve, 800));
      authPending = false;
      signedIn = true;
      window.webContents.send('fixture:changed');
      window.webContents.send('fixture:signedIn');
      return status();
    });
    const preload = join(directory, 'preload.cjs');
    await writeFile(
      preload,
      `const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('previewChatGPTSubscription',{status:()=>ipcRenderer.invoke('fixture:status'),models:()=>ipcRenderer.invoke('fixture:models'),signOut:()=>ipcRenderer.invoke('fixture:signOut'),signIn:(value)=>ipcRenderer.invoke('fixture:signIn',value),select:()=>ipcRenderer.invoke('fixture:status'),cancel:()=>ipcRenderer.invoke('fixture:status'),onSignedIn:(cb)=>{const listener=()=>cb();ipcRenderer.on('fixture:signedIn',listener);return ()=>ipcRenderer.removeListener('fixture:signedIn',listener);},onChanged:(cb)=>{const listener=()=>cb();ipcRenderer.on('fixture:changed',listener);return ()=>ipcRenderer.removeListener('fixture:changed',listener);}});
contextBridge.exposeInMainWorld('previewAppearance',{platform:'darwin',contentGlass:false,current:()=>Promise.resolve({platform:'darwin',contentGlass:false}),onChange:()=>()=>{}});
contextBridge.exposeInMainWorld('previewPreferences',{load:()=>Promise.resolve({engine:'pdf_inspector',uiLanguage:'en',translationServices:{pdf_inspector:{id:'auto',profiles:{'chatgpt-subscription':{values:{model:'fixture-model'}}}}}}),save:()=>Promise.resolve(),onChange:()=>()=>{}});`,
    );
    window = new BrowserWindow({
      show: false,
      width: 1000,
      height: 800,
      webPreferences: { preload, contextIsolation: true, sandbox: true },
    });
    window.webContents.session.webRequest.onBeforeSendHeaders(
      { urls: [backend.origin + '/*'] },
      (details, callback) =>
        callback({ requestHeaders: { ...details.requestHeaders, 'X-Preview-Token': 'ui-test' } }),
    );
    const run = (code) => window.webContents.executeJavaScript(code);
    const wait = async (code) => {
      for (let i = 0; i < 150; i++) {
        if (await run(code)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw Error('UI wait failed: ' + code);
    };
    await window.loadURL(backend.origin + '/?settingsWindow=1&section=providers');
    await wait(
      `window.previewReady === true && !!document.querySelector('[data-provider-id="chatgpt-subscription"]')`,
    );
    await run(`document.querySelector('[data-provider-id="chatgpt-subscription"]').click()`);
    await wait(
      `!!document.querySelector('.provider-detail .subscription-model') && document.querySelector('.provider-detail').textContent.includes('Fixture Model Display Name')`,
    );
    assert.ok(modelRequests > 0);
    assert.equal(await run(`!!document.querySelector('.subscription-badge')`), false);
    assert.equal(await run(`!!document.querySelector('.copy-toast')`), false);
    assert.match(
      await run(`document.querySelector('.subscription-heading').textContent`),
      /ChatGPT Subscription/,
    );
    assert.equal(await run(`document.querySelector('.provider-use-button').disabled`), false);
    await run(
      `(()=>{const buttons=[...document.querySelectorAll('.provider-detail button')];buttons.find(b=>b.textContent.trim()==='Add account').click();})()`,
    );
    await wait(`!!document.querySelector('.subscription-guidance.is-pending')`);
    assert.match(
      await run(`document.querySelector('.subscription-guidance').textContent`),
      /default browser.*translation service/,
    );
    await writeFile(
      '/private/tmp/pdfmathreader-subscription-pending.png',
      (await window.webContents.capturePage()).toPNG(),
    );
    await wait(
      `document.querySelector('.provider-detail').textContent.includes('Fixture Model Display Name') && !document.querySelector('.provider-detail').textContent.includes('Finish signing in')`,
    );
    await wait(
      `document.querySelector('.copy-toast')?.textContent.includes('Signed in. You can now choose ChatGPT Subscription as a translation service.')`,
    );
    assert.deepEqual(signInRequests.at(-1), { clientId: '' });
    await run(`document.querySelector('.provider-use-button').click()`);
    await wait(
      `document.querySelector('[data-provider-id="chatgpt-subscription"]').getAttribute('aria-current') === 'true'`,
    );
    await run(
      `(()=>{const buttons=[...document.querySelectorAll('.provider-detail .subscription-account-actions button')];buttons.find(b=>b.textContent.trim()==='Sign out').click();})()`,
    );
    await wait(
      `document.querySelector('.provider-detail').textContent.includes('Continue with ChatGPT') && !document.querySelector('.provider-detail .subscription-model')`,
    );
    await run(
      `(()=>{const buttons=[...document.querySelectorAll('.provider-detail button')];buttons.find(b=>b.textContent.trim()==='Continue with ChatGPT').click();})()`,
    );
    await wait(
      `document.querySelector('.provider-detail').textContent.includes('Fixture Model Display Name')`,
    );
    assert.deepEqual(signInRequests.at(-1), { clientId: 'oaiapp_ui' });
    await run(
      `([...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Experimental Features')).click()`,
    );
    await wait(`!!document.querySelector('.chatgpt-subscription-feature .subscription-heading')`);
    await run(`window.previewChatGPTSubscription.signOut('oaiapp_ui')`);
    await wait(
      `!![...document.querySelectorAll('.chatgpt-subscription-feature button')].find(b=>b.textContent.trim()==='Continue with ChatGPT')`,
    );
    await run(
      `([...document.querySelectorAll('.chatgpt-subscription-feature button')].find(b=>b.textContent.trim()==='Continue with ChatGPT')).click()`,
    );
    await wait(
      `!!document.querySelector('.chatgpt-subscription-feature .subscription-guidance.is-pending')`,
    );
    assert.equal(
      await run(
        `!![...document.querySelectorAll('.chatgpt-subscription-feature button')].find(b=>b.textContent.trim()==='Continue with ChatGPT')`,
      ),
      false,
    );
    await writeFile(
      '/private/tmp/pdfmathreader-subscription-pending.png',
      (await window.webContents.capturePage()).toPNG(),
    );
    await wait(
      `!document.querySelector('.subscription-guidance.is-pending') && document.querySelector('.chatgpt-subscription-feature').textContent.includes('Signed in')`,
    );
    await writeFile(
      '/private/tmp/pdfmathreader-subscription-settings.png',
      (await window.webContents.capturePage()).toPNG(),
    );
    console.log(
      'Settings UI smoke passed: simplified heading and combined guidance, login success toast, model catalog, activation, and account actions.',
    );
  } catch (error) {
    console.error(error);
    smokeExitCode = 1;
  } finally {
    window?.destroy();
    await backend?.close();
    await rm(directory, { recursive: true, force: true });
    clearTimeout(timeout);
    app.exit(smokeExitCode);
  }
}
void main();
