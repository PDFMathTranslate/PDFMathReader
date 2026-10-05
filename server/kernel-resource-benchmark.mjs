import { startServer } from './index.mjs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile),
  pause = (ms) => new Promise((r) => setTimeout(r, ms));
function seconds(s) {
  const p = s.split(':').map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
}
async function processes() {
  const { stdout } = await exec('/bin/ps', ['-axo', 'pid=,ppid=,time=,rss=,comm=']);
  const all = stdout
    .trim()
    .split('\n')
    .map((l) => {
      const m = l.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(.+)$/);
      return m
        ? { pid: +m[1], parent: +m[2], seconds: seconds(m[3]), rss: +m[4] * 1024, command: m[5] }
        : null;
    })
    .filter(Boolean);
  const ids = new Set([process.pid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of all)
      if (ids.has(p.parent) && !ids.has(p.pid)) {
        ids.add(p.pid);
        changed = true;
      }
  }
  return all.filter((p) => p.pid !== process.pid && ids.has(p.pid) && p.command !== '/bin/ps');
}
const dir = await mkdtemp(join(tmpdir(), 'pdf-kernel-benchmark-'));
const backend = await startServer({
  port: 0,
  development: false,
  cacheDir: dir,
  runtimeHomeRoot: join(tmpdir(), 'preview-kernel-test-homes'),
  enginesRoot: join(homedir(), 'Library/Application Support/PDFMathReader/engines'),
  getApiKey: () => 'simulation-only',
  providerFetch: async () => {
    await pause(400);
    return new Response(
      JSON.stringify({
        choices: [
          {
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
const rows = [];
try {
  for (const engine of ['pdf_math_fast', 'pdf_math_precise'])
    for (const enabled of [true, false]) {
      const state = await (await fetch(backend.origin + '/api/engines/' + engine)).json();
      if (!state.available) {
        rows.push({ engine, enabled, error: state.reason });
        continue;
      }
      const doc = await PDFDocument.create(),
        font = await doc.embedFont(StandardFonts.Helvetica),
        page = doc.addPage([612, 792]);
      for (let n = 0; n < 3; n++)
        page.drawText(
          `Scientific fixture ${engine} ${enabled} paragraph ${n}. This paragraph compares research results.`,
          { font, size: 12, x: 50, y: 690 - n * 90 },
        );
      const bytes = await doc.save();
      let done = false,
        previous = await processes(),
        previousTime = performance.now();
      const samples = [];
      const started = performance.now();
      const pending = fetch(
        backend.origin +
          '/api/math-page?' +
          new URLSearchParams({ engine, page: 1, language: 'French', threads: 2, pageLimit: 1 }),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/pdf' },
          body: bytes,
          signal: AbortSignal.timeout(60000),
        },
      )
        .then(async (r) => ({
          status: r.status,
          ...(r.ok
            ? { outputBytes: (await r.arrayBuffer()).byteLength }
            : { error: await r.text() }),
        }))
        .catch((e) => ({ error: e.message }))
        .finally(() => (done = true));
      while (!done) {
        await pause(250);
        const current = await processes(),
          time = performance.now(),
          old = new Map(previous.map((p) => [p.pid, p]));
        const elapsed = (time - previousTime) / 1000;
        samples.push({
          cpuPercent:
            (current.reduce(
              (sum, p) => sum + Math.max(0, p.seconds - (old.get(p.pid)?.seconds ?? 0)),
              0,
            ) /
              elapsed) *
            100,
          rssBytes: current.reduce((sum, p) => sum + p.rss, 0),
          count: current.length,
        });
        previous = current;
        previousTime = time;
      }
      const result = await pending;
      await pause(3000);
      const idle = await processes(),
        active = samples.filter((s) => s.count > 0);
      const row = {
        engine,
        version: state.version,
        enabled,
        labelOnly: true,
        settingScope: 'renderer; kernel execution path unchanged',
        durationMs: performance.now() - started - 3000,
        result,
        kernelCpuMeanPercent: active.length
          ? active.reduce((sum, s) => sum + s.cpuPercent, 0) / active.length
          : 0,
        kernelRssMeanBytes: active.length
          ? active.reduce((sum, s) => sum + s.rssBytes, 0) / active.length
          : 0,
        kernelRssPeakBytes: Math.max(0, ...samples.map((s) => s.rssBytes)),
        idleProcessCount: idle.length,
        idleRssBytes: idle.reduce((sum, p) => sum + p.rss, 0),
        samples,
      };
      rows.push(row);
      console.log('Kernel benchmark', JSON.stringify({ ...row, samples: undefined }));
    }
  await writeFile(
    resolve('doc/kernel-resource-benchmark.json'),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        method:
          'real kernels, local simulated provider (400ms/request), single page, two threads; ON/OFF labels use identical backend path, not full desktop/window benchmark; RSS summed, CPU cumulative deltas at 250ms intervals',
        rows,
      },
      null,
      2,
    ),
  );
} finally {
  await backend.close();
  await rm(dir, { recursive: true, force: true });
}
