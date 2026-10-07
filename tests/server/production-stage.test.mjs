import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { stageApplication } from '../../electron/build/production-stage.mjs';

test('production bundle serves and extracts PDFs without an external Express installation', async () => {
  const { stage, packages } = await stageApplication();
  let backend;
  try {
    await access(join(stage, 'electron/preload.cjs'));
    await access(join(stage, 'electron/main/backend/backend-process.mjs'));
    for (const name of ['kernel-worker.py', 'kernel-options.py', 'kernel-services.py'])
      await access(join(stage, 'server/kernels/python', name));
    await access(join(stage, 'server/platform/macos/local-translation.swift'));
    await access(join(stage, 'server/formula/formula-ocr-worker.mjs'));
    await access(
      join(stage, 'node_modules/onnxruntime-node/bin/napi-v6', process.platform, process.arch),
    );
    assert.ok(!packages.includes('express'));
    await assert.rejects(access(join(stage, 'node_modules/express')));
    await access(join(stage, 'licenses/express/LICENSE'));
    const { startServer } = await import(pathToFileURL(join(stage, 'server/index.mjs')));
    backend = await startServer({
      port: 0,
      development: false,
      cacheDir: join(stage, 'cache'),
      token: 'package-test',
    });
    const headers = { 'X-Preview-Token': 'package-test' };
    assert.equal((await fetch(backend.origin, { headers })).status, 200);
    assert.equal((await fetch(backend.origin)).status, 403);
    const formulaStatus = await fetch(backend.origin + '/api/formula-ocr/status', { headers });
    assert.equal(formulaStatus.status, 200);
    assert.equal((await formulaStatus.json()).ready, false);
    const pdf = await PDFDocument.create(),
      font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf
      .addPage([612, 792])
      .drawText('Bundled extraction fixture', { x: 48, y: 700, size: 16, font });
    const response = await fetch(backend.origin + '/api/documents', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/pdf' },
      body: await pdf.save(),
    });
    assert.equal(response.status, 201);
    const { id } = await response.json();
    const layout = await fetch(backend.origin + '/api/layout', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: id, page: 1, height: 792 }),
    });
    assert.equal(layout.status, 200);
    assert.ok(
      (await layout.json()).paragraphs.some((p) => p.text.includes('Bundled extraction fixture')),
    );
  } finally {
    await backend?.close();
    await rm(stage, { recursive: true, force: true });
  }
});
