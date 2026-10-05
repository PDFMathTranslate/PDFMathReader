// Real Fast kernel, deterministic local provider; never makes paid requests.
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { extractTextWithPositionsAsync } from '@firecrawl/pdf-inspector';
import { startServer } from './index.mjs';
const dir = await mkdtemp(join(tmpdir(), 'fast-benchmark-')),
  reports = [];
const delay = Number(process.env.FAST_BENCHMARK_PROVIDER_MS || 200);
let providerCalls = 0,
  providerMs = 0;
const backend = await startServer({
  port: 0,
  development: false,
  cacheDir: dir,
  enginesRoot: join(homedir(), 'Library/Application Support/PDFMathReader/engines'),
  runtimeHomeRoot: join(tmpdir(), 'fast-benchmark-assets'),
  kernelDiagnostic: (message) => process.stderr.write(message),
  kernelTiming: (r) => reports.push(r),
  getApiKey: () => 'simulation-only',
  providerFetch: async () => {
    const start = performance.now();
    providerCalls++;
    await new Promise((r) => setTimeout(r, delay));
    providerMs += performance.now() - start;
    return new Response(
      JSON.stringify({
        id: 'mock',
        object: 'chat.completion',
        model: 'mock',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'Texte traduit pour ce paragraphe scientifique.',
            },
          },
        ],
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  },
});
try {
  const doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = Number(process.env.FAST_BENCHMARK_PAGES || 30);
  for (let i = 0; i < pages; i++) {
    const p = doc.addPage([612, 792]),
      angle = process.env.FAST_BENCHMARK_ROTATE ? (i % 4) * 90 : 0;
    for (let j = 0; j < 6; j++) {
      const position =
        angle === 90
          ? { x: 100 + j * 80, y: 80 }
          : angle === 180
            ? { x: 550, y: 90 + j * 90 }
            : angle === 270
              ? { x: 550 - j * 80, y: 700 }
              : { x: 50, y: 700 - j * 90 };
      p.drawText(`Benchmark page ${i + 1}, paragraph ${j + 1}. Scientific text for translation.`, {
        font,
        ...position,
        rotate: degrees(angle),
        size: 12,
      });
    }
  }
  for (const p of process.env.FAST_BENCHMARK_ROTATE ? doc.getPages() : [doc.getPage(0)])
    p.setCropBox(20, 30, 572, 732);
  if (process.env.FAST_BENCHMARK_ROTATE)
    doc.getPages().forEach((p, i) => p.setRotation(degrees((i % 4) * 90)));
  const bytes = await doc.save();
  const timings = [];
  for (const page of process.env.FAST_BENCHMARK_ROTATE
    ? [1, 2, 3, 4, 1]
    : [1, Math.ceil(pages / 2), pages, 1]) {
    const start = performance.now(),
      before = providerCalls,
      oldMs = providerMs;
    const response = await fetch(
      backend.origin +
        '/api/math-page?' +
        new URLSearchParams({
          engine: 'pdf_math_fast',
          page,
          language: 'French',
          threads: 4,
          pageLimit: 2,
        }),
      { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: bytes },
    );
    if (!response.ok) throw Error(JSON.stringify(await response.json()));
    const outputBytes = Buffer.from(await response.arrayBuffer()),
      output = await PDFDocument.load(outputBytes);
    assert.equal(output.getPageCount(), 1);
    assert.deepEqual(output.getPage(0).getCropBox(), doc.getPage(page - 1).getCropBox());
    assert.equal(output.getPage(0).getRotation().angle, doc.getPage(page - 1).getRotation().angle);
    const layout = await (
      await fetch(backend.origin + '/api/math-layout/' + response.headers.get('X-Layout-Key'))
    ).json();
    assert.ok(layout.paragraphs.some((b) => b.translation.includes('Texte traduit')));
    assert.ok(layout.paragraphs.every((b) => b.page === page));
    if (page === 1) assert.ok(Math.abs(layout.paragraphs[0].sourceBox.x - 30) < 1);
    const row = {
      page,
      wallMs: performance.now() - start,
      providerCalls: providerCalls - before,
      providerAggregateMs: providerMs - oldMs,
      ...reports.at(-1),
    };
    timings.push(row);
    console.log(JSON.stringify(row));
    const text = (await extractTextWithPositionsAsync(outputBytes, [1], { frame: 'display' }))
      .map((i) => i.text)
      .join(' ');
    assert.ok(text.includes('Texte traduit'));
    assert.ok(layout.paragraphs.some((b) => b.text.includes(`Benchmark page ${page},`)));
  }
  const snapshot = await (await fetch(backend.origin + '/api/kernel-performance')).json();
  assert.equal(snapshot.reports.length, timings.length);
  assert.ok(
    snapshot.reports.every(
      (r) => typeof r.queueMs === 'number' && typeof r.providerCalls === 'number',
    ),
  );
  const result = { pages, delayMs: delay, timings };
  if (process.env.FAST_BENCHMARK_OUTPUT)
    await writeFile(process.env.FAST_BENCHMARK_OUTPUT, JSON.stringify(result, null, 2));
} finally {
  await backend.close();
  await rm(dir, { recursive: true, force: true });
}
