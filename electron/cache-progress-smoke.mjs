import assert from 'node:assert/strict';
export async function verifyCacheProgress(window) {
  const run = (code) => window.webContents.executeJavaScript(code),
    pause = (ms) => new Promise((r) => setTimeout(r, ms));
  async function wait(code) {
    for (let i = 0; i < 400; i++) {
      if (await run(code)) return;
      await pause(50);
    }
    throw Error('Cache progress timeout: ' + code);
  }
  async function openSample() {
    await wait(
      `!![...document.querySelectorAll('button')].find(b=>b.textContent==='Try a sample document')`,
    );
    await run(
      `(()=>{window.progressObservations=[];const original=window.fetch;window.fetch=async(url,options)=>{const translated=String(url)==='/api/translate';if(translated){await new Promise(r=>setTimeout(r,120));const page=document.querySelector('.page-translation-progress'),ring=document.querySelector('.translation-progress');window.progressObservations.push({probe:JSON.parse(options.body).cacheOnly,pageNeutral:page?.classList.contains('cache-reading'),ringNeutral:ring?.classList.contains('cache-reading'),pageColor:page&&getComputedStyle(page.querySelector('span')).backgroundColor,ringColor:ring&&getComputedStyle(ring.querySelector('.translation-progress-fill')).stroke});}return original(url,options);};[...document.querySelectorAll('button')].find(b=>b.textContent==='Try a sample document').click();})()`,
    );
    await wait(
      `!!document.querySelector('.paragraph[aria-label*="Mock translated"]')&&!document.querySelector('.translation-progress')`,
    );
    return run('window.progressObservations');
  }
  const fresh = await openSample();
  assert.ok(
    fresh.some((o) => o.probe && o.pageNeutral && o.ringNeutral),
    'cache lookup is neutral in page and toolbar',
  );
  assert.ok(
    fresh.some((o) => !o.probe && !o.pageNeutral && !o.ringNeutral),
    'uncached translation uses the accent',
  );
  await new Promise((resolve) => {
    window.webContents.once('did-finish-load', resolve);
    window.webContents.reload();
  });
  const cached = await openSample();
  assert.ok(
    cached.length > 0 && cached.every((o) => o.probe && o.pageNeutral && o.ringNeutral),
    'reopened cache never starts an accent translation request',
  );
  console.log(
    'Cache progress passed: gray lookup and cached reload, accent for fresh translation, page and toolbar consistency.',
  );
  window.close();
}
