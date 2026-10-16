import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import {
  COMPANION_SERVICE_DOMAIN,
  COMPANION_SERVICE_TYPE,
  companionServiceName,
  createBonjourAdvertiser,
} from '../../electron/main/services/bonjour-advertiser.mjs';
import { createCompanionServer } from '../../electron/main/services/companion-server.mjs';

function fakeAdvertiser() {
  const starts = [];
  const calls = [];
  let active = false;
  return {
    starts,
    calls,
    start(port, options) {
      starts.push(port);
      calls.push({ port, options });
      active = true;
      return true;
    },
    stop() {
      active = false;
    },
    running: () => active,
  };
}

test('kernel sharing persists its pairing code and runs one LAN backend', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'companion-')), 'companion.json');
  const started = [];
  let closed = 0;
  const options = {
    path,
    backendOptions: () => ({ port: 0, token: 'window-token' }),
    startBackend: async (backendOptions) => {
      started.push(backendOptions);
      return { close: async () => closed++, setCredentials: async () => {} };
    },
    dialog: {},
    host: () => 'studio.local',
    interfaces: () => ({
      lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      en0: [
        { address: '192.168.1.20', family: 'IPv4', internal: false },
        { address: 'fe80::1', family: 'IPv6', internal: false },
      ],
    }),
    tailscale: { discover: async () => [] },
  };
  const companion = await createCompanionServer(options);
  assert.equal(companion.enabled(), false);
  await companion.launch();
  assert.equal(started.length, 0);

  await companion.setEnabled(true);
  assert.equal(companion.running(), true);
  assert.match(companion.pairingCode(), /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
  assert.deepEqual(started[0].companion, {
    port: 8891,
    token: companion.pairingCode(),
    host: '::',
  });
  assert.equal(started[0].token, 'window-token');
  assert.deepEqual(companion.addresses(), ['http://studio.local:8891', 'http://192.168.1.20:8891']);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), {
    enabled: true,
    token: companion.pairingCode(),
    port: 8891,
  });

  const first = companion.pairingCode();
  await companion.regenerate();
  assert.notEqual(companion.pairingCode(), first);
  assert.equal(closed, 1);
  assert.equal(started.at(-1).companion.token, companion.pairingCode());

  // A relaunch restores sharing with the same code.
  const relaunched = await createCompanionServer(options);
  assert.equal(relaunched.pairingCode(), companion.pairingCode());
  await relaunched.launch();
  assert.equal(relaunched.running(), true);

  await companion.setEnabled(false);
  assert.equal(companion.running(), false);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).enabled, false);
});

test('connection snapshots come from the active backend only', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'companion-connections-'));
  const snapshot = [
    {
      id: 'connection-1',
      address: '192.168.1.30',
      name: 'Rongxin iPhone',
      userAgent: 'PDFMathReader/1.0',
      connectedAt: 1,
      lastSeenAt: 2,
      activeJobs: 0,
    },
  ];
  let calls = 0;
  let closed = 0;
  const companion = await createCompanionServer({
    path: join(directory, 'companion.json'),
    backendOptions: () => ({}),
    startBackend: async () => ({
      companionConnections: async () => {
        calls++;
        return snapshot;
      },
      close: async () => closed++,
    }),
    dialog: {},
    tailscale: { discover: async () => [] },
  });
  try {
    assert.deepEqual(await companion.connections(), []);

    await companion.setEnabled(true);
    assert.deepEqual(await companion.connections(), snapshot);
    assert.equal(calls, 1);

    await companion.close();
    assert.equal(companion.enabled(), true);
    assert.deepEqual(await companion.connections(), []);
    assert.equal(closed, 1);
  } finally {
    await companion.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('a busy port is reported instead of crashing', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'companion-')), 'companion.json');
  const messages = [];
  const companion = await createCompanionServer({
    path,
    backendOptions: () => ({}),
    startBackend: async () => {
      throw Error('listen EADDRINUSE: address already in use 0.0.0.0:8891');
    },
    dialog: {
      showMessageBox: async (options) => {
        messages.push(options);
        return { response: 0 };
      },
    },
    tailscale: { discover: async () => [] },
  });
  await companion.setEnabled(true);
  assert.equal(companion.running(), false);
  await companion.showDialog();
  assert.match(messages[0].detail, /Port 8891 is already in use/);
});

test('Bonjour discovery follows sharing and opt-in lifecycles without exposing the code', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'companion-')), 'companion.json');
  const advertiser = fakeAdvertiser();
  let closed = 0;
  const companion = await createCompanionServer({
    path,
    discoveryEnabled: true,
    advertiser,
    backendOptions: () => ({}),
    startBackend: async (options) => ({
      companionPort: 9123,
      close: async () => closed++,
      options,
    }),
    tailscale: {
      discover: async () => ['100.113.193.105', 'fd7a:115c:a1e0::643b:c169', '100.63.1.1'],
    },
    dialog: {},
  });
  await companion.launch();
  assert.equal(advertiser.starts.length, 0);
  await companion.setEnabled(true);
  assert.deepEqual(advertiser.starts, [9123]);
  assert.deepEqual(advertiser.calls[0], {
    port: 9123,
    options: { txtRecords: ['ts=100.113.193.105,fd7a:115c:a1e0::643b:c169'] },
  });
  assert.equal(companion.advertising(), true);
  assert.equal(JSON.stringify(advertiser.starts).includes(companion.pairingCode()), false);
  await companion.setDiscoveryEnabled(false);
  assert.equal(companion.advertising(), false);
  await companion.setDiscoveryEnabled(true);
  assert.deepEqual(advertiser.starts, [9123, 9123]);
  await companion.setEnabled(false);
  assert.equal(companion.advertising(), false);
  assert.equal(closed, 1);
});

test('Bonjour registration uses a distinct bounded name and no TXT data', () => {
  const child = new EventEmitter();
  child.kill = () => child.emit('exit', 0);
  const calls = [];
  const advertiser = createBonjourAdvertiser({
    serviceName: companionServiceName('Rongxins-MacBook-Pro.local'),
    spawnImpl: (...args) => {
      calls.push(args);
      return child;
    },
  });

  assert.equal(advertiser.start(18891), true);
  assert.deepEqual(calls, [
    [
      'dns-sd',
      [
        '-R',
        'PDFMathReader - Rongxins-MacBook-Pro',
        COMPANION_SERVICE_TYPE,
        COMPANION_SERVICE_DOMAIN,
        '18891',
      ],
      { stdio: 'ignore' },
    ],
  ]);
  advertiser.stop();
  assert.equal(advertiser.start(18892, { txtRecords: ['ts=100.64.1.2,fd7a:115c:a1e0::1'] }), true);
  assert.deepEqual(calls[1], [
    'dns-sd',
    [
      '-R',
      'PDFMathReader - Rongxins-MacBook-Pro',
      COMPANION_SERVICE_TYPE,
      COMPANION_SERVICE_DOMAIN,
      '18892',
      'ts=100.64.1.2,fd7a:115c:a1e0::1',
    ],
    { stdio: 'ignore' },
  ]);
  assert.ok(Buffer.byteLength(companionServiceName('x'.repeat(200)), 'utf8') <= 63);
  advertiser.stop();
  assert.equal(advertiser.running(), false);
});

test('stopping during a pending backend start clears a late Bonjour registration', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'companion-')), 'companion.json');
  const advertiser = fakeAdvertiser();
  let enterStart;
  const startEntered = new Promise((resolve) => {
    enterStart = resolve;
  });
  let resolveBackend;
  const backendReady = new Promise((resolve) => {
    resolveBackend = resolve;
  });
  let closed = 0;
  const companion = await createCompanionServer({
    path,
    discoveryEnabled: true,
    advertiser,
    backendOptions: () => ({}),
    startBackend: async () => {
      enterStart();
      return backendReady;
    },
    tailscale: { discover: async () => [] },
    dialog: {},
  });

  const enabling = companion.setEnabled(true);
  await startEntered;
  const stopping = companion.close();
  resolveBackend({ companionPort: 9123, close: async () => closed++ });
  await Promise.all([enabling, stopping]);

  assert.deepEqual(advertiser.starts, [9123]);
  assert.equal(advertiser.running(), false);
  assert.equal(closed, 1);
});

test('disabled sharing still enforces durable document ownership', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'companion-'));
  try {
    const sourcePath = join(directory, 'source.pdf');
    const pdf = await PDFDocument.create();
    pdf.addPage([612, 792]);
    await writeFile(sourcePath, await pdf.save());
    const documents = {
      recentsPath: join(directory, 'recent-documents.json'),
      annotationsRoot: join(directory, 'annotations'),
      quickLinksRoot: join(directory, 'quick-links'),
      statePath: join(directory, 'companion-documents.json'),
    };
    await writeFile(
      documents.recentsPath,
      JSON.stringify([{ id: 'document-1', path: sourcePath, pinned: false }]),
    );
    const makeStore = () =>
      import('../../server/documents/companion-document-store.mjs').then(
        ({ createCompanionDocumentStore }) => createCompanionDocumentStore(documents),
      );
    const remoteStore = await makeStore();
    await remoteStore.acquire('document-1', {
      deviceID: 'ios-1',
      deviceName: 'Rongxin iPhone',
      sessionID: 'ios-session-1',
    });

    const companion = await createCompanionServer({
      path: join(directory, 'companion.json'),
      documents,
      backendOptions: () => ({}),
      startBackend: async () => {
        throw Error('The disabled companion server must not start.');
      },
      dialog: {},
      tailscale: { discover: async () => [] },
    });
    await assert.rejects(
      companion.claimDesktopDocument('document-1', 'desktop-session-1', 'This Mac'),
      (error) => error.code === 'DOCUMENT_LOCKED' && error.deviceName === 'Rongxin iPhone',
    );

    await companion.close();
    await remoteStore.release('document-1', 'ios-session-1');
    const relaunched = await createCompanionServer({
      path: join(directory, 'companion.json'),
      documents,
      backendOptions: () => ({}),
      startBackend: async () => {
        throw Error('The disabled companion server must not start.');
      },
      dialog: {},
      tailscale: { discover: async () => [] },
    });
    const claimed = await relaunched.claimDesktopDocument(
      'document-1',
      'desktop-session-1',
      'This Mac',
    );
    assert.equal(claimed.claimed, true);
    await relaunched.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
