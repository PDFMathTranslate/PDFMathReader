import express from 'express';

export function registerFormulaOcrRoutes(app, { service }) {
  app.get('/api/formula-ocr/status', async (_req, res) => {
    try {
      res.json(await service.status());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post('/api/formula-ocr/download', async (_req, res) => {
    try {
      await service.download();
      res.json(await service.status());
    } catch (error) {
      res.status(503).json({ error: error.message });
    }
  });
  app.post(
    '/api/formula-ocr/recognize',
    express.raw({ type: 'image/png', limit: '16mb' }),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length)
        return res.status(400).json({ error: 'A formula PNG image is required.' });
      const controller = new AbortController();
      const disconnected = () => {
        if (!res.writableFinished) controller.abort();
      };
      res.once('close', disconnected);
      try {
        const result = await service.recognize(req.body, { signal: controller.signal });
        res.json(typeof result === 'string' ? { latex: result.trim() } : result);
      } catch (error) {
        if (!res.destroyed) res.status(503).json({ error: error.message });
      } finally {
        res.off('close', disconnected);
      }
    },
  );
}
