const MAX_SAFE_BYTES = Number.MAX_SAFE_INTEGER;

function clock() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function bodyByteLength(value, encoding = 'utf8') {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'string')
    return Buffer.byteLength(value, typeof encoding === 'string' ? encoding : 'utf8');
  if (Buffer.isBuffer(value)) return value.byteLength;
  if (value instanceof Uint8Array) return value.byteLength;
  if (value instanceof ArrayBuffer) return value.byteLength;
  return 0;
}

function addBytes(total, value) {
  return Math.min(MAX_SAFE_BYTES, total + bodyByteLength(value));
}
function duration(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
function timing(value) {
  return {
    requests: value.requests,
    totalDurationMs: value.totalDurationMs,
    maxDurationMs: value.maxDurationMs,
    lastDurationMs: value.lastDurationMs,
  };
}

export function createPerformanceTracker({ uploadStats = () => ({}), now = clock } = {}) {
  let requestCount = 0,
    requestBodyBytes = 0,
    responseBodyBytes = 0;
  const layout = { requests: 0, totalDurationMs: 0, maxDurationMs: 0, lastDurationMs: 0 };
  const nativeExtraction = { requests: 0, totalDurationMs: 0, maxDurationMs: 0, lastDurationMs: 0 };

  function recordTiming(target, value) {
    const elapsed = duration(value);
    target.requests++;
    target.totalDurationMs += elapsed;
    target.maxDurationMs = Math.max(target.maxDurationMs, elapsed);
    target.lastDurationMs = elapsed;
  }

  function middleware(req, res, next) {
    requestCount++;
    req.on('data', (chunk) => {
      requestBodyBytes = addBytes(requestBodyBytes, chunk);
    });
    const write = res.write,
      end = res.end;
    res.write = function (chunk, ...args) {
      responseBodyBytes = Math.min(
        MAX_SAFE_BYTES,
        responseBodyBytes + bodyByteLength(chunk, typeof args[0] === 'string' ? args[0] : 'utf8'),
      );
      return write.call(this, chunk, ...args);
    };
    res.end = function (chunk, ...args) {
      responseBodyBytes = Math.min(
        MAX_SAFE_BYTES,
        responseBodyBytes + bodyByteLength(chunk, typeof args[0] === 'string' ? args[0] : 'utf8'),
      );
      return end.call(this, chunk, ...args);
    };
    next();
  }

  function snapshot() {
    const stats = uploadStats?.() || {};
    const uploadBytes =
      Number.isSafeInteger(stats.uploadBytes) && stats.uploadBytes >= 0 ? stats.uploadBytes : 0;
    return {
      schemaVersion: 1,
      requests: requestCount,
      requestBodyBytes,
      responseBodyBytes,
      layout: timing(layout),
      nativeExtraction: timing(nativeExtraction),
      uploadBytes,
    };
  }

  return {
    middleware,
    now,
    recordLayout: (elapsed) => recordTiming(layout, elapsed),
    recordNativeExtraction: (elapsed) => recordTiming(nativeExtraction, elapsed),
    snapshot,
  };
}
