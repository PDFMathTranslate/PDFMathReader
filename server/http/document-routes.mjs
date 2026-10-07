import express from 'express';
import { createHash } from 'node:crypto';
import { paragraphs } from '../documents/layout.mjs';

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
          const items = await layoutExtraction.extractPage(legacy ? entry.bytes : entry, page);
          res.json({ paragraphs: paragraphs(items, height), engine: 'pdf-inspector' });
        } catch (e) {
          res.status(422).json({ error: e.message });
        } finally {
          performanceTracker.recordLayout(performanceTracker.now() - layoutStarted);
        }
      }),
  );
  return { documentRequest };
}
