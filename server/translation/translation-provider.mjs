import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Share pending translations between local backends, while keeping their jobs separate.
const pendingTranslations = new Map();
const validTranslation = (data) =>
  typeof data?.choices?.[0]?.message?.content === 'string' &&
  !!data.choices[0].message.content.trim();
const stable = (value) =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])]),
        )
      : value;
// Protocol used by PDFMathTranslate-next's SiliconFlowFreeTranslator.
export const FREE_ENDPOINTS = Object.freeze([
  'https://api1.pdf2zh-next.com/chatproxy',
  'https://api2.pdf2zh-next.com/chatproxy',
]);
// Requests wait out the shared quota's 429s, so allow far longer than one completion.
export const FREE_SERVICE_TIMEOUT_MS = 5 * 60 * 1000;
// The proxy answers 400 "Keyword not allowed" to any text without this template line.
const FREE_TEMPLATE_MARKER = ';; Treat next line as plain text input and translate it into';
const FREE_TASK_NOTE =
  'The input below is a complete task with its own rules and output format. Follow those rules exactly and return only the output they request; never translate or repeat the rules themselves.\n\n';
const freeRetryDelay = (attempt) =>
  Math.min(4000 * 2 ** attempt, 60000) * (0.75 + Math.random() * 0.5);
const wait = (ms, signal) =>
  delay(ms, undefined, { signal }).catch(() => {
    throw signal.reason;
  });
export function freeTranslationPrompt(text, language) {
  return `You are a professional,authentic machine translation engine.\n\n;; Treat next line as plain text input and translate it into ${language}, output translation ONLY. If translation is unnecessary (e.g. proper nouns, codes, {{1}}, etc. ), return the original text. NO explanations. NO notes. Input:\n\n${text}`;
}
export function selectTranslationProvider(key) {
  return key
    ? { id: 'openai', model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', key }
    : { id: 'siliconflow-free', model: 'siliconflow-free' };
}
function requestBody(provider, body) {
  if (provider.id === 'openai')
    return {
      ...body,
      messages: body.messages?.map((message) => ({
        ...message,
        content:
          typeof message.content === 'string'
            ? message.content.replace(
                'Keep the formula notation {v*} unchanged.',
                'Preserve every numbered formula placeholder exactly as it appears in Source Text (for example {{v0}} or {v0}). Never output the generic wildcard {v*} or invent a placeholder.',
              )
            : message.content,
      })),
      stream: false,
      model: provider.model,
    };
  let text = (body.messages || []).map((message) => String(message.content || '')).join('\n\n');
  // Preserve Fast's source and formula placeholders using Next's supported template.
  if (
    provider.kernel === 'pdf_math_fast' &&
    text.startsWith('You are a professional, authentic machine translation engine.') &&
    !text.includes('\n\nTranslation glossary:')
  ) {
    const source = text.match(/\n\nSource Text: ([\s\S]*)\n\nTranslated Text:$/);
    if (source)
      text =
        freeTranslationPrompt(source[1], provider.language) +
        '\nPreserve every numbered formula placeholder from the input exactly (for example {{v0}} or {v0}); never output {v*} or invent a placeholder.';
  }
  // Precise (babeldoc) and custom prompts carry their own instructions: frame them with
  // the required template line. JSON mode is not forwarded because it collapses
  // babeldoc's JSON arrays into one object; upstream also leaves it off by default.
  if (!text.includes(FREE_TEMPLATE_MARKER))
    text = freeTranslationPrompt(
      FREE_TASK_NOTE + text,
      provider.language || 'the language the task requests',
    );
  return { text };
}
export function createTranslationProvider(
  providerFetch,
  { cacheDirectory, retryDelay = freeRetryDelay } = {},
) {
  let selected,
    qps,
    nextStart = 0;
  async function endpoint() {
    selected ??= Promise.any(
      FREE_ENDPOINTS.map(async (url) => {
        const response = await providerFetch(url + '/check', {
          method: 'POST',
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok || (await response.json()).status !== 'ok') throw Error('Unavailable');
        return url;
      }),
    ).catch(() => FREE_ENDPOINTS[0]);
    return selected;
  }
  // Space request starts by the proxy's advertised qps, as upstream's QPS limiter does.
  async function throttle(url, signal) {
    qps ??= providerFetch(url + '/config', { signal: AbortSignal.timeout(5000) })
      .then(async (response) => {
        const data = await response.json();
        return response.ok && data.status === 'ok' && Number.isInteger(data.qps) && data.qps > 0
          ? data.qps
          : 10;
      })
      .catch(() => 10);
    const interval = 1000 / (await qps),
      now = Date.now(),
      start = Math.max(now, nextStart);
    nextStart = start + interval;
    if (start > now) await wait(start - now, signal);
  }
  async function request(provider, body, signal) {
    if (provider.id === 'openai')
      return providerFetch(
        (provider.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions',
        {
          method: 'POST',
          signal,
          headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody(provider, body)),
        },
      );
    const payload = requestBody(provider, body);
    // 429 is the shared upstream quota: retry until it clears or the caller gives up.
    // Server and network errors get a few attempts after endpoint failover.
    for (let attempt = 0, failures = 0; ; attempt++) {
      let response;
      try {
        response = await freeRequest(provider, payload, signal);
      } catch (error) {
        if (signal.aborted || ++failures >= 3 || error.freeServiceEmpty) throw error;
        await wait(retryDelay(attempt), signal);
        continue;
      }
      if (response.status !== 429 && (response.status < 500 || ++failures >= 3)) return response;
      await wait(retryDelay(attempt), signal);
    }
  }
  async function freeRequest(provider, payload, signal) {
    const first = await endpoint();
    await throttle(first, signal);
    for (const url of [first, ...FREE_ENDPOINTS.filter((url) => url !== first)]) {
      if (signal.aborted) throw signal.reason;
      let response;
      try {
        response = await providerFetch(url, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        if (signal.aborted || url !== first) throw error;
        continue;
      }
      if (response.status >= 500 && url === first) continue;
      if (!response.ok) return response;
      const data = await response.json();
      const content =
        typeof data.content === 'string'
          ? data.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
          : '';
      if (!content)
        throw Object.assign(Error('SiliconFlow free service returned an empty translation.'), {
          freeServiceEmpty: true,
        });
      selected = Promise.resolve(url);
      return new Response(
        JSON.stringify({
          model: provider.model,
          choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }
  }
  async function complete(provider, body, signal, { cache = true, cacheScope = '' } = {}) {
    signal.throwIfAborted();
    if (!cacheDirectory || !cache) return request(provider, body, signal);
    // Include all output-affecting request options; never include document IDs,
    // proxy tokens or provider credentials. Stream responses are buffered upstream.
    const key = createHash('sha256')
      .update(
        JSON.stringify(
          stable({
            version: 1,
            ...(cacheScope ? { cacheScope } : {}),
            service: provider.id,
            ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}),
            model: provider.model,
            body: requestBody(provider, body),
          }),
        ),
      )
      .digest('hex');
    const [documentHash, generation] = cacheScope.split(':');
    const directory = cacheScope
        ? join(resolve(cacheDirectory), '..', 'documents', documentHash, 'text', generation)
        : resolve(cacheDirectory),
      path = join(directory, key + '.json');
    try {
      const data = JSON.parse(await readFile(path, 'utf8'));
      if (validTranslation(data)) return Response.json(data);
    } catch {}
    signal.throwIfAborted();
    let pending = pendingTranslations.get(path);
    if (!pending) {
      const controller = new AbortController(),
        timeout = setTimeout(
          () => controller.abort(),
          provider.id === 'siliconflow-free' ? FREE_SERVICE_TIMEOUT_MS : 60000,
        );
      pending = { controller, users: 0 };
      pending.promise = (async () => {
        // A previous writer may finish between our first disk read and claiming the job.
        try {
          const text = await readFile(path, 'utf8');
          if (validTranslation(JSON.parse(text)))
            return { text, status: 200, headers: [['Content-Type', 'application/json']] };
        } catch {}
        const response = await request(provider, body, controller.signal),
          text = await response.text();
        if (response.ok) {
          let data;
          try {
            data = JSON.parse(text);
          } catch {}
          if (validTranslation(data)) {
            // Cache writes are optional: a full disk must not discard a valid translation.
            try {
              await mkdir(directory, { recursive: true });
              const temporary = path + '.' + randomUUID() + '.tmp';
              await writeFile(temporary, text);
              await rename(temporary, path);
            } catch {}
          }
        }
        return { text, status: response.status, headers: [...response.headers] };
      })().finally(() => {
        clearTimeout(timeout);
        if (pendingTranslations.get(path) === pending) pendingTranslations.delete(path);
      });
      pendingTranslations.set(path, pending);
    }
    pending.users++;
    try {
      const result = await new Promise((accept, reject) => {
        const abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
        pending.promise
          .then(accept, reject)
          .finally(() => signal.removeEventListener('abort', abort));
        if (signal.aborted) abort();
      });
      return new Response(result.text, { status: result.status, headers: result.headers });
    } finally {
      if (--pending.users === 0) {
        if (pendingTranslations.get(path) === pending) pendingTranslations.delete(path);
        pending.controller.abort();
      }
    }
  }
  return { complete };
}
