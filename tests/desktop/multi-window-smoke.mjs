import assert from 'node:assert/strict';
import { app } from 'electron';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFile, mkdtemp, rm, symlink } from 'node:fs/promises';

export async function verifyMultiWindow(first, windows, createWindow) {
  const wait = async (window, expression) => {
    for (let i = 0; i < 200; i++) {
      if (await window.webContents.executeJavaScript(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw Error('Multi-window check timed out: ' + expression);
  };
  const sample = (window) =>
    window.webContents.executeJavaScript(
      "document.querySelector('.empty > button:not(.primary)').click()",
    );
  await wait(first, "!!document.querySelector('.empty > button:not(.primary)')");
  await sample(first);
  await wait(first, 'window.previewRenderDiagnostics?.().totalPages>0');
  const firstState = windows.get(first),
    firstPages = await first.webContents.executeJavaScript(
      'window.previewRenderDiagnostics().totalPages',
    );
  // Opening a second PDF from the existing reader must create a new window.
  await first.webContents.executeJavaScript(
    `(async()=>{const bytes=new Uint8Array(await (await fetch('/sample.pdf')).arrayBuffer());const input=document.querySelector('input[type=file]'),data=new DataTransfer();data.items.add(new File([bytes],'A quieter way to read.pdf',{type:'application/pdf'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  for (let i = 0; i < 100 && windows.size < 2; i++)
    await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(windows.size, 2);
  const second = [...windows.keys()].find((window) => window !== first);
  await wait(second, 'window.previewRenderDiagnostics?.().totalPages>0');
  const secondState = windows.get(second);
  assert.notEqual(first.webContents.getOSProcessId(), second.webContents.getOSProcessId());
  assert.notEqual(firstState.backend.processId, secondState.backend.processId);
  assert.notEqual(firstState.backend.origin, secondState.backend.origin);
  assert.equal(
    await first.webContents.executeJavaScript('window.previewRenderDiagnostics().totalPages'),
    firstPages,
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  await second.webContents.executeJavaScript(
    "window.previewPreferences.save({direction:'horizontal',columns:2,fit:'width',zoom:1,translationMode:'reading'})",
  );
  assert.equal(
    await first.webContents.executeJavaScript(
      'window.previewPreferences.load().then(state=>state.direction)',
    ),
    'vertical',
  );
  assert.equal(
    await second.webContents.executeJavaScript(
      'window.previewPreferences.load().then(state=>state.direction)',
    ),
    'horizontal',
  );
  // Each window's IPC must report its own activity.
  second.hide();
  first.show();
  first.focus();
  await wait(first, 'window.previewActivity.current()');
  await wait(second, 'window.previewActivity.current().then(active=>!active)');
  assert.equal(
    await second.webContents.executeJavaScript('window.previewActivity.current()'),
    false,
  );
  assert.equal(await first.webContents.executeJavaScript('window.previewActivity.current()'), true);
  second.show();
  // Closing a document only clears that window.
  // Use the same menu action exposed to this renderer by the desktop shell.
  second.webContents.send('reader:action', 'close-document');
  await wait(second, 'window.previewRenderDiagnostics?.().totalPages===0');
  assert.equal(
    await first.webContents.executeJavaScript('window.previewRenderDiagnostics().totalPages'),
    firstPages,
  );
  // A file opened from a reader must fill an existing start page.
  for (let i = 0; i < 100 && secondState.performance.hasDocument; i++)
    await new Promise((resolve) => setTimeout(resolve, 50));
  await first.webContents.executeJavaScript(
    `(async()=>{const bytes=new Uint8Array(await (await fetch('/sample.pdf')).arrayBuffer());await window.previewDocuments.open(new File([bytes],'A quieter way to read.pdf',{type:'application/pdf'}));})()`,
  );
  await wait(second, 'window.previewRenderDiagnostics?.().totalPages>0');
  assert.equal(windows.size, 2);
  assert.equal(windows.get(second).backend, secondState.backend);
  second.webContents.send('reader:action', 'close-document');
  await wait(second, 'window.previewRenderDiagnostics?.().totalPages===0');
  // Closing a native window stops its backend but leaves its sibling running.
  await new Promise((resolve) => setTimeout(resolve, 400));
  second.webContents.send('reader:action', 'close-document');
  for (let i = 0; i < 100 && windows.has(second); i++)
    await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(windows.size, 1);
  assert.equal(first.isDestroyed(), false);
  assert.equal(
    await first.webContents.executeJavaScript("fetch('/api/config').then(r=>r.status)"),
    200,
  );
  const bytes = await first.webContents.executeJavaScript(
    "fetch('/sample.pdf').then(r=>r.arrayBuffer()).then(b=>Array.from(new Uint8Array(b)))",
  );
  const folder = await mkdtemp(join(tmpdir(), 'multi-window-'));
  const path = join(folder, 'Portrait and landscape.pdf');
  await writeFile(path, new Uint8Array(bytes));
  app.emit('second-instance', {}, [app.getPath('exe'), path], '/tmp');
  for (let i = 0; i < 100 && windows.size < 2; i++)
    await new Promise((resolve) => setTimeout(resolve, 50));
  const delivered = [...windows.keys()].find((window) => window !== first);
  assert.ok(delivered);
  await wait(delivered, 'window.previewRenderDiagnostics?.().totalPages>0');
  assert.equal(
    await first.webContents.executeJavaScript('window.previewRenderDiagnostics().totalPages'),
    firstPages,
  );
  const recentId = await first.webContents.executeJavaScript(
    "window.previewRecents.list().then(entries=>entries.find(entry=>entry.name==='Portrait and landscape.pdf')?.id)",
  );
  assert.ok(recentId);
  const assertDelivered = async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await wait(delivered, 'window.previewRenderDiagnostics?.().totalPages>0');
    assert.equal(windows.size, 2);
    assert.equal(
      [...windows.keys()].find((window) => window !== first),
      delivered,
    );
  };
  app.emit('open-file', { preventDefault() {} }, path);
  app.emit('open-file', { preventDefault() {} }, path);
  await assertDelivered();
  app.emit('second-instance', {}, [app.getPath('exe'), path], '/tmp');
  app.emit('second-instance', {}, [app.getPath('exe'), path], '/tmp');
  await assertDelivered();
  const alias = join(folder, 'Portrait and landscape alias.pdf');
  await symlink(path, alias);
  app.emit('second-instance', {}, [app.getPath('exe'), alias], '/tmp');
  await assertDelivered();
  const empty = await createWindow();
  await wait(empty, "!!document.querySelector('.empty')");
  const recentOpen = await empty.webContents.executeJavaScript(
    `window.previewRecents.open(${JSON.stringify(recentId)})`,
  );
  assert.equal(recentOpen, null);
  await new Promise((resolve) => setTimeout(resolve, 250));
  await wait(empty, "!!document.querySelector('.empty')");
  assert.equal(windows.size, 3);
  empty.close();
  for (let i = 0; i < 100 && windows.has(empty); i++)
    await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(windows.size, 2);
  delivered.close();
  for (let i = 0; i < 100 && windows.has(delivered); i++)
    await new Promise((resolve) => setTimeout(resolve, 50));
  await first.webContents.executeJavaScript(
    `window.previewRecents.openWindow(${JSON.stringify(recentId)})`,
  );
  const recentWindow = [...windows.keys()].find((window) => window !== first);
  await wait(recentWindow, 'window.previewRenderDiagnostics?.().totalPages>0');
  assert.equal(
    await first.webContents.executeJavaScript('window.previewRenderDiagnostics().totalPages'),
    firstPages,
  );
  recentWindow.close();
  for (let i = 0; i < 100 && windows.has(recentWindow); i++)
    await new Promise((resolve) => setTimeout(resolve, 50));
  const third = await createWindow();
  await wait(third, "!!document.querySelector('.empty')");
  assert.equal(windows.size, 2);
  const thirdBackend = windows.get(third).backend;
  const returnToStart = async () => {
    third.show();
    third.focus();
    third.webContents.send('reader:action', 'close-document');
    await wait(third, 'window.previewRenderDiagnostics?.().totalPages===0');
    await wait(third, "!document.querySelector('.workspace.document-closing')");
    for (let i = 0; i < 100 && windows.get(third).performance.hasDocument; i++)
      await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(windows.get(third).performance.hasDocument, false);
  };
  const createBlankExtras = async () => {
    const extras = [];
    for (let i = 0; i < 2; i++) {
      const extra = await createWindow();
      await wait(extra, "!!document.querySelector('.empty')");
      extras.push(extra);
    }
    third.show();
    third.focus();
    return extras;
  };
  const waitRemoved = async (extras) => {
    for (const extra of extras) {
      for (let i = 0; i < 100 && windows.has(extra); i++)
        await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(windows.has(extra), false);
    }
  };
  const secondInstanceExtras = await createBlankExtras();
  app.emit('second-instance', {}, [app.getPath('exe'), path], '/tmp');
  await wait(third, 'window.previewRenderDiagnostics?.().totalPages>0');
  await waitRemoved(secondInstanceExtras);
  assert.equal(windows.size, 2);
  assert.equal(windows.get(third).backend, thirdBackend);
  assert.equal(
    await first.webContents.executeJavaScript('window.previewRenderDiagnostics().totalPages'),
    firstPages,
  );
  await returnToStart();
  const openFileExtras = await createBlankExtras();
  app.emit('open-file', { preventDefault() {} }, path);
  await wait(third, 'window.previewRenderDiagnostics?.().totalPages>0');
  await waitRemoved(openFileExtras);
  assert.equal(windows.size, 2);
  assert.equal(windows.get(third).backend, thirdBackend);
  assert.equal(
    await first.webContents.executeJavaScript('window.previewRenderDiagnostics().totalPages'),
    firstPages,
  );
  await returnToStart();
  await first.webContents.executeJavaScript(
    `window.previewRecents.openWindow(${JSON.stringify(recentId)})`,
  );
  await wait(third, 'window.previewRenderDiagnostics?.().totalPages>0');
  assert.equal(windows.size, 2);
  await returnToStart();
  assert.equal(windows.get(third).backend, thirdBackend);
  assert.equal(
    await first.webContents.executeJavaScript('window.previewRenderDiagnostics().totalPages'),
    firstPages,
  );
  await rm(folder, { recursive: true, force: true });
  const result = {
    passed: true,
    independentRendererProcesses: true,
    independentBackendProcesses: true,
    secondPDFPreservesFirst: true,
    ipcScopedToWindow: true,
    closeDocumentIsolated: true,
    closeWindowIsolated: true,
    newWindow: true,
    secondInstanceDeliveryIsolated: true,
    recentDocumentDeliveryIsolated: true,
    windowPreferencesIsolated: true,
    filePickerReusesStartPage: true,
    secondInstanceReusesStartPage: true,
    openFileReusesStartPage: true,
    recentsReuseStartPage: true,
    repeatedOpenFileReusesDeliveredWindow: true,
    concurrentSecondInstanceReusesDeliveredWindow: true,
    symlinkAliasReusesDeliveredWindow: true,
    recentOpenReturnsNullOnEmptyStartPage: true,
    emptyStartPagePreserved: true,
    secondInstanceClosesOtherBlankStartPages: true,
    openFileClosesOtherBlankStartPages: true,
  };
  first.webContents.send('reader:action', 'close-document');
  await wait(first, 'window.previewRenderDiagnostics?.().totalPages===0');
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal(windows.get(first).performance.hasDocument, false);
  third.show();
  third.focus();
  await wait(third, "!document.querySelector('.workspace.document-closing')");
  const quitting = new Promise((resolve) => app.once('before-quit', resolve));
  third.webContents.send('reader:action', 'close-document');
  await Promise.race([
    quitting,
    new Promise((_, reject) => {
      const timer = setTimeout(
        () => reject(Error('Start-page close did not quit with only empty windows remaining.')),
        5000,
      );
      timer.unref();
    }),
  ]);
  result.startPageCloseQuitsWithoutDocuments = true;
  await writeFile('/tmp/preview-multi-window-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
