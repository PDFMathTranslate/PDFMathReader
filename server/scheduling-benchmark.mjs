// Real Fast kernel, deterministic local provider, isolated cache; no paid calls.
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { startServer } = await import(
  process.env.SCHEDULING_SERVER ? pathToFileURL(process.env.SCHEDULING_SERVER).href : './index.mjs'
);
const dir = await mkdtemp(join(tmpdir(), 'reader-scheduling-'));
let slow = false,
  entered;
const backend = await startServer({
  port: 0,
  development: false,
  cacheDir: dir,
  enginesRoot: join(homedir(), 'Library/Application Support/PDFMathReader/engines'),
  runtimeHomeRoot: join(tmpdir(), 'reader-scheduling-assets'),
  getApiKey: () => 'simulation-only',
  providerFetch: async () => {
    if (slow) {
      entered?.();
      await new Promise((r) => setTimeout(r, 1500));
    }
    return Response.json({
      choices: [{ message: { content: 'Texte traduit pour ce paragraphe.' } }],
    });
  },
});
try {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let n = 1; n <= 2; n++) {
    const page = pdf.addPage();
    for (let j = 0; j < 3; j++)
      page.drawText(
        `Scientific scheduling fixture ${n === 1 ? 'first' : 'second'} paragraph ${j}. Text for translation.`,
        { font, x: 50, y: 700 - j * 90, size: 12 },
      );
  }
  const bytes = await pdf.save();
  const request = (page) =>
    fetch(
      backend.origin +
        '/api/math-page?' +
        new URLSearchParams({
          engine: 'pdf_math_fast',
          page,
          language: 'French',
          threads: 1,
          pageLimit: 1,
        }),
      { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: bytes },
    );
  const warm = await request(1);
  assert.equal(warm.status, 200);
  await warm.arrayBuffer();
  slow = true;
  const providerEntered = new Promise((r) => {
      entered = r;
    }),
    busy = request(2);
  await Promise.race([
    providerEntered,
    busy.then(() => {
      throw Error('Fixture did not reach the simulated provider');
    }),
  ]);
  const start = performance.now(),
    cached = await request(1);
  await cached.arrayBuffer();
  assert.equal(cached.status, 200);
  assert.equal(cached.headers.get('X-Translation-Cache'), 'hit');
  const cacheWhileBusyMs = performance.now() - start;
  const finished = await busy;
  assert.equal(finished.status, 200);
  await finished.arrayBuffer();
  const reports = (await (await fetch(backend.origin + '/api/kernel-performance')).json()).reports;
  const result = {
    providerDelayMs: 1500,
    pageLimit: 1,
    cacheWhileBusyMs,
    cachedQueueMs: reports.findLast((r) => r.cached).queueMs,
  };
  if (!process.env.SCHEDULING_SERVER) {
    assert.equal(result.cachedQueueMs, 0);
    assert.ok(cacheWhileBusyMs < 1000, 'Cached page waited behind live translation');
  }
  if (process.env.SCHEDULING_OUTPUT)
    await writeFile(process.env.SCHEDULING_OUTPUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await backend.close();
  await rm(dir, { recursive: true, force: true });
}
