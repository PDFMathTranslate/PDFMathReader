import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { networkInterfaces as defaultNetworkInterfaces } from 'node:os';
import {
  normalizeTailscaleAddresses,
  normalizeTailscaleAddress,
} from '../../../shared/companion/tailscale.mjs';

const defaultExecFile = promisify(execFile);
export const TAILSCALE_CLI_CANDIDATES = Object.freeze([
  '/usr/local/bin/tailscale',
  '/Applications/Tailscale.app/Contents/MacOS/Tailscale',
]);
export const TAILSCALE_PROBE_TIMEOUT_MS = 1000;
const TAILSCALE_INTERFACE = /^utun\d+$/i;

export function tailscaleAddressesFromInterfaces(interfaces) {
  const values = [];
  for (const [name, entries] of Object.entries(interfaces || {})) {
    if (!TAILSCALE_INTERFACE.test(name)) continue;
    for (const entry of entries || []) {
      if (entry?.internal === true) continue;
      const address = normalizeTailscaleAddress(entry?.address);
      if (address) values.push(address);
    }
  }
  return normalizeTailscaleAddresses(values);
}

function selfAddressesFromStatus(stdout) {
  let status;
  try {
    status = JSON.parse(String(stdout || ''));
  } catch {
    return [];
  }
  return normalizeTailscaleAddresses(status?.Self?.TailscaleIPs);
}

// Interface enumeration is local and does not need permission to contact the
// Tailscale local API.  The CLI is a fallback for systems where the utun
// address has not appeared yet; its Self field is used exclusively, so peer
// addresses from status --json can never be advertised.
export function createTailscaleAddressProvider({
  interfaces = defaultNetworkInterfaces,
  execFileImpl = defaultExecFile,
  commands = TAILSCALE_CLI_CANDIDATES,
  timeoutMs = TAILSCALE_PROBE_TIMEOUT_MS,
  logger = () => {},
} = {}) {
  const discover = async () => {
    let local = [];
    try {
      local = tailscaleAddressesFromInterfaces(interfaces());
    } catch (error) {
      logger(error);
    }
    if (local.length) return local;

    for (const command of commands) {
      try {
        const result = await execFileImpl(command, ['status', '--json'], {
          encoding: 'utf8',
          timeout: timeoutMs,
          maxBuffer: 256 * 1024,
        });
        const addresses = selfAddressesFromStatus(result?.stdout ?? result);
        if (addresses.length) return addresses;
      } catch (error) {
        logger(error);
      }
    }
    return [];
  };

  return { discover };
}
