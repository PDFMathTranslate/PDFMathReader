import assert from 'node:assert/strict';
import { app } from 'electron';
import { writeFile } from 'node:fs/promises';

const DEFAULT_RUNS = 2;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_SETTLED_PROBE_MS = 20_000;
const POLL_MS = 50;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function now() {
  return globalThis.performance.now();
}

export async function verifyOperationPerformance(
  window,
  windows,
  createWindow,
  {
    runs = positiveInteger(process.env.PDF_OPERATION_SMOKE_RUNS, DEFAULT_RUNS),
    timeoutMs = positiveInteger(process.env.PDF_OPERATION_SMOKE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    settledProbeMs = positiveInteger(
      process.env.PDF_OPERATION_SETTLED_PROBE_MS,
      DEFAULT_SETTLED_PROBE_MS,
    ),
    outputPath = process.env.PDF_OPERATION_PERFORMANCE_OUTPUT ||
      '/tmp/pdfmathreader-operation-performance.json',
  } = {},
) {
  const evaluate = (target, code) => target.webContents.executeJavaScript(code, true);
  const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  async function waitForRenderer(target, label, code, limit = timeoutMs) {
    const started = now();
    let lastError;
    while (now() - started < limit) {
      try {
        if (await evaluate(target, code)) return;
      } catch (error) {
        lastError = error;
      }
      await pause(POLL_MS);
    }
    const detail = lastError ? ` (${lastError.message})` : '';
    throw Error(`Operation performance smoke timed out waiting for ${label}${detail}`);
  }

  async function waitForMain(label, predicate, limit = timeoutMs) {
    const started = now();
    while (now() - started < limit) {
      if (await predicate()) return;
      await pause(POLL_MS);
    }
    throw Error(`Operation performance smoke timed out waiting for ${label}`);
  }

  async function probeRenderer(target, code, limit) {
    const started = now();
    while (now() - started < limit) {
      try {
        if (await evaluate(target, code)) return { matched: true, elapsedMs: now() - started };
      } catch {}
      await pause(POLL_MS);
    }
    return { matched: false, elapsedMs: now() - started };
  }

  async function waitForStartPage(target) {
    await waitForRenderer(
      target,
      'the start page',
      'window.previewReady===true && !!document.querySelector(".empty")',
    );
    const state = await evaluate(
      target,
      '(()=>{const d=window.previewRenderDiagnostics?.();return {totalPages:d?.totalPages??null,opening:d?.opening??null};})()',
    );
    assert.equal(state.totalPages, 0, 'operation smoke must start with an empty document');
    assert.equal(state.opening, false, 'operation smoke start page is still opening');
  }

  async function initialReadyMetrics(target) {
    const renderer = await evaluate(
      target,
      '(()=>{const paints=performance.getEntriesByType("paint").map(entry=>({name:entry.name,startTime:entry.startTime,duration:entry.duration}));return {previewReadyObservedAtMs:performance.now(),paints,firstPaintMs:paints.find(entry=>entry.name==="first-paint")?.startTime??null,firstContentfulPaintMs:paints.find(entry=>entry.name==="first-contentful-paint")?.startTime??null};})()',
    );
    return {
      mainProcessUptimeMsAtPreviewReadyObserved: process.uptime() * 1000,
      ...renderer,
    };
  }

  async function readPerformanceReport(target) {
    try {
      return await evaluate(
        target,
        "(async()=>typeof window.previewPerformanceReport==='function'?await window.previewPerformanceReport():null)()",
      );
    } catch {
      return null;
    }
  }

  async function openAndClose(target, index) {
    await waitForStartPage(target);
    const openStarted = now();
    await evaluate(target, 'document.querySelector(".sample-button")?.click(); true');
    await waitForRenderer(
      target,
      `the first painted sample page (${index}/${runs})`,
      '(()=>{const d=window.previewRenderDiagnostics?.();const canvas=document.querySelector(".page canvas");return d?.totalPages>0&&d?.opening===false&&d?.metrics?.firstPageMs!==null&&canvas?.width>0&&canvas?.height>0;})()',
    );
    const firstPageMs = now() - openStarted;
    const diagnostics = await evaluate(target, 'window.previewRenderDiagnostics?.()');
    const report = await readPerformanceReport(target);
    const open = {
      index,
      clickToFirstPaintMs: firstPageMs,
      firstPageMs: Number.isFinite(diagnostics?.metrics?.firstPageMs)
        ? diagnostics.metrics.firstPageMs
        : null,
      firstScreenMs: Number.isFinite(report?.firstScreenMs) ? report.firstScreenMs : null,
      stages: report?.stages || null,
      pageCount: report?.pageCount || null,
    };

    const closeStarted = now();
    target.webContents.send('reader:action', 'close-document');
    await waitForRenderer(
      target,
      `the empty page after close (${index}/${runs})`,
      '(()=>{const d=window.previewRenderDiagnostics?.();return !!document.querySelector(".empty")&&d?.totalPages===0&&d?.mountedPages===0&&d?.mountedThumbnails===0;})()',
    );
    const closeToEmptyMs = now() - closeStarted;
    const settled = await probeRenderer(
      target,
      '(()=>{const d=window.previewRenderDiagnostics?.();return !document.querySelector(".workspace.document-closing")&&d?.opening===false;})()',
      settledProbeMs,
    );
    if (windows?.get(target)?.performance) {
      await waitForMain(
        `the main document state after close (${index}/${runs})`,
        () => windows.get(target)?.performance?.hasDocument === false,
      );
    }
    return {
      open,
      closeToEmptyMs,
      closeToSettledMs: settled.matched ? now() - closeStarted : null,
      closeSettledProbeMs: settled.elapsedMs,
      closeSettledWithinProbe: settled.matched,
    };
  }

  async function nativeWindowCycle() {
    if (!windows || typeof createWindow !== 'function')
      return { skipped: true, reason: 'windows/createWindow were not supplied by the dispatcher' };

    const createStarted = now();
    const target = await createWindow();
    const createReturnedMs = now() - createStarted;
    assert.ok(windows.has(target), 'new native window was not registered');
    await waitForRenderer(target, 'the native window renderer', 'window.previewReady===true');
    const readyMs = now() - createStarted;
    await waitForRenderer(
      target,
      'the native window start page',
      '!!document.querySelector(".empty")',
    );

    let closeToHiddenMs = target.isVisible() ? null : 0;
    let resolveHidden;
    const hidden = new Promise((resolve) => {
      resolveHidden = resolve;
    });
    const onHide = () => {
      if (closeToHiddenMs === null) closeToHiddenMs = now() - closeStarted;
      resolveHidden();
    };
    const onClosed = () => resolveHidden();
    target.once('hide', onHide);
    target.once('closed', onClosed);
    const closeStarted = now();
    if (closeToHiddenMs === 0) resolveHidden();
    target.close();
    await hidden;
    await waitForMain('the native window to close', () => !windows.has(target));
    target.removeListener('hide', onHide);
    target.removeListener('closed', onClosed);
    return {
      createReturnedMs,
      readyMs,
      closeToHiddenMs,
      closeToDestroyedMs: now() - closeStarted,
    };
  }

  await waitForStartPage(window);
  const initial = await initialReadyMetrics(window);
  await evaluate(window, 'window.previewPreferences.save({automatic:false})');
  const savedPreferences = await evaluate(window, 'window.previewPreferences.load()');
  assert.equal(savedPreferences.automatic, false, 'automatic translation did not disable');
  window.webContents.send('preferences:changed', savedPreferences);

  const cycles = [];
  for (let index = 1; index <= runs; index++) cycles.push(await openAndClose(window, index));
  const nativeWindow = await nativeWindowCycle();
  const result = {
    schemaVersion: 1,
    date: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    visibility: {
      initialWindowVisible: window.isVisible(),
      backgroundRenderSmoke: process.argv.includes('--smoke-background-render'),
    },
    initial,
    measurement:
      'Monotonic main-process performance.now(); open is sample click to first nonblank page canvas; close is reader action to empty and settled start page; native close is close request to BrowserWindow closed.',
    document: 'built-in sample PDF; automatic translation disabled; isolated smoke user data',
    runs,
    cycles,
    nativeWindow,
  };
  await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(
    'Operation performance smoke passed',
    JSON.stringify({
      outputPath,
      runs,
      initial,
      clickToFirstPaintMs: cycles.map((cycle) => Math.round(cycle.open.clickToFirstPaintMs)),
      firstPageMs: cycles.map((cycle) => cycle.open.firstPageMs),
      closeToEmptyMs: cycles.map((cycle) => Math.round(cycle.closeToEmptyMs)),
      closeToSettledMs: cycles.map((cycle) =>
        cycle.closeToSettledMs === null ? null : Math.round(cycle.closeToSettledMs),
      ),
      nativeWindow,
    }),
  );
  app.exit(0);
}
