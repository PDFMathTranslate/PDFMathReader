const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const MAX_FRAGMENT_CHARACTERS = 6000;
const MAX_TOKEN_CHARACTERS = 4096;
const REQUEST_TIMEOUT_MS = 5000;
const MIN_GAP_IN_EM = -0.25;
const MAX_GAP_IN_EM = 3;
const MIN_AFTER_INDENT_IN_EM = -4;
const MAX_AFTER_INDENT_IN_EM = 4;

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

function boundedLayout(layout) {
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) return undefined;
  const bounded = {};
  if (typeof layout.sameColumn === 'boolean') bounded.sameColumn = layout.sameColumn;
  if (
    typeof layout.gapInEm === 'number' &&
    Number.isFinite(layout.gapInEm) &&
    layout.gapInEm >= MIN_GAP_IN_EM &&
    layout.gapInEm <= MAX_GAP_IN_EM
  )
    bounded.gapInEm = layout.gapInEm;
  if (
    typeof layout.afterIndentInEm === 'number' &&
    Number.isFinite(layout.afterIndentInEm) &&
    layout.afterIndentInEm >= MIN_AFTER_INDENT_IN_EM &&
    layout.afterIndentInEm <= MAX_AFTER_INDENT_IN_EM
  )
    bounded.afterIndentInEm = layout.afterIndentInEm;
  return Object.keys(bounded).length ? bounded : undefined;
}

function requestBody(before, after, layout) {
  return {
    model: MODEL,
    state: { before, after, ...(layout ? { layout } : {}) },
    questions: {
      paragraph_continuation: {
        type: 'noul',
        instructions:
          'Should these adjoining text fragments be translated as one continuous body paragraph? A paragraph can contain several complete sentences. When layout is supplied, gapInEm is the empty vertical gap measured in font sizes and afterIndentInEm is the next first-line indentation. Same-column text with a normal row gap (about 0.25 em) and zero indentation is strong evidence of a continuation. A following sentence about the same data, methods, or results can continue the paragraph even when the previous sentence is complete. Use text and layout evidence; a period alone is not a paragraph boundary.',
        criteria: {
          true: 'The next fragment continues the same body paragraph, within a sentence or between related complete sentences. With matching font, same-column placement, a normal row gap and no new first-line indentation, related sentences should be combined unless there is explicit evidence of a new paragraph.',
          false:
            'There is evidence of an intentional paragraph boundary such as extra paragraph spacing, new first-line indentation, a distinct unrelated subject, a list entry, a heading, a caption, or a footnote. A new sentence expanding on the same subject, or a period in before, is not sufficient evidence of a new paragraph.',
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
  { before, after, layout, token } = {},
  { fetchImpl = fetch, env = process.env } = {},
) {
  const input = boundedInput(before, after);
  const credential = resolveToken(token, env);
  if (!input || !credential) return fallbackResult();
  const safeLayout = boundedLayout(layout);

  const data = await requestClassification(
    fetchImpl,
    credential,
    requestBody(input.before, input.after, safeLayout),
  );
  const answer = noulAnswer(data);
  if (answer === null) return fallbackResult();

  const continuousRows =
    safeLayout?.sameColumn === true &&
    typeof safeLayout.gapInEm === 'number' &&
    safeLayout.gapInEm >= 0 &&
    safeLayout.gapInEm <= 0.5 &&
    typeof safeLayout.afterIndentInEm === 'number' &&
    Math.abs(safeLayout.afterIndentInEm) <= 0.2;
  return { combine: answer >= (continuousRows ? 0.7 : 0.8), status: 'classified' };
}
