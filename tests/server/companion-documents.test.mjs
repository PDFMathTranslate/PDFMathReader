import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { PDFDocument, PDFHexString, PDFName } from 'pdf-lib';
import { createCompanionDocumentStore } from '../../server/documents/companion-document-store.mjs';

const annotation = {
  id: 'highlight-1',
  page: 1,
  kind: 'highlight',
  origin: 'source',
  text: 'A highlighted sentence',
  comment: '',
  color: '#fff36a',
  rects: [{ x: 10, y: 20, width: 100, height: 12 }],
  createdAt: '2026-10-16T00:00:00.000Z',
};

const quickLink = {
  id: 'link-1',
  origin: { page: 1, box: { x: 10, y: 20, width: 100, height: 12 } },
  result: { page: 1, box: { x: 20, y: 30, width: 100, height: 12 } },
};

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'pdfmath-companion-'));
  const path = join(directory, 'source.pdf');
  const recentsPath = join(directory, 'recent-documents.json');
  const statePath = join(directory, 'companion-documents.json');
  const annotationsRoot = join(directory, 'annotations');
  const quickLinksRoot = join(directory, 'quick-links');
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  const transfer = {
    version: 1,
    documentID: 'desktop-document',
    annotations: [annotation],
    quickLinks: [quickLink],
    readingState: {
      page: 1,
      zoom: 1.25,
      scaleMode: 'fitPage',
      displayMode: 'singlePage',
      scrollDirection: 'vertical',
      sidebarVisible: true,
      lastUpdated: '2026-10-16T00:00:00.000Z',
    },
  };
  const info = pdf.context.obj({});
  info.set(PDFName.of('PDFMathReaderTransfer'), PDFHexString.fromText(JSON.stringify(transfer)));
  pdf.context.trailerInfo.Info = pdf.context.register(info);
  const bytes = Buffer.from(await pdf.save({ useObjectStreams: false }));
  await writeFile(path, bytes);
  await writeFile(
    recentsPath,
    JSON.stringify([
      {
        id: 'desktop-document',
        path,
        pinned: false,
        lastOpened: transfer.readingState.lastUpdated,
        view: {
          page: 1,
          zoom: 1.5,
          fit: 'width',
          columns: 1,
          direction: 'vertical',
          sidebar: true,
        },
      },
    ]),
  );
  const makeStore = () =>
    createCompanionDocumentStore({
      recentsPath,
      annotationsRoot,
      quickLinksRoot,
      statePath,
      maxDocumentBytes: 10 * 1024 * 1024,
    });
  return {
    directory,
    path,
    recentsPath,
    statePath,
    bytes,
    makeStore,
  };
}

function upload(snapshot, overrides = {}) {
  return {
    requestID: 'request-1',
    revision: snapshot.revision,
    pdf: snapshot.pdf,
    sha256: createHash('sha256').update(Buffer.from(snapshot.pdf, 'base64')).digest('hex'),
    byteCount: Buffer.byteLength(Buffer.from(snapshot.pdf, 'base64')),
    pageCount: snapshot.pageCount,
    release: false,
    annotations: [annotation],
    quickLinks: [quickLink],
    readingState: {
      page: 1,
      zoom: 1.25,
      scaleMode: 'fitPage',
      displayMode: 'singlePage',
      scrollDirection: 'vertical',
      sidebarVisible: true,
      lastUpdated: '2026-10-16T00:00:00.000Z',
    },
    ...overrides,
  };
}

test('companion document sessions are durable, exclusive, and idempotent', async () => {
  const fixtureState = await fixture();
  try {
    const store = await fixtureState.makeStore();
    const listed = await store.list();
    assert.deepEqual(listed.documents, [
      {
        id: 'desktop-document',
        title: 'source.pdf',
        pageCount: 1,
        lastOpened: '2026-10-16T00:00:00.000Z',
      },
    ]);

    const acquired = await store.acquire('desktop-document', {
      deviceID: 'ios-device-1',
      deviceName: 'Rongxin iPhone',
      sessionID: 'session-1',
    });
    assert.equal(acquired.created, true);
    assert.equal(acquired.response.sessionID, 'session-1');
    assert.deepEqual(acquired.response.annotations, [annotation]);
    assert.deepEqual(acquired.response.quickLinks, [quickLink]);
    assert.equal(acquired.response.readingState.zoom, 1.25);

    const resumed = await store.acquire('desktop-document', {
      deviceID: 'ios-device-1',
      deviceName: 'Rongxin iPhone',
      sessionID: 'session-1',
    });
    assert.equal(resumed.created, false);
    await assert.rejects(
      store.acquire('desktop-document', {
        deviceID: 'ios-device-2',
        deviceName: 'Other iPhone',
        sessionID: 'session-2',
      }),
      (error) => error.code === 'DOCUMENT_LOCKED' && error.deviceName === 'Rongxin iPhone',
    );

    const body = upload(acquired.response);
    const saved = await store.update('desktop-document', 'session-1', body);
    assert.equal(saved.released, false);
    const released = await store.update('desktop-document', 'session-1', {
      ...body,
      requestID: 'request-2',
      release: true,
    });
    assert.equal(released.released, true);
    assert.equal(
      (
        await store.update('desktop-document', 'session-1', {
          ...body,
          requestID: 'request-2',
          release: true,
        })
      ).revision,
      released.revision,
    );
    await assert.rejects(
      store.acquire('desktop-document', {
        deviceID: 'ios-device-1',
        deviceName: 'Rongxin iPhone',
        sessionID: 'session-1',
      }),
      (error) => error.code === 'SESSION_RELEASED',
    );

    const restarted = await fixtureState.makeStore();
    const next = await restarted.acquire('desktop-document', {
      deviceID: 'ios-device-2',
      deviceName: 'Other iPhone',
      sessionID: 'session-2',
    });
    assert.equal(next.response.revision, released.revision);
    assert.deepEqual(next.response.annotations, [annotation]);
  } finally {
    await rm(fixtureState.directory, { recursive: true, force: true });
  }
});

test('a durable lock survives a companion backend restart', async () => {
  const fixtureState = await fixture();
  try {
    const first = await fixtureState.makeStore();
    await first.acquire('desktop-document', {
      deviceID: 'ios-device-1',
      deviceName: 'Rongxin iPhone',
      sessionID: 'session-1',
    });
    const second = await fixtureState.makeStore();
    await assert.rejects(
      second.acquire('desktop-document', {
        deviceID: 'ios-device-2',
        deviceName: 'Other iPhone',
        sessionID: 'session-2',
      }),
      (error) => error.code === 'DOCUMENT_LOCKED',
    );
    assert.equal(
      JSON.parse(await readFile(fixtureState.statePath, 'utf8')).documents['desktop-document'].lock
        .sessionID,
      'session-1',
    );
  } finally {
    await rm(fixtureState.directory, { recursive: true, force: true });
  }
});

test('desktop ownership blocks paired sessions and releases explicitly', async () => {
  const fixtureState = await fixture();
  try {
    const store = await fixtureState.makeStore();
    const claimed = await store.claimDesktop('desktop-document', 'desktop-session-1', 'This Mac');
    assert.equal(claimed.claimed, true);
    assert.equal(claimed.revision, claimed.revision.toLowerCase());
    await assert.rejects(
      store.acquire('desktop-document', {
        deviceID: 'ios-device-1',
        deviceName: 'Rongxin iPhone',
        sessionID: 'session-1',
      }),
      (error) => error.code === 'DOCUMENT_LOCKED' && error.deviceName === 'This Mac',
    );

    const released = await store.releaseDesktop('desktop-document', 'desktop-session-1');
    assert.equal(released.released, true);
    const reacquired = await store.claimDesktop(
      'desktop-document',
      'desktop-session-1',
      'This Mac',
    );
    assert.equal(reacquired.claimed, true);
    assert.equal(reacquired.resumed, false);
    await store.releaseDesktop('desktop-document', 'desktop-session-1');

    const remote = await store.acquire('desktop-document', {
      deviceID: 'ios-device-1',
      deviceName: 'Rongxin iPhone',
      sessionID: 'session-1',
    });
    assert.equal(remote.created, true);
    assert.equal(remote.response.readingState.zoom, 1.5);
  } finally {
    await rm(fixtureState.directory, { recursive: true, force: true });
  }
});

test('a malformed durable state fails closed', async () => {
  const fixtureState = await fixture();
  try {
    await writeFile(fixtureState.statePath, '{"version":1,"documents":[]}', 'utf8');
    await assert.rejects(fixtureState.makeStore(), /Companion document state is invalid/);
  } finally {
    await rm(fixtureState.directory, { recursive: true, force: true });
  }
});
