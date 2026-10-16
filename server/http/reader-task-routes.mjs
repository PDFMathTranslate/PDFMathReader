import express from 'express';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

function errorStatus(error) {
  return Number.isInteger(error?.status) ? error.status : 500;
}

function errorMessage(error) {
  return error?.status && error.status < 500
    ? String(error.message || 'Invalid reader task request.')
    : 'Reader task request failed.';
}

export function registerReaderTaskRoutes(app, { readerTasks }) {
  if (!readerTasks) throw Error('Reader task routes require a task service.');

  app.post('/api/reader-tasks', express.json({ limit: '256kb' }), (req, res) => {
    try {
      const task = readerTasks.create(req.body);
      res.status(202).json({ id: task.id });
    } catch (error) {
      res.status(errorStatus(error)).json({ error: errorMessage(error) });
    }
  });

  app.get('/api/reader-tasks/:id', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const task = readerTasks.get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Reader task not found.' });
    res.json(readerTasks.status(task));
  });

  app.get('/api/reader-tasks/:id/pages/:number', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const number = Number(req.params.number);
    if (!Number.isInteger(number) || number < 1)
      return res.status(400).json({ error: 'Invalid page number.' });
    const task = readerTasks.get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Reader task not found.' });
    const page = readerTasks.page(task.id, number);
    if (!page) return res.status(404).json({ error: 'Page is not part of this reader task.' });
    if (page.state === 'queued' || page.state === 'running')
      return res.status(202).json({ state: 'pending', progress: page.progress || null });
    if (page.state === 'cancelled')
      return res.status(409).json({ error: 'Reader task cancelled.' });
    if (page.state === 'failed')
      return res.status(422).json({ error: page.error || 'Page failed.' });
    if (page.resultKind === 'empty') return res.sendStatus(204);
    if (!page.resultPath) return res.status(404).json({ error: 'Page result unavailable.' });
    try {
      await stat(page.resultPath);
      if (page.resultKind === 'inspector') {
        res.type('application/json');
        return createReadStream(page.resultPath)
          .on('error', () => {
            if (!res.headersSent) res.status(404).json({ error: 'Page result unavailable.' });
            else res.destroy();
          })
          .pipe(res);
      }
      for (const [name, value] of Object.entries(page.resultHeaders || {})) {
        if (name === 'content-type') continue;
        res.setHeader(name, value);
      }
      res.type('application/pdf');
      return createReadStream(page.resultPath)
        .on('error', () => {
          if (!res.headersSent) res.status(404).json({ error: 'Page result unavailable.' });
          else res.destroy();
        })
        .pipe(res);
    } catch {
      return res.status(404).json({ error: 'Page result unavailable.' });
    }
  });

  app.delete('/api/reader-tasks/:id', (req, res) => {
    try {
      if (!readerTasks.cancel(req.params.id))
        return res.status(404).json({ error: 'Reader task not found.' });
      res.sendStatus(204);
    } catch (error) {
      res.status(errorStatus(error)).json({ error: errorMessage(error) });
    }
  });
}
