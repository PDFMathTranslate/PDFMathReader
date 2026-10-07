import express from 'express';

export function registerProviderPortRoute(app, providerPort) {
  app.post('/api/providers/ports', express.json({ limit: '4kb' }), async (req, res) => {
    const endpoints = req.body?.endpoints;
    if (
      !Array.isArray(endpoints) ||
      endpoints.length > 2 ||
      endpoints.some(
        (item) =>
          !['ollama', 'xinference'].includes(item?.id?.toLowerCase()) ||
          typeof item.url !== 'string' ||
          item.url.length > 2048,
      )
    )
      return res.sendStatus(400);
    res.json(
      Object.fromEntries(
        await Promise.all(endpoints.map(async (item) => [item.id, await providerPort(item.url)])),
      ),
    );
  });
}

export function registerDeveloperRoutes(
  app,
  {
    developerDiagnostics,
    recentDebugLogs,
    engines,
    cacheManager,
    developerTests,
    developerTestSecretValues,
    developerTestTimeoutMs,
    diagnosticTasks,
    diagnosticQueues,
  },
) {
  app.get('/api/developer/snapshot', async (_req, res) => {
    if (!developerDiagnostics.isEnabled()) return res.json(developerDiagnostics.snapshot());
    let processReport = { available: true, cpuPercentBasis: 'interval', processes: [] };
    try {
      processReport = await engines.processes();
    } catch (error) {
      processReport = {
        available: false,
        reason: error?.message || 'Process sampling failed.',
        processes: [],
      };
    }
    const { processes, ...processesStatus } = processReport;
    res.json(
      developerDiagnostics.snapshot({
        tasks: diagnosticTasks(),
        queues: diagnosticQueues(),
        processes,
        processesStatus,
      }),
    );
  });
  app.post('/api/developer/enabled', express.json({ limit: '4kb' }), (req, res) => {
    if (typeof req.body?.enabled !== 'boolean')
      return res.status(400).json({ error: 'enabled must be a boolean' });
    res.json({ enabled: developerDiagnostics.setEnabled(req.body.enabled) });
  });
  app.get('/api/developer/recent-logs', (req, res) => {
    const engine = req.query.engine;
    if (!recentDebugLogs.isEngine(engine)) return res.status(400).json({ error: 'Invalid engine' });
    const diagnosticEvents = developerDiagnostics.isEnabled()
      ? developerDiagnostics.snapshot().events.filter((event) => event.kernel === engine)
      : [];
    res.json({
      events: recentDebugLogs.merge([diagnosticEvents, recentDebugLogs.snapshot(engine)]),
    });
  });
  app.post(
    '/api/developer/test',
    (req, res, next) => {
      if (!developerDiagnostics.isEnabled())
        return res.status(403).json({
          status: 'error',
          message: 'Developer diagnostics must be enabled.',
          elapsedMs: 0,
        });
      next();
    },
    express.json({ limit: '100kb' }),
    async (req, res) =>
      cacheManager.runTask('developer-test', async () => {
        const started = performance.now(),
          controller = new AbortController();
        let timedOut = false,
          disconnected = false;
        const timeout = setTimeout(() => {
          timedOut = true;
          controller.abort(Error('Developer test timed out.'));
        }, developerTestTimeoutMs);
        timeout.unref?.();
        const onDisconnect = () => {
          if (!res.writableEnded) {
            disconnected = true;
            controller.abort(Error('Developer test client disconnected.'));
          }
        };
        req.once('aborted', onDisconnect);
        res.once('close', onDisconnect);
        const secrets = developerTestSecretValues(req.body);
        const elapsed = () => Math.max(0, Math.round(performance.now() - started));
        const safe = (value) => developerDiagnostics.redact(value, { secrets, maxLength: 4_000 });
        const debugCapture =
          req.body?.advancedOptions?.debug === true
            ? recentDebugLogs.begin(req.body?.engine)
            : null;
        try {
          const result = await developerTests.run(req.body, {
            signal: controller.signal,
            controller,
          });
          if (res.destroyed || disconnected) return;
          const payload = {
            status: 'success',
            message: safe(result.message),
            elapsedMs: elapsed(),
          };
          if (typeof result.output === 'string' && result.output)
            payload.output = safe(result.output);
          res.json(payload);
        } catch (error) {
          if (res.destroyed || disconnected) return;
          const message = timedOut
            ? 'Developer test timed out after 90 seconds.'
            : safe(error?.message || 'Developer test failed.');
          res
            .status(error?.status === 400 ? 400 : 422)
            .json({ status: 'error', message, elapsedMs: elapsed() });
        } finally {
          clearTimeout(timeout);
          req.removeListener('aborted', onDisconnect);
          res.removeListener('close', onDisconnect);
          debugCapture?.end();
        }
      }),
  );
}

export function registerStatusRoutes(
  app,
  { kernelReports, performanceTracker, diagnostics, documents, sessionId, getApiKey, keyStatus },
) {
  app.get('/api/kernel-performance', (_req, res) =>
    res.json({ schemaVersion: 1, reports: kernelReports }),
  );
  app.get('/api/performance', (_req, res) => res.json(performanceTracker.snapshot()));
  app.get('/api/config', (_req, res) =>
    res.json({
      sessionId,
      ...keyStatus(),
      configured: !!getApiKey(),
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    }),
  );
  if (diagnostics) app.get('/api/document-stats', (_req, res) => res.json(documents.stats()));
}
