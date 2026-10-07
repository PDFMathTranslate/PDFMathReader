import { app } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const exec = promisify(execFile),
  pause = (ms) => new Promise((r) => setTimeout(r, ms));
function seconds(value) {
  const parts = value.split(':').map(Number);
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
}
async function snapshot(root) {
  const { stdout } = await exec('/bin/ps', ['-axo', 'pid=,ppid=,time=,rss=,comm=']);
  const all = stdout
    .trim()
    .split('\n')
    .map((line) => {
      const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(.+)$/);
      return m
        ? { pid: +m[1], parent: +m[2], seconds: seconds(m[3]), rss: +m[4] * 1024, command: m[5] }
        : null;
    })
    .filter(Boolean);
  const ids = new Set([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of all)
      if (ids.has(p.parent) && !ids.has(p.pid)) {
        ids.add(p.pid);
        changed = true;
      }
  }
  return all.filter((p) => ids.has(p.pid) && p.command !== '/bin/ps');
}
export async function verifyResourceBenchmark(window) {
  const enabled = process.env.PDF_RESOURCE_SAVING !== '0',
    evaluate = (code) => window.webContents.executeJavaScript(code);
  async function wait(code) {
    for (let i = 0; i < 200; i++) {
      if (await evaluate(code)) return;
      await pause(100);
    }
    throw Error('Benchmark state timeout: ' + code);
  }
  await wait('window.previewReady===true');
  const preferences = {
    reduceResourceUsage: enabled,
    automatic: false,
    documentOpenMode: 'original',
    interactionMode: 'comparison',
  };
  await evaluate(`window.previewPreferences.save(${JSON.stringify(preferences)})`);
  window.webContents.send('preferences:changed', preferences);
  await evaluate(
    "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('sample')).click()",
  );
  window.show();
  window.focus();
  await wait('window.previewRenderDiagnostics().residentBytes>0');
  const rows = [];
  for (const state of ['foreground', 'inactive', 'minimized']) {
    window.restore();
    window.show();
    window.focus();
    await wait('window.previewRenderDiagnostics().residentBytes>0');
    await pause(500);
    if (state === 'inactive') window.blur();
    if (state === 'minimized') window.minimize();
    await wait(
      `window.previewRenderDiagnostics().foreground===${!enabled || state === 'foreground'}`,
    );
    await pause(3000);
    let previous = await snapshot(process.pid),
      time = performance.now();
    const samples = [];
    for (let i = 0; i < 10; i++) {
      await pause(1000);
      const current = await snapshot(process.pid),
        next = performance.now(),
        elapsed = (next - time) / 1000,
        old = new Map(previous.map((p) => [p.pid, p]));
      const cpu =
        (current.reduce(
          (n, p) => n + Math.max(0, p.seconds - (old.get(p.pid)?.seconds ?? p.seconds)),
          0,
        ) /
          elapsed) *
        100;
      samples.push({
        cpuPercent: cpu,
        rssBytes: current.reduce((n, p) => n + p.rss, 0),
        processes: current,
      });
      previous = current;
      time = next;
    }
    const d = await evaluate('window.previewRenderDiagnostics()');
    const row = {
      enabled,
      state,
      kernel: 'idle',
      cpuMeanPercent: samples.reduce((n, s) => n + s.cpuPercent, 0) / samples.length,
      rssMeanBytes: samples.reduce((n, s) => n + s.rssBytes, 0) / samples.length,
      rssPeakBytes: Math.max(...samples.map((s) => s.rssBytes)),
      bitmapBytes: d.residentBytes,
      bitmapCacheBytes: d.cache.bytes,
      foreground: d.foreground,
      kernelProcessCount: previous.filter((p) => /kernel-worker|pdf2zh|python/i.test(p.command))
        .length,
      samples,
    };
    rows.push(row);
    console.log('Resource benchmark row', JSON.stringify({ ...row, samples: undefined }));
  }
  const report = {
    date: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    enabled,
    measurement:
      'ps process-tree cumulative CPU delta; summed RSS (shared pages may be counted twice)',
    sampleSeconds: 10,
    settleSeconds: 3,
    document:
      'built-in sample, original view, comparison rendering, automatic translation disabled',
    rows,
  };
  await writeFile(
    resolve(`doc/resource-benchmark-${enabled ? 'on' : 'off'}.json`),
    JSON.stringify(report, null, 2),
  );
  app.quit();
}
