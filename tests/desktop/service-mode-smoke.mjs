import assert from 'node:assert/strict';
import { app } from 'electron';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function verifyServiceMode(first, backend, token, windows, createWindow) {
  const run = (target, code) => target.webContents.executeJavaScript(code);
  const wait = async (target, code, label = code) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      try {
        if (await run(target, code)) return;
      } catch {}
      await pause(100);
    }
    throw Error(
      `Service mode smoke timed out: ${label} (${JSON.stringify(await run(target, 'window.previewRenderDiagnostics?.()'))})`,
    );
  };
  const waitNative = async (predicate, label, details) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (predicate()) return;
      await pause(100);
    }
    const suffix = details ? ` (${details()})` : '';
    throw Error(`Service mode native state timed out: ${label}${suffix}`);
  };
  const waitReaderTask = async (state, taskId, label) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const response = await fetch(
        `${state.backend.origin}/api/reader-tasks/${encodeURIComponent(taskId)}`,
        { headers: { 'X-Preview-Token': token } },
      );
      if (response.ok) {
        const status = await response.json();
        if (status.state === 'complete' || status.state === 'failed') return status;
      }
      await pause(100);
    }
    throw Error(`Service mode reader task timed out: ${label}`);
  };
  const rendererPids = () => new Set(app.getAppMetrics().map((metric) => metric.pid));
  const waitRendererGone = async (pids, label) =>
    waitNative(() => [...pids].every((pid) => !rendererPids().has(pid)), label);
  const snapshot = (target) => run(target, 'window.previewRenderDiagnostics()');
  const waitDocument = (target, label) =>
    wait(
      target,
      'window.previewReady===true && !window.previewRenderDiagnostics().opening && window.previewRenderDiagnostics().totalPages>0 && !!window.previewRenderDiagnostics().readingView',
      label,
    );
  const openSample = async (target) => {
    await wait(
      target,
      "!!document.querySelector('.empty > button:not(.primary)')",
      'sample button',
    );
    await run(target, "document.querySelector('.empty > button:not(.primary)').click();true");
    await waitDocument(target, 'sample document');
  };
  const viewFields = ['page', 'fit', 'direction', 'columns', 'sidebar', 'showTranslations'];
  const assertViewRestored = (before, after, label) => {
    for (const field of viewFields) assert.equal(after[field], before[field], `${label} ${field}`);
    assert.ok(
      Math.abs(after.zoom - before.zoom) < (before.fit === 'manual' ? 0.001 : 0.005),
      `${label} zoom (${JSON.stringify({ before, after })})`,
    );
    assert.ok(Math.abs(after.offsetX - before.offsetX) < 0.03, `${label} horizontal offset`);
    assert.ok(Math.abs(after.offsetY - before.offsetY) < 0.03, `${label} vertical offset`);
  };
  const waitLoad = async (target, label) => {
    const loaded = new Promise((resolve) => target.webContents.once('did-finish-load', resolve));
    target.restore();
    target.show();
    await loaded;
    await waitDocument(target, label);
    app.focus({ steal: true });
    target.focus();
    await wait(target, 'window.previewRenderDiagnostics().foreground', `${label} active`);
  };
  const assertBackendAlive = async (target, pid, label) => {
    const state = windows.get(target);
    assert.ok(state, `${label} window state remains registered`);
    assert.equal(state.backend.processId, pid, `${label} backend process remains stable`);
    const response = await fetch(`${state.backend.origin}/api/config`, {
      headers: { 'X-Preview-Token': token },
    });
    assert.equal(response.status, 200, `${label} backend remains authenticated`);
  };
  const waitSuspended = async (targets, label) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (targets.every((target) => windows.get(target)?.serviceMode?.phase === 'suspended'))
        return;
      await pause(100);
    }
    const diagnostics = targets.map((target) => ({
      phase: windows.get(target)?.serviceMode?.phase || null,
      documents: windows.get(target)?.documents?.length || 0,
      minimized: target.isMinimized(),
    }));
    throw Error(`Service mode native state timed out: ${label} (${JSON.stringify(diagnostics)})`);
  };

  await wait(first, 'window.previewReady===true', 'first reader ready');
  await run(
    first,
    `window.previewPreferences.save({engine:'pdf_inspector',language:'Simplified Chinese',translationMode:'full',automatic:false,documentOpenMode:'manual',concurrency:1,pageConcurrency:1,reuseTranslations:false,paragraphContinuationDetection:false,translationServices:{pdf_inspector:{id:'openai',values:{}}}})`,
  );
  await openSample(first);
  const firstBefore = await snapshot(first);
  assert.ok(firstBefore.documentId, 'first sample uploaded to the backend');
  // Give the snapshot a view state that is visible in diagnostics and survives a
  // renderer replacement even though the sample itself is a one-page PDF.
  await run(
    first,
    `(()=>{const sidebar=document.querySelector('[aria-label="Toggle thumbnails"]'),translation=document.querySelector('.translation-toggle'),zoom=document.querySelector('[aria-label="Zoom percentage"]');if(sidebar?.getAttribute('aria-expanded')==='true')sidebar.click();if(translation?.getAttribute('aria-pressed')==='true')translation.click();if(zoom){zoom.value='125%';zoom.dispatchEvent(new Event('input',{bubbles:true}));zoom.dispatchEvent(new Event('change',{bubbles:true}));}return true;})()`,
  );
  await pause(500);
  await run(first, 'window.previewSaveReadingView()');
  const firstView = (await snapshot(first)).readingView;
  assert.ok(firstView, 'first reading view is available before parking');

  const fixtureDirectory = await mkdtemp(join(tmpdir(), 'pdfmathreader-service-mode-')),
    fixturePath = join(fixtureDirectory, 'Portrait and landscape.pdf'),
    fixturePdf = await PDFDocument.create(),
    fixtureFont = await fixturePdf.embedFont(StandardFonts.Helvetica),
    fixturePage = fixturePdf.addPage([612, 792]),
    secondFixturePage = fixturePdf.addPage([612, 792]);
  fixturePage.drawText(
    'Service mode translation fixture page one. The backend task starts before the reader renderer is gone.',
    { x: 50, y: 700, font: fixtureFont, size: 14 },
  );
  secondFixturePage.drawText(
    'Service mode translation fixture page two. This queued page must finish after the renderer exits.',
    { x: 50, y: 700, font: fixtureFont, size: 14 },
  );
  const fixtureBytes = await fixturePdf.save();
  await writeFile(fixturePath, Uint8Array.from(fixtureBytes));
  const second = await createWindow(
    fixturePath,
    undefined,
    null,
    'general',
    true,
    undefined,
    'window',
  );
  await waitDocument(second, 'path-backed sample');
  const secondBefore = await snapshot(second);
  assert.ok(secondBefore.documentId, 'second sample uploaded to the backend');
  assert.ok(secondBefore.recentId, 'path-backed sample has a recent entry');
  const firstState = windows.get(first),
    secondState = windows.get(second),
    backendPids = new Map([
      [first, firstState.backend.processId],
      [second, secondState.backend.processId],
    ]),
    firstRendererPid = first.webContents.getOSProcessId(),
    secondRendererPid = second.webContents.getOSProcessId();
  assert.equal(firstState.backend, backend, 'smoke backend belongs to the first window');
  assert.ok(rendererPids().has(firstRendererPid), 'first renderer appears in app metrics');
  assert.ok(rendererPids().has(secondRendererPid), 'second renderer appears in app metrics');
  assert.notEqual(firstRendererPid, secondRendererPid, 'reader windows use independent renderers');
  assert.notEqual(
    backendPids.get(first),
    backendPids.get(second),
    'reader windows use independent backends',
  );

  await run(
    second,
    `window.previewPreferences.save({engine:'pdf_inspector',language:'Simplified Chinese',translationMode:'full',automatic:false,concurrency:1,pageConcurrency:1,reuseTranslations:false,paragraphContinuationDetection:false,translationServices:{pdf_inspector:{id:'openai',values:{}}}})`,
  );

  second.webContents.send('preferences:changed', secondState.preferences);
  await pause(100);

  // Start a real server-side reader task before parking the windows. The
  // service-mode provider is delayed so the task is still running after both
  // Chromium renderers have exited; the backend then completes it independently.
  second.webContents.send('reader:action', 'translate-all-pages');
  let readerTaskId;
  for (let attempt = 0; attempt < 100 && !readerTaskId; attempt++) {
    readerTaskId = await run(
      second,
      `(async()=>{const result=await window.previewPrepareServiceMode?.();return result?.document?.resumeTranslation?.taskId||null})()`,
    );
    if (!readerTaskId) await pause(50);
  }
  assert.ok(readerTaskId, 'translation creates a resumable backend reader task');
  const taskServiceId = await run(
    second,
    `(async()=>{const result=await window.previewPrepareServiceMode?.();return result?.document?.resumeTranslation?.settings?.translationService?.id})()`,
  );
  assert.equal(taskServiceId, 'openai', 'task uses the explicitly selected delayed provider');

  // Minimizing one window while another remains visible must not park either
  // renderer. This also guards the tab-group active-window calculation.
  second.show();
  second.focus();
  first.minimize();
  await waitNative(() => first.isMinimized() && !second.isMinimized(), 'one window minimized');
  await pause(1300);
  assert.notEqual(firstState.serviceMode?.phase, 'suspended', 'one minimized window does not park');
  assert.notEqual(secondState.serviceMode?.phase, 'suspended', 'visible window does not park');

  // Once every reader window is minimized, both renderers are discarded while
  // their native windows and backends remain registered.
  second.minimize();
  await waitNative(
    () => first.isMinimized() && second.isMinimized(),
    'all reader windows minimized',
  );
  await waitSuspended([first, second], 'all renderers suspended');
  await waitRendererGone(
    new Set([firstRendererPid, secondRendererPid]),
    'old renderer processes exit',
  );
  const taskAfterRenderersGone = await fetch(
    `${secondState.backend.origin}/api/reader-tasks/${encodeURIComponent(readerTaskId)}`,
    { headers: { 'X-Preview-Token': token } },
  ).then((response) => {
    assert.equal(response.status, 200, 'reader task remains available after renderer exit');
    return response.json();
  });
  assert.equal(
    taskAfterRenderersGone.state,
    'running',
    `reader task continues while renderer processes are gone (${JSON.stringify(taskAfterRenderersGone)})`,
  );
  const completedTask = await waitReaderTask(secondState, readerTaskId, 'translation completion');
  assert.equal(completedTask.state, 'complete', 'reader task completes in the backend');
  assert.equal(completedTask.completed, completedTask.total, 'reader task reports all pages done');
  const translatedPageResponse = await fetch(
    `${secondState.backend.origin}/api/reader-tasks/${encodeURIComponent(readerTaskId)}/pages/1`,
    { headers: { 'X-Preview-Token': token } },
  );
  assert.equal(translatedPageResponse.status, 200, 'completed reader page is available');
  const translatedPage = await translatedPageResponse.json();
  const translatedText = translatedPage.paragraphs?.find(
    (paragraph) => paragraph.translation,
  )?.translation;
  assert.equal(
    translatedText,
    'Mock translated paragraph (service-mode call 1)',
    'first delayed provider call produces the retained translation',
  );
  const translatedSecondPageResponse = await fetch(
    `${secondState.backend.origin}/api/reader-tasks/${encodeURIComponent(readerTaskId)}/pages/2`,
    { headers: { 'X-Preview-Token': token } },
  );
  assert.equal(translatedSecondPageResponse.status, 200, 'queued reader page is available');
  const translatedSecondPage = await translatedSecondPageResponse.json();
  const translatedSecondText = translatedSecondPage.paragraphs?.find(
    (paragraph) => paragraph.translation,
  )?.translation;
  assert.equal(
    translatedSecondText,
    'Mock translated paragraph (service-mode call 2)',
    'second delayed provider call completes after renderer processes are gone',
  );
  assert.equal(first.isDestroyed(), false, 'first native window remains alive');
  assert.equal(second.isDestroyed(), false, 'second native window remains alive');
  await assertBackendAlive(first, backendPids.get(first), 'first');
  await assertBackendAlive(second, backendPids.get(second), 'second');

  const firstLoad = waitLoad(first, 'first renderer restore');
  const firstRestored = await snapshotAfterLoad(firstLoad, first);
  assert.notEqual(
    firstRestored.rendererPid,
    firstRendererPid,
    'first renderer receives a new process',
  );
  assert.equal(
    firstRestored.document.totalPages,
    firstBefore.totalPages,
    'first uploaded bytes restore the document',
  );
  assertViewRestored(firstView, firstRestored.document.readingView, 'first restored view');
  assert.equal(
    firstRestored.document.documentId,
    firstBefore.documentId,
    'first backend document survives renderer replacement',
  );

  const secondLoad = waitLoad(second, 'second renderer restore');
  const secondRestored = await snapshotAfterLoad(secondLoad, second);
  assert.notEqual(
    secondRestored.rendererPid,
    secondRendererPid,
    'second renderer receives a new process',
  );
  assert.equal(
    secondRestored.document.totalPages,
    secondBefore.totalPages,
    'second uploaded bytes restore the document',
  );
  assert.equal(
    secondRestored.document.readingView.page,
    secondBefore.readingView.page,
    'second page restores',
  );
  assert.equal(
    secondRestored.document.documentId,
    secondBefore.documentId,
    'second backend document survives renderer replacement',
  );
  assert.equal(
    secondRestored.document.recentId,
    secondBefore.recentId,
    'path-backed recent entry survives restore',
  );
  await wait(
    second,
    'window.previewRenderDiagnostics().translatedPages>0',
    'translated page restores',
  );
  assert.equal(
    await run(
      second,
      "document.querySelector('.reading-paragraph .paragraph-text, .paragraph.translated .paragraph-text')?.textContent || ''",
    ),
    'Mock translated paragraph (service-mode call 1)',
    'completed translation content restores with the document',
  );

  // Repeat the cycle, then close one native window while it is parked and quit
  // with the remaining parked window. This covers the shutdown path that cannot
  // execute renderer JavaScript.
  first.minimize();
  second.minimize();
  await waitSuspended([first, second], 'second renderer suspension');
  await waitRendererGone(
    new Set([firstRestored.rendererPid, secondRestored.rendererPid]),
    'second renderer processes exit',
  );
  const closed = new Promise((resolve) => second.once('closed', resolve));
  second.close();
  await closed;
  assert.equal(windows.has(second), false, 'a suspended window can close cleanly');
  await rm(fixtureDirectory, { recursive: true, force: true });
  const quitting = new Promise((resolve) => app.once('before-quit', resolve));
  app.quit();
  await quitting;
  console.log(
    JSON.stringify({
      passed: true,
      independentRenderers: true,
      oneMinimizedDoesNotSuspend: true,
      allMinimizedSuspends: true,
      backendContinuity: true,
      uploadedDocumentRestored: true,
      translationTaskContinuesWithoutRenderers: true,
      translationTaskRestored: true,
      readingViewRestored: true,
      repeatedSuspendRestore: true,
      closeWhileSuspended: true,
      quitWhileSuspended: true,
    }),
  );
}

async function snapshotAfterLoad(load, target) {
  await load;
  return {
    rendererPid: target.webContents.getOSProcessId(),
    document: await target.webContents.executeJavaScript('window.previewRenderDiagnostics()'),
  };
}
