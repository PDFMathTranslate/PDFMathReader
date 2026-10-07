import express from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { isTranslationLanguageSupported } from '../../shared/translation/languages.mjs';
import { mathProviderOutcome } from '../translation/provider-outcome.mjs';

export function registerKernelRoutes(
  app,
  {
    engines,
    cacheManager,
    documentCache,
    documentRequest,
    limiter,
    pageLimiter,
    proxyJobs,
    origin,
    kernelReports,
    kernelTiming,
    recentDebugLogs,
    providerRuntime,
    nextRequestId = { value: 0 },
    maxDocumentBytes,
  },
) {
  const { translationServices, providerFor, serviceHeader } = providerRuntime;
  app.post('/api/runtime/uv/install', async (_req, res) => {
    try {
      res.json(await engines.installUv());
    } catch {
      res
        .status(503)
        .json({ error: 'uv installation failed. Check your network connection and try again.' });
    }
  });
  app.get('/api/engines', async (_req, res) => res.json(await engines.startup()));
  app.get('/api/engines/:id', async (req, res) => {
    try {
      res.json(await engines.check(req.params.id));
    } catch {
      res.status(400).json({ error: 'Unknown kernel' });
    }
  });
  app.get('/api/engines/:id/services', async (req, res) => {
    try {
      res.json(await translationServices(req.params.id));
    } catch (error) {
      res.status(422).json({ error: error.message });
    }
  });
  app.get('/api/engines/:id/advanced', async (req, res) => {
    try {
      res.json(await engines.advanced(req.params.id, undefined, { cacheOnly: true }));
    } catch {
      res.status(400).json({ error: 'Unknown kernel' });
    }
  });
  app.post('/api/engines/:id/install', express.json({ limit: '10kb' }), async (req, res) => {
    try {
      res.json(
        await engines.install(req.params.id, {
          reinstall: req.body?.reinstall === true,
          source: req.body?.source === 'git' ? 'git' : 'release',
        }),
      );
    } catch (e) {
      res.status(503).json({ error: e.message });
    }
  });

  app.post(
    '/api/math-page',
    express.json({ limit: '100kb' }),
    express.raw({ type: 'application/pdf', limit: maxDocumentBytes }),
    async (req, res) =>
      cacheManager.runTask('kernel-translation', async () => {
        const { engine, language } = req.query;
        const entry = documentRequest(req);
        if (entry.error) return res.status(entry.error.status).json({ error: entry.error.message });
        const reuseTranslations = Buffer.isBuffer(req.body)
          ? true
          : (req.body?.reuseTranslations ?? true);
        if (typeof reuseTranslations !== 'boolean')
          return res.status(400).json({ error: 'Invalid translation cache preference' });
        const forceRetranslation = Buffer.isBuffer(req.body)
          ? false
          : (req.body?.forceRetranslation ?? false);
        if (typeof forceRetranslation !== 'boolean')
          return res.status(400).json({ error: 'Invalid force retranslation preference' });
        const cacheOnly = Buffer.isBuffer(req.body) ? false : (req.body?.cacheOnly ?? false);
        if (typeof cacheOnly !== 'boolean')
          return res.status(400).json({ error: 'Invalid cache lookup preference' });
        const sourceLanguage = Buffer.isBuffer(req.body) ? undefined : req.body?.sourceLanguage;
        if (
          sourceLanguage !== undefined &&
          !isTranslationLanguageSupported('pdf_inspector', sourceLanguage, 'source')
        )
          return res.status(400).json({ error: 'Invalid source language' });
        const advancedOptions = Buffer.isBuffer(req.body) ? {} : req.body?.advancedOptions;
        const page = Number(req.query.page),
          threads = Number(req.query.threads || 2),
          pageLimit = Number(req.query.pageLimit || 2);
        if (
          !['pdf_math_fast', 'pdf_math_precise'].includes(engine) ||
          !Number.isInteger(page) ||
          page < 1 ||
          !Number.isInteger(threads) ||
          threads < 1 ||
          threads > 12 ||
          !Number.isInteger(pageLimit) ||
          pageLimit < 1 ||
          pageLimit > 12 ||
          typeof language !== 'string' ||
          !isTranslationLanguageSupported(engine, language)
        )
          return res.status(400).json({ error: 'Invalid kernel request' });
        const glossary = req.body?.glossary || [];
        if (!validGlossaryEntries(glossary))
          return res.status(400).json({ error: 'Invalid glossary' });
        let provider;
        try {
          provider = await providerFor(
            req.body?.translationService,
            engine,
            sourceLanguage,
            language,
          );
        } catch (error) {
          return res.status(422).json({ error: error.message });
        }
        serviceHeader(res, provider);
        limiter.setMax(threads);
        pageLimiter.setMax(pageLimit);
        const controller = new AbortController();
        let queueMs = 0;
        const cacheScope = await documentCache.scope(
          entry.documentHash || createHash('sha256').update(entry.bytes),
        );
        const debugCapture = advancedOptions?.debug === true ? recentDebugLogs.begin(engine) : null;
        const job = {
            id: `translation-${++nextRequestId.value}`,
            state: 'running',
            kernel: engine,
            page,
            language,
            controller,
            error: '',
            provider,
            cacheScope,
            forceRetranslation,
            providerCalls: 0,
            providerQueueMs: 0,
            providerAggregateMs: 0,
            providerMaxMs: 0,
          },
          proxyToken = randomBytes(32).toString('hex');
        proxyJobs.set(proxyToken, job);
        res.on('close', () => {
          if (!res.writableEnded) controller.abort();
        });
        try {
          const bytes = await engines.translate({
            runWorker: (fn) => {
              const waitingAt = performance.now();
              return pageLimiter.run(
                () => {
                  queueMs = performance.now() - waitingAt;
                  return fn();
                },
                {
                  signal: controller.signal,
                  meta: { kind: 'kernel-translation', kernel: engine, page, language },
                },
              );
            },
            id: engine,
            bytes: entry.bytes,
            documentHash: entry.documentHash,
            page,
            language,
            sourceLanguage,
            threads,
            model: provider.model,
            proxy: { url: `${origin()}/kernel-proxy/v1`, token: proxyToken },
            signal: controller.signal,
            translationService: provider.native ? provider.selection : undefined,
            serviceIdentity: provider.id === 'apple-local' ? { service: 'apple-local' } : undefined,
            localTranslation: provider.id === 'apple-local',
            glossary,
            advancedOptions,
            reuseTranslations,
            forceRetranslation,
            cacheScope,
            onPageTiming: (timing) => {
              job.timing = timing;
            },
          });
          if (!bytes) return res.sendStatus(204);
          const report = {
            ...job.timing,
            queueMs,
            providerCalls: job.providerCalls,
            providerQueueMs: job.providerQueueMs,
            providerAggregateMs: job.providerAggregateMs,
            providerMaxMs: job.providerMaxMs,
          };
          kernelReports.push(report);
          if (kernelReports.length > 20) kernelReports.shift();
          kernelTiming?.(report);
          res.setHeader('X-Layout-Key', bytes.layoutKey);
          res.setHeader('X-Translation-Cache', bytes.cached ? 'hit' : 'miss');
          res.setHeader('X-Translation-Model', bytes.translationModel);
          const outcome = mathProviderOutcome({
            cached: bytes.cached,
            providerCalls: job.providerCalls,
            native: provider.native,
            cacheOnly,
          });
          if (outcome) res.setHeader('X-Translation-Outcome', outcome);
          res.type('application/pdf').send(bytes);
        } catch (e) {
          if (!res.destroyed) {
            const outcome = mathProviderOutcome({
              error: e,
              providerError: job.error,
              native: provider.native,
              cacheOnly,
            });
            if (outcome) res.setHeader('X-Translation-Outcome', outcome);
            res.status(422).json({ error: job.error || e.message });
          }
        } finally {
          proxyJobs.delete(proxyToken);
          debugCapture?.end();
        }
      }),
  );
  app.get('/api/math-layout/:key', async (req, res) =>
    cacheManager.runTask('math-layout', async () => {
      try {
        res.json(await engines.layout(req.params.key));
      } catch {
        res.status(404).json({ error: 'Paragraph layout is unavailable.' });
      }
    }),
  );
}

function validGlossaryEntries(value) {
  return (
    Array.isArray(value) &&
    value.length <= 5000 &&
    value.every(
      (entry) =>
        entry &&
        typeof entry.source === 'string' &&
        entry.source.length > 0 &&
        entry.source.length <= 500 &&
        typeof entry.target === 'string' &&
        entry.target.length > 0 &&
        entry.target.length <= 500,
    )
  );
}
