import {
  orderedParagraphBlocks,
  paragraphContinuationCandidate,
  combineParagraphText,
} from '../../../shared/translation/paragraph-fragments.mjs';

// Layouts and boundary requests are shared across visible pages. A group is
// resolved before any translation job is queued, so neighboring jobs agree.
export function createParagraphContinuation({
  context,
  pages,
  ensureLayout,
  api,
  timeoutMs = 6000,
}) {
  let snapshot,
    generation = 0,
    active = 0;
  let groups = new WeakMap();
  let orders = new WeakMap();
  const decisions = new Map(),
    requests = [],
    controllers = new Set();
  const same = (a, b) =>
    a && b && a.epoch === b.epoch && a.enabled === b.enabled && a.token === b.token;
  function reset() {
    generation++;
    groups = new WeakMap();
    orders = new WeakMap();
    decisions.clear();
    for (const request of requests.splice(0)) request.resolve(false);
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
  const fresh = (version) => generation === version && same(snapshot, context());
  async function run(request) {
    const controller = new AbortController();
    controllers.add(controller);
    let timer;
    try {
      const result = await Promise.race([
        Promise.resolve().then(() =>
          fresh(request.version)
            ? api('/api/paragraph-continuation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  before: request.before,
                  after: request.after,
                  token: snapshot.token,
                }),
                signal: controller.signal,
              })
            : null,
        ),
        new Promise((resolve) => {
          controller.signal.addEventListener('abort', () => resolve(null), { once: true });
          timer = setTimeout(() => {
            resolve(null);
            controller.abort();
          }, timeoutMs);
        }),
      ]);
      request.resolve(
        fresh(request.version) && result?.status === 'classified' && result.combine === true,
      );
    } catch {
      request.resolve(false);
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
      controller.abort();
    }
  }
  function drain() {
    while (active < 4 && requests.length) {
      const request = requests.shift();
      if (!fresh(request.version)) {
        request.resolve(false);
        continue;
      }
      active++;
      void run(request).finally(() => {
        active--;
        drain();
      });
    }
  }
  function combines(left, right, version) {
    if (!fresh(version) || !paragraphContinuationCandidate(left, right))
      return Promise.resolve(false);
    const before = left.block.text,
      after = right.block.text;
    if (Array.from(before).length > 6000 || Array.from(after).length > 6000)
      return Promise.resolve(false);
    const key = JSON.stringify([
      left.page.number,
      left.block.id,
      before,
      right.page.number,
      right.block.id,
      after,
    ]);
    if (decisions.has(key)) return decisions.get(key);
    if (requests.length >= 256) return Promise.resolve(false);
    const promise = new Promise((resolve) => requests.push({ before, after, version, resolve }));
    decisions.set(key, promise);
    // The window's document layouts may be large; retain only a bounded set of judgments.
    if (decisions.size > 512) decisions.delete(decisions.keys().next().value);
    drain();
    return promise;
  }
  async function neighbor(member, direction, version) {
    if (!fresh(version)) return null;
    const ordered = orderedForPage(member.page),
      index = ordered.indexOf(member.block);
    if (index < 0) return null;
    const adjacent = ordered[index + direction];
    if (adjacent) return { page: member.page, block: adjacent };
    const page = pages()[member.page.number - 1 + direction];
    if (!page) return null;
    try {
      await ensureLayout(page);
    } catch {
      return null;
    }
    if (!fresh(version)) return null;
    const candidates = orderedForPage(page);
    const block = direction < 0 ? candidates.at(-1) : candidates[0];
    return block ? { page, block } : null;
  }
  function orderedForPage(page) {
    const entry = orders.get(page);
    if (entry?.blocks === page.blocks) return entry.ordered;
    const ordered = orderedParagraphBlocks(page);
    orders.set(page, { blocks: page.blocks, ordered });
    return ordered;
  }
  const singleton = (page, block) => ({
    id: `${page.number}:${block.id}`,
    members: [{ page, block }],
    text: block.text,
  });
  async function resolveGroup(page, block, version) {
    const origin = { page, block },
      left = [origin];
    // Find the actual beginning first. Resolving from either page must produce
    // the same group, including when the reader opens a continuation page first.
    for (;;) {
      const before = await neighbor(left[0], -1, version);
      if (!before || !(await combines(before, left[0], version))) break;
      left.unshift(before);
      if (left.length > 16) return singleton(page, block);
    }
    const members = [left[0]];
    for (;;) {
      const after = await neighbor(members.at(-1), 1, version);
      if (!after || !(await combines(members.at(-1), after, version))) break;
      members.push(after);
      if (members.length > 16) return singleton(page, block);
    }
    if (!fresh(version) || combineParagraphText(members.map((m) => m.block.text)).length > 20000)
      return singleton(page, block);
    // Another concurrently resolving member may already have published this group.
    const first = members[0].block;
    const cached = groups.get(first);
    if (cached?.group) return cached.group;
    const group = {
      id: `${members[0].page.number}:${first.id}`,
      members,
      text: combineParagraphText(members.map((member) => member.block.text)),
    };
    const entry = { group, promise: Promise.resolve(group) };
    for (const member of members) groups.set(member.block, entry);
    return group;
  }
  function groupFor(page, block) {
    const current = refresh();
    if (!current.enabled) return Promise.resolve(singleton(page, block));
    const cached = groups.get(block);
    if (cached) return cached.promise;
    const version = generation;
    const entry = {
      promise: resolveGroup(page, block, version).catch(() => singleton(page, block)),
    };
    groups.set(block, entry);
    return entry.promise;
  }
  return { groupFor, invalidate: reset };
}
