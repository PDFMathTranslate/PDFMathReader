export function registerDiagnosticMiddleware(
  app,
  { developerDiagnostics, proxyJobs, token, origin, nextRequestId = { value: 0 } },
) {
  app.use((req, res, next) => {
    if (
      !developerDiagnostics.isEnabled() ||
      req.path.startsWith('/api/developer/') ||
      req.path === '/api/cache/activity' ||
      !['/api/', '/kernel-proxy/'].some((prefix) => req.path.startsWith(prefix))
    )
      return next();
    const proxyJob = req.path.startsWith('/kernel-proxy/')
      ? proxyJobs.get(String(req.headers.authorization || '').replace(/^Bearer /, ''))
      : null;
    if (
      req.path.startsWith('/kernel-proxy/')
        ? !proxyJob
        : token && req.headers['x-preview-token'] !== token
    )
      return next();
    const started = performance.now(),
      id = ++nextRequestId.value,
      path = req.path.slice(0, 512);
    const candidate =
      proxyJob?.kernel ||
      req.query.engine ||
      path.match(/^\/api\/engines\/([^/]+)/)?.[1] ||
      (path === '/api/translate' ? 'pdf_inspector' : null);
    const kernel = ['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise'].includes(candidate)
      ? candidate
      : null;
    const page = Number(req.query.page || proxyJob?.page),
      pageInfo = Number.isSafeInteger(page) && page > 0 ? ` page=${page}` : '';
    const requestBytes = Number(req.headers['content-length']);
    const bytesInfo =
      Number.isSafeInteger(requestBytes) && requestBytes >= 0 ? ` bytes=${requestBytes}` : '';
    developerDiagnostics.record({
      kind: 'http-request',
      kernel,
      pid: process.pid,
      message: `#${id} ${req.method} ${path}${pageInfo}${bytesInfo}`,
    });
    let traced = false;
    const trace = () => {
      if (traced) return;
      traced = true;
      const responseBytes = Number(res.getHeader('content-length'));
      const size =
        Number.isSafeInteger(responseBytes) && responseBytes >= 0 ? ` bytes=${responseBytes}` : '';
      developerDiagnostics.record({
        kind: 'http-response',
        kernel,
        pid: process.pid,
        message: `#${id} ${req.method} ${path} status=${res.statusCode}${res.writableFinished ? '' : ' aborted'} latencyMs=${Math.round((performance.now() - started) * 100) / 100}${size}`,
      });
    };
    res.once('finish', trace);
    res.once('close', trace);
    next();
  });
}

export function registerAccessMiddleware(app, { token, origin, development }) {
  app.use((req, res, next) => {
    if (token && req.headers['x-preview-token'] !== token) return res.sendStatus(403);
    if (req.headers.host !== new URL(origin()).host) return res.sendStatus(403);
    next();
  });
  // Local browser clients only. Reject cross-origin requests before processing data.
  app.use((req, res, next) => {
    const serverOrigin = origin();
    if (
      req.headers.origin &&
      req.headers.origin !== serverOrigin &&
      !(development && req.headers.origin === 'http://localhost:5173')
    )
      return res.status(403).json({ error: 'Origin rejected' });
    next();
  });
}

export function registerPerformanceMiddleware(app, performanceTracker) {
  // Install before any route body parser so byte counts reflect the actual streams.
  app.use(performanceTracker.middleware);
}

export function registerErrorMiddleware(app) {
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    if (error?.type === 'entity.too.large' || error?.status === 413)
      return res.status(413).json({ error: 'PDF exceeds the 50 MiB limit.' });
    if (error?.status === 400) return res.status(400).json({ error: 'Invalid request body.' });
    return next(error);
  });
}
