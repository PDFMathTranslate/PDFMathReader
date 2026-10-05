import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { replaceFile } from './atomic-file.mjs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const SERVICE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const FIELD_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const MAX_VALUE_LENGTH = 16384;
const ENGINES = new Set(['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isRecord(value) {
  return (
    isObject(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}
function validServiceId(value) {
  return typeof value === 'string' && SERVICE_ID.test(value);
}
function validFieldId(value) {
  return typeof value === 'string' && FIELD_ID.test(value);
}
function copyValues(value) {
  const result = {};
  if (!isRecord(value)) return result;
  for (const [id, entry] of Object.entries(value))
    if (
      validFieldId(id) &&
      typeof entry === 'string' &&
      entry.length <= MAX_VALUE_LENGTH &&
      !/[\r\n]/.test(entry) &&
      entry
    )
      result[id] = entry;
  return result;
}
function copyStore(value) {
  const result = {};
  if (!isRecord(value)) return result;
  for (const [engine, services] of Object.entries(value)) {
    if (!ENGINES.has(engine) || !isRecord(services)) continue;
    const next = {};
    for (const [service, values] of Object.entries(services))
      if (validServiceId(service)) {
        const copied = copyValues(values);
        if (Object.keys(copied).length) next[service] = copied;
      }
    if (Object.keys(next).length) result[engine] = next;
  }
  return result;
}

export async function createServiceCredentials({
  path,
  safeStorage,
  platform = process.platform,
} = {}) {
  let state = {},
    storageError = '';
  const available = () =>
    ['darwin', 'win32'].includes(platform) &&
    typeof safeStorage?.isEncryptionAvailable === 'function' &&
    safeStorage.isEncryptionAvailable();
  const secure = async () => {
    if (
      !available() ||
      (platform === 'darwin' &&
        typeof safeStorage.isAsyncEncryptionAvailable === 'function' &&
        !(await safeStorage.isAsyncEncryptionAvailable()))
    )
      throw Error(
        `${platform === 'win32' ? 'Windows' : 'macOS'} secure storage is unavailable. No service key was saved.`,
      );
  };
  const encrypt = async (value) =>
    platform === 'win32' ? safeStorage.encryptString(value) : safeStorage.encryptStringAsync(value);
  const decrypt = async (value) =>
    platform === 'win32'
      ? safeStorage.decryptString(value)
      : (await safeStorage.decryptStringAsync(value)).result;
  try {
    const encrypted = await readFile(path);
    await secure();
    state = copyStore(JSON.parse(await decrypt(encrypted)));
    storageError = '';
  } catch (error) {
    if (error.code !== 'ENOENT')
      storageError = 'Saved service credentials could not be unlocked. Clear them or try again.';
  }
  let writes = Promise.resolve();
  const serial = (action) => {
    const next = writes.then(action);
    writes = next.catch(() => {});
    return next;
  };
  const status = () => ({ keyStorageAvailable: available(), keyStorageError: storageError });
  const load = async (selection) => {
    await writes;
    if (!isRecord(selection) || selection.engine === undefined) return copyStore(state);
    if (!ENGINES.has(selection.engine) || !validServiceId(selection.service)) return {};
    return { ...copyValues(state[selection.engine]?.[selection.service]) };
  };
  const persist = async (next) => {
    const cleaned = copyStore(next);
    if (!Object.keys(cleaned).length) {
      await rm(path, { force: true });
      state = {};
      storageError = '';
      return status();
    }
    await secure();
    let encrypted;
    try {
      encrypted = await encrypt(JSON.stringify(cleaned));
    } catch {
      throw Error(
        `${platform === 'win32' ? 'Windows' : 'macOS'} could not encrypt service credentials. No credentials were saved.`,
      );
    }
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(temporary, encrypted, { mode: 0o600 });
      await replaceFile(temporary, path, { platform });
    } catch {
      await rm(temporary, { force: true });
      throw Error('Could not save encrypted service credentials.');
    }
    state = cleaned;
    storageError = '';
    return status();
  };
  const enqueue = (action) => serial(async () => persist(await action()));
  return {
    status,
    load,
    save: ({ engine, service, values } = {}) => {
      if (!ENGINES.has(engine) || !validServiceId(service) || !isRecord(values))
        throw Error('Invalid service credentials.');
      const cleaned = copyValues(values);
      return enqueue(async () => {
        const next = copyStore(state);
        if (Object.keys(cleaned).length) {
          next[engine] ??= {};
          next[engine][service] = cleaned;
        } else if (next[engine]) {
          delete next[engine][service];
          if (!Object.keys(next[engine]).length) delete next[engine];
        }
        return next;
      });
    },
    clear: ({ engine, service, fields } = {}) => {
      if (
        (engine !== undefined && !ENGINES.has(engine)) ||
        (service !== undefined && !validServiceId(service))
      )
        throw Error('Invalid service credential selection.');
      return enqueue(async () => {
        const next = copyStore(state);
        if (engine === undefined) return {};
        if (service === undefined) {
          delete next[engine];
          return next;
        }
        if (!next[engine]?.[service]) return next;
        if (!Array.isArray(fields)) {
          delete next[engine][service];
        } else
          for (const field of fields) if (validFieldId(field)) delete next[engine][service][field];
        if (next[engine]?.[service] && !Object.keys(next[engine][service]).length)
          delete next[engine][service];
        if (next[engine] && !Object.keys(next[engine]).length) delete next[engine];
        return next;
      });
    },
    flush: () => writes,
  };
}
