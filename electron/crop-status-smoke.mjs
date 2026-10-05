import assert from 'node:assert/strict';
import { Menu } from 'electron';
import { PDFDocument } from 'pdf-lib';
import { writeFile } from 'node:fs/promises';

export async function verifyCropStatus(window) {
  const evaluate = (code) => window.webContents.executeJavaScript(code);
  const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  let lastCondition = '';

  async function wait(condition, label = condition) {
    lastCondition = label;
    for (let attempt = 0; attempt < 300; attempt += 1) {
      try {
        if (await evaluate(condition)) return;
      } catch {
        // The renderer can briefly replace the DOM while opening the fixture.
      }
      await pause(50);
    }
    let diagnostic = '';
    try {
      diagnostic = JSON.stringify(
        await evaluate(`({
        ready: window.previewReady,
        mock: window.cropStatusSmoke,
        diagnostics: window.previewRenderDiagnostics?.(),
        body: document.body.innerText.slice(-1200)
      })`),
      );
    } catch {
      diagnostic = 'renderer diagnostics unavailable';
    }
    throw Error(`Crop status smoke timed out: ${lastCondition}\n${diagnostic}`);
  }

  function assertInside(child, parent, label) {
    assert.ok(child, `${label} is present`);
    assert.ok(child.left >= parent.left - 1, `${label} left edge is inside the cropped frame`);
    assert.ok(child.top >= parent.top - 1, `${label} top edge is inside the cropped frame`);
    assert.ok(child.right <= parent.right + 1, `${label} right edge is inside the cropped frame`);
    assert.ok(
      child.bottom <= parent.bottom + 1,
      `${label} bottom edge is inside the cropped frame`,
    );
  }

  const pdf = await PDFDocument.create();
  pdf
    .addPage([800, 1000])
    .drawText('Crop status regression smoke fixture', { x: 72, y: 860, size: 20 });
  const fixture = Buffer.from(await pdf.save()).toString('base64');
  const errorText = [
    'Mocked layout extraction failed for the cropped page.',
    'This deliberately long diagnostic verifies that the retry toast wraps inside the visible page frame.',
    'The request is expected to fail so the smoke can exercise the real error and recovery controls.',
    'Keep this message visible across several lines so a regression cannot hide its lower edge behind the shifted PDF page.',
  ].join(' ');
  const requestDelay = 1200;

  try {
    await wait('window.previewReady === true', 'initial renderer ready');
    window.show();
    window.focus();
    await evaluate(`(() => {
      const originalFetch = window.fetch.bind(window);
      const fixture = ${JSON.stringify(fixture)};
      const errorText = ${JSON.stringify(errorText)};
      window.cropStatusSmoke = {layoutCalls: 0, layoutPending: 0, sampleCalls: 0};
      window.fetch = async (input, options) => {
        const url = new URL(String(input), location.href);
        if (url.pathname === '/sample.pdf') {
          window.cropStatusSmoke.sampleCalls += 1;
          const bytes = Uint8Array.from(atob(fixture), character => character.charCodeAt(0));
          return new Response(bytes, {status: 200, headers: {'Content-Type': 'application/pdf'}});
        }
        if (url.pathname === '/api/engines/pdf_inspector') {
          return new Response(JSON.stringify({
            id: 'pdf_inspector',
            label: 'PDF Inspector',
            installed: true,
            available: true,
            version: 'smoke-fixture'
          }), {status: 200, headers: {'Content-Type': 'application/json'}});
        }
        if (url.pathname === '/api/layout') {
          window.cropStatusSmoke.layoutCalls += 1;
          window.cropStatusSmoke.layoutPending += 1;
          await new Promise(resolve => setTimeout(resolve, ${requestDelay}));
          window.cropStatusSmoke.layoutPending -= 1;
          return new Response(JSON.stringify({error: errorText}), {
            status: 422,
            headers: {'Content-Type': 'application/json'}
          });
        }
        return originalFetch(input, options);
      };
      return true;
    })()`);
    await evaluate(`window.previewPreferences.save({
      engine: 'pdf_inspector',
      automatic: true,
      documentOpenMode: 'translation',
      translationMode: 'full',
      restoreDocuments: false,
      reduceMotion: true,
      defaultPageCropEnabled: false,
      defaultPageCropX: 0,
      defaultPageCropY: 0
    })`);

    await wait('!!document.querySelector(".sample-button")', 'sample button');
    await evaluate('document.querySelector(".sample-button").click(); true');
    await wait('window.cropStatusSmoke.sampleCalls === 1', 'fixture sample request');
    await wait(
      `(() => {
      const diagnostics = window.previewRenderDiagnostics?.();
      return diagnostics?.totalPages === 1 && !diagnostics.opening && document.querySelector('.page canvas')?.width > 0;
    })()`,
      'sample page rendered',
    );
    await wait(
      'window.cropStatusSmoke.layoutCalls === 1 && window.cropStatusSmoke.layoutPending === 1',
      'delayed layout request',
    );
    await wait('!!document.querySelector(".page-translation-progress")', 'initial page progress');

    const menu = Menu.getApplicationMenu();
    menu.getMenuItemById('crop-x-more').click();
    await wait(
      'window.previewRenderDiagnostics()?.readingView?.cropX === 0.05',
      'horizontal crop applied',
    );
    menu.getMenuItemById('crop-y-more').click();
    await wait(
      `(() => {
      const view = window.previewRenderDiagnostics()?.readingView;
      return view?.cropX === 0.05 && view?.cropY === 0.05;
    })()`,
      'vertical crop applied',
    );

    const snapshot = () =>
      evaluate(`(() => {
      const rect = element => {
        if (!element) return null;
        const bounds = element.getBoundingClientRect();
        return {
          left: bounds.left,
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height
        };
      };
      const wrap = document.querySelector('.page-wrap');
      const toast = document.querySelector('.page-translation-toast');
      const retry = toast?.querySelector('button');
      const progress = document.querySelector('.page-translation-progress');
      const retryStyle = retry ? getComputedStyle(retry) : null;
      return {
        view: window.previewRenderDiagnostics?.().readingView,
        wrap: rect(wrap),
        page: rect(document.querySelector('.page')),
        toast: rect(toast),
        toastText: toast?.innerText || '',
        retry: rect(retry),
        retryStyle: retryStyle ? {
          display: retryStyle.display,
          visibility: retryStyle.visibility,
          opacity: retryStyle.opacity,
          pointerEvents: retryStyle.pointerEvents
        } : null,
        progress: rect(progress),
      progressPending: window.cropStatusSmoke?.layoutPending || 0
      };
    })()`);
    const scrollToastIntoView = async (label) => {
      await evaluate(`(() => {
        const toast = document.querySelector('.page-translation-toast');
        toast?.scrollIntoView({block: 'center', inline: 'nearest'});
        return !!toast;
      })()`);
      await wait(
        `(() => {
        const reader = document.querySelector('.reader');
        const toast = document.querySelector('.page-translation-toast');
        if (!reader || !toast) return false;
        const readerBounds = reader.getBoundingClientRect();
        const toastBounds = toast.getBoundingClientRect();
        return toastBounds.top >= readerBounds.top + 8 && toastBounds.bottom <= readerBounds.bottom - 8;
      })()`,
        label,
      );
    };

    const progressState = await snapshot();
    assert.equal(progressState.view.cropX, 0.05);
    assert.equal(progressState.view.cropY, 0.05);
    assert.equal(progressState.progressPending, 1);
    assertInside(progressState.progress, progressState.wrap, 'page translation progress');
    assert.ok(
      Math.abs(progressState.progress.top - progressState.wrap.top) <= 1,
      'progress aligns with the cropped frame top',
    );
    assert.ok(
      Math.abs(progressState.progress.left - progressState.wrap.left) <= 1,
      'progress starts at the cropped frame left edge',
    );
    assert.ok(
      Math.abs(progressState.progress.right - progressState.wrap.right) <= 1,
      'progress reaches the cropped frame right edge',
    );

    await wait(
      'window.cropStatusSmoke.layoutPending === 0 && !!document.querySelector(".page-translation-toast")',
      'failed layout toast',
    );
    await pause(250);
    const failedState = await snapshot();
    assertInside(failedState.toast, failedState.wrap, 'translation failure toast');
    assert.ok(
      failedState.toastText.includes('deliberately long diagnostic'),
      'toast contains the mocked long diagnostic',
    );
    assert.ok(failedState.retry?.width > 0 && failedState.retry?.height > 0, 'retry is visible');
    assert.notEqual(failedState.retryStyle?.visibility, 'hidden', 'retry is visible');
    assert.notEqual(failedState.retryStyle?.pointerEvents, 'none', 'retry is clickable');

    await scrollToastIntoView('failure toast scrolled into view');
    const retryPoint = await evaluate(`(() => {
      const button = document.querySelector('.page-translation-toast button');
      const bounds = button?.getBoundingClientRect();
      if (!button || !bounds) return null;
      const x = Math.round(bounds.left + bounds.width / 2);
      const y = Math.round(bounds.top + bounds.height / 2);
      const hit = document.elementFromPoint(x, y);
      return {x, y, hit: hit === button || button.contains(hit)};
    })()`);
    assert.ok(retryPoint?.hit, 'retry center is hit by the page pointer');
    window.webContents.sendInputEvent({
      type: 'mouseMove',
      x: retryPoint.x,
      y: retryPoint.y,
      button: 'left',
    });
    window.webContents.sendInputEvent({
      type: 'mouseDown',
      x: retryPoint.x,
      y: retryPoint.y,
      button: 'left',
      clickCount: 1,
    });
    window.webContents.sendInputEvent({
      type: 'mouseUp',
      x: retryPoint.x,
      y: retryPoint.y,
      button: 'left',
      clickCount: 1,
    });
    await wait(
      'window.cropStatusSmoke.layoutCalls === 2 && window.cropStatusSmoke.layoutPending === 1',
      'retry layout request',
    );
    await wait('!!document.querySelector(".page-translation-progress")', 'retry page progress');
    const retryProgressState = await snapshot();
    assert.equal(retryProgressState.progressPending, 1);
    assertInside(
      retryProgressState.progress,
      retryProgressState.wrap,
      'retry page translation progress',
    );
    assert.ok(
      Math.abs(retryProgressState.progress.top - retryProgressState.wrap.top) <= 1,
      'retry progress aligns with the cropped frame top',
    );

    await wait(
      'window.cropStatusSmoke.layoutPending === 0 && !!document.querySelector(".page-translation-toast")',
      'retry failure toast',
    );
    await pause(250);
    await scrollToastIntoView('retry failure toast scrolled into view');
    const finalState = await snapshot();
    assertInside(finalState.toast, finalState.wrap, 'retry failure toast');
    assert.ok(
      finalState.retry?.width > 0 && finalState.retry?.height > 0,
      'retry remains visible after the second failure',
    );
    // Advance only the five-minute dismissal timer, without slowing this smoke.
    await evaluate(`(() => {
      const original = window.setTimeout;
      window.setTimeout = (callback, delay, ...args) => {
        if (delay === 5 * 60 * 1000) { window.expireKernelIgnore = () => callback(...args); return 0; }
        return original(callback, delay, ...args);
      };
    })()`);
    const ignoreLabel = () =>
      evaluate(`document.querySelector('.kernel-error-actions button')?.textContent.trim()`);
    assert.equal(await ignoreLabel(), 'Ignore for 5 minutes');
    await evaluate(`document.querySelector('.kernel-error-actions button').click()`);
    await wait(`!document.querySelector('.kernel-error-popover')`, 'first dismissal');
    assert.equal(
      await evaluate(`!!document.querySelector('.page-translation-toast button')`),
      true,
    );
    await evaluate(`window.expireKernelIgnore()`);
    await wait(
      `!!document.querySelector('.kernel-error-popover')`,
      'five-minute dismissal expired',
    );
    assert.equal(await ignoreLabel(), 'Ignore errors in this document');
    await evaluate(`document.querySelector('.kernel-error-actions button').click()`);
    await wait(`!document.querySelector('.kernel-error-popover')`, 'document dismissal');
    await evaluate(`document.querySelector('.page-translation-toast button').click()`);
    await wait(
      `window.cropStatusSmoke.layoutCalls === 3 && window.cropStatusSmoke.layoutPending === 0 && !!document.querySelector('.page-translation-toast button')`,
      'page retry after document dismissal',
    );
    assert.equal(
      await evaluate(`!!document.querySelector('.kernel-error-popover')`),
      false,
      'document dismissal suppresses only the header popover',
    );
    menu.getMenuItemById('file-close-document').click();
    await wait(`window.previewRenderDiagnostics()?.totalPages === 0`, 'document closed');
    await evaluate(`(() => {
      const bytes = Uint8Array.from(atob(${JSON.stringify(fixture)}), character => character.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], 'A quieter way to read.pdf', {type:'application/pdf'}));
      const input = document.querySelector('input[type=file]');input.files = transfer.files;
      input.dispatchEvent(new Event('change', {bubbles:true}));
    })()`);
    await wait(
      `!!document.querySelector('.kernel-error-popover') && !!document.querySelector('.page-translation-toast')`,
      'new document reports errors again',
    );
    assert.equal(
      await ignoreLabel(),
      'Ignore for 5 minutes',
      'new document resets the ignore choice',
    );
    await writeFile(
      '/tmp/pdfmathreader-crop-status.png',
      (await window.webContents.capturePage()).toPNG(),
    );
    console.log(
      'Crop status smoke passed:',
      JSON.stringify({
        cropX: finalState.view.cropX,
        cropY: finalState.view.cropY,
        toastInsideFrame: true,
        retryClickable: true,
        progressAligned: true,
        documentIgnore: true,
        newDocumentReset: true,
        screenshot: '/tmp/pdfmathreader-crop-status.png',
      }),
    );
  } finally {
    window.close();
  }
}
