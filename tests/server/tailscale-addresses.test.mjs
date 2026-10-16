import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTailscaleAddressProvider } from '../../electron/main/services/tailscale-addresses.mjs';
import {
  normalizeTailscaleAddresses,
  tailscaleHttpUrls,
  tailscaleTxt,
} from '../../shared/companion/tailscale.mjs';

test('normalizes only this computer’s Tailscale address ranges', () => {
  assert.deepEqual(
    normalizeTailscaleAddresses([
      '100.113.193.105',
      '100.113.193.105',
      '100.127.255.255',
      '100.100.100.100',
      '100.63.1.1',
      '100.128.1.1',
      'fd7a:115c:a1e0:0:0:0:643b:c169',
      'FD7A:115C:A1E0::1',
      'fd68:115c:a1e0::1',
      '2001:db8::1',
    ]),
    ['100.113.193.105', '100.127.255.255', 'fd7a:115c:a1e0::643b:c169', 'fd7a:115c:a1e0::1'],
  );
});

test('formats tailnet URLs and bounded discovery TXT metadata', () => {
  const addresses = ['100.64.1.2', 'fd7a:115c:a1e0::1', '100.63.1.1'];
  assert.deepEqual(tailscaleHttpUrls(addresses, 8891), [
    'http://100.64.1.2:8891',
    'http://[fd7a:115c:a1e0::1]:8891',
  ]);
  assert.equal(tailscaleTxt(addresses), 'ts=100.64.1.2,fd7a:115c:a1e0::1');
  assert.equal(tailscaleTxt(['100.64.1.2'], 8), '');
});

test('uses utun self addresses before invoking the CLI', async () => {
  let calls = 0;
  const provider = createTailscaleAddressProvider({
    interfaces: () => ({
      utun4: [
        { address: '100.113.193.105', internal: false },
        { address: 'fd7a:115c:a1e0::643b:c169', internal: false },
        { address: 'fd68:115c:a1e0::1', internal: false },
      ],
      en0: [{ address: '192.168.1.20', internal: false }],
    }),
    execFileImpl: async () => {
      calls++;
      return { stdout: JSON.stringify({ Self: { TailscaleIPs: ['100.64.1.2'] } }) };
    },
  });
  assert.deepEqual(await provider.discover(), ['100.113.193.105', 'fd7a:115c:a1e0::643b:c169']);
  assert.equal(calls, 0);
});

test('falls back to CLI Self addresses and ignores peers', async () => {
  const calls = [];
  const provider = createTailscaleAddressProvider({
    interfaces: () => ({ en0: [{ address: '192.168.1.20', internal: false }] }),
    commands: ['/test/tailscale'],
    timeoutMs: 750,
    execFileImpl: async (...args) => {
      calls.push(args);
      return {
        stdout: JSON.stringify({
          Self: { TailscaleIPs: ['100.113.193.105', 'fd7a:115c:a1e0::1'] },
          Peer: { peer: { TailscaleIPs: ['100.64.1.9', 'fd7a:115c:a1e0::9'] } },
        }),
      };
    },
  });
  assert.deepEqual(await provider.discover(), ['100.113.193.105', 'fd7a:115c:a1e0::1']);
  assert.deepEqual(calls, [
    [
      '/test/tailscale',
      ['status', '--json'],
      { encoding: 'utf8', timeout: 750, maxBuffer: 256 * 1024 },
    ],
  ]);
});
