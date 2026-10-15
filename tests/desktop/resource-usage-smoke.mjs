import assert from 'node:assert/strict';
import { app } from 'electron';
export async function verifyResourceUsage(window) {
  const evaluate = (code) => window.webContents.executeJavaScript(code);
  const wait = async (predicate) => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(predicate)) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error(
      'Resource usage state timed out: ' +
        predicate +
        ' ' +
        JSON.stringify({
          focused: window.isFocused(),
          visible: window.isVisible(),
          minimized: window.isMinimized(),
          diagnostics: await evaluate('window.previewRenderDiagnostics()'),
        }),
    );
  };
  await wait('window.previewReady===true');
  assert.equal(
    await evaluate('window.previewPreferences.load().then(p=>p.reduceResourceUsage)'),
    true,
  );
  assert.equal(window.webContents.getBackgroundThrottling(), true);
  await evaluate('window.previewPreferences.save({reduceBackgroundFrameRate:false})');
  assert.equal(window.webContents.getBackgroundThrottling(), false);
  await evaluate('window.previewPreferences.save({reduceBackgroundFrameRate:true})');
  assert.equal(window.webContents.getBackgroundThrottling(), true);
  await evaluate(
    "document.querySelector('.empty .sample')?.click() || [...document.querySelectorAll('button')].find(b=>b.textContent.includes('sample'))?.click()",
  );
  await wait('window.previewRenderDiagnostics().residentBytes>0');
  const before = await evaluate('window.previewRenderDiagnostics()');
  window.minimize();
  await wait(
    'window.previewRenderDiagnostics().foreground===false && window.previewRenderDiagnostics().residentBytes===0 && window.previewRenderDiagnostics().cache.bytes===0',
  );
  window.restore();
  window.show();
  window.focus();
  await wait(
    'window.previewRenderDiagnostics().foreground===true && window.previewRenderDiagnostics().residentBytes>0',
  );
  // A lone macOS window can immediately regain focus after blur(). Hiding it
  // gives this preference check a stable inactive state; tabs smoke covers blur.
  window.hide();
  await wait('window.previewRenderDiagnostics().foreground===false');
  await evaluate('window.previewPreferences.save({reduceResourceUsage:false})');
  // The sender owns its reactive setting; emulate another window's settings broadcast.
  window.webContents.send('preferences:changed', { reduceResourceUsage: false });
  await wait('window.previewRenderDiagnostics().foreground===true');
  window.webContents.send('preferences:changed', { reduceResourceUsage: true });
  await wait('window.previewRenderDiagnostics().foreground===false');
  window.show();
  window.focus();
  await wait(
    'window.previewRenderDiagnostics().foreground===true && window.previewRenderDiagnostics().residentBytes>0',
  );
  assert.equal((await evaluate('window.previewRenderDiagnostics()')).active, before.active);
  console.log(
    'Resource usage smoke passed:',
    JSON.stringify({
      beforeBitmapBytes: before.residentBytes,
      beforeCacheBytes: before.cache.bytes,
      backgroundBitmapBytes: 0,
      backgroundCacheBytes: 0,
    }),
  );
  app.quit();
}
