import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
export async function verifyLayoutRegion(window) {
  const layout = JSON.parse(await readFile(process.env.PDF_READER_LAYOUT_FIXTURE, 'utf8'));
  const original = await PDFDocument.load(await readFile(process.env.PDF_READER_SOURCE_FIXTURE));
  const one = await PDFDocument.create();
  const [page] = await one.copyPages(original, [layout.page - 1]);
  one.addPage(page);
  const source = Buffer.from(await one.save()).toString('base64'),
    translated = (await readFile(process.env.PDF_READER_TRANSLATED_FIXTURE)).toString('base64');
  const evaluate = (code) => window.webContents.executeJavaScript(code);
  async function wait(code) {
    for (let n = 0; n < 400; n++) {
      if (await evaluate(code)) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    console.log(
      await evaluate(
        `JSON.stringify({title:document.title,paragraphs:document.querySelectorAll('.paragraph.math').length,status:document.querySelector('.page-caption')?.innerText,thumb:document.querySelector('.thumb small')?.innerText,error:document.querySelector('.error-banner')?.innerText,diagnostics:window.previewRenderDiagnostics?.()})`,
      ),
    );
    await writeFile(
      '/tmp/pdfmathreader-layout-region-failure.png',
      (await window.webContents.capturePage()).toPNG(),
    );
    throw Error('Actual page verification timed out: ' + code);
  }
  window.show();
  window.focus();
  await wait(`!!document.querySelector('[aria-label="Translation settings"]')`);
  await evaluate(
    `(()=>{const original=window.fetch;window.fetch=async(...args)=>{const url=String(args[0]);if(url.startsWith('/api/math-page?'))return new Response(Uint8Array.from(atob(${JSON.stringify(translated)}),c=>c.charCodeAt(0)),{status:200,headers:{'Content-Type':'application/pdf','X-Layout-Key':'fixture'}});if(url==='/api/math-layout/fixture')return new Response(JSON.stringify(${JSON.stringify(layout)}),{status:200,headers:{'Content-Type':'application/json'}});return original(...args);};const b=document.querySelector('[aria-label="Translation settings"]');b.focus();b.click();})()`,
  );
  await wait(
    `!!document.querySelector('.kernel-switcher button')&&!document.querySelector('.kernel-switcher button').disabled`,
  );
  await evaluate(
    `(()=>{const b=[...document.querySelectorAll('.kernel-switcher button')].find(b=>b.textContent==='Fast');b.focus();b.click();})()`,
  );
  await wait(
    `document.querySelector('.kernel-switcher button[aria-checked="true"]')?.textContent==='Fast'&&document.querySelector('.kernel-traffic-light')?.dataset.status==='ready'&&!document.querySelector('.kernel-switcher button').disabled`,
  );
  await evaluate(
    `document.querySelector('[aria-label="Close settings"]').click();(()=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(${JSON.stringify(source)}),c=>c.charCodeAt(0))],'A quieter way to read.pdf',{type:'application/pdf'}));const input=document.querySelector('input[type="file"]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  const changed = layout.paragraphs.filter((b) => b.text !== b.translation).length;
  await wait(
    `document.querySelectorAll('.paragraph.math').length===${changed}&&document.querySelector('.thumb small')?.innerText==='Translated'`,
  );
  await new Promise((r) => setTimeout(r, 5000));
  const boxes = await evaluate(
    `(()=>{const page=document.querySelector('.page').getBoundingClientRect();return [...document.querySelectorAll('.paragraph.math')].map(b=>{const r=b.getBoundingClientRect();return {top:(r.top-page.top)/page.height,height:r.height/page.height,left:(r.left-page.left)/page.width};});})()`,
  );
  assert.ok(boxes.length > 0);
  assert.ok(
    boxes.every((b) => b.height < 0.4),
    'No overlay should span unrelated table/header and body',
  );
  await writeFile(
    '/tmp/pdfmathreader-layout-region-fixed.png',
    (await window.webContents.capturePage()).toPNG(),
  );
  console.log(
    JSON.stringify({
      actualPage: layout.page,
      visibleSwitchTargets: boxes.length,
      unchangedRegionsOmitted: layout.paragraphs.length - changed,
      pageSpanningOverlayAbsent: true,
      boxes,
    }),
  );
  window.close();
}
