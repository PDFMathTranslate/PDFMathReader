import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { ref } from 'vue';
import { createTfidfWeighting } from '../../src/features/reader/tfidf-weighting.mjs';

const id = 'ab'.repeat(16);

function document(pages) {
  const read = [];
  return {
    read,
    fingerprints: [id],
    numPages: pages.length,
    getPage: async (number) => ({
      getTextContent: async () => {
        read.push(number);
        return { items: [{ str: pages[number - 1], hasEOL: true }] };
      },
    }),
  };
}

async function recording(known, pdf) {
  const requests = [],
    oldFetch = globalThis.fetch;
  globalThis.fetch = async (path, { body }) => {
    requests.push([path, JSON.parse(body)]);
    return { ok: true, json: async () => ({ known }) };
  };
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const session = { pdf },
      weighting = createTfidfWeighting({
        session,
        preferences: { tfidfWeightingEnabled: ref(false) },
      });
    weighting.record(pdf);
    weighting.record(pdf);
    mock.timers.tick(1500);
    for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
    return requests;
  } finally {
    mock.timers.reset();
    globalThis.fetch = oldFetch;
  }
}

test('a new document lends the terms of its sampled pages once, even when weighting is off', async () => {
  const pdf = document(['Gibbs entropy', 'Free energy']);
  const requests = await recording(false, pdf);
  assert.deepEqual(requests[0], ['/api/term-corpus/documents', { id }]);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1][1].terms.sort(), ['energy', 'entropy', 'free', 'gibbs']);
  assert.deepEqual(pdf.read, [1, 2]);
});

test('a document already in the cache is not read again', async () => {
  const pdf = document(['Gibbs entropy']);
  assert.equal((await recording(true, pdf)).length, 1);
  assert.deepEqual(pdf.read, []);
});
