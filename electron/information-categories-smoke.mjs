import assert from 'node:assert/strict';
import { app } from 'electron';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
export async function verifyInformationCategories(reader, recents, createWindow) {
  const evaluate = (target, code) => target.webContents.executeJavaScript(code);
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const wait = async (target, code) => {
    if (target === reader) {
      app.focus({ steal: true });
      reader.show();
      reader.focus();
      reader.webContents.focus();
    }
    for (let n = 0; n < 250; n++) {
      if (await evaluate(target, code)) return;
      await pause(50);
    }
    console.log(
      await evaluate(
        target,
        '(async()=>JSON.stringify({prefs:await window.previewPreferences.load(),error:document.querySelector(".error-banner")?.textContent,keywords:Array.from(document.querySelectorAll(".pdf-information-keyword"),s=>s.textContent),diag:window.previewRenderDiagnostics?.()}))()',
      ),
    );
    throw Error('Information categories timeout: ' + code);
  };
  const reload = async () => {
    await evaluate(reader, 'window.previewDocuments.closed()');
    const loaded = new Promise((resolve) => reader.webContents.once('did-finish-load', resolve));
    reader.webContents.reload();
    await loaded;
    reader.show();
    app.focus({ steal: true });
    reader.focus();
    await wait(reader, 'window.previewReady');
  };
  await wait(reader, 'window.previewReady');
  await evaluate(
    reader,
    'window.previewPreferences.save({automatic:false,documentOpenMode:"original",interactionMode:"reading",reduceBackgroundFrameRate:false})',
  );
  const directory = await mkdtemp(join(tmpdir(), 'pdf-information-categories-')),
    path = join(directory, 'Portrait and landscape.pdf');
  try {
    const pdf = await PDFDocument.create(),
      font = await pdf.embedFont(StandardFonts.Helvetica),
      page = pdf.addPage([612, 792]);
    page.drawText('First, results suggest a higher effect. However, findings support this.', {
      x: 48,
      y: 700,
      size: 12,
      font,
    });
    await writeFile(path, await pdf.save());
    await recents.remember(path);
    const id = recents.list()[0].id;
    await reload();
    await evaluate(reader, `document.querySelector('[data-recent-id="${id}"]').click()`);
    await wait(reader, '!!document.querySelector(".reading-text-layer span")');
    const settings = await createWindow(null, null, reader, 'general');
    settings.show();
    settings.focus();
    await wait(
      settings,
      'document.querySelectorAll(".information-subcategories .setting-row").length===4',
    );
    assert.equal(
      await evaluate(
        settings,
        'document.querySelector("[data-setting=emphasizeKeyVerbs] input").disabled',
      ),
      true,
    );
    await evaluate(
      settings,
      'document.querySelector("[data-setting=information-emphasis] input").click()',
    );
    await wait(reader, 'document.querySelectorAll(".pdf-information-keyword").length===7');
    const cases = [
      ['emphasizeResearchFindings', ['results', 'higher', 'findings']],
      ['emphasizeOrdinals', ['First']],
      ['emphasizeKeyVerbs', ['suggest', 'support']],
      ['emphasizeLogicalConnectives', ['However']],
    ];
    for (const [key, excluded] of cases) {
      await evaluate(settings, `document.querySelector('[data-setting="${key}"] input').click()`);
      await wait(settings, `window.previewPreferences.load().then(p=>p.${key}===false)`);
      await wait(
        reader,
        `document.querySelectorAll(".pdf-information-keyword").length===${7 - excluded.length}`,
      );
      const remaining = await evaluate(
        reader,
        'Array.from(document.querySelectorAll(".pdf-information-keyword"),s=>s.textContent)',
      );
      for (const word of excluded) assert.ok(!remaining.includes(word));
      await evaluate(settings, `document.querySelector('[data-setting="${key}"] input').click()`);
      await wait(settings, `window.previewPreferences.load().then(p=>p.${key}===true)`);
      await wait(reader, 'document.querySelectorAll(".pdf-information-keyword").length===7');
    }
    await evaluate(
      settings,
      'document.querySelector("[data-setting=emphasizeKeyVerbs] input").click()',
    );
    await reload();
    await evaluate(reader, `document.querySelector('[data-recent-id="${id}"]').click()`);
    await wait(reader, '!!document.querySelector(".reading-text-layer span")');
    assert.equal(
      await evaluate(reader, 'window.previewPreferences.load().then(p=>p.emphasizeKeyVerbs)'),
      false,
    );
    assert.ok(
      !(await evaluate(
        reader,
        'Array.from(document.querySelectorAll(".pdf-information-keyword"),s=>s.textContent).includes("suggest")',
      )),
    );
    console.log(
      'Information categories smoke passed: native settings, four independent switches, reader synchronization and persistence.',
    );
    app.exit(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
