// Independent asynchronous lanes keep a slow judgment from blocking other paragraphs.
export function createTopicSentenceClassifier({
  context,
  api,
  onUpdate = () => {},
  concurrency = 4,
  timeoutMs = 6000,
}) {
  const entries = new Map();
  const queue = [];
  const controllers = new Set();
  let snapshot,
    active = 0,
    generation = 0,
    disposed = false;
  const lanes = Math.max(1, Math.min(8, Math.floor(concurrency) || 4));
  const same = (a, b) =>
    a &&
    b &&
    a.document === b.document &&
    a.epoch === b.epoch &&
    a.enabled === b.enabled &&
    a.token === b.token;

  function reset() {
    generation++;
    entries.clear();
    queue.length = 0;
    for (const controller of controllers) controller.abort();
  }
  function refresh() {
    const next = context();
    if (!same(snapshot, next)) {
      reset();
      snapshot = { ...next };
    }
    return snapshot;
  }
  function fresh(entry) {
    return !disposed && entry.generation === generation && same(snapshot, context());
  }
  async function run(entry) {
    const controller = new AbortController();
    controllers.add(controller);
    let timer;
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => {
          // A queued item may outlive its document or settings.
          if (!fresh(entry)) return null;
          return api('/api/topic-sentence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paragraph: entry.paragraph,
              firstSentence: entry.firstSentence,
              token: snapshot.token,
            }),
            signal: controller.signal,
          });
        }),
        new Promise((resolve) => {
          controller.signal.addEventListener('abort', () => resolve(null), { once: true });
          timer = setTimeout(() => {
            resolve(null);
            controller.abort();
          }, timeoutMs);
        }),
      ]);
      if (fresh(entry)) {
        entry.yes =
          result?.status === 'classified' && typeof result.isTopicSentence === 'boolean'
            ? result.isTopicSentence
            : true;
      }
    } catch {
      // Missing credentials, transport errors and malformed replies retain emphasis.
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
      controller.abort();
      entry.done = true;
      if (fresh(entry)) onUpdate();
    }
  }
  function drain() {
    while (!disposed && active < lanes && queue.length) {
      const entry = queue.shift();
      if (!fresh(entry)) continue;
      active++;
      void run(entry).finally(() => {
        active--;
        drain();
      });
    }
  }
  function isTopicSentence(paragraph, firstSentence) {
    const current = refresh();
    if (
      disposed ||
      !current.enabled ||
      typeof paragraph !== 'string' ||
      typeof firstSentence !== 'string' ||
      !firstSentence.trim() ||
      !paragraph.startsWith(firstSentence) ||
      Array.from(paragraph).length > 12000
    )
      return true;
    const key = JSON.stringify([paragraph, firstSentence]);
    const cached = entries.get(key);
    if (cached) {
      entries.delete(key);
      entries.set(key, cached);
      return cached.yes;
    }
    // Bound both network backlog and document text retained in the window.
    if (queue.length >= 128) return true;
    if (entries.size >= 512) {
      for (const [oldKey, entry] of entries) {
        if (entry.done) entries.delete(oldKey);
        if (entries.size < 512) break;
      }
    }
    const entry = { paragraph, firstSentence, generation, yes: true, done: false };
    entries.set(key, entry);
    queue.push(entry);
    drain();
    return true;
  }
  return {
    isTopicSentence,
    invalidate() {
      reset();
      snapshot = undefined;
    },
    dispose() {
      disposed = true;
      reset();
    },
  };
}
