import assert from 'node:assert/strict';
import { app } from 'electron';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Counts red (the watermark) and black (the body text) pixels on the first page canvas.
const COUNT = `(()=>{
  const c=document.querySelector('.page canvas');
  if(!c||!c.width)return null;
  const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let red=0,dark=0;
  for(let i=0;i<d.length;i+=4){
    const r=d[i],g=d[i+1],b=d[i+2];
    if(r>200&&r-g>40&&r-b>40)red++;
    else if(r<90&&g<90&&b<90)dark++;
  }
  return {red,dark};
})()`;

export async function verifyWatermarkRemoval(window, recents) {
  const evaluate = (code) => window.webContents.executeJavaScript(code);
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function wait(code, label) {
    for (let i = 0; i < 300; i++) {
      const value = await evaluate(code);
      if (value) return value;
      await pause(50);
    }
    const state = await evaluate(
      '({diagnostics:window.previewRenderDiagnostics?.(),body:document.body.innerText.slice(0,600),recents:[...document.querySelectorAll("[data-recent-id]")].map((e)=>e.dataset.recentId),error:document.querySelector("[role=alert],.error")?.innerText})',
    ).catch(() => null);
    throw Error(`Watermark smoke timed out waiting for ${label}: ${JSON.stringify(state)}`);
  }
  const savePreferences = async (values) => {
    // The sender does not receive its own change notification; mimic a settings window.
    window.webContents.send('preferences:changed', values);
    await pause(80);
    await evaluate(`window.previewPreferences.save(${JSON.stringify(values)})`);
  };
  const folder = await mkdtemp(join(tmpdir(), 'watermark-smoke-'));
  try {
    await wait('window.previewReady', 'the reader');
    await evaluate(
      'window.previewPreferences.save({automatic:false,documentOpenMode:"original",watermarkRemovalEnabled:false})',
    );
    const pdf = await PDFDocument.create(),
      font = await pdf.embedFont(StandardFonts.Helvetica);
    for (let n = 1; n <= 4; n++) {
      const page = pdf.addPage([612, 792]);
      for (let i = 0; i < 24; i++)
        page.drawText(`Body sentence ${n}.${i} that stays on the page.`, {
          x: 72,
          y: 720 - i * 16,
          size: 11,
          font,
        });
      page.drawText('CONFIDENTIAL', {
        x: 120,
        y: 240,
        size: 80,
        font,
        rotate: degrees(40),
        color: rgb(1, 0, 0),
        opacity: 0.35,
      });
    }
    const path = join(folder, 'Portrait and landscape.pdf');
    await writeFile(path, await pdf.save());
    await recents.remember(path);
    const id = recents.list()[0].id;
    await new Promise((resolve) => {
      window.webContents.once('did-finish-load', resolve);
      window.webContents.reload();
    });
    await wait('window.previewReady', 'the reader after reload');
    // Pages render only in a foreground window.
    window.show();
    app.focus({ steal: true });
    window.focus();
    window.webContents.focus();
    await evaluate(`document.querySelector('[data-recent-id="${id}"]').click()`);
    await wait(
      'window.previewRenderDiagnostics().totalPages===4&&!!document.querySelector(".page canvas")?.width',
      'the document',
    );
    const before = await wait(
      `(()=>{const r=${COUNT};return r&&r.red>500&&r.dark>500?r:null;})()`,
      'the watermark to render',
    );

    await savePreferences({ watermarkRemovalEnabled: true });
    const removed = await wait(
      `(()=>{const r=${COUNT};return r&&r.red===0&&r.dark>0?r:null;})()`,
      'the watermark to disappear',
    );
    assert.ok(
      removed.dark > before.dark * 0.9,
      'body text must stay when the watermark is removed',
    );

    await savePreferences({ watermarkRemovalEnabled: false });
    const restored = await wait(
      `(()=>{const r=${COUNT};return r&&r.red>500?r:null;})()`,
      'the watermark to return',
    );
    console.log('Watermark removal passed.', JSON.stringify({ before, removed, restored }));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
  app.exit(0);
}
