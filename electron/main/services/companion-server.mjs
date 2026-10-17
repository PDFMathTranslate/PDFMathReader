import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { hostname, networkInterfaces } from 'node:os';
import { randomBytes, randomUUID } from 'node:crypto';
import { replaceFile } from '../../../runtime/node/atomic-file.mjs';
import { createBonjourAdvertiser } from './bonjour-advertiser.mjs';
import { createTailscaleAddressProvider } from './tailscale-addresses.mjs';
import {
  COMPANION_DEFAULT_PORT,
  normalizePairingCode,
  pairingCodeFromBytes,
  PAIRING_CODE_BYTES,
} from '../../../shared/companion/pairing.mjs';
import {
  normalizeTailscaleAddresses,
  tailscaleHttpUrls,
  tailscaleTxt,
} from '../../../shared/companion/tailscale.mjs';

const createPairingCode = () => pairingCodeFromBytes(randomBytes(PAIRING_CODE_BYTES));

// Shares this computer's Fast and Precise kernels with PDFMathReader on iPhone
// and iPad. Per-window backends listen on loopback with random ports, so the
// companion runs one dedicated backend that also listens on the local network,
// and only while sharing is on. Its settings live outside renderer preferences.
export async function createCompanionServer({
  path,
  startBackend,
  backendOptions,
  dialog,
  label = (text) => text,
  interfaces = networkInterfaces,
  host = hostname,
  discoveryEnabled = false,
  documents,
  getDesktopClaims,
  advertiser = createBonjourAdvertiser({
    logger: (error) =>
      console.error('Unable to advertise PDFMathReader on the local network:', error.message),
  }),
  tailscale = createTailscaleAddressProvider({ interfaces }),
}) {
  let config = { enabled: false, token: '', port: COMPANION_DEFAULT_PORT };
  try {
    const saved = JSON.parse(await readFile(path, 'utf8'));
    config = {
      enabled: saved.enabled === true,
      token: [PAIRING_CODE_BYTES, 16].includes(normalizePairingCode(saved.token).length)
        ? saved.token
        : '',
      port:
        Number.isInteger(saved.port) && saved.port > 0 && saved.port < 65536
          ? saved.port
          : COMPANION_DEFAULT_PORT,
    };
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  let backend = null;
  let starting = null;
  let lastError = '';
  let shouldAdvertise = discoveryEnabled === true;
  let tailscaleAddresses = [];
  let activePort = config.port;
  let localDocuments = null;
  let createLocalDocumentStore;
  let transition = Promise.resolve();

  const runTransition = (operation) => {
    const result = transition.then(operation);
    transition = result.catch(() => {});
    return result;
  };
  const ensureLocalDocuments = async () => {
    if (localDocuments || !documents) return localDocuments;
    createLocalDocumentStore ||= (
      await import('../../../server/documents/companion-document-store.mjs')
    ).createCompanionDocumentStore;
    localDocuments = await createLocalDocumentStore(documents);
    return localDocuments;
  };
  const dropLocalDocuments = async () => {
    if (!localDocuments) return;
    await localDocuments.flush?.();
    localDocuments = null;
  };

  const computerName = () => {
    const name = String(host() || '')
      .replace(/\.local\.?$/i, '')
      .trim();
    return Array.from(name || 'PDFMathReader')
      .slice(0, 63)
      .join('');
  };

  const refreshTailscaleAddresses = async () => {
    try {
      tailscaleAddresses = normalizeTailscaleAddresses(await tailscale.discover());
    } catch {
      tailscaleAddresses = [];
    }
    return tailscaleAddresses;
  };

  const computer = () => {
    return tailscaleAddresses.length
      ? { name: computerName(), tailscaleAddresses: [...tailscaleAddresses] }
      : undefined;
  };

  const advertise = () => {
    if (!shouldAdvertise || !backend) return false;
    const txt = tailscaleTxt(tailscaleAddresses);
    return advertiser.start(activePort, { txtRecords: txt ? [txt] : [] });
  };

  const save = async () => {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(config), { mode: 0o600 });
      await replaceFile(temporary, path);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  };

  const stopNow = async () => {
    advertiser.stop();
    const current = backend || (await starting?.catch(() => null));
    backend = null;
    starting = null;
    activePort = config.port;
    // A pending start can finish between the first stop and the await above.
    // Stop again after it resolves so that it cannot leave a registration up.
    advertiser.stop();
    await current?.close();
  };

  const startNow = async () => {
    if (backend) return backend;
    if (starting) return starting;
    await dropLocalDocuments();
    if (!config.token) {
      config.token = createPairingCode();
      await save();
    }
    lastError = '';
    starting = (async () => {
      await refreshTailscaleAddresses();
      try {
        const companionComputer = computer();
        const service = await startBackend({
          ...backendOptions(),
          companion: {
            port: config.port,
            token: config.token,
            host: '::',
            ...(companionComputer ? { computer: companionComputer } : {}),
            ...(documents ? { documents } : {}),
            ...(getDesktopClaims ? { desktopClaims: (await getDesktopClaims()) || [] } : {}),
          },
          onCrash: (error) => {
            backend = null;
            activePort = config.port;
            advertiser.stop();
            lastError = error?.message || 'The kernel sharing service stopped.';
          },
        });
        backend = service;
        activePort = service.companionPort || config.port;
        if (shouldAdvertise) advertise();
        return service;
      } catch (error) {
        lastError = /EADDRINUSE/.test(error?.message || '')
          ? `Port ${config.port} is already in use on this computer.`
          : error?.message || 'The kernel sharing service could not start.';
        throw error;
      } finally {
        starting = null;
      }
    })();
    return starting;
  };

  const stop = () => runTransition(stopNow);
  const start = () => runTransition(startNow);

  const setDiscoveryEnabled = async (enabled) => {
    shouldAdvertise = enabled === true;
    if (!shouldAdvertise) {
      advertiser.stop();
      return;
    }
    if (config.enabled && backend) {
      await refreshTailscaleAddresses();
      advertise();
    }
  };

  const documentRequestNow = async (pathname, options = {}) => {
    if (!config.enabled) return { available: false };
    await startNow();
    const response = await fetch(`http://127.0.0.1:${activePort}${pathname}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    let body;
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    if (!response.ok) {
      const error = Error(body.error || `Companion document request failed (${response.status}).`);
      error.status = response.status;
      error.code = body.code;
      error.deviceName = body.deviceName;
      throw error;
    }
    return body;
  };

  const documentRequest = (pathname, options = {}) =>
    runTransition(() => documentRequestNow(pathname, options));

  const claimDesktopDocument = async (id, sessionID, deviceName = computerName()) =>
    runTransition(async () => {
      if (!config.enabled) {
        const store = await ensureLocalDocuments();
        return store ? store.claimDesktop(id, sessionID, deviceName) : { available: false };
      }
      try {
        return await documentRequestNow(
          `/companion/v1/documents/${encodeURIComponent(id)}/desktop-session`,
          { method: 'POST', body: JSON.stringify({ sessionID, deviceName }) },
        );
      } catch (error) {
        if (!backend) {
          const store = await ensureLocalDocuments();
          if (store) return store.claimDesktop(id, sessionID, deviceName);
        }
        throw error;
      }
    });

  const releaseDesktopDocument = async (id, sessionID) =>
    runTransition(async () => {
      if (!config.enabled || localDocuments)
        return (
          (await ensureLocalDocuments())?.releaseDesktop(id, sessionID) || { available: false }
        );
      return documentRequestNow(
        `/companion/v1/documents/${encodeURIComponent(id)}/desktop-session/${encodeURIComponent(sessionID)}`,
        { method: 'DELETE' },
      );
    });

  const addresses = () => {
    const name = String(host() || '').replace(/\.local$/i, '');
    const port = backend?.companionPort || activePort || config.port;
    const list = name ? [`http://${name}.local:${port}`] : [];
    for (const entries of Object.values(interfaces() || {}))
      for (const entry of entries || [])
        if (!entry.internal && (entry.family === 'IPv4' || entry.family === 4))
          list.push(`http://${entry.address}:${port}`);
    list.push(...tailscaleHttpUrls(tailscaleAddresses, port));
    return [...new Set(list)];
  };

  const setEnabled = async (enabled) =>
    runTransition(async () => {
      config.enabled = enabled;
      await save();
      if (!enabled) {
        await stopNow();
        await ensureLocalDocuments();
        return;
      }
      try {
        await startNow();
      } catch {
        await ensureLocalDocuments();
        /* lastError explains the failure in the dialog. */
      }
    });

  const regenerate = async () =>
    runTransition(async () => {
      config.token = createPairingCode();
      await save();
      if (config.enabled) {
        await stopNow();
        try {
          await startNow();
        } catch {
          await ensureLocalDocuments();
          /* lastError explains the failure in the dialog. */
        }
      }
    });

  const detail = () => {
    if (!config.enabled)
      return label(
        'PDFMathReader on iPhone and iPad can translate pages with the Fast and Precise kernels installed on this computer. Pages are sent over your local network and translated with this computer’s default translation service.',
      );
    if (!backend) return `${label('Kernel sharing could not start.')}\n\n${lastError}`;
    return [
      label(
        'On your iPhone or iPad, open Settings, then PDFMathReader on Your Computer, and enter:',
      ),
      '',
      `${label('Address')}: ${addresses()[0] || ''}`,
      ...addresses()
        .slice(1)
        .map((address) => `    ${address}`),
      '',
      `${label('Pairing code')}: ${config.token}`,
      '',
      label(
        'Keep PDFMathReader open on this computer while you read. Anyone on your network with the pairing code can use these kernels.',
      ),
    ].join('\n');
  };

  // A native dialog keeps sharing out of the per-window settings, which belong
  // to a single backend; the loop redraws it after each change.
  const showDialog = async (parent) => {
    for (;;) {
      const buttons = config.enabled
        ? [label('OK'), label('Turn Off'), label('New Pairing Code')]
        : [label('Turn On'), label('Cancel')];
      const options = {
        type: 'info',
        message: label('Share Kernels with iPhone and iPad'),
        detail: detail(),
        buttons,
        defaultId: 0,
        cancelId: config.enabled ? 0 : 1,
      };
      const { response } = parent
        ? await dialog.showMessageBox(parent, options)
        : await dialog.showMessageBox(options);
      if (!config.enabled) {
        if (response !== 0) return;
        await setEnabled(true);
      } else if (response === 1) {
        await setEnabled(false);
        return;
      } else if (response === 2) await regenerate();
      else return;
    }
  };

  return {
    enabled: () => config.enabled,
    running: () => !!backend,
    connections: async () =>
      config.enabled && backend ? (await backend.companionConnections?.()) || [] : [],
    discoveryEnabled: () => shouldAdvertise,
    advertising: () => advertiser.running(),
    addresses,
    pairingCode: () => config.token,
    launch: async () => {
      if (!config.enabled) return;
      try {
        await start();
      } catch (error) {
        console.error('Unable to share kernels with iPhone and iPad:', error.message);
      }
    },
    setEnabled,
    setDiscoveryEnabled,
    claimDesktopDocument,
    releaseDesktopDocument,
    regenerate,
    showDialog,
    setCredentials: (key, status) => backend?.setCredentials(key, status),
    close: () =>
      runTransition(async () => {
        await stopNow();
        await dropLocalDocuments();
      }),
  };
}
