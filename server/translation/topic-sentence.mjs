const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const MAX_PARAGRAPH_CHARACTERS = 12000;
const MAX_TOKEN_CHARACTERS = 4096;
const REQUEST_TIMEOUT_MS = 5000;

const fallbackResult = () => ({ isTopicSentence: true, status: 'fallback' });

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

function boundedInput(paragraph, firstSentence) {
  if (typeof paragraph !== 'string' || typeof firstSentence !== 'string') return null;
  if (!paragraph.trim() || !firstSentence.trim()) return null;
  if (unicodeLength(paragraph) > MAX_PARAGRAPH_CHARACTERS) return null;
  if (!paragraph.startsWith(firstSentence)) return null;
  return { paragraph, firstSentence };
}

function requestBody(paragraph, firstSentence) {
  return {
    model: MODEL,
    state: { paragraph, firstSentence },
    questions: {
      first_sentence_topic: {
        type: 'noul',
        instructions:
          'Does `firstSentence` state or introduce the main idea developed by `paragraph`?',
        criteria: {
          true: 'The first sentence states or introduces the central idea developed by the rest of the paragraph.',
          false:
            'The first sentence only provides a transition, example, background detail, or another point rather than the paragraph’s main idea.',
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
  const answer = data?.answers?.first_sentence_topic;
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

export async function classifyTopicSentence(
  { paragraph, firstSentence, token } = {},
  { fetchImpl = fetch, env = process.env } = {},
) {
  const input = boundedInput(paragraph, firstSentence);
  const credential = resolveToken(token, env);
  if (!input || !credential) return fallbackResult();

  const data = await requestClassification(
    fetchImpl,
    credential,
    requestBody(input.paragraph, input.firstSentence),
  );
  const answer = noulAnswer(data);
  if (answer === null) return fallbackResult();

  return { isTopicSentence: answer >= 0.5, status: 'classified' };
}
