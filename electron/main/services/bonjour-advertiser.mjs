import { spawn as defaultSpawn } from 'node:child_process';
import { hostname as defaultHostname } from 'node:os';

export const COMPANION_SERVICE_NAME = 'PDFMathReader';
export const COMPANION_SERVICE_TYPE = '_pdfmathreader._tcp.';
export const COMPANION_SERVICE_DOMAIN = 'local.';

const truncateUtf8 = (value, maxBytes) => {
  let result = '';
  for (const character of value) {
    const candidate = result + character;
    if (Buffer.byteLength(candidate, 'utf8') > maxBytes) break;
    result = candidate;
  }
  return result;
};

export const companionServiceName = (hostName = defaultHostname()) => {
  const host = String(hostName || '')
    .replace(/\.local\.?$/i, '')
    .trim();
  if (!host) return COMPANION_SERVICE_NAME;
  return truncateUtf8(`${COMPANION_SERVICE_NAME} - ${host}`, 63);
};

// dns-sd keeps the registration alive for as long as the process runs. The
// companion server owns this process so discovery follows the sharing
// lifecycle. TXT records are limited to non-secret, validated metadata supplied
// by that server; the pairing secret is never placed in the argument list.
export function createBonjourAdvertiser({
  spawnImpl = defaultSpawn,
  command = 'dns-sd',
  serviceName = companionServiceName(),
  serviceType = COMPANION_SERVICE_TYPE,
  domain = COMPANION_SERVICE_DOMAIN,
  logger = () => {},
} = {}) {
  let processHandle = null;

  const start = (port, { txtRecords = [] } = {}) => {
    if (processHandle || !Number.isInteger(port) || port <= 0 || port >= 65536) return false;
    const records = (Array.isArray(txtRecords) ? txtRecords : [])
      .filter((record) => typeof record === 'string')
      .filter((record) => {
        const bytes = Buffer.byteLength(record, 'utf8');
        return bytes > 0 && bytes <= 255 && !/[\0\r\n]/.test(record);
      });
    let child;
    try {
      child = spawnImpl(
        command,
        ['-R', serviceName, serviceType, domain, String(port), ...records],
        { stdio: 'ignore' },
      );
    } catch (error) {
      logger(error);
      return false;
    }
    processHandle = child;
    child.once?.('error', (error) => {
      if (processHandle !== child) return;
      processHandle = null;
      logger(error);
    });
    child.once?.('exit', () => {
      if (processHandle === child) processHandle = null;
    });
    child.unref?.();
    return true;
  };

  const stop = () => {
    const child = processHandle;
    processHandle = null;
    if (!child) return;
    try {
      child.kill?.();
    } catch (error) {
      logger(error);
    }
  };

  return { start, stop, running: () => !!processHandle };
}
