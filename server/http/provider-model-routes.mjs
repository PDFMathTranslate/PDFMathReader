import express from 'express';

const MAX_BASE_URL_LENGTH = 2_048;
const MAX_API_KEY_LENGTH = 8_192;
const MAX_MODEL_ENTRIES = 1_000;
const MAX_MODEL_ID_LENGTH = 512;
const PROVIDER_TIMEOUT_MS = 15_000;

const INVALID_REQUEST = 'Invalid provider model request.';
const MISSING_API_KEY = 'A provider API key is required.';
const FETCH_ERROR = 'Unable to load provider models.';
const INVALID_RESULT = 'Provider returned an invalid model list.';
const EMPTY_RESULT = 'Provider returned no models.';
const TIMEOUT_ERROR = 'Provider model request timed out.';

export function registerProviderModelRoutes(
  app,
  {
    providerFetch = globalThis.fetch,
    getApiKey = () => undefined,
    timeoutMs = PROVIDER_TIMEOUT_MS,
  } = {},
) {
  app.post('/api/providers/models', express.json({ limit: '16kb' }), async (req, res) => {
    const request = validateRequest(req.body, getApiKey);
    if (!request.ok) return res.status(request.status).json({ error: request.error });

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : PROVIDER_TIMEOUT_MS,
    );
    timeout.unref?.();
    const onClose = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.once('close', onClose);
    try {
      if (typeof providerFetch !== 'function') throw Error('Provider fetch is unavailable.');
      const response = await providerFetch(request.endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${request.apiKey}`,
        },
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response?.ok) return sendJson(res, 502, { error: FETCH_ERROR });
      const payload = await response.json();
      const models = validateModels(payload);
      if (models === null) return sendJson(res, 502, { error: INVALID_RESULT });
      if (!models.length) return sendJson(res, 502, { error: EMPTY_RESULT });
      return sendJson(res, 200, { models });
    } catch {
      return sendJson(res, controller.signal.aborted ? 504 : 502, {
        error: controller.signal.aborted ? TIMEOUT_ERROR : FETCH_ERROR,
      });
    } finally {
      clearTimeout(timeout);
      res.off('close', onClose);
    }
  });
}

function validateRequest(body, getApiKey) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return { ok: false, status: 400, error: INVALID_REQUEST };
  const { baseUrl, apiKey, useSharedKey } = body;
  const endpoint = normalizeBaseUrl(baseUrl);
  if (!endpoint) return { ok: false, status: 400, error: INVALID_REQUEST };
  if (apiKey !== undefined && typeof apiKey !== 'string')
    return { ok: false, status: 400, error: INVALID_REQUEST };
  if (typeof apiKey === 'string' && apiKey.length > MAX_API_KEY_LENGTH)
    return { ok: false, status: 400, error: INVALID_REQUEST };
  if (useSharedKey !== undefined && typeof useSharedKey !== 'boolean')
    return { ok: false, status: 400, error: INVALID_REQUEST };

  let secret = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!secret && useSharedKey === true) {
    try {
      const sharedKey = getApiKey?.();
      if (typeof sharedKey === 'string' && sharedKey.length <= MAX_API_KEY_LENGTH)
        secret = sharedKey.trim();
    } catch {
      secret = '';
    }
  }
  if (!secret) return { ok: false, status: 400, error: MISSING_API_KEY };
  if (secret.length > MAX_API_KEY_LENGTH) return { ok: false, status: 400, error: INVALID_REQUEST };
  return { ok: true, endpoint, apiKey: secret };
}

function normalizeBaseUrl(value) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > MAX_BASE_URL_LENGTH ||
    value.includes('?') ||
    value.includes('#')
  )
    return null;
  try {
    const normalized = value.trim();
    const url = new URL(normalized);
    const authority = normalized.slice(normalized.indexOf('://') + 3).split(/[/?#]/, 1)[0];
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !url.hostname ||
      authority.includes('@') ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/models`;
    return url.href;
  } catch {
    return null;
  }
}

function validateModels(payload) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    !Array.isArray(payload.data) ||
    payload.data.length > MAX_MODEL_ENTRIES
  )
    return null;
  const ids = [];
  for (const entry of payload.data) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      typeof entry.id !== 'string' ||
      !entry.id.trim() ||
      entry.id.length > MAX_MODEL_ID_LENGTH
    )
      return null;
    ids.push(entry.id);
  }
  return [...new Set(ids)].sort();
}

function sendJson(res, status, body) {
  if (res.destroyed) return;
  res.status(status).json(body);
}
