import assert from 'node:assert/strict';
import { app } from 'electron';
import { PDFDocument } from 'pdf-lib';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export async function verifyRecentView(window, recents) {
  const dir = await mkdtemp(join(tmpdir(), 'recent-view-'));
  const path = join(dir, 'Portrait and landscape.pdf');
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText('Recent document list');
  await writeFile(path, await pdf.save());
  const run = (code) => window.webContents.executeJavaScript(code);
  async function wait(code) {
    for (let i = 0; i < 200; i++) {
      if (await run(code)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error('Recent view timeout: ' + code);
  }
  try {
    await recents.remember(path);
    await window.webContents.reload();
    await wait(`!!document.querySelector('.recent-view-switch')`);
    console.log(
      await run(
        `JSON.stringify([...document.querySelectorAll('.recent-clear,.recent-view-switch')].map(e=>({cls:e.className,rect:e.getBoundingClientRect().toJSON(),min:getComputedStyle(e).minHeight})))`,
      ),
    );
    assert.ok(
      await run(
        `(()=>{const a=document.querySelector('.recent-clear').getBoundingClientRect(), b=document.querySelector('.recent-view-switch').getBoundingClientRect();return b.left>a.right&&Math.abs(a.height-b.height)<2})()`,
      ),
    );
    await run(`document.querySelectorAll('.recent-view-switch button')[1].click()`);
    await wait(`!!document.querySelector('.recent-list .recent-document-name')`);
    assert.equal(
      await run(`document.querySelector('.recent-document-name').textContent`),
      'Portrait and landscape.pdf',
    );
    await window.webContents.reload();
    await wait(`!!document.querySelector('.recent-list')`);
    await run(`document.documentElement.dataset.interfaceStyle='liquid-glass'`);
    await wait(
      `getComputedStyle(document.querySelector('.recent-view-switch')).backdropFilter.includes('blur')`,
    );
    await wait(`document.querySelector('.recent-document img')?.naturalWidth>0`);
    await writeFile(
      '/tmp/reader-recent-list.png',
      (await window.webContents.capturePage()).toPNG(),
    );
    await run(`document.querySelectorAll('.recent-view-switch button')[0].click()`);
    await wait(`!document.querySelector('.recent-list')`);
    assert.equal(await run(`localStorage.getItem('reader-recent-view')`), 'gallery');
    await writeFile(
      '/tmp/reader-recent-gallery.png',
      (await window.webContents.capturePage()).toPNG(),
    );
    await run(`document.querySelector('.recent-document').click()`);
    await wait(`!!document.querySelector('.page canvas')?.width`);
    console.log('Recent view passed: placement, list, persistence, glass, gallery and opening');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  app.exit(0);
}
