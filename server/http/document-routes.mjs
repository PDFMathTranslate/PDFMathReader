import express from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { paragraphs } from '../documents/layout.mjs';

const LAYOUT_CACHE_SCHEMA = 1;
const DOCUMENT_HASH_PATTERN = /^[0-9a-f]{64}$/;
const CACHE_GENERATION_PATTERN = /^[a-z0-9-]+$/i;

async function persistentLayoutPath(entry, cacheManager, documentCache, page, height) {
  if (
    !entry?.documentHash ||
    typeof cacheManager?.directory !== 'string' ||
    typeof documentCache?.scope !== 'function'
  )
    return null;
  const scope = await documentCache.scope(entry.documentHash);
  if (typeof scope !== 'string') return null;
  const separator = scope.indexOf(':');
  if (separator <= 0) return null;
  const scopeHash = scope.slice(0, separator),
    generation = scope.slice(separator + 1);
  if (!DOCUMENT_HASH_PATTERN.test(scopeHash) || !CACHE_GENERATION_PATTERN.test(generation))
    return null;
  const key = createHash('sha256')
    .update(JSON.stringify({ page, height, schema: LAYOUT_CACHE_SCHEMA }))
    .digest('hex');
  return join(cacheManager.directory, 'documents', scopeHash, 'layout', generation, `${key}.json`);
}

async function readPersistentLayout(path) {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    return value && !Array.isArray(value) && Array.isArray(value.paragraphs)
      ? value.paragraphs
      : undefined;
  } catch {
    return undefined;
  }
}

async function writePersistentLayout(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temporary, JSON.stringify({ paragraphs: value }));
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

export function registerDocumentRoutes(
  app,
  {
    documents,
    isDocumentId,
    documentCache,
    layoutEntries,
    layoutExtraction,
    performanceTracker,
    cacheManager,
    maxDocumentBytes,
  },
) {
  app.post(
    '/api/documents',
    express.raw({ type: 'application/pdf', limit: maxDocumentBytes }),
    async (req, res) => {
      try {
        if (!Buffer.isBuffer(req.body))
          return res.status(400).json({ error: 'PDF body is required.' });
        const id = documents.register(req.body),
          entry = documents.getEntry(id);
        await documentCache
          .register(entry.documentHash, req.headers['x-document-name'])
          .catch(() => {});
        res.status(201).json({ id });
      } catch (e) {
        if (e?.status) return res.status(e.status).json({ error: e.message });
        res.status(400).json({ error: e.message });
      }
    },
  );
  app.delete('/api/documents/:id', (req, res) => {
    if (!isDocumentId(req.params.id) || !documents.delete(req.params.id))
      return res.status(404).json({ error: 'Document not found.' });
    const entry = layoutEntries.get(req.params.id);
    if (entry) {
      layoutExtraction.cleanup(entry);
      layoutEntries.delete(req.params.id);
    }
    res.status(204).end();
  });

  const documentRequest = (req) => {
    if (Buffer.isBuffer(req.body))
      return req.body.length
        ? { bytes: req.body }
        : { error: { status: 400, message: 'PDF body is required.' } };
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
      return { error: { status: 400, message: 'JSON body is required.' } };
    if (!isDocumentId(req.body.documentId))
      return { error: { status: 400, message: 'Invalid document id.' } };
    const entry = documents.getEntry(req.body.documentId);
    if (!entry) return { error: { status: 404, message: 'Document not found.' } };
    const stable = layoutEntries.get(entry.id);
    if (stable && stable.bytes === entry.bytes) return stable;
    layoutEntries.set(entry.id, entry);
    return entry;
  };

  app.post(
    '/api/translation-cache/clear',
    express.raw({ type: 'application/pdf', limit: maxDocumentBytes }),
    async (req, res) => {
      try {
        if (!Buffer.isBuffer(req.body) || !req.body.subarray(0, 1024).includes(Buffer.from('%PDF')))
          return res.status(400).json({ error: 'Invalid PDF' });
        await cacheManager.withMaintenance(() =>
          documentCache.clear(createHash('sha256').update(req.body)),
        );
        res.sendStatus(204);
      } catch (e) {
        res
          .status(e?.status === 409 ? 409 : 500)
          .json({ error: e.message, busy: e?.status === 409 });
      }
    },
  );

  app.post(
    '/api/layout',
    express.json({ limit: '100kb' }),
    express.raw({ type: 'application/pdf', limit: maxDocumentBytes }),
    async (req, res) =>
      cacheManager.runTask('layout', async () => {
        const layoutStarted = performanceTracker.now();
        try {
          const entry = documentRequest(req);
          if (entry.error)
            return res.status(entry.error.status).json({ error: entry.error.message });
          const legacy = Buffer.isBuffer(req.body),
            source = legacy ? req.query : req.body;
          if (!legacy && (typeof source.page !== 'number' || typeof source.height !== 'number'))
            return res.status(400).json({ error: 'Invalid PDF or page' });
          const page = Number(source.page),
            height = Number(source.height);
          if (!Number.isInteger(page) || page < 1 || !Number.isFinite(height) || height <= 0)
            return res.status(400).json({ error: 'Invalid PDF or page' });
          const cachePath = legacy
            ? null
            : await persistentLayoutPath(entry, cacheManager, documentCache, page, height);
          const cached = cachePath ? await readPersistentLayout(cachePath) : undefined;
          if (cached !== undefined)
            return res.json({ paragraphs: cached, engine: 'pdf-inspector' });
          const items = await layoutExtraction.extractPage(legacy ? entry.bytes : entry, page),
            result = paragraphs(items, height);
          if (cachePath) await writePersistentLayout(cachePath, result).catch(() => {});
          res.json({ paragraphs: result, engine: 'pdf-inspector' });
        } catch (e) {
          res.status(422).json({ error: e.message });
        } finally {
          performanceTracker.recordLayout(performanceTracker.now() - layoutStarted);
        }
      }),
  );
  return { documentRequest };
}
