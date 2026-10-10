import { createServer } from 'node:http';
import { createHash, createPublicKey, createVerify, randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { replaceFile } from '../../../runtime/node/atomic-file.mjs';
import { CHATGPT_INFERENCE_TIMEOUT_MS } from '../../../shared/translation/timeouts.mjs';

const ISSUER = 'https://auth.openai.com';
const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;
const DEFAULT_AUTHORIZATION_ENDPOINT = `${ISSUER}/api/accounts/authorize`;
const DEFAULT_TOKEN_ENDPOINT = `${ISSUER}/api/accounts/oauth/token`;
const DEFAULT_REVOCATION_ENDPOINT = `${ISSUER}/api/accounts/oauth/revoke`;
const DEFAULT_JWKS_URI = `${ISSUER}/.well-known/jwks.json`;
const RESOURCE = 'https://api.openai.com/v1';
const MODELS_URL = `${RESOURCE}/models`;
const RESPONSES_URL = `${RESOURCE}/responses`;
const DYNAMIC_CLIENT_ID = 'dynamic_agent_client';
const REQUIRED_SCOPE = 'chatgpt.tokens.use.direct';
const REQUIRED_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'resource.invoke',
  REQUIRED_SCOPE,
];
const CALLBACK_PATH = '/auth/callback';
const DEFAULT_AGENT_NAME = 'PDFMathReader';
const DEFAULT_AUTH_TIMEOUT = 5 * 60 * 1000;
const DEFAULT_NETWORK_TIMEOUT = 30 * 1000;
const REFRESH_SKEW = 60 * 1000;
const responseSignals = new WeakMap();

const PUBLIC_ERRORS = Object.freeze({
  closed: 'ChatGPT authentication service is closed.',
  unavailable: 'ChatGPT authentication is unavailable.',
  inProgress: 'A ChatGPT sign-in is already in progress.',
  cancelled: 'ChatGPT sign-in was cancelled.',
  timedOut: 'ChatGPT sign-in timed out.',
  callback: 'ChatGPT sign-in callback was invalid.',
  exchange: 'ChatGPT sign-in could not be completed.',
  identity: 'ChatGPT account identity could not be verified.',
  permission: 'This ChatGPT account has not granted plan usage permission.',
  account: 'The selected ChatGPT account is unavailable.',
  switched: 'The ChatGPT account changed while the request was running.',
  interrupted: 'The ChatGPT request was interrupted.',
  refresh: 'The ChatGPT session could not be refreshed.',
  expired: 'The ChatGPT session has expired. Sign in again.',
  models: 'ChatGPT models could not be loaded.',
  inference: 'ChatGPT inference could not be completed.',
  signOut: 'ChatGPT sign-out could not be confirmed remotely.',
  usageLimit: 'ChatGPT plan usage limit reached.',
  usageUnavailable: 'ChatGPT plan usage is temporarily unavailable.',
  storage: 'Secure ChatGPT credentials are unavailable and remain in memory.',
  savedCredentials: 'Saved ChatGPT credentials could not be unlocked.',
});

function publicError(code, message) {
  const error = Error(message);
  error.code = code;
  return error;
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

function isString(value, max = 4096) {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= max && !/[\r\n]/.test(value)
  );
}

function validClientId(value) {
  return isString(value, 512) && !/\s/.test(value);
}

function validHostId(value) {
  return (
    typeof value === 'string' &&
    /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function scopesFrom(value) {
  if (typeof value === 'string') return [...new Set(value.trim().split(/\s+/).filter(Boolean))];
  if (Array.isArray(value)) return [...new Set(value.filter((item) => typeof item === 'string'))];
  return [];
}

function hasDirectScope(account) {
  return Array.isArray(account?.scopes) && account.scopes.includes(REQUIRED_SCOPE);
}

function signedIn(account) {
  return !!account?.accessToken && hasDirectScope(account);
}

function clearAccountTokens(account) {
  return {
    clientId: account.clientId,
    email: account.email || '',
    subject: account.subject || '',
    issuer: account.issuer || ISSUER,
    idToken: '',
    accessToken: '',
    refreshToken: '',
    tokenType: '',
    expiresAt: 0,
    scopes: [],
  };
}

function normalizeAccount(clientId, value) {
  if (!validClientId(clientId) || !isRecord(value)) return null;
  const subject = typeof value.subject === 'string' ? value.subject : '';
  const account = {
    clientId,
    email: typeof value.email === 'string' ? value.email : '',
    subject,
    issuer: typeof value.issuer === 'string' ? value.issuer : ISSUER,
    idToken:
      typeof value.idToken === 'string'
        ? value.idToken
        : typeof value.id_token === 'string'
          ? value.id_token
          : '',
    accessToken:
      typeof value.accessToken === 'string'
        ? value.accessToken
        : typeof value.access_token === 'string'
          ? value.access_token
          : '',
    refreshToken:
      typeof value.refreshToken === 'string'
        ? value.refreshToken
        : typeof value.refresh_token === 'string'
          ? value.refresh_token
          : '',
    tokenType:
      typeof value.tokenType === 'string'
        ? value.tokenType
        : typeof value.token_type === 'string'
          ? value.token_type
          : 'Bearer',
    expiresAt: Number.isFinite(value.expiresAt)
      ? value.expiresAt
      : Number.isFinite(value.expires_at)
        ? value.expires_at
        : 0,
    scopes: scopesFrom(value.scopes ?? value.scope),
  };
  if (!account.subject && account.idToken) return null;
  return account;
}

function normalizeState(value) {
  if (!isRecord(value)) return { activeClientId: null, accounts: new Map() };
  const accounts = new Map();
  const rawAccounts = Array.isArray(value.accounts)
    ? Object.fromEntries(value.accounts.map((account) => [account?.clientId, account]))
    : isRecord(value.accounts)
      ? value.accounts
      : {};
  for (const [clientId, raw] of Object.entries(rawAccounts)) {
    const account = normalizeAccount(clientId, raw);
    if (account) accounts.set(clientId, account);
  }
  const activeClientId =
    validClientId(value.activeClientId) && accounts.has(value.activeClientId)
      ? value.activeClientId
      : null;
  return { activeClientId, accounts };
}

function serializeState(activeClientId, accounts) {
  return JSON.stringify({
    version: 1,
    activeClientId,
    accounts: Object.fromEntries([...accounts].map(([clientId, account]) => [clientId, account])),
  });
}

function base64urlDecode(value) {
  if (typeof value !== 'string' || !value) throw publicError('JWT_INVALID', PUBLIC_ERRORS.identity);
  return Buffer.from(value, 'base64url');
}

function decodeJsonSegment(value) {
  try {
    return JSON.parse(base64urlDecode(value).toString('utf8'));
  } catch {
    throw publicError('JWT_INVALID', PUBLIC_ERRORS.identity);
  }
}

function decodeJwt(token) {
  if (!isString(token, 65536)) throw publicError('JWT_INVALID', PUBLIC_ERRORS.identity);
  const parts = token.split('.');
  if (parts.length !== 3) throw publicError('JWT_INVALID', PUBLIC_ERRORS.identity);
  return {
    header: decodeJsonSegment(parts[0]),
    claims: decodeJsonSegment(parts[1]),
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: base64urlDecode(parts[2]),
  };
}

function audienceIncludes(audience, expected) {
  return audience === expected || (Array.isArray(audience) && audience.includes(expected));
}

function validAudience(claims, expected) {
  if (!audienceIncludes(claims?.aud, expected)) return false;
  if (claims?.azp !== undefined && claims.azp !== expected) return false;
  return !Array.isArray(claims.aud) || claims.aud.length < 2 || claims.azp === expected;
}

function randomSecret(size = 32) {
  return randomBytes(size).toString('base64url');
}

function pkceChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}

function responseStatus(response) {
  return Number.isFinite(response?.status) ? response.status : 0;
}

function responseOK(response) {
  const status = responseStatus(response);
  return response?.ok === true || (response?.ok === undefined && status >= 200 && status < 300);
}

function isAbortError(error, signal) {
  return signal?.aborted || error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

function abortError(signal) {
  if (signal?.reason?.name === 'TimeoutError')
    return publicError('NETWORK_TIMEOUT', 'The ChatGPT network request timed out.');
  return publicError('ABORTED', PUBLIC_ERRORS.interrupted);
}

function raceWithSignal(operation, signal, onAbort) {
  if (!signal) return Promise.resolve().then(operation);
  if (signal.aborted) {
    onAbort?.();
    return Promise.reject(abortError(signal));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener('abort', abort);
    const abort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      onAbort?.();
      reject(abortError(signal));
    };
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve()
      .then(operation)
      .then(
        (value) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(value);
        },
        (error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        },
      );
  });
}

function cancelBody(response, reader) {
  for (const target of [reader, response?.body, response]) {
    try {
      const result = target?.cancel?.();
      if (result && typeof result.catch === 'function') void result.catch(() => {});
    } catch {
      // A body may already be closed or locked by the response helper.
    }
  }
}

async function readBodyText(body, signal) {
  const decoder = new TextDecoder();
  let text = '';
  if (typeof body?.getReader === 'function') {
    const reader = body.getReader();
    try {
      while (true) {
        const item = await raceWithSignal(
          () => reader.read(),
          signal,
          () => cancelBody({ body }, reader),
        );
        if (item.done) break;
        text +=
          typeof item.value === 'string'
            ? item.value
            : decoder.decode(item.value, { stream: true });
      }
    } finally {
      if (signal?.aborted) cancelBody({ body }, reader);
      try {
        reader.releaseLock?.();
      } catch {
        // A stalled reader can reject release while its read is being cancelled.
      }
    }
    return text + decoder.decode();
  }
  if (typeof body?.[Symbol.asyncIterator] === 'function') {
    const iterator = body[Symbol.asyncIterator]();
    const cancelIterator = () => {
      try {
        const result = iterator.return?.();
        if (result && typeof result.catch === 'function') void result.catch(() => {});
      } catch {
        // Ignore a body iterator that is already closing.
      }
    };
    try {
      while (true) {
        const item = await raceWithSignal(() => iterator.next(), signal, cancelIterator);
        if (item.done) break;
        text +=
          typeof item.value === 'string'
            ? item.value
            : decoder.decode(item.value, { stream: true });
      }
    } finally {
      if (signal?.aborted) cancelIterator();
    }
    return text + decoder.decode();
  }
  throw publicError('RESPONSE_BODY', PUBLIC_ERRORS.unavailable);
}

async function responseJSON(response, signal) {
  try {
    const bodySignal = signal || responseSignals.get(response);
    if (
      response?.body &&
      (typeof response.body.getReader === 'function' ||
        typeof response.body[Symbol.asyncIterator] === 'function')
    ) {
      const text = await readBodyText(response.body, bodySignal);
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }
    if (typeof response?.text === 'function') {
      const text = await raceWithSignal(
        () => response.text(),
        bodySignal,
        () => cancelBody(response),
      );
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }
    if (typeof response?.json === 'function')
      return await raceWithSignal(
        () => response.json(),
        bodySignal,
        () => cancelBody(response),
      );
  } catch (error) {
    if (error?.code === 'ABORTED' || error?.code === 'NETWORK_TIMEOUT') throw error;
    return null;
  }
  return null;
}

async function fetchWithTimeout(fetcher, url, options, timeoutMs) {
  const parentSignal = options?.signal;
  const controller = new AbortController();
  if (parentSignal?.aborted) throw publicError('ABORTED', PUBLIC_ERRORS.interrupted);
  const timeoutSignal =
    typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(Math.max(1, timeoutMs))
      : (() => {
          const timeoutController = new AbortController();
          const timer = setTimeout(
            () => timeoutController.abort(new DOMException('Timeout', 'TimeoutError')),
            Math.max(1, timeoutMs),
          );
          timer.unref?.();
          return timeoutController.signal;
        })();
  const signals = [parentSignal, controller.signal, timeoutSignal].filter(Boolean);
  const linkedSignal =
    typeof AbortSignal.any === 'function'
      ? AbortSignal.any(signals)
      : (() => {
          const linkedController = new AbortController();
          for (const signal of signals) {
            if (signal.aborted) linkedController.abort(signal.reason);
            else
              signal.addEventListener('abort', () => linkedController.abort(signal.reason), {
                once: true,
              });
          }
          return linkedController.signal;
        })();
  const request = () => fetcher(url, { ...options, signal: linkedSignal });
  try {
    const response = await raceWithSignal(request, linkedSignal);
    if (response && (typeof response === 'object' || typeof response === 'function'))
      responseSignals.set(response, linkedSignal);
    return response;
  } catch (error) {
    if (parentSignal?.aborted) throw publicError('ABORTED', PUBLIC_ERRORS.interrupted);
    if (timeoutSignal.aborted)
      throw publicError('NETWORK_TIMEOUT', 'The ChatGPT network request timed out.');
    throw error;
  }
}

function urlString(value, fallback) {
  return typeof value === 'string' && /^https:\/\//i.test(value) ? value : fallback;
}

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function delay(ms, signal) {
  if (signal?.aborted) return Promise.reject(publicError('ABORTED', PUBLIC_ERRORS.interrupted));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(publicError('ABORTED', PUBLIC_ERRORS.interrupted));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

async function consumeSSE(body, { signal, onEvent }) {
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = '';
  let data = [];
  let completed = false;

  const dispatch = async () => {
    if (!data.length) {
      eventName = '';
      return;
    }
    const raw = data.join('\n');
    data = [];
    const name = eventName;
    eventName = '';
    if (raw === '[DONE]') return;
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      throw publicError('SSE_INVALID', PUBLIC_ERRORS.inference);
    }
    const type = typeof value?.type === 'string' ? value.type : name;
    const result = await onEvent(type, value);
    if (result === true) completed = true;
  };

  const consumeLine = async (line) => {
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (!line) {
      await dispatch();
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') eventName = value;
    else if (field === 'data') data.push(value);
  };

  const processChunk = async (chunk) => {
    if (signal?.aborted) throw abortError(signal);
    buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    while (true) {
      const newline = buffer.indexOf('\n');
      if (newline < 0) break;
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      await consumeLine(line);
      if (completed) return true;
    }
    return completed;
  };

  if (typeof body?.getReader === 'function') {
    const reader = body.getReader();
    try {
      while (true) {
        const item = await raceWithSignal(
          () => reader.read(),
          signal,
          () => cancelBody(body, reader),
        );
        if (item.done) break;
        if (await processChunk(item.value)) return true;
      }
    } finally {
      if (signal?.aborted || completed) cancelBody(body, reader);
      try {
        reader.releaseLock?.();
      } catch {
        // A stalled reader can reject release while its read is being cancelled.
      }
    }
  } else if (typeof body?.[Symbol.asyncIterator] === 'function') {
    const iterator = body[Symbol.asyncIterator]();
    const cancelIterator = () => {
      try {
        const result = iterator.return?.();
        if (result && typeof result.catch === 'function') void result.catch(() => {});
      } catch {
        // Ignore a body iterator that is already closing.
      }
    };
    try {
      while (true) {
        const item = await raceWithSignal(() => iterator.next(), signal, cancelIterator);
        if (item.done) break;
        if (await processChunk(item.value)) return true;
      }
    } finally {
      if (signal?.aborted || completed) cancelIterator();
    }
  } else if (typeof body?.text === 'function') {
    const text = await raceWithSignal(
      () => body.text(),
      signal,
      () => cancelBody(body),
    );
    if (await processChunk(text)) return true;
  }
  buffer += decoder.decode();
  if (buffer) await consumeLine(buffer);
  await dispatch();
  return completed;
}

function responseText(response) {
  if (!isRecord(response)) return '';
  if (typeof response.output_text === 'string') return response.output_text;
  const output = asArray(response.output);
  const pieces = [];
  for (const item of output) {
    for (const content of asArray(item?.content)) {
      if (content?.type === 'output_text' && typeof content.text === 'string')
        pieces.push(content.text);
    }
  }
  return pieces.join('');
}

function responseFailure(event, status) {
  const code = [
    event?.code,
    event?.error?.code,
    event?.response?.error?.code,
    event?.response?.incomplete_details?.reason,
  ].find((value) => typeof value === 'string');
  if (code === 'subscription_sharing_usage_limit_exceeded')
    return publicError('USAGE_LIMIT', PUBLIC_ERRORS.usageLimit);
  if (code === 'subscription_sharing_usage_unavailable')
    return publicError('USAGE_UNAVAILABLE', PUBLIC_ERRORS.usageUnavailable);
  const detail = typeof event?.detail === 'string' ? event.detail : event?.error?.message;
  const unsupported =
    typeof detail === 'string' && /^Unsupported parameter: ([a-z_]+)\.?$/i.exec(detail);
  if (
    unsupported &&
    [
      'temperature',
      'top_p',
      'max_output_tokens',
      'text',
      'tools',
      'tool_choice',
      'parallel_tool_calls',
      'reasoning',
    ].includes(unsupported[1])
  )
    return publicError(
      'REQUEST',
      `ChatGPT Subscription does not support the request parameter: ${unsupported[1]}.`,
    );
  if (Number.isInteger(status))
    return publicError('REQUEST', `ChatGPT Subscription request failed (HTTP ${status}).`);
  return publicError('INFERENCE', PUBLIC_ERRORS.inference);
}

function normalizeUsage(usage) {
  if (!isRecord(usage)) return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const prompt = finiteNumber(usage.prompt_tokens, finiteNumber(usage.input_tokens));
  const completion = finiteNumber(usage.completion_tokens, finiteNumber(usage.output_tokens));
  const total = finiteNumber(usage.total_tokens, prompt + completion);
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: total,
  };
}

function toResponseContent(content) {
  if (typeof content === 'string') return content;
  if (content == null) return '';
  if (!Array.isArray(content)) throw publicError('BODY_INVALID', PUBLIC_ERRORS.inference);
  return content.map((part) => {
    if (!isRecord(part)) throw publicError('BODY_INVALID', PUBLIC_ERRORS.inference);
    if (part.type === 'text' || part.type === 'input_text') {
      if (typeof part.text !== 'string') throw publicError('BODY_INVALID', PUBLIC_ERRORS.inference);
      return { type: 'input_text', text: part.text };
    }
    if (part.type === 'image_url') {
      const imageUrl = typeof part.image_url === 'string' ? part.image_url : part.image_url?.url;
      if (!isString(imageUrl, 2 * 1024 * 1024))
        throw publicError('BODY_INVALID', PUBLIC_ERRORS.inference);
      return { type: 'input_image', image_url: imageUrl };
    }
    if (part.type === 'input_image' && isString(part.image_url, 2 * 1024 * 1024)) {
      return { type: 'input_image', image_url: part.image_url };
    }
    throw publicError('BODY_INVALID', PUBLIC_ERRORS.inference);
  });
}

function messagesToInput(messages) {
  if (!Array.isArray(messages) || !messages.length)
    throw publicError('BODY_INVALID', PUBLIC_ERRORS.inference);
  return messages.map((message) => {
    if (!isRecord(message) || !isString(message.role, 64))
      throw publicError('BODY_INVALID', PUBLIC_ERRORS.inference);
    const result = { role: message.role, content: toResponseContent(message.content) };
    if (typeof message.name === 'string' && message.name.length <= 256) result.name = message.name;
    return result;
  });
}

function responseFormatToText(responseFormat) {
  if (responseFormat === undefined) return undefined;
  if (!isRecord(responseFormat) || !isString(responseFormat.type, 64))
    throw publicError('BODY_INVALID', PUBLIC_ERRORS.inference);
  if (responseFormat.type === 'json_schema') {
    const schema = responseFormat.json_schema;
    if (!isRecord(schema) || !isString(schema.name, 256) || !isRecord(schema.schema))
      throw publicError('BODY_INVALID', PUBLIC_ERRORS.inference);
    return {
      format: {
        type: 'json_schema',
        name: schema.name,
        strict: schema.strict !== false,
        schema: schema.schema,
      },
    };
  }
  if (responseFormat.type === 'json_object') return { format: { type: 'json_object' } };
  if (responseFormat.type === 'text') return { format: { type: 'text' } };
  throw publicError('BODY_INVALID', PUBLIC_ERRORS.inference);
}

function toResponsesBody(body) {
  if (!isRecord(body) || !isString(body.model, 512))
    throw publicError('BODY_INVALID', PUBLIC_ERRORS.inference);
  const payload = {
    model: body.model,
    input: messagesToInput(body.messages),
    store: false,
    stream: true,
  };
  const format = responseFormatToText(body.response_format);
  if (format) payload.text = format;
  // ChatGPT plan inference rejects API sampling overrides that native OpenAI
  // translators send by default (for example temperature: 0).
  if (Number.isFinite(body.max_output_tokens)) payload.max_output_tokens = body.max_output_tokens;
  else if (Number.isFinite(body.max_completion_tokens))
    payload.max_output_tokens = body.max_completion_tokens;
  else if (Number.isFinite(body.max_tokens)) payload.max_output_tokens = body.max_tokens;
  if (body.reasoning && isRecord(body.reasoning)) payload.reasoning = body.reasoning;
  if (Array.isArray(body.tools)) payload.tools = body.tools;
  if (body.tool_choice !== undefined) payload.tool_choice = body.tool_choice;
  if (body.parallel_tool_calls !== undefined)
    payload.parallel_tool_calls = !!body.parallel_tool_calls;
  return payload;
}

async function verifyIDToken(
  token,
  {
    clientId,
    nonce,
    discovery,
    fetcher,
    signal,
    timeoutMs = DEFAULT_NETWORK_TIMEOUT,
    now = Date.now(),
  },
) {
  const decoded = decodeJwt(token);
  const { header, claims, signingInput, signature } = decoded;
  if (header.alg !== 'RS256' || !isString(header.kid, 512))
    throw publicError('JWT_INVALID', PUBLIC_ERRORS.identity);
  const jwksUri = urlString(discovery.jwks_uri, DEFAULT_JWKS_URI);
  let response;
  try {
    response = await fetchWithTimeout(
      fetcher,
      jwksUri,
      { headers: { accept: 'application/json' }, signal },
      timeoutMs,
    );
  } catch (error) {
    if (isAbortError(error, signal)) throw publicError('ABORTED', PUBLIC_ERRORS.interrupted);
    throw publicError('JWKS_UNAVAILABLE', PUBLIC_ERRORS.identity);
  }
  if (!responseOK(response)) throw publicError('JWKS_UNAVAILABLE', PUBLIC_ERRORS.identity);
  const document = await responseJSON(response, responseSignals.get(response) || signal);
  const key = asArray(document?.keys).find((candidate) => candidate?.kid === header.kid);
  if (!key || key.kty !== 'RSA' || (key.alg && key.alg !== 'RS256') || !key.n || !key.e)
    throw publicError('JWT_KEY_MISSING', PUBLIC_ERRORS.identity);
  let verified = false;
  try {
    const publicKey = createPublicKey({ key, format: 'jwk' });
    const verifier = createVerify('RSA-SHA256');
    verifier.update(signingInput);
    verifier.end();
    verified = verifier.verify(publicKey, signature);
  } catch {
    verified = false;
  }
  if (!verified) throw publicError('JWT_INVALID', PUBLIC_ERRORS.identity);
  const issuer = typeof claims.iss === 'string' ? claims.iss : '';
  const expectedIssuer = typeof discovery.issuer === 'string' ? discovery.issuer : ISSUER;
  if (issuer !== expectedIssuer || !validAudience(claims, clientId))
    throw publicError('JWT_INVALID', PUBLIC_ERRORS.identity);
  if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= now)
    throw publicError('JWT_EXPIRED', PUBLIC_ERRORS.identity);
  if (!isString(claims.nonce, 4096) || claims.nonce !== nonce || !isString(claims.sub, 4096))
    throw publicError('JWT_INVALID', PUBLIC_ERRORS.identity);
  return claims;
}

export async function createChatGPTSubscription({
  path,
  safeStorage,
  openExternal,
  fetcher = globalThis.fetch,
  platform = process.platform,
  agentName = DEFAULT_AGENT_NAME,
  authTimeoutMs = DEFAULT_AUTH_TIMEOUT,
  fetchTimeoutMs = DEFAULT_NETWORK_TIMEOUT,
  inferenceTimeoutMs = CHATGPT_INFERENCE_TIMEOUT_MS,
  refreshSkewMs = REFRESH_SKEW,
  serverFactory = (handler) => createServer(handler),
  onChange,
} = {}) {
  if (!isString(path, 4096) || typeof fetcher !== 'function' || typeof openExternal !== 'function')
    throw Error('ChatGPT subscription service requires path, fetcher, and openExternal.');

  const hostPath = `${path}.host`;
  const accounts = new Map();
  let activeClientId = null;
  let hostId = '';
  let hostReady = false;
  let pending = null;
  let closed = false;
  let storageAvailable = false;
  let stateError = '';
  let discoveryPromise = null;
  let persistence = Promise.resolve();
  const requests = new Set();
  const refreshes = new Map();

  const availableStorage = async () => {
    try {
      if (!['darwin', 'win32'].includes(platform)) return false;
      if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== 'function') return false;
      if (!safeStorage.isEncryptionAvailable()) return false;
      if (platform === 'darwin' && typeof safeStorage.isAsyncEncryptionAvailable === 'function')
        return await safeStorage.isAsyncEncryptionAvailable();
      return true;
    } catch {
      return false;
    }
  };

  const encrypt = async (value) => {
    if (platform === 'darwin' && typeof safeStorage.encryptStringAsync === 'function')
      return await safeStorage.encryptStringAsync(value);
    return safeStorage.encryptString(value);
  };

  const decrypt = async (value) => {
    if (platform === 'darwin' && typeof safeStorage.decryptStringAsync === 'function') {
      const result = await safeStorage.decryptStringAsync(value);
      if (typeof result === 'string') return result;
      if (Buffer.isBuffer(result)) return result.toString();
      if (typeof result?.result === 'string') return result.result;
      if (Buffer.isBuffer(result?.result)) return result.result.toString();
      return undefined;
    }
    return safeStorage.decryptString(value);
  };

  const writeAtomic = async (target, content) => {
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(temporary, content, { mode: 0o600 });
      await chmod(temporary, 0o600);
      await replaceFile(temporary, target, { platform });
      await chmod(target, 0o600);
    } finally {
      await rm(temporary, { force: true });
    }
  };

  try {
    const savedHost = (await readFile(hostPath, 'utf8')).trim();
    if (validHostId(savedHost)) {
      hostId = savedHost;
      hostReady = true;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') stateError = PUBLIC_ERRORS.storage;
  }
  if (!hostId) {
    hostId = `urn:uuid:${randomUUID()}`;
    try {
      await writeAtomic(hostPath, `${hostId}\n`);
      hostReady = true;
    } catch {
      stateError = PUBLIC_ERRORS.storage;
    }
  }

  storageAvailable = await availableStorage();
  if (storageAvailable) {
    try {
      const encrypted = await readFile(path);
      const value = await decrypt(encrypted);
      const restored = normalizeState(JSON.parse(value));
      activeClientId = restored.activeClientId;
      for (const [clientId, account] of restored.accounts) accounts.set(clientId, account);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        stateError = PUBLIC_ERRORS.savedCredentials;
      }
    }
  } else {
    try {
      await readFile(path);
      stateError = PUBLIC_ERRORS.storage;
    } catch (error) {
      if (error.code !== 'ENOENT') stateError = PUBLIC_ERRORS.storage;
    }
  }

  const status = () => ({
    available: true,
    signedIn: signedIn(accounts.get(activeClientId)),
    accounts: [...accounts.values()].map((account) => ({
      clientId: account.clientId,
      email: account.email || '',
      subject: account.subject || '',
      signedIn: signedIn(account),
    })),
    activeClientId: activeClientId || null,
    pending: !!pending,
    storageAvailable,
    error: stateError || '',
  });

  const broadcast = async () => {
    if (typeof onChange !== 'function') return;
    try {
      await onChange(status());
    } catch {
      // State notifications must never break authentication or inference.
    }
  };

  const persistStateNow = async () => {
    if (!storageAvailable) return;
    if (!accounts.size) {
      await rm(path, { force: true });
      return;
    }
    try {
      const encrypted = await encrypt(serializeState(activeClientId, accounts));
      await writeAtomic(path, encrypted);
    } catch {
      stateError = PUBLIC_ERRORS.storage;
    }
  };

  const persistState = () => {
    const next = persistence.then(persistStateNow);
    persistence = next.catch(() => {});
    return next;
  };

  const checkOpen = () => {
    if (closed) throw publicError('CLOSED', PUBLIC_ERRORS.closed);
  };

  const track = (controller) => {
    requests.add(controller);
    return () => requests.delete(controller);
  };

  const abortRequests = () => {
    for (const controller of requests) controller.abort();
  };

  const closeServer = async (server) => {
    if (!server) return;
    await new Promise((resolve) => {
      try {
        server.close(() => resolve());
        // Browsers may preconnect without sending a request. These sockets are
        // not idle HTTP connections and otherwise keep close() pending forever.
        server.closeAllConnections?.();
      } catch {
        resolve();
      }
    });
  };

  const settlePending = async (attempt, error, value) => {
    if (!attempt || attempt.settled) return;
    attempt.settled = true;
    if (pending === attempt) pending = null;
    clearTimeout(attempt.timer);
    if (error) attempt.controller.abort();
    await closeServer(attempt.server);
    await broadcast();
    if (error) attempt.reject(error);
    else attempt.resolve(value === undefined ? status() : value);
  };

  const cancelPending = async (error = publicError('CANCELLED', PUBLIC_ERRORS.cancelled)) => {
    const attempt = pending;
    if (!attempt) return;
    await settlePending(attempt, error);
  };

  const loadDiscovery = async (signal) => {
    if (discoveryPromise) return discoveryPromise;
    discoveryPromise = (async () => {
      let response;
      try {
        response = await fetchWithTimeout(
          fetcher,
          DISCOVERY_URL,
          { headers: { accept: 'application/json' }, signal },
          fetchTimeoutMs,
        );
      } catch (error) {
        if (isAbortError(error, signal)) throw publicError('ABORTED', PUBLIC_ERRORS.interrupted);
        throw publicError('DISCOVERY_UNAVAILABLE', PUBLIC_ERRORS.unavailable);
      }
      if (!responseOK(response))
        throw publicError('DISCOVERY_UNAVAILABLE', PUBLIC_ERRORS.unavailable);
      const document = await responseJSON(response, responseSignals.get(response) || signal);
      if (!isRecord(document) || typeof document.issuer !== 'string')
        throw publicError('DISCOVERY_INVALID', PUBLIC_ERRORS.unavailable);
      const issuer = document.issuer;
      if (issuer !== ISSUER) throw publicError('DISCOVERY_INVALID', PUBLIC_ERRORS.unavailable);
      return {
        issuer,
        authorization_endpoint: urlString(
          document.authorization_endpoint,
          DEFAULT_AUTHORIZATION_ENDPOINT,
        ),
        token_endpoint: urlString(document.token_endpoint, DEFAULT_TOKEN_ENDPOINT),
        revocation_endpoint: urlString(document.revocation_endpoint, DEFAULT_REVOCATION_ENDPOINT),
        jwks_uri: urlString(document.jwks_uri, DEFAULT_JWKS_URI),
      };
    })();
    try {
      return await discoveryPromise;
    } catch (error) {
      discoveryPromise = null;
      throw error;
    }
  };

  const accountFor = (clientId) => {
    if (!validClientId(clientId)) throw publicError('ACCOUNT', PUBLIC_ERRORS.account);
    const account = accounts.get(clientId);
    if (!account) throw publicError('ACCOUNT', PUBLIC_ERRORS.account);
    return account;
  };

  const ensureActive = (clientId, account) => {
    const current = accounts.get(clientId);
    if (
      activeClientId !== clientId ||
      !signedIn(current) ||
      (account?.subject && current?.subject !== account.subject)
    )
      throw publicError('SWITCHED', PUBLIC_ERRORS.switched);
  };

  const exchangeCode = async (attempt, clientId, code, discovery) => {
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      code_verifier: attempt.verifier,
      redirect_uri: attempt.redirectUri,
      resource: RESOURCE,
    });
    let response;
    try {
      response = await fetchWithTimeout(
        fetcher,
        discovery.token_endpoint,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
          },
          body: form.toString(),
          signal: attempt.controller.signal,
        },
        fetchTimeoutMs,
      );
    } catch (error) {
      if (isAbortError(error, attempt.controller.signal))
        throw publicError('ABORTED', PUBLIC_ERRORS.cancelled);
      throw publicError('EXCHANGE', PUBLIC_ERRORS.exchange);
    }
    const document = await responseJSON(
      response,
      responseSignals.get(response) || attempt.controller.signal,
    );
    if (!responseOK(response)) {
      if (document?.error === 'invalid_grant')
        throw publicError('INVALID_GRANT', PUBLIC_ERRORS.exchange);
      throw publicError('EXCHANGE', PUBLIC_ERRORS.exchange);
    }
    if (
      !isRecord(document) ||
      !isString(document.access_token, 65536) ||
      !isString(document.id_token, 65536)
    )
      throw publicError('EXCHANGE', PUBLIC_ERRORS.exchange);
    return document;
  };

  const processCallback = async (attempt, params) => {
    let discovery;
    try {
      checkOpen();
      if (pending !== attempt || attempt.settled) return;
      const callbackClientId = params.get('client_id') || '';
      const clientId = attempt.dynamic ? callbackClientId : attempt.clientId;
      if (!validClientId(clientId) || clientId === DYNAMIC_CLIENT_ID)
        throw publicError('CALLBACK', PUBLIC_ERRORS.callback);
      if (!attempt.dynamic && callbackClientId && callbackClientId !== attempt.clientId)
        throw publicError('CALLBACK', PUBLIC_ERRORS.callback);
      const code = params.get('code') || '';
      if (!isString(code, 65536)) throw publicError('CALLBACK', PUBLIC_ERRORS.callback);
      if (attempt.dynamic) attempt.issuedClientId = clientId;
      discovery = await loadDiscovery(attempt.controller.signal);
      const token = await exchangeCode(attempt, clientId, code, discovery);
      const scopes = scopesFrom(token.scope);
      if (!scopes.includes(REQUIRED_SCOPE))
        throw publicError('PERMISSION', PUBLIC_ERRORS.permission);
      const claims = await verifyIDToken(token.id_token, {
        clientId,
        nonce: attempt.nonce,
        discovery,
        fetcher,
        signal: attempt.controller.signal,
      });
      const previous = accounts.get(clientId);
      if (previous?.subject && previous.subject !== claims.sub)
        throw publicError('IDENTITY', PUBLIC_ERRORS.identity);
      if (pending !== attempt || attempt.settled)
        throw publicError('ABORTED', PUBLIC_ERRORS.cancelled);
      const expiresIn = finiteNumber(token.expires_in, 3600);
      accounts.set(clientId, {
        clientId,
        email: typeof claims.email === 'string' ? claims.email : previous?.email || '',
        subject: claims.sub,
        issuer: claims.iss,
        idToken: token.id_token,
        accessToken: token.access_token,
        refreshToken:
          typeof token.refresh_token === 'string'
            ? token.refresh_token
            : previous?.refreshToken || '',
        tokenType: typeof token.token_type === 'string' ? token.token_type : 'Bearer',
        expiresAt: Date.now() + Math.max(0, expiresIn) * 1000,
        scopes,
      });
      activeClientId = clientId;
      stateError = '';
      await persistState();
      await settlePending(attempt, null);
    } catch (error) {
      if (pending !== attempt || attempt.settled) return;
      let failure = error;
      if (error?.code === 'INVALID_GRANT' && attempt.dynamic && attempt.issuedClientId) {
        attempt.dynamic = false;
        attempt.clientId = attempt.issuedClientId;
        attempt.retried = true;
        try {
          await retryDynamicAuthorization(attempt);
          return;
        } catch (retryError) {
          failure = retryError;
        }
      }
      const publicFailure =
        failure?.code === 'PERMISSION'
          ? failure
          : failure?.code === 'IDENTITY'
            ? failure
            : isAbortError(failure, attempt.controller.signal)
              ? publicError('CANCELLED', PUBLIC_ERRORS.cancelled)
              : publicError(
                  failure?.code || 'SIGN_IN',
                  failure?.message && Object.values(PUBLIC_ERRORS).includes(failure.message)
                    ? failure.message
                    : PUBLIC_ERRORS.exchange,
                );
      stateError = publicFailure.message;
      await settlePending(attempt, publicFailure);
    }
  };

  const handleCallback = (request, response) => {
    const attempt = pending;
    let target;
    try {
      target = new URL(request.url || '/', 'http://127.0.0.1');
    } catch {
      response.statusCode = 400;
      response.end('Invalid callback.');
      return;
    }
    if (
      request.method !== 'GET' ||
      target.pathname !== CALLBACK_PATH ||
      !attempt ||
      attempt.settled
    ) {
      response.statusCode = 404;
      response.end('Not found.');
      return;
    }
    if (attempt.callbackSeen) {
      response.statusCode = 409;
      response.end('Callback already handled.');
      return;
    }
    attempt.callbackSeen = true;
    const params = target.searchParams;
    if (params.get('state') !== attempt.state) {
      response.statusCode = 400;
      response.end('Invalid callback state.');
      void settlePending(attempt, publicError('CALLBACK', PUBLIC_ERRORS.callback));
      return;
    }
    const callbackError = params.get('error');
    if (callbackError) {
      response.statusCode = 200;
      response.end('ChatGPT sign-in was cancelled. You can close this window.');
      void settlePending(
        attempt,
        publicError(
          'DENIED',
          callbackError === 'access_denied' ? PUBLIC_ERRORS.cancelled : PUBLIC_ERRORS.exchange,
        ),
      );
      return;
    }
    if (!params.get('code')) {
      response.statusCode = 400;
      response.end('Invalid callback.');
      void settlePending(attempt, publicError('CALLBACK', PUBLIC_ERRORS.callback));
      return;
    }
    response.statusCode = 200;
    response.setHeader('content-type', 'text/plain; charset=utf-8');
    response.setHeader('connection', 'close');
    response.end('Finishing sign-in. Return to PDFMathReader to check the result.');
    void processCallback(attempt, params);
  };

  const listen = async (server, signal) => {
    await new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        server.removeListener('error', onError);
        server.removeListener('listening', onListening);
        signal?.removeEventListener('abort', onAbort);
      };
      const onError = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onListening = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onAbort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(publicError('ABORTED', PUBLIC_ERRORS.cancelled));
      };
      if (signal?.aborted) {
        onAbort();
        return;
      }
      server.once('error', onError);
      server.once('listening', onListening);
      signal?.addEventListener('abort', onAbort, { once: true });
      try {
        server.listen(0, '127.0.0.1');
      } catch (error) {
        onError(error);
      }
    });
    const address = server.address();
    if (!address || typeof address !== 'object' || !Number.isFinite(address.port))
      throw Error('listener');
    return address.port;
  };

  const retryDynamicAuthorization = async (attempt) => {
    const discovery = await loadDiscovery(attempt.controller.signal);
    if (attempt.settled || attempt.controller.signal.aborted)
      throw publicError('ABORTED', PUBLIC_ERRORS.cancelled);
    attempt.state = randomSecret();
    attempt.nonce = randomSecret();
    attempt.verifier = randomSecret(48);
    attempt.callbackSeen = false;
    const query = new URLSearchParams({
      client_id: attempt.clientId,
      ext_agent_host_id: hostId,
      response_type: 'code',
      redirect_uri: attempt.redirectUri,
      scope: REQUIRED_SCOPES.join(' '),
      resource: RESOURCE,
      state: attempt.state,
      nonce: attempt.nonce,
      code_challenge_method: 'S256',
      code_challenge: pkceChallenge(attempt.verifier),
    });
    const opened = await openExternal(
      `${urlString(discovery.authorization_endpoint, DEFAULT_AUTHORIZATION_ENDPOINT)}?${query.toString()}`,
    );
    if (opened === false) throw publicError('BROWSER', PUBLIC_ERRORS.unavailable);
  };

  const signIn = async ({ clientId } = {}) => {
    checkOpen();
    if (!hostReady) {
      stateError = PUBLIC_ERRORS.storage;
      await broadcast();
      throw publicError('HOST_STORAGE', PUBLIC_ERRORS.storage);
    }
    if (pending) throw publicError('IN_PROGRESS', PUBLIC_ERRORS.inProgress);
    const forceDynamic = clientId === null || clientId === '';
    const selectedClientId = forceDynamic ? null : (clientId ?? activeClientId);
    if (selectedClientId !== null && selectedClientId !== undefined) accountFor(selectedClientId);
    const dynamic = !selectedClientId;
    const existing = selectedClientId ? accounts.get(selectedClientId) : null;
    const attempt = {
      dynamic,
      clientId: dynamic ? DYNAMIC_CLIENT_ID : selectedClientId,
      state: randomSecret(),
      nonce: randomSecret(),
      verifier: randomSecret(48),
      server: null,
      timer: null,
      controller: new AbortController(),
      callbackSeen: false,
      settled: false,
    };
    attempt.promise = new Promise((resolve, reject) => {
      attempt.resolve = resolve;
      attempt.reject = reject;
    });
    const server = serverFactory(handleCallback);
    attempt.server = server;
    pending = attempt;
    attempt.timer = setTimeout(
      () => {
        if (pending === attempt) {
          stateError = PUBLIC_ERRORS.timedOut;
          void settlePending(attempt, publicError('TIMEOUT', PUBLIC_ERRORS.timedOut));
        }
      },
      Math.max(1, authTimeoutMs),
    );
    attempt.timer.unref?.();
    void broadcast();
    try {
      const port = await listen(server, attempt.controller.signal);
      if (attempt.settled) throw publicError('ABORTED', PUBLIC_ERRORS.cancelled);
      attempt.redirectUri = `http://127.0.0.1:${port}${CALLBACK_PATH}`;
      const discovery = await loadDiscovery(attempt.controller.signal);
      const query = new URLSearchParams({
        client_id: attempt.clientId,
        ext_agent_host_id: hostId,
        response_type: 'code',
        redirect_uri: attempt.redirectUri,
        scope: REQUIRED_SCOPES.join(' '),
        resource: RESOURCE,
        state: attempt.state,
        nonce: attempt.nonce,
        code_challenge_method: 'S256',
        code_challenge: pkceChallenge(attempt.verifier),
      });
      if (dynamic) query.set('agent_name_hint', agentName);
      else {
        if (existing?.idToken) query.set('id_token_hint', existing.idToken);
        if (existing?.email) query.set('login_hint', existing.email);
      }
      if (attempt.settled) throw publicError('ABORTED', PUBLIC_ERRORS.cancelled);
      const opened = await openExternal(
        `${urlString(discovery.authorization_endpoint, DEFAULT_AUTHORIZATION_ENDPOINT)}?${query.toString()}`,
      );
      if (opened === false) throw publicError('BROWSER', PUBLIC_ERRORS.unavailable);
    } catch (error) {
      if (pending === attempt) {
        stateError =
          error?.code === 'ABORTED' ? PUBLIC_ERRORS.cancelled : PUBLIC_ERRORS.unavailable;
        await settlePending(
          attempt,
          publicError(
            error?.code || 'SIGN_IN',
            Object.values(PUBLIC_ERRORS).includes(error?.message) ? error.message : stateError,
          ),
        );
      } else {
        await closeServer(server);
        attempt.reject(
          publicError(
            error?.code || 'SIGN_IN',
            Object.values(PUBLIC_ERRORS).includes(error?.message)
              ? error.message
              : PUBLIC_ERRORS.unavailable,
          ),
        );
      }
    }
    return attempt.promise;
  };

  const cancel = async () => {
    checkOpen();
    await cancelPending(publicError('CANCELLED', PUBLIC_ERRORS.cancelled));
    return status();
  };

  const select = async (clientId) => {
    checkOpen();
    if (clientId !== null && clientId !== undefined && clientId !== '') accountFor(clientId);
    abortRequests();
    await cancelPending(publicError('CANCELLED', PUBLIC_ERRORS.cancelled));
    activeClientId = clientId || null;
    stateError = '';
    await persistState();
    await broadcast();
    return status();
  };

  const refreshAccount = async (clientId, account) => {
    const running = refreshes.get(clientId);
    if (running) return running;
    const controller = new AbortController();
    const untrack = track(controller);
    const operation = (async () => {
      try {
        if (!account.refreshToken) throw publicError('EXPIRED', PUBLIC_ERRORS.expired);
        const discovery = await loadDiscovery(controller.signal);
        const form = new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          refresh_token: account.refreshToken,
          resource: RESOURCE,
        });
        let response;
        try {
          response = await fetchWithTimeout(
            fetcher,
            discovery.token_endpoint,
            {
              method: 'POST',
              headers: {
                'content-type': 'application/x-www-form-urlencoded',
                accept: 'application/json',
              },
              body: form.toString(),
              signal: controller.signal,
            },
            fetchTimeoutMs,
          );
        } catch (error) {
          if (isAbortError(error, controller.signal))
            throw publicError('ABORTED', PUBLIC_ERRORS.interrupted);
          throw publicError('REFRESH', PUBLIC_ERRORS.refresh);
        }
        const document = await responseJSON(
          response,
          responseSignals.get(response) || controller.signal,
        );
        if (!responseOK(response)) {
          if (document?.error === 'invalid_grant') {
            if (accounts.get(clientId) === account) {
              accounts.set(clientId, clearAccountTokens(account));
              await persistState();
            }
            stateError = PUBLIC_ERRORS.expired;
            await broadcast();
            throw publicError('EXPIRED', PUBLIC_ERRORS.expired);
          }
          throw publicError('REFRESH', PUBLIC_ERRORS.refresh);
        }
        if (!isRecord(document) || !isString(document.access_token, 65536))
          throw publicError('REFRESH', PUBLIC_ERRORS.refresh);
        if (
          controller.signal.aborted ||
          activeClientId !== clientId ||
          accounts.get(clientId) !== account
        )
          throw publicError('SWITCHED', PUBLIC_ERRORS.switched);
        const scopes = document.scope === undefined ? account.scopes : scopesFrom(document.scope);
        if (!scopes.includes(REQUIRED_SCOPE))
          throw publicError('PERMISSION', PUBLIC_ERRORS.permission);
        accounts.set(clientId, {
          ...account,
          accessToken: document.access_token,
          refreshToken:
            typeof document.refresh_token === 'string'
              ? document.refresh_token
              : account.refreshToken,
          tokenType:
            typeof document.token_type === 'string'
              ? document.token_type
              : account.tokenType || 'Bearer',
          expiresAt: Date.now() + Math.max(0, finiteNumber(document.expires_in, 3600)) * 1000,
          scopes,
        });
        stateError = '';
        await persistState();
        await broadcast();
        return document.access_token;
      } catch (error) {
        if (error?.code === 'ABORTED' || error?.code === 'SWITCHED') throw error;
        if (error?.code === 'EXPIRED') {
          if (stateError !== PUBLIC_ERRORS.expired) {
            stateError = PUBLIC_ERRORS.expired;
            await broadcast();
          }
          throw error;
        }
        if (error?.code === 'PERMISSION') {
          stateError = PUBLIC_ERRORS.permission;
          await broadcast();
          throw error;
        }
        stateError = PUBLIC_ERRORS.refresh;
        await broadcast();
        throw publicError('REFRESH', PUBLIC_ERRORS.refresh);
      } finally {
        untrack();
        refreshes.delete(clientId);
      }
    })();
    refreshes.set(clientId, operation);
    return operation;
  };

  const accessTokenFor = async (clientId, controller, { forceRefresh = false } = {}) => {
    const account = accountFor(clientId);
    ensureActive(clientId, account);
    if (!forceRefresh && account.accessToken && account.expiresAt > Date.now() + refreshSkewMs)
      return account.accessToken;
    return refreshAccount(clientId, account);
  };

  const requestWithToken = async (clientId, controller, request) => {
    if (controller.signal.aborted) throw publicError('ABORTED', PUBLIC_ERRORS.interrupted);
    let token = await accessTokenFor(clientId, controller);
    if (controller.signal.aborted) throw publicError('ABORTED', PUBLIC_ERRORS.interrupted);
    let response;
    try {
      response = await request(token, controller.signal);
    } catch (error) {
      if (isAbortError(error, controller.signal))
        throw publicError('ABORTED', PUBLIC_ERRORS.interrupted);
      throw error;
    }
    if (responseStatus(response) !== 401) return response;
    if (controller.signal.aborted) throw publicError('ABORTED', PUBLIC_ERRORS.interrupted);
    token = await accessTokenFor(clientId, controller, { forceRefresh: true });
    try {
      response = await request(token, controller.signal);
    } catch (error) {
      if (isAbortError(error, controller.signal))
        throw publicError('ABORTED', PUBLIC_ERRORS.interrupted);
      throw error;
    }
    return response;
  };

  const models = async () => {
    checkOpen();
    const clientId = activeClientId;
    const account = accountFor(clientId);
    ensureActive(clientId, account);
    const controller = new AbortController();
    const untrack = track(controller);
    try {
      const response = await requestWithToken(clientId, controller, (token, signal) =>
        fetchWithTimeout(
          fetcher,
          MODELS_URL,
          { headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, signal },
          fetchTimeoutMs,
        ),
      );
      if (!responseOK(response)) throw publicError('MODELS', PUBLIC_ERRORS.models);
      const document = await responseJSON(
        response,
        responseSignals.get(response) || controller.signal,
      );
      if (controller.signal.aborted) throw publicError('ABORTED', PUBLIC_ERRORS.interrupted);
      ensureActive(clientId, account);
      return asArray(document?.models)
        .filter(
          (model) =>
            model?.visibility === 'list' &&
            isString(model.slug, 512) &&
            typeof model.display_name === 'string',
        )
        .map((model) => ({ slug: model.slug, display_name: model.display_name }));
    } catch (error) {
      if (error?.code === 'SWITCHED' || error?.code === 'ABORTED') throw error;
      if (error?.code === 'REFRESH' || error?.code === 'EXPIRED') throw error;
      throw publicError('MODELS', PUBLIC_ERRORS.models);
    } finally {
      untrack();
    }
  };

  const complete = async (body, signal, options = {}) => {
    checkOpen();
    const clientId = options?.clientId ?? activeClientId;
    const account = accountFor(clientId);
    ensureActive(clientId, account);
    if (!signedIn(account)) throw publicError('ACCOUNT', PUBLIC_ERRORS.account);
    if (signal?.aborted) throw publicError('ABORTED', PUBLIC_ERRORS.interrupted);
    const controller = new AbortController();
    const untrack = track(controller);
    const forwardAbort = () => controller.abort();
    signal?.addEventListener('abort', forwardAbort, { once: true });
    try {
      const payload = toResponsesBody(body);
      const response = await requestWithToken(clientId, controller, (token, requestSignal) =>
        fetchWithTimeout(
          fetcher,
          RESPONSES_URL,
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
              accept: 'text/event-stream',
            },
            body: JSON.stringify(payload),
            signal: requestSignal,
          },
          inferenceTimeoutMs,
        ),
      );
      if (controller.signal.aborted) throw publicError('ABORTED', PUBLIC_ERRORS.interrupted);
      ensureActive(clientId, account);
      if (!responseOK(response)) {
        let failure;
        try {
          failure = await responseJSON(
            response,
            responseSignals.get(response) || controller.signal,
          );
        } catch {
          // Preserve HTTP status without exposing arbitrary response contents.
        }
        throw responseFailure(failure, responseStatus(response));
      }
      if (!response.body) throw publicError('INFERENCE', PUBLIC_ERRORS.inference);
      let text = '';
      let model = body.model;
      let usage = null;
      let sawCompleted = false;
      await consumeSSE(response.body, {
        signal: responseSignals.get(response) || controller.signal,
        onEvent: async (type, event) => {
          if (type === 'response.output_text.delta') {
            if (typeof event.delta === 'string') text += event.delta;
          } else if (type === 'response.completed') {
            sawCompleted = true;
            const completed = isRecord(event.response) ? event.response : event;
            if (typeof completed.model === 'string') model = completed.model;
            usage = completed.usage || usage;
            if (!text) text = responseText(completed);
            return true;
          } else if (
            type === 'response.failed' ||
            type === 'response.incomplete' ||
            type === 'error'
          ) {
            throw responseFailure(event);
          }
          return false;
        },
      });
      if (controller.signal.aborted) throw publicError('ABORTED', PUBLIC_ERRORS.interrupted);
      ensureActive(clientId, account);
      if (!sawCompleted) throw publicError('INFERENCE', PUBLIC_ERRORS.inference);
      return {
        choices: [{ message: { content: text } }],
        model,
        usage: normalizeUsage(usage),
      };
    } catch (error) {
      if (error?.code === 'SWITCHED' || error?.code === 'ABORTED') throw error;
      if (error?.code === 'REFRESH' || error?.code === 'EXPIRED') throw error;
      if (error?.code === 'USAGE_LIMIT' || error?.code === 'USAGE_UNAVAILABLE') throw error;
      if (error?.code === 'REQUEST') throw error;
      if (error?.code === 'NETWORK_TIMEOUT') throw error;
      if (isAbortError(error, controller.signal))
        throw publicError('ABORTED', PUBLIC_ERRORS.interrupted);
      throw publicError('INFERENCE', PUBLIC_ERRORS.inference);
    } finally {
      signal?.removeEventListener('abort', forwardAbort);
      untrack();
    }
  };

  const revoke = async (account) => {
    if (!account.refreshToken) return true;
    const controller = new AbortController();
    const untrack = track(controller);
    try {
      const discovery = await loadDiscovery(controller.signal);
      const form = new URLSearchParams({
        token: account.refreshToken,
        token_type_hint: 'refresh_token',
        client_id: account.clientId,
      });
      for (let attempt = 0; attempt < 3; attempt++) {
        let response;
        try {
          response = await fetchWithTimeout(
            fetcher,
            discovery.revocation_endpoint,
            {
              method: 'POST',
              headers: {
                'content-type': 'application/x-www-form-urlencoded',
                accept: 'application/json',
              },
              body: form.toString(),
              signal: controller.signal,
            },
            fetchTimeoutMs,
          );
        } catch (error) {
          if (isAbortError(error, controller.signal)) return false;
          response = null;
        }
        if (response && responseStatus(response) === 200) return true;
        if (response && responseStatus(response) < 500) return false;
        if (attempt < 2) {
          try {
            await delay(50 * 2 ** attempt, controller.signal);
          } catch {
            return false;
          }
        }
      }
      return false;
    } catch {
      return false;
    } finally {
      untrack();
    }
  };

  const signOut = async (clientId) => {
    checkOpen();
    const selected = clientId ?? activeClientId;
    const account = accountFor(selected);
    abortRequests();
    await cancelPending(publicError('CANCELLED', PUBLIC_ERRORS.cancelled));
    const confirmed = await revoke(account);
    if (accounts.get(selected) === account) accounts.set(selected, clearAccountTokens(account));
    stateError = confirmed ? '' : PUBLIC_ERRORS.signOut;
    await persistState();
    await broadcast();
    return status();
  };

  const close = async () => {
    if (closed) return;
    closed = true;
    abortRequests();
    await cancelPending(publicError('CLOSED', PUBLIC_ERRORS.closed));
    await persistence;
  };

  return { status, signIn, cancel, select, signOut, models, complete, close };
}
