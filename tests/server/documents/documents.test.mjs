import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentStore } from '../../../server/documents/documents.mjs';

test('document store rejects capacity without evicting active documents and invalidates deletes', () => {
  const store = createDocumentStore({ maxDocuments: 2, maxBytes: 100, maxDocumentBytes: 100 });
  const bytes = Buffer.from('%PDF-1.7\nfixture');
  const first = store.register(bytes),
    second = store.register(bytes);
  assert.throws(
    () => store.register(bytes),
    (error) => error.code === 'DOCUMENT_CAPACITY' && error.status === 409,
  );
  assert.equal(store.get(first), bytes);
  assert.equal(store.get(second), bytes);
  assert.equal(store.delete('not-a-uuid'), false);
  assert.equal(store.delete(first), true);
  assert.equal(store.get(first), undefined);
  assert.equal(store.stats().activeBytes, bytes.length);
  store.clear();
  assert.equal(store.size(), 0);
  assert.equal(store.stats().activeBytes, 0);
});
