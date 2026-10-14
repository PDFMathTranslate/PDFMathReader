import express from 'express';

const json = express.json({ limit: '2mb' });
const fail = (res, error) =>
  res.status(error?.status === 400 ? 400 : 500).json({ error: error?.message || 'Failed' });

export function registerTermCorpusRoutes(app, { termCorpus }) {
  // Without terms this only asks whether the document is already sampled.
  app.post('/api/term-corpus/documents', json, async (req, res) => {
    try {
      const { id, terms } = req.body || {};
      res.json(terms === undefined ? await termCorpus.touch(id) : await termCorpus.add(id, terms));
    } catch (error) {
      fail(res, error);
    }
  });
  app.post('/api/term-corpus/frequencies', json, async (req, res) => {
    try {
      res.json(await termCorpus.frequencies(req.body?.exclude, req.body?.terms));
    } catch (error) {
      fail(res, error);
    }
  });
}
