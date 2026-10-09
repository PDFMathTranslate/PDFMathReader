import express from 'express';

export function registerCacheRoutes(app, { cacheManager }) {
  app.post('/api/cache/activity', (_req, res) => {
    cacheManager.noteActivity();
    res.sendStatus(204);
  });
  app.get('/api/cache', async (_req, res) => {
    try {
      res.json(await cacheManager.stats());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  const cacheResponse = ({ bytes, limitMB }) => ({ bytes, limitMB });
  app.post('/api/cache/limit', express.json({ limit: '4kb' }), async (req, res) => {
    try {
      res.json(cacheResponse(await cacheManager.setLimit(req.body?.limitMB)));
    } catch (error) {
      res.status(error?.status === 400 ? 400 : 500).json({ error: error.message });
    }
  });
  app.post('/api/cache/clear', express.json({ limit: '4kb' }), async (_req, res) => {
    try {
      res.json(cacheResponse(await cacheManager.clear()));
    } catch (error) {
      res
        .status(error?.status === 409 ? 409 : 500)
        .json({ error: error.message, busy: error?.status === 409 });
    }
  });
  app.post('/api/cache/document/clear', express.json({ limit: '4kb' }), async (req, res) => {
    try {
      res.json(await cacheManager.clearDocument(req.body?.id));
    } catch (error) {
      res
        .status([400, 404, 409].includes(error?.status) ? error.status : 500)
        .json({ error: error.message, busy: error?.status === 409 });
    }
  });
}
