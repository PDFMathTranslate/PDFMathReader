import { applicationPath } from '../runtime/node/application-paths.mjs';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDocumentCache } from './documents/document-cache.mjs';
import { createDocumentStore, isDocumentId, MAX_DOCUMENT_BYTES } from './documents/documents.mjs';
import { createLayoutExtraction } from './documents/layout-extraction.mjs';
import { extractTextWithPositionsAsync } from './documents/pdf-extractor.mjs';
import { createPerformanceTracker } from './diagnostics/performance.mjs';
import { createDeveloperDiagnostics } from './diagnostics/developer-diagnostics.mjs';
import {
  createDeveloperTests,
  developerMockCompletion,
  developerTestSecretValues,
  DEVELOPER_TEST_TIMEOUT_MS,
} from './diagnostics/developer-tests.mjs';
import {
  createRecentDebugLogs,
  isRecentDebugLogEngine,
  mergeRecentDebugLogEvents,
} from './diagnostics/recent-debug-logs.mjs';
import { createCacheManager } from './cache/cache-management.mjs';
import { createEngines, createLimiter } from './kernels/engines.mjs';
import { createLocalTranslation } from './platform/macos/local-translation.mjs';
import { createTranslationRuntime } from './translation/provider-runtime.mjs';
import { isProviderPortOpen } from './http/provider-port.mjs';
import {
  registerAccessMiddleware,
  registerDiagnosticMiddleware,
  registerErrorMiddleware,
  registerPerformanceMiddleware,
} from './http/middleware.mjs';
import { registerProxyRoutes } from './http/proxy-routes.mjs';
import { registerCacheRoutes } from './http/cache-routes.mjs';
import {
  registerDeveloperRoutes,
  registerProviderPortRoute,
  registerStatusRoutes,
} from './http/diagnostic-routes.mjs';
import { registerDocumentRoutes } from './http/document-routes.mjs';
import { registerKernelRoutes } from './http/kernel-routes.mjs';
import { registerTranslationRoutes } from './http/translation-routes.mjs';

export async function startServer({
  port = 5173,
  development = true,
  cacheDir = resolve('.cache/translations'),
  cacheLimitMB = null,
  token,
  diagnostics = false,
  kernelDiagnostic,
  kernelTiming,
  pythonResourcesPath,
  providerFetch = globalThis.fetch,
  localTranslationImpl,
  enginesRoot = join(cacheDir, '..', 'engines'),
  runtimeHomeRoot = enginesRoot,
  appVersion = 'development',
  findUvImpl,
  execImpl,
  getApiKey = () => process.env.OPENAI_API_KEY,
  keyStatus = () => ({ keySource: process.env.OPENAI_API_KEY ? 'environment' : 'none' }),
} = {}) {
  const app = express();
  const developerDiagnostics = createDeveloperDiagnostics({
    secrets: () => {
      try {
        return [getApiKey?.()];
      } catch {
        return [];
      }
    },
  });
  const recentDebugLogs = createRecentDebugLogs({
    redact: (value, options) => developerDiagnostics.redact(value, options),
  });
  const recentLogs = {
    isEngine: isRecentDebugLogEngine,
    snapshot: (engine) => recentDebugLogs.snapshot(engine),
    merge: (groups) => mergeRecentDebugLogEvents(groups),
    begin: (engine) => recentDebugLogs.begin(engine),
  };
  const sessionId = randomBytes(16).toString('hex');
  let origin;
  let engines;
  const localTranslator =
    localTranslationImpl ||
    createLocalTranslation({
      resourcesPath: pythonResourcesPath,
      cacheRoot: join(cacheDir, '..', 'native'),
      onProcess: (child, file) =>
        engines?.observeProcess(child, file, {
          kernel: 'apple-local',
          name: 'Apple Translation',
          args: [],
        }),
    });
  const documents = createDocumentStore();
  const documentCache = createDocumentCache(cacheDir);
  const providerLimiter = createLimiter(4, { label: 'provider' });
  const pageLimiter = createLimiter(2, { label: 'kernel-pages' });
  const proxyJobs = new Map();
  const kernelReports = [];
  const nextRequestId = { value: 0 };
  const nextDiagnosticRequestId = { value: 0 };
  engines = createEngines({
    root: enginesRoot,
    runtimeHomeRoot,
    appVersion,
    cacheDir: join(cacheDir, 'math'),
    onDiagnostic: (message) => kernelDiagnostic?.(developerDiagnostics.redact(message)),
    onKernelEvent: (event) => {
      const diagnosticEvent = developerDiagnostics.record(event);
      recentDebugLogs.record(event, { diagnosticEvent });
    },
    pythonResourcesPath,
    findUvImpl,
    execImpl,
  });
  const providerRuntime = createTranslationRuntime({
    engines,
    localTranslator,
    providerFetch,
    cacheDirectory: join(cacheDir, 'text'),
    appVersion,
    getApiKey,
    sessionId,
    developerMockCompletion,
  });
  const performanceTracker = createPerformanceTracker({ uploadStats: documents.stats });
  const layoutEntries = new Map();
  const layoutExtraction = createLayoutExtraction({
    extractor: extractTextWithPositionsAsync,
    onNativeExtraction: (elapsed) => performanceTracker.recordNativeExtraction(elapsed),
    now: () => performanceTracker.now(),
  });
  const cacheManager = createCacheManager({
    directory: cacheDir,
    documentCache,
    limitMB: cacheLimitMB,
    isBusy: () =>
      proxyJobs.size > 0 ||
      providerLimiter.snapshot().tasks.length > 0 ||
      pageLimiter.snapshot().tasks.length > 0 ||
      (engines.tasks?.().length || 0) > 0,
  });
  await cacheManager.start();
  const developerTests = createDeveloperTests({
    engines,
    layoutExtraction,
    providerFor: providerRuntime.providerFor,
    complete: providerRuntime.complete,
    limiter: providerLimiter,
    pageLimiter,
    proxyJobs,
    proxyUrl: () => `${origin}/kernel-proxy/v1`,
  });
  const diagnosticQueues = () => [pageLimiter.snapshot(), providerLimiter.snapshot()];
  const diagnosticTasks = () => {
    const tasks = [...(engines.tasks?.() || [])];
    for (const queue of diagnosticQueues()) tasks.push(...queue.tasks);
    for (const job of proxyJobs.values())
      tasks.push({
        id: job.id,
        label: 'Translation request',
        kind: 'translation-request',
        kernel: job.kernel,
        state: job.state || 'running',
        page: job.page,
        language: job.language,
      });
    return tasks;
  };

  registerDiagnosticMiddleware(app, {
    developerDiagnostics,
    proxyJobs,
    token,
    nextRequestId: nextDiagnosticRequestId,
  });
  registerProxyRoutes(app, {
    limiter: providerLimiter,
    proxyJobs,
    localTranslator,
    providerClient: providerRuntime.providerClient,
  });
  registerAccessMiddleware(app, { token, origin: () => origin, development });
  registerPerformanceMiddleware(app, performanceTracker);

  registerProviderPortRoute(app, isProviderPortOpen);
  registerCacheRoutes(app, { cacheManager });
  registerDeveloperRoutes(app, {
    developerDiagnostics,
    recentDebugLogs: recentLogs,
    engines,
    cacheManager,
    developerTests,
    developerTestSecretValues,
    developerTestTimeoutMs: DEVELOPER_TEST_TIMEOUT_MS,
    diagnosticTasks,
    diagnosticQueues,
  });
  const { documentRequest } = registerDocumentRoutes(app, {
    documents,
    isDocumentId,
    documentCache,
    layoutEntries,
    layoutExtraction,
    performanceTracker,
    cacheManager,
    maxDocumentBytes: MAX_DOCUMENT_BYTES,
  });
  registerKernelRoutes(app, {
    engines,
    cacheManager,
    documentCache,
    documentRequest,
    limiter: providerLimiter,
    pageLimiter,
    proxyJobs,
    origin: () => origin,
    kernelReports,
    kernelTiming,
    recentDebugLogs,
    providerRuntime,
    maxDocumentBytes: MAX_DOCUMENT_BYTES,
    nextRequestId,
  });
  registerStatusRoutes(app, {
    kernelReports,
    performanceTracker,
    diagnostics,
    documents,
    sessionId,
    getApiKey,
    keyStatus,
  });
  registerTranslationRoutes(app, {
    limiter: providerLimiter,
    cacheManager,
    cacheDir,
    documentCache,
    documents,
    providerRuntime,
    getApiKey,
  });

  registerErrorMiddleware(app);
  let vite;
  if (development) {
    const { createServer } = await import('vite');
    vite = await createServer({
      server: { middlewareMode: true, hmr: { host: '127.0.0.1' } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use((_req, res, next) => {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'",
      );
      next();
    });
    app.use(express.static(applicationPath('dist')));
  }
  const server = await new Promise((accept, reject) => {
    const listener = app.listen(port, '127.0.0.1', () => accept(listener));
    listener.on('error', reject);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  let closed = false;
  return {
    origin,
    documentStats: documents.stats,
    close: async () => {
      if (closed) return;
      closed = true;
      for (const entry of layoutEntries.values()) layoutExtraction.cleanup(entry);
      layoutEntries.clear();
      documents.clear();
      server.closeAllConnections();
      await engines.close();
      await localTranslator.close?.();
      await new Promise((r) => server.close(r));
      await vite?.close();
      await cacheManager.close();
    },
  };
}
