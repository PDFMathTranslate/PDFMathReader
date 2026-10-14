import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { createTermCorpus } from '../../../server/documents/term-corpus.mjs';
import { registerTermCorpusRoutes } from '../../../server/http/term-corpus-routes.mjs';

const id = (n) => n.toString(16).padStart(32, '0');

async function withDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), 'term-corpus-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('document frequencies leave out the open document', () =>
  withDirectory(async (directory) => {
    const corpus = createTermCorpus({ directory });
    assert.deepEqual(await corpus.touch(id(1)), { known: false });
    await corpus.add(id(1), ['entropy', 'the', 'the']);
    await corpus.add(id(2), ['the', 'gibbs']);
    assert.deepEqual(await corpus.touch(id(1)), { known: true });
    assert.deepEqual(await corpus.frequencies(id(1), ['the', 'entropy', 'gibbs', 'none']), {
      documents: 1,
      frequencies: [1, 0, 1, 0],
    });
    assert.deepEqual(await corpus.frequencies(id(3), ['the']), {
      documents: 2,
      frequencies: [2],
    });
    // A new sample of a document replaces its old one.
    await corpus.add(id(1), ['gibbs']);
    assert.deepEqual(
      (await corpus.frequencies(undefined, ['entropy', 'gibbs'])).frequencies,
      [0, 2],
    );
    await assert.rejects(corpus.add('../x', ['a']), { status: 400 });
    await assert.rejects(corpus.frequencies(id(1), 'the'), { status: 400 });
  }));

test('the cache caps terms, evicts the least recently opened and reloads from disk', () =>
  withDirectory(async (directory) => {
    let clock = 0;
    const corpus = createTermCorpus({
      directory,
      maxDocuments: 2,
      maxTerms: 3,
      now: () => ++clock,
    });
    assert.equal((await corpus.add(id(1), ['a1', 'b1', 'c1', 'd1', 'e1'])).terms, 3);
    await corpus.add(id(2), ['shared']);
    await corpus.touch(id(1));
    await corpus.add(id(3), ['shared']);
    await corpus.flush();
    const reloaded = createTermCorpus({ directory });
    assert.deepEqual(await reloaded.touch(id(2)), { known: false });
    assert.deepEqual(await reloaded.touch(id(1)), { known: true });
    assert.deepEqual(await reloaded.frequencies(null, ['shared']), {
      documents: 2,
      frequencies: [1],
    });
  }));

test('routes look up, record and reject malformed requests', () =>
  withDirectory(async (directory) => {
    const app = express();
    registerTermCorpusRoutes(app, { termCorpus: createTermCorpus({ directory }) });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const post = (path, body) =>
      fetch(`http://127.0.0.1:${server.address().port}/api/term-corpus/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    try {
      assert.deepEqual(await (await post('documents', { id: id(1) })).json(), { known: false });
      assert.equal((await post('documents', { id: id(1), terms: ['entropy'] })).status, 200);
      assert.deepEqual(
        await (await post('frequencies', { exclude: id(2), terms: ['entropy'] })).json(),
        { documents: 1, frequencies: [1] },
      );
      assert.equal((await post('documents', { id: 'nope' })).status, 400);
      assert.equal((await post('frequencies', { terms: [7] })).status, 400);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }));
