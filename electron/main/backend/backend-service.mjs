import { applicationPath } from '../../../runtime/node/application-paths.mjs';
import { utilityProcess } from 'electron';
import { fileURLToPath } from 'node:url';

const processModule = applicationPath('electron', 'main', 'backend', 'backend-process.mjs');

function messageData(message) {
  return message && typeof message === 'object' && 'data' in message ? message.data : message;
}
function redact(text, key) {
  return key && text.includes(key) ? text.replaceAll(key, '[redacted]') : text;
}

export async function startBackendService(options = {}) {
  const {
    credentials,
    initialCredentials,
    onCrash,
    onDiagnostic,
    kernelDiagnostic: _kernelDiagnostic,
    getApiKey: _getApiKey,
    keyStatus: _keyStatus,
    providerFetch: _providerFetch,
    ...serverOptions
  } = options;
  const state = credentials || initialCredentials || {};
  const initial = {
    key:
      typeof state.getKey === 'function'
        ? state.getKey()
        : typeof state.key === 'string'
          ? state.key
          : '',
    status:
      typeof state.status === 'function'
        ? state.status()
        : state.status && typeof state.status === 'object'
          ? { ...state.status }
          : undefined,
  };
  const childEnv = { ...process.env };
  delete childEnv.OPENAI_API_KEY;
  const child = utilityProcess.fork(processModule, [], {
    env: childEnv,
    serviceName: 'PDFMathReader backend',
    stdio: 'ignore',
  });
  const pending = new Map();
  let requestId = 0;
  let ready = false;
  let closing = false;
  let crashReported = false;
  let activeKey = initial.key;
  let startupResolve, startupReject;
  let startupTimer;
  const startup = new Promise((resolve, reject) => {
    startupResolve = resolve;
    startupReject = reject;
  });
  const rejectPending = (error) => {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  };
  const failStartup = (error) => {
    clearTimeout(startupTimer);
    startupReject(error);
  };
  const request = (type, payload = {}) =>
    new Promise((resolve, reject) => {
      const id = ++requestId;
      pending.set(id, { resolve, reject });
      try {
        child.postMessage({ type, id, ...payload });
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  child.on('message', (message) => {
    const value = messageData(message) || {};
    if (value.type === 'ready') {
      ready = true;
      clearTimeout(startupTimer);
      startupResolve(value.origin);
      return;
    }
    if (value.type === 'startup-error') {
      failStartup(Error(redact(value.message || 'The backend could not start.', activeKey)));
      return;
    }
    if (value.type === 'diagnostic') {
      onDiagnostic?.(value.message);
      return;
    }
    if (value.type === 'closed') {
      const waiter = pending.get(value.id);
      if (waiter) {
        pending.delete(value.id);
        waiter.resolve();
      }
      return;
    }
    if (value.type === 'credentials') {
      const waiter = pending.get(value.id);
      if (waiter) {
        pending.delete(value.id);
        waiter.resolve(value.status);
      }
      return;
    }
    if (value.type === 'error') {
      const waiter = pending.get(value.id);
      if (waiter) {
        pending.delete(value.id);
        waiter.reject(Error(redact(value.message || 'The backend request failed.', activeKey)));
      }
    }
  });
  child.on('error', (type) => {
    const error = Error(`The backend utility process failed${type ? ` (${type})` : ''}.`);
    if (!ready) failStartup(error);
    else if (!closing && !crashReported) {
      crashReported = true;
      void onCrash?.(error);
    }
  });
  let closePromise;
  child.on('exit', (code) => {
    clearTimeout(startupTimer);
    const error = Error(
      ready
        ? code === 0
          ? 'The backend utility process exited unexpectedly.'
          : `The backend utility process exited unexpectedly (code ${code}).`
        : code === 0
          ? 'The backend utility process exited before it was ready.'
          : `The backend utility process failed during startup (code ${code}).`,
    );
    if (!ready) failStartup(error);
    rejectPending(error);
    if (ready && !closing && !crashReported) {
      crashReported = true;
      void onCrash?.(error);
    }
    if (closePromise) {
      /* The exit handler completes close below through this flag. */
    }
  });
  child.once('spawn', () => {
    try {
      child.postMessage({ type: 'start', options: serverOptions, credentials: initial });
    } catch (error) {
      failStartup(error);
      child.kill();
    }
  });
  startupTimer = setTimeout(() => {
    const error = Error(
      'The backend utility process did not become ready in time. Check the local runtime and try again.',
    );
    failStartup(error);
    child.kill();
  }, 30000);
  const origin = await startup;
  const close = () => {
    if (closePromise) return closePromise;
    closing = true;
    closePromise = new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const timer = setTimeout(() => {
        child.kill();
        finish();
      }, 5000);
      child.once('exit', () => {
        clearTimeout(timer);
        finish();
      });
      if (!child.pid) {
        clearTimeout(timer);
        finish();
        return;
      }
      // The acknowledgement follows kernel cleanup, but wait for the utility
      // process itself to exit before allowing Electron to quit.
      request('close').catch(() => {
        child.kill();
      });
    });
    return closePromise;
  };
  const setCredentials = (key, status) => {
    activeKey = typeof key === 'string' ? key : '';
    return request('credentials', {
      key: activeKey,
      status: status && typeof status === 'object' ? { ...status } : undefined,
    });
  };
  return { origin, close, setCredentials, processId: child.pid };
}
