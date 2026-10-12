const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const MAX_FRAGMENT_CHARACTERS = 6000;
const MAX_TOKEN_CHARACTERS = 4096;
const REQUEST_TIMEOUT_MS = 5000;

const fallbackResult = () => ({ combine: false, status: 'fallback' });

function unicodeLength(value) {
  return Array.from(value).length;
}

function resolveToken(token, env) {
  // A nonempty supplied token has priority; an empty setting permits the server fallback.
  if (token !== undefined && token !== null && typeof token !== 'string') return null;
  const custom = typeof token === 'string' ? token.trim() : '';
  const candidate = custom || env?.TYPESAFE_API_KEY;
  if (typeof candidate !== 'string') return null;

  const value = candidate.trim();
  return value && unicodeLength(value) <= MAX_TOKEN_CHARACTERS ? value : null;
}

function boundedInput(before, after) {
  if (typeof before !== 'string' || typeof after !== 'string') return null;
  if (!before.trim() || !after.trim()) return null;
  if (unicodeLength(before) > MAX_FRAGMENT_CHARACTERS) return null;
  if (unicodeLength(after) > MAX_FRAGMENT_CHARACTERS) return null;
  return { before, after };
}

function requestBody(before, after) {
  return {
    model: MODEL,
    state: { before, after },
    questions: {
      paragraph_continuation: {
        type: 'noul',
        instructions:
          'Are `before` and `after` consecutive fragments of one paragraph that was split by the document layout?',
        criteria: {
          true: 'The fragments are semantically and grammatically continuous parts of one paragraph separated by an artificial document-layout boundary.',
          false:
            'The fragments mark an intentional paragraph boundary, a new topic, a list entry, a heading, a caption, or a footnote.',
        },
      },
    },
  };
}

async function requestClassification(fetchImpl, token, body) {
  if (typeof fetchImpl !== 'function') return null;

  const controller = new AbortController();
  let timeout;
  const request = Promise.resolve().then(async () => {
    const response = await fetchImpl(TYPESAFE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response || response.ok !== true || typeof response.json !== 'function') return null;
    // Keep parsing inside the deadline: response.json() may itself be delayed.
    return response.json();
  });
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error('TypeSafe request timed out'));
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([request, deadline]);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

function noulAnswer(data) {
  const answer = data?.answers?.paragraph_continuation;
  if (!answer || typeof answer !== 'object' || answer.type !== 'noul') return null;
  if (
    typeof answer.noul !== 'number' ||
    !Number.isFinite(answer.noul) ||
    answer.noul < 0 ||
    answer.noul > 1
  )
    return null;
  return answer.noul;
}

export async function classifyParagraphContinuation(
  { before, after, token } = {},
  { fetchImpl = fetch, env = process.env } = {},
) {
  const input = boundedInput(before, after);
  const credential = resolveToken(token, env);
  if (!input || !credential) return fallbackResult();

  const data = await requestClassification(
    fetchImpl,
    credential,
    requestBody(input.before, input.after),
  );
  const answer = noulAnswer(data);
  if (answer === null) return fallbackResult();

  return { combine: answer >= 0.8, status: 'classified' };
}
