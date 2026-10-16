/* eslint-disable no-control-regex */

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join } from 'node:path';
import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib';
import { replaceFile } from '../../runtime/node/atomic-file.mjs';
import { validateQuickLinks } from '../../shared/quick-links.mjs';

const DEFAULT_MAX_DOCUMENT_BYTES = 200 * 1024 * 1024;
const MAX_DOCUMENT_ID_BYTES = 256;
const MAX_DEVICE_FIELD_BYTES = 256;
const MAX_READING_STATE_BYTES = 64 * 1024;
const MAX_SAVED_REQUESTS = 16;
const MAX_RELEASED_SESSIONS = 64;
const MAX_ANNOTATIONS = 10_000;
const MAX_TEXT_LENGTH = 100_000;
const MAX_RECT_COUNT = 256;
const MAX_COORDINATE = 1_000_000;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._~-]{1,256}$/;
const PDF_MAGIC = Buffer.from('%PDF');
const TRANSFER_KEY = 'PDFMathReaderTransfer';
const TRANSFER_MARKER_KEY = 'PDFMathReaderTransferMetadata';
const TRANSFER_MARKER = 'PDFMathReaderTransferMetadata:v1';

export class CompanionDocumentError extends Error {
  constructor(message, code, status = 400, details = {}) {
    super(message);
    this.name = 'CompanionDocumentError';
    this.code = code;
    this.status = status;
    Object.assign(this, details);
  }
}

function fail(message, code, status = 400, details) {
  throw new CompanionDocumentError(message, code, status, details);
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function validHash(value) {
  return typeof value === 'string' && HASH_PATTERN.test(value);
}

function validIdentifier(value, label = 'identifier') {
  if (
    typeof value !== 'string' ||
    Buffer.byteLength(value, 'utf8') > MAX_DOCUMENT_ID_BYTES ||
    !IDENTIFIER_PATTERN.test(value)
  )
    fail(`Invalid ${label}.`, 'INVALID_IDENTIFIER', 400);
  return value;
}

function validDeviceField(value, label) {
  if (
    typeof value !== 'string' ||
    !value.length ||
    Buffer.byteLength(value, 'utf8') > MAX_DEVICE_FIELD_BYTES ||
    [...value].some((character) => character.codePointAt(0) < 0x20 || character === '\u007f')
  )
    fail(`Invalid ${label}.`, 'INVALID_REQUEST', 400);
  return value;
}

function isPDFBytes(bytes) {
  return Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.subarray(0, 1024).includes(PDF_MAGIC);
}

function decodeBase64(value, label = 'PDF') {
  if (
    typeof value !== 'string' ||
    !value.length ||
    value.length % 4 === 1 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  )
    fail(`Invalid ${label}.`, 'INVALID_DOCUMENT', 400);
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) fail(`Invalid ${label}.`, 'INVALID_DOCUMENT', 400);
  return bytes;
}

function pathDigest(key) {
  return digest(Buffer.from(key, 'utf8'));
}

function validatePageCount(value, pageCount) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000)
    fail('Invalid page count.', 'INVALID_DOCUMENT', 400);
  if (pageCount !== undefined && value !== pageCount)
    fail('The PDF page count does not match the request.', 'INVALID_DOCUMENT', 400);
  return value;
}

function validateReadingState(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('Invalid reading state.', 'INVALID_REQUEST', 400);
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    fail('Invalid reading state.', 'INVALID_REQUEST', 400);
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_READING_STATE_BYTES)
    fail('Reading state is too large.', 'INVALID_REQUEST', 413);
  if (value.page !== undefined && (!Number.isSafeInteger(value.page) || value.page < 1))
    fail('Invalid reading state page.', 'INVALID_REQUEST', 400);
  if (value.zoom !== undefined && (!Number.isFinite(value.zoom) || value.zoom < 0.01))
    fail('Invalid reading state zoom.', 'INVALID_REQUEST', 400);
  return clone(value);
}

function validateNativeRefs(value) {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > 10_000 ||
    value.some((ref) => typeof ref !== 'string' || !/^\d+ \d+ R$/.test(ref))
  )
    fail('Invalid annotation native references.', 'INVALID_REQUEST', 400);
  return [...new Set(value)];
}

function finiteAnnotationNumber(value, name, minimum = 0) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > MAX_COORDINATE
  )
    fail(`Invalid annotation ${name}.`, 'INVALID_REQUEST', 400);
  return value;
}

function validateAnnotationRect(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(`Invalid ${label}.`, 'INVALID_REQUEST', 400);
  return {
    x: finiteAnnotationNumber(value.x, `${label} x`),
    y: finiteAnnotationNumber(value.y, `${label} y`),
    width: finiteAnnotationNumber(value.width, `${label} width`, Number.MIN_VALUE),
    height: finiteAnnotationNumber(value.height, `${label} height`, Number.MIN_VALUE),
  };
}

function validateAnnotation(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(`Invalid annotation ${index}.`, 'INVALID_REQUEST', 400);
  if (
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    value.id.length > 256 ||
    /[\u0000-\u001f\u007f]/.test(value.id)
  )
    fail(`Invalid annotation ${index} id.`, 'INVALID_REQUEST', 400);
  if (!Number.isSafeInteger(value.page) || value.page < 1 || value.page > 1_000_000)
    fail(`Invalid annotation ${index} page.`, 'INVALID_REQUEST', 400);
  if (value.kind !== 'highlight' && value.kind !== 'comment')
    fail(`Invalid annotation ${index} kind.`, 'INVALID_REQUEST', 400);
  if (value.origin !== 'source' && value.origin !== 'translation')
    fail(`Invalid annotation ${index} origin.`, 'INVALID_REQUEST', 400);
  if (typeof value.text !== 'string' || value.text.length > MAX_TEXT_LENGTH)
    fail(`Invalid annotation ${index} text.`, 'INVALID_REQUEST', 400);
  if (typeof value.comment !== 'string' || value.comment.length > MAX_TEXT_LENGTH)
    fail(`Invalid annotation ${index} comment.`, 'INVALID_REQUEST', 400);
  if (typeof value.color !== 'string' || !/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value.color))
    fail(`Invalid annotation ${index} color.`, 'INVALID_REQUEST', 400);
  if (!Array.isArray(value.rects) || value.rects.length < 1 || value.rects.length > MAX_RECT_COUNT)
    fail(`Invalid annotation ${index} rectangles.`, 'INVALID_REQUEST', 400);
  const result = {
    id: value.id,
    page: value.page,
    kind: value.kind,
    origin: value.origin,
    text: value.text,
    comment: value.comment,
    color: value.color,
    rects: value.rects.map((rect, rectIndex) =>
      validateAnnotationRect(rect, `annotation ${index} rectangle ${rectIndex}`),
    ),
    createdAt: value.createdAt,
  };
  if (
    typeof result.createdAt !== 'string' ||
    result.createdAt.length > 128 ||
    !Number.isFinite(Date.parse(result.createdAt))
  )
    fail(`Invalid annotation ${index} created-at.`, 'INVALID_REQUEST', 400);
  if (value.blockId !== undefined) {
    if (
      (typeof value.blockId !== 'string' && typeof value.blockId !== 'number') ||
      (typeof value.blockId === 'number' && !Number.isSafeInteger(value.blockId)) ||
      (typeof value.blockId === 'string' && (!value.blockId.length || value.blockId.length > 256))
    )
      fail(`Invalid annotation ${index} block id.`, 'INVALID_REQUEST', 400);
    result.blockId = value.blockId;
  }
  if (value.nativeRef !== undefined) {
    if (typeof value.nativeRef !== 'string' || !/^\d+ \d+ R$/.test(value.nativeRef))
      fail('Invalid annotation native reference.', 'INVALID_REQUEST', 400);
    result.nativeRef = value.nativeRef;
  }
  if (value.dateUnknown !== undefined) result.dateUnknown = !!value.dateUnknown;
  if (value.author !== undefined) {
    if (typeof value.author !== 'string' || value.author.length > 1000)
      fail('Invalid annotation author.', 'INVALID_REQUEST', 400);
    result.author = value.author;
  }
  for (const name of ['translationRect', 'sourceRect'])
    if (value[name] !== undefined) result[name] = validateAnnotationRect(value[name], name);
  for (const name of ['modifiedAt']) {
    if (value[name] !== undefined) {
      if (
        typeof value[name] !== 'string' ||
        value[name].length > 128 ||
        !Number.isFinite(Date.parse(value[name]))
      )
        fail(`Invalid annotation ${name}.`, 'INVALID_REQUEST', 400);
      result[name] = value[name];
    }
  }
  if (value.translationVersion !== undefined) {
    const version = value.translationVersion;
    if (
      !version ||
      typeof version !== 'object' ||
      !['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise'].includes(version.engine) ||
      typeof version.language !== 'string' ||
      !version.language ||
      version.language.length > 100
    )
      fail(`Invalid annotation ${index} translation version.`, 'INVALID_REQUEST', 400);
    result.translationVersion = { engine: version.engine, language: version.language };
  }
  return result;
}

function validateAnnotations(value) {
  if (!Array.isArray(value) || value.length > MAX_ANNOTATIONS)
    fail('Invalid annotations.', 'INVALID_REQUEST', 400);
  return value.map((annotation, index) => validateAnnotation(annotation, index));
}

function textValue(dict, key) {
  return dict?.lookupMaybe(PDFName.of(key), PDFString, PDFHexString)?.decodeText() || '';
}

function transferText(pdf) {
  const info = pdf.context.lookupMaybe(pdf.context.trailerInfo.Info, PDFDict);
  const infoValue = info?.lookupMaybe(PDFName.of(TRANSFER_KEY), PDFString, PDFHexString);
  if (infoValue) return infoValue.decodeText();
  const values = [];
  for (const page of pdf.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let index = 0; index < annots.size(); index++) {
      const dict = annots.lookupMaybe(index, PDFDict);
      if (textValue(dict, TRANSFER_MARKER_KEY) !== TRANSFER_MARKER) continue;
      const value = textValue(dict, TRANSFER_KEY);
      if (value) values.push(value);
    }
  }
  return values.length && values.every((value) => value === values[0]) ? values[0] : undefined;
}

async function transferMetadata(bytes, pageCount) {
  try {
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    const value = transferText(pdf);
    if (!value || Buffer.byteLength(value, 'utf8') > 4 * 1024 * 1024) return undefined;
    const payload = JSON.parse(value);
    if (payload?.version !== 1) return undefined;
    const annotations = validateAnnotations(payload.annotations);
    const quickLinks = validateQuickLinks(payload.quickLinks);
    if (
      annotations.some((annotation) => annotation.page > pageCount) ||
      quickLinks.some((link) => link.origin.page > pageCount || link.result.page > pageCount)
    )
      return undefined;
    return {
      annotations,
      nativeRefs: annotations.map((annotation) => annotation.nativeRef).filter(Boolean),
      quickLinks,
      readingState: validateReadingState(payload.readingState),
    };
  } catch {
    return undefined;
  }
}

function desktopReadingState(view) {
  if (!view || typeof view !== 'object' || !Number.isSafeInteger(view.page)) return undefined;
  const scaleMode =
    view.fit === 'width' ? 'fitWidth' : view.fit === 'manual' ? 'custom' : 'fitPage';
  const displayMode =
    view.columns === 4 ? 'fourPages' : view.columns === 2 ? 'twoPages' : 'singlePage';
  return {
    page: Math.max(1, view.page),
    zoom: Number.isFinite(view.zoom) ? Math.max(0.1, view.zoom) : 1,
    scaleMode,
    displayMode,
    scrollDirection: view.direction === 'horizontal' ? 'horizontal' : 'vertical',
    sidebarVisible: view.sidebar !== false,
    lastUpdated: new Date().toISOString(),
  };
}

function stateDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Companion document state entry is invalid.');
  const state = {};
  if (value.revision !== undefined) {
    if (!validHash(value.revision)) throw Error('Companion document revision is invalid.');
    state.revision = value.revision;
  }
  if (value.readingState !== undefined)
    state.readingState = validateReadingState(value.readingState);
  if (value.lock && typeof value.lock === 'object') {
    state.lock = {
      sessionID: validIdentifier(value.lock.sessionID, 'session identifier'),
      deviceID: validDeviceField(value.lock.deviceID, 'device identifier'),
      deviceName: validDeviceField(value.lock.deviceName, 'device name'),
      acquiredAt: Number.isFinite(value.lock.acquiredAt) ? value.lock.acquiredAt : Date.now(),
      lastSeenAt: Number.isFinite(value.lock.lastSeenAt)
        ? value.lock.lastSeenAt
        : Number.isFinite(value.lock.acquiredAt)
          ? value.lock.acquiredAt
          : Date.now(),
    };
    if (value.lock.acquiredRevision !== undefined) {
      if (!validHash(value.lock.acquiredRevision))
        throw Error('Companion lock revision is invalid.');
      state.lock.acquiredRevision = value.lock.acquiredRevision;
    }
  } else if (value.lock !== undefined) {
    throw Error('Companion document lock is invalid.');
  }
  if (value.releasedSessions !== undefined) {
    if (
      !Array.isArray(value.releasedSessions) ||
      value.releasedSessions.some(
        (sessionID) => typeof sessionID !== 'string' || !IDENTIFIER_PATTERN.test(sessionID),
      )
    )
      throw Error('Companion released sessions are invalid.');
    state.releasedSessions = value.releasedSessions.slice(-MAX_RELEASED_SESSIONS);
  }
  if (value.saveHistory !== undefined) {
    if (
      !Array.isArray(value.saveHistory) ||
      value.saveHistory.some(
        (entry) =>
          !entry ||
          typeof entry !== 'object' ||
          !IDENTIFIER_PATTERN.test(entry.sessionID || '') ||
          !IDENTIFIER_PATTERN.test(entry.requestID || '') ||
          !validHash(entry.payloadDigest) ||
          !validHash(entry.revision) ||
          !validHash(entry.sha256) ||
          !Number.isSafeInteger(entry.byteCount) ||
          !Number.isSafeInteger(entry.pageCount) ||
          typeof entry.released !== 'boolean',
      )
    )
      throw Error('Companion save history is invalid.');
    state.saveHistory = value.saveHistory.slice(-MAX_SAVED_REQUESTS).map((entry) => ({
      sessionID: entry.sessionID,
      requestID: entry.requestID,
      payloadDigest: entry.payloadDigest,
      revision: entry.revision,
      sha256: entry.sha256,
      byteCount: entry.byteCount,
      pageCount: entry.pageCount,
      released: entry.released,
    }));
  }
  if (value.pending && typeof value.pending === 'object') {
    const history = value.pending.history;
    if (
      !validHash(value.pending.revision) ||
      typeof value.pending.sessionID !== 'string' ||
      !IDENTIFIER_PATTERN.test(value.pending.sessionID) ||
      typeof value.pending.released !== 'boolean' ||
      !history ||
      typeof history !== 'object' ||
      history.sessionID !== value.pending.sessionID ||
      !validHash(history.revision) ||
      history.revision !== value.pending.revision ||
      history.released !== value.pending.released ||
      !validHash(history.sha256) ||
      !validHash(history.payloadDigest) ||
      !IDENTIFIER_PATTERN.test(history.requestID || '') ||
      !Number.isSafeInteger(history.byteCount) ||
      !Number.isSafeInteger(history.pageCount)
    )
      throw Error('Companion pending update is invalid.');
    const metadata = {};
    if (value.pending.metadata !== undefined) {
      if (
        !value.pending.metadata ||
        typeof value.pending.metadata !== 'object' ||
        Array.isArray(value.pending.metadata)
      )
        throw Error('Companion pending metadata is invalid.');
      if (Object.hasOwn(value.pending.metadata, 'annotations'))
        metadata.annotations = validateAnnotations(value.pending.metadata.annotations);
      if (Object.hasOwn(value.pending.metadata, 'nativeRefs'))
        metadata.nativeRefs = validateNativeRefs(value.pending.metadata.nativeRefs);
      if (Object.hasOwn(value.pending.metadata, 'quickLinks'))
        metadata.quickLinks = validateQuickLinks(value.pending.metadata.quickLinks);
      if (Object.hasOwn(value.pending.metadata, 'readingState'))
        metadata.readingState = validateReadingState(value.pending.metadata.readingState);
    }
    state.pending = {
      sessionID: value.pending.sessionID,
      revision: value.pending.revision,
      released: value.pending.released,
      history: {
        sessionID: history.sessionID,
        requestID: history.requestID,
        payloadDigest: history.payloadDigest,
        revision: history.revision,
        sha256: history.sha256,
        byteCount: history.byteCount,
        pageCount: history.pageCount,
        released: history.released,
      },
      ...(Object.keys(metadata).length ? { metadata } : {}),
    };
  } else if (value.pending !== undefined) {
    throw Error('Companion pending update is invalid.');
  }
  return state;
}

async function atomicJSON(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
    await replaceFile(temporary, path);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

async function atomicBytes(path, bytes, mode = 0o600) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { mode });
    await replaceFile(temporary, path);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

async function parsePDF(bytes, maxDocumentBytes) {
  if (!bytes.length || bytes.length > maxDocumentBytes || !isPDFBytes(bytes))
    fail('The document is not a readable PDF.', 'INVALID_DOCUMENT', 400);
  let pdf;
  try {
    pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch {
    fail('The document is not a readable PDF.', 'INVALID_DOCUMENT', 400);
  }
  const pageCount = pdf.getPageCount();
  if (!pageCount) fail('The document has no pages.', 'INVALID_DOCUMENT', 400);
  return { pageCount, sha256: digest(bytes) };
}

async function readRecentEntries(recentsPath) {
  let stored;
  try {
    stored = JSON.parse(await readFile(recentsPath, 'utf8'));
  } catch {
    return [];
  }
  if (!Array.isArray(stored)) return [];
  const seen = new Set();
  return stored.filter((entry) => {
    if (
      !entry ||
      typeof entry.id !== 'string' ||
      Buffer.byteLength(entry.id, 'utf8') > MAX_DOCUMENT_ID_BYTES ||
      !IDENTIFIER_PATTERN.test(entry.id) ||
      typeof entry.path !== 'string' ||
      !isAbsolute(entry.path) ||
      extname(entry.path).toLowerCase() !== '.pdf' ||
      seen.has(entry.id)
    )
      return false;
    seen.add(entry.id);
    return true;
  });
}

async function readSource(entry, maxDocumentBytes) {
  let bytes;
  let sourceStat;
  try {
    sourceStat = await stat(entry.path);
    bytes = Buffer.from(await readFile(entry.path));
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'EACCES')
      fail('The document is no longer available.', 'DOCUMENT_UNAVAILABLE', 404);
    throw error;
  }
  const parsed = await parsePDF(bytes, maxDocumentBytes);
  return { ...parsed, bytes, mode: sourceStat.mode & 0o777 };
}

function annotationPaths(root, key) {
  return root ? join(root, `${pathDigest(key)}.json`) : undefined;
}

function quickLinkPath(root, key) {
  return root ? join(root, `${pathDigest(key)}.json`) : undefined;
}

async function loadOptionalJSON(path) {
  if (!path) return { present: false, value: undefined };
  try {
    return { present: true, value: JSON.parse(await readFile(path, 'utf8')) };
  } catch (error) {
    if (error?.code === 'ENOENT') return { present: false, value: undefined };
    if (error instanceof SyntaxError)
      fail('Stored companion metadata is invalid.', 'INVALID_METADATA', 409);
    throw error;
  }
}

async function loadAnnotations(root, key) {
  const result = await loadOptionalJSON(annotationPaths(root, key));
  if (!result.present) return result;
  try {
    const raw = Array.isArray(result.value) ? result.value : result.value?.annotations;
    const annotations = validateAnnotations(raw || []);
    const nativeRefs = validateNativeRefs(
      Array.isArray(result.value) ? [] : result.value?.nativeRefs,
    );
    return { present: true, value: { annotations, nativeRefs } };
  } catch {
    fail('Stored annotation metadata is invalid.', 'INVALID_METADATA', 409);
  }
}

async function loadQuickLinks(root, key) {
  const result = await loadOptionalJSON(quickLinkPath(root, key));
  if (!result.present) return result;
  try {
    return { present: true, value: validateQuickLinks(result.value) };
  } catch {
    fail('Stored quick-link metadata is invalid.', 'INVALID_METADATA', 409);
  }
}

function transferFallback(transfer) {
  return {
    annotations: transfer?.annotations,
    nativeRefs: transfer?.nativeRefs,
    quickLinks: transfer?.quickLinks,
    readingState: transfer?.readingState,
  };
}

async function metadataForDocument(id, source, annotationRoot, quickLinksRoot) {
  const sidecarAnnotations = await loadAnnotations(annotationRoot, id);
  const sidecarLinks = await loadQuickLinks(quickLinksRoot, id);
  let annotations = sidecarAnnotations.value?.annotations;
  let nativeRefs = sidecarAnnotations.value?.nativeRefs || [];
  let quickLinks = sidecarLinks.value;
  let readingState;
  if (!sidecarAnnotations.present || !sidecarLinks.present) {
    const transfer = await transferMetadata(source.bytes, source.pageCount);
    const fallback = transferFallback(transfer);
    if (!sidecarAnnotations.present) {
      annotations = fallback.annotations || [];
      nativeRefs = fallback.nativeRefs || [];
    }
    if (!sidecarLinks.present) quickLinks = fallback.quickLinks || [];
    readingState = fallback.readingState;
  }
  return {
    annotations: annotations || [],
    nativeRefs,
    quickLinks: quickLinks || [],
    readingState,
  };
}

function payloadDigest(body) {
  return digest(
    JSON.stringify({
      revision: body.revision,
      pdf: body.pdf,
      sha256: body.sha256,
      byteCount: body.byteCount,
      pageCount: body.pageCount,
      annotations: body.annotations,
      nativeRefs: body.nativeRefs,
      quickLinks: body.quickLinks,
      readingState: body.readingState,
      release: body.release,
    }),
  );
}

function historyEntry(state, requestID, sessionID) {
  return state.saveHistory?.find(
    (entry) => entry.requestID === requestID && entry.sessionID === sessionID,
  );
}

function rememberHistory(state, entry) {
  state.saveHistory = [
    ...(state.saveHistory || []).filter((item) => item.requestID !== entry.requestID),
    entry,
  ].slice(-MAX_SAVED_REQUESTS);
}

function rememberReleased(state, sessionID) {
  state.releasedSessions = [
    ...(state.releasedSessions || []).filter((value) => value !== sessionID),
    sessionID,
  ].slice(-MAX_RELEASED_SESSIONS);
}

function resultFromHistory(entry) {
  return {
    revision: entry.revision,
    sha256: entry.sha256,
    byteCount: entry.byteCount,
    pageCount: entry.pageCount,
    released: entry.released,
  };
}

export async function createCompanionDocumentStore({
  recentsPath,
  annotationsRoot,
  quickLinksRoot,
  statePath,
  maxDocumentBytes = DEFAULT_MAX_DOCUMENT_BYTES,
  now = () => Date.now(),
} = {}) {
  if (typeof recentsPath !== 'string' || !isAbsolute(recentsPath))
    throw Error('Companion recent-document storage is not configured.');
  const durableStatePath =
    typeof statePath === 'string' && isAbsolute(statePath)
      ? statePath
      : join(dirname(recentsPath), 'companion-documents.json');
  const limit = Number.isSafeInteger(maxDocumentBytes)
    ? Math.min(Math.max(maxDocumentBytes, 1), DEFAULT_MAX_DOCUMENT_BYTES)
    : DEFAULT_MAX_DOCUMENT_BYTES;
  let state = { version: 1, documents: {} };
  try {
    const saved = JSON.parse(await readFile(durableStatePath, 'utf8'));
    if (
      saved?.version !== 1 ||
      !saved.documents ||
      typeof saved.documents !== 'object' ||
      Array.isArray(saved.documents)
    )
      throw Error('Companion document state is invalid.');
    const entries = Object.entries(saved.documents);
    if (entries.some(([id]) => !IDENTIFIER_PATTERN.test(id)))
      throw Error('Companion document state identifier is invalid.');
    state.documents = Object.fromEntries(entries.map(([id, value]) => [id, stateDocument(value)]));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  let writes = Promise.resolve();
  const serial = (operation) => {
    const result = writes.then(operation);
    writes = result.catch(() => {});
    return result;
  };
  const persist = () => atomicJSON(durableStatePath, { version: 1, documents: state.documents });
  const restoreDocumentState = (documentState, previous) => {
    for (const key of Object.keys(documentState)) delete documentState[key];
    if (previous) Object.assign(documentState, previous);
  };

  async function resolve(id) {
    validIdentifier(id, 'document identifier');
    const entry = (await readRecentEntries(recentsPath)).find((candidate) => candidate.id === id);
    if (!entry) fail('Unknown document.', 'UNKNOWN_DOCUMENT', 404);
    return entry;
  }

  async function recoverPending(id, entry, documentState) {
    const pending = documentState.pending;
    if (!pending) return;
    let source;
    try {
      source = await readSource(entry, limit);
    } catch {
      return;
    }
    if (source.sha256 !== pending.revision) {
      const previous = clone(documentState);
      delete documentState.pending;
      try {
        await persist();
      } catch (error) {
        restoreDocumentState(documentState, previous);
        throw error;
      }
      return;
    }
    const previous = clone(documentState);
    const metadata = pending.metadata || {};
    if (Object.hasOwn(metadata, 'annotations') && annotationPaths(annotationsRoot, id))
      await atomicJSON(annotationPaths(annotationsRoot, id), {
        version: 1,
        key: id,
        annotations: metadata.annotations,
        nativeRefs: metadata.nativeRefs || [],
        updatedAt: new Date(now()).toISOString(),
      });
    if (Object.hasOwn(metadata, 'quickLinks') && quickLinkPath(quickLinksRoot, id))
      await atomicJSON(quickLinkPath(quickLinksRoot, id), metadata.quickLinks);
    documentState.revision = source.sha256;
    if (Object.hasOwn(metadata, 'readingState')) documentState.readingState = metadata.readingState;
    rememberHistory(documentState, pending.history);
    delete documentState.pending;
    if (pending.released) {
      documentState.lock = undefined;
      rememberReleased(documentState, pending.sessionID);
    }
    try {
      await persist();
    } catch (error) {
      restoreDocumentState(documentState, previous);
      throw error;
    }
  }

  async function snapshot(id, entry, source, documentState) {
    const metadata = await metadataForDocument(id, source, annotationsRoot, quickLinksRoot);
    const readingState =
      documentState.readingState || metadata.readingState || desktopReadingState(entry.view);
    return {
      sessionID: documentState.lock?.sessionID,
      revision: source.sha256,
      sha256: source.sha256,
      byteCount: source.bytes.length,
      pageCount: source.pageCount,
      pdf: source.bytes.toString('base64'),
      annotations: metadata.annotations,
      nativeRefs: metadata.nativeRefs,
      quickLinks: metadata.quickLinks,
      ...(readingState ? { readingState } : {}),
    };
  }

  async function acquire(id, { deviceID, deviceName, sessionID } = {}) {
    return serial(async () => {
      validDeviceField(deviceID, 'device identifier');
      validDeviceField(deviceName, 'device name');
      validIdentifier(sessionID, 'session identifier');
      const entry = await resolve(id);
      const documentState = (state.documents[id] ||= {});
      await recoverPending(id, entry, documentState);
      if (documentState.lock) {
        if (documentState.lock.sessionID !== sessionID || documentState.lock.deviceID !== deviceID)
          fail('The document is already open on another device.', 'DOCUMENT_LOCKED', 409, {
            deviceName: documentState.lock.deviceName,
          });
        const source = await readSource(entry, limit);
        if (documentState.revision && documentState.revision !== source.sha256)
          fail('The document changed while it was locked.', 'REVISION_CONFLICT', 409);
        const previous = clone(documentState);
        documentState.revision ||= source.sha256;
        try {
          await persist();
          const response = await snapshot(id, entry, source, documentState);
          return { response, created: false };
        } catch (error) {
          restoreDocumentState(documentState, previous);
          throw error;
        }
      }
      if (documentState.releasedSessions?.includes(sessionID))
        fail('This document session has already been released.', 'SESSION_RELEASED', 409);
      const source = await readSource(entry, limit);
      const previous = clone(documentState);
      const time = now();
      documentState.revision = source.sha256;
      documentState.lock = {
        sessionID,
        deviceID,
        deviceName,
        acquiredAt: time,
        lastSeenAt: time,
        acquiredRevision: source.sha256,
      };
      try {
        await persist();
        const response = await snapshot(id, entry, source, documentState);
        return { response, created: true };
      } catch (error) {
        restoreDocumentState(documentState, previous);
        throw error;
      }
    });
  }

  // The desktop reader uses the same durable lock as paired readers, but it
  // does not need to upload its PDF to itself. Its session identifier is kept
  // by the Electron main process so a restart can resume an existing lock.
  async function claimDesktop(id, sessionID, deviceName = 'This Mac') {
    return serial(async () => {
      validIdentifier(sessionID, 'session identifier');
      const entry = await resolve(id);
      const documentState = (state.documents[id] ||= {});
      await recoverPending(id, entry, documentState);
      if (documentState.lock) {
        if (documentState.lock.deviceID !== 'desktop')
          fail('The document is already open on another device.', 'DOCUMENT_LOCKED', 409, {
            deviceName: documentState.lock.deviceName,
          });
        const source = await readSource(entry, limit);
        if (documentState.revision && documentState.revision !== source.sha256)
          fail('The document changed while it was locked.', 'REVISION_CONFLICT', 409);
        const previous = clone(documentState);
        // The desktop endpoint is only reachable from this app's main process.
        // A new per-window token may therefore resume a desktop lock left by a
        // process restart, while paired device sessions remain non-takeoverable.
        const resumed = documentState.lock.sessionID !== sessionID;
        if (resumed) documentState.lock.sessionID = sessionID;
        documentState.lock.deviceName = validDeviceField(deviceName, 'device name');
        documentState.revision ||= source.sha256;
        documentState.lock.lastSeenAt = now();
        try {
          await persist();
          return { claimed: true, resumed: true, sessionID, revision: source.sha256 };
        } catch (error) {
          restoreDocumentState(documentState, previous);
          throw error;
        }
      }
      // A clean desktop close records the session as released. Reusing this
      // local session is safe because only the single Electron instance owns
      // the desktop endpoint, and it also makes a lost close response retryable.
      const source = await readSource(entry, limit);
      const previous = clone(documentState);
      if (documentState.releasedSessions?.includes(sessionID))
        documentState.releasedSessions = documentState.releasedSessions.filter(
          (value) => value !== sessionID,
        );
      const time = now();
      documentState.revision = source.sha256;
      documentState.lock = {
        sessionID,
        deviceID: 'desktop',
        deviceName: validDeviceField(deviceName, 'device name'),
        acquiredAt: time,
        lastSeenAt: time,
        acquiredRevision: source.sha256,
      };
      try {
        await persist();
        return { claimed: true, resumed: false, sessionID, revision: source.sha256 };
      } catch (error) {
        restoreDocumentState(documentState, previous);
        throw error;
      }
    });
  }

  async function list() {
    return serial(async () => {
      const entries = await readRecentEntries(recentsPath);
      const documents = [];
      for (const entry of entries) {
        try {
          const source = await readSource(entry, limit);
          documents.push({
            id: entry.id,
            title: basename(entry.path),
            pageCount: source.pageCount,
            ...(typeof entry.lastOpened === 'string' && entry.lastOpened.length <= 128
              ? { lastOpened: entry.lastOpened }
              : {}),
          });
        } catch {}
      }
      return { documents };
    });
  }

  async function heartbeat(id, sessionID) {
    return serial(async () => {
      validIdentifier(sessionID, 'session identifier');
      const documentState = state.documents[id];
      if (!documentState?.lock) {
        if (documentState?.releasedSessions?.includes(sessionID))
          fail('This document session has already been released.', 'SESSION_RELEASED', 409);
        fail('The document session is not active.', 'SESSION_NOT_ACTIVE', 409);
      }
      if (documentState.lock.sessionID !== sessionID)
        fail('The document session belongs to another device.', 'SESSION_NOT_OWNER', 409);
      await resolve(id);
      const previous = clone(documentState);
      documentState.lock.lastSeenAt = now();
      try {
        await persist();
      } catch (error) {
        restoreDocumentState(documentState, previous);
        throw error;
      }
      return { ok: true, sessionID, revision: documentState.revision };
    });
  }

  async function update(id, sessionID, body = {}) {
    return serial(async () => {
      validIdentifier(sessionID, 'session identifier');
      if (!body || typeof body !== 'object' || Array.isArray(body))
        fail('Invalid document update.', 'INVALID_REQUEST', 400);
      const operationDigest = payloadDigest(body);
      const requestID = body.requestID || operationDigest;
      validIdentifier(requestID, 'request identifier');
      const documentState = state.documents[id];
      const entry = await resolve(id);
      if (documentState?.pending) await recoverPending(id, entry, documentState);
      const prior = documentState && historyEntry(documentState, requestID, sessionID);
      if (prior) {
        if (prior.payloadDigest !== operationDigest)
          fail(
            'The request identifier was reused for different data.',
            'IDEMPOTENCY_CONFLICT',
            409,
          );
        return resultFromHistory(prior);
      }
      if (!documentState?.lock)
        fail(
          documentState?.releasedSessions?.includes(sessionID)
            ? 'This document session has already been released.'
            : 'The document session is not active.',
          documentState?.releasedSessions?.includes(sessionID)
            ? 'SESSION_RELEASED'
            : 'SESSION_NOT_ACTIVE',
          409,
        );
      if (documentState.lock.sessionID !== sessionID)
        fail('The document session belongs to another device.', 'SESSION_NOT_OWNER', 409);
      const source = await readSource(entry, limit);
      if (!validHash(body.revision) || body.revision !== source.sha256)
        fail('The document revision is out of date.', 'REVISION_CONFLICT', 409);
      const bytes = decodeBase64(body.pdf);
      if (bytes.length > limit || !isPDFBytes(bytes))
        fail('The document is not a readable PDF.', 'INVALID_DOCUMENT', 400);
      if (!validHash(body.sha256) || body.sha256 !== digest(bytes))
        fail('The PDF checksum does not match.', 'CHECKSUM_MISMATCH', 400);
      if (body.byteCount !== bytes.length)
        fail('The PDF byte count does not match.', 'CHECKSUM_MISMATCH', 400);
      const parsed = await parsePDF(bytes, limit);
      validatePageCount(body.pageCount, parsed.pageCount);
      const release = body.release === true;
      if (body.release !== undefined && typeof body.release !== 'boolean')
        fail('Invalid release flag.', 'INVALID_REQUEST', 400);

      let annotations;
      let nativeRefs;
      let quickLinks;
      let readingState;
      const hasAnnotations = Object.hasOwn(body, 'annotations');
      const hasQuickLinks = Object.hasOwn(body, 'quickLinks');
      const hasReadingState = Object.hasOwn(body, 'readingState');
      if (hasAnnotations) annotations = validateAnnotations(body.annotations);
      if (hasQuickLinks) quickLinks = validateQuickLinks(body.quickLinks);
      if (Object.hasOwn(body, 'nativeRefs')) nativeRefs = validateNativeRefs(body.nativeRefs);
      if (hasReadingState) readingState = validateReadingState(body.readingState);
      const transfer =
        !hasAnnotations || !hasQuickLinks || !hasReadingState
          ? await transferMetadata(bytes, parsed.pageCount)
          : undefined;
      const fallback = transferFallback(transfer);
      if (!hasAnnotations) annotations = fallback.annotations;
      if (!hasQuickLinks) quickLinks = fallback.quickLinks;
      if (!hasReadingState) readingState = fallback.readingState;
      if (annotations) {
        annotations = validateAnnotations(annotations);
        if (annotations.some((annotation) => annotation.page > parsed.pageCount))
          fail('Annotation references a missing PDF page.', 'INVALID_REQUEST', 400);
        nativeRefs ||=
          fallback.nativeRefs || annotations.map((item) => item.nativeRef).filter(Boolean);
      }
      if (quickLinks) {
        quickLinks = validateQuickLinks(quickLinks);
        if (
          quickLinks.some(
            (link) => link.origin.page > parsed.pageCount || link.result.page > parsed.pageCount,
          )
        )
          fail('Quick link references a missing PDF page.', 'INVALID_REQUEST', 400);
      }
      if (readingState !== undefined) readingState = validateReadingState(readingState);

      // Explicit arrays are authoritative. A PDF carrying only the portable
      // transfer metadata is already self-contained, so preserve its bytes.
      const output = bytes;
      const final = await parsePDF(output, limit);
      const finalRevision = final.sha256;
      const history = {
        sessionID,
        requestID,
        payloadDigest: operationDigest,
        revision: finalRevision,
        sha256: finalRevision,
        byteCount: output.length,
        pageCount: final.pageCount,
        released: release,
      };
      const metadata = {
        ...(annotations !== undefined ? { annotations, nativeRefs: nativeRefs || [] } : {}),
        ...(quickLinks !== undefined ? { quickLinks } : {}),
        ...(readingState !== undefined ? { readingState } : {}),
      };
      const previous = clone(documentState);
      documentState.pending = {
        sessionID,
        revision: finalRevision,
        released: release,
        history,
        ...(Object.keys(metadata).length ? { metadata } : {}),
      };
      try {
        await persist();
      } catch (error) {
        restoreDocumentState(documentState, previous);
        throw error;
      }
      await atomicBytes(entry.path, output, source.mode || 0o600);
      if (annotations !== undefined && annotationPaths(annotationsRoot, id))
        await atomicJSON(annotationPaths(annotationsRoot, id), {
          version: 1,
          key: id,
          annotations,
          nativeRefs: nativeRefs || [],
          updatedAt: new Date(now()).toISOString(),
        });
      if (quickLinks !== undefined && quickLinkPath(quickLinksRoot, id))
        await atomicJSON(quickLinkPath(quickLinksRoot, id), quickLinks);
      const beforeFinalize = clone(documentState);
      documentState.revision = finalRevision;
      if (readingState !== undefined) documentState.readingState = readingState;
      rememberHistory(documentState, history);
      delete documentState.pending;
      if (release) {
        documentState.lock = undefined;
        rememberReleased(documentState, sessionID);
      } else if (documentState.lock) documentState.lock.lastSeenAt = now();
      try {
        await persist();
      } catch (error) {
        restoreDocumentState(documentState, beforeFinalize);
        throw error;
      }
      return resultFromHistory(history);
    });
  }

  async function release(id, sessionID) {
    return serial(async () => {
      validIdentifier(sessionID, 'session identifier');
      const documentState = state.documents[id];
      if (!documentState?.lock) {
        if (documentState?.releasedSessions?.includes(sessionID)) return { released: true };
        fail('The document session is not active.', 'SESSION_NOT_ACTIVE', 409);
      }
      if (documentState.lock.sessionID !== sessionID)
        fail('The document session belongs to another device.', 'SESSION_NOT_OWNER', 409);
      const entry = await resolve(id);
      const source = await readSource(entry, limit);
      if (documentState.revision && documentState.revision !== source.sha256)
        fail('The document has unsaved changes.', 'UNSAVED_CHANGES', 409);
      const previous = clone(documentState);
      documentState.lock = undefined;
      rememberReleased(documentState, sessionID);
      try {
        await persist();
      } catch (error) {
        restoreDocumentState(documentState, previous);
        throw error;
      }
      return { released: true };
    });
  }

  async function releaseDesktop(id, sessionID) {
    return serial(async () => {
      validIdentifier(sessionID, 'session identifier');
      const documentState = state.documents[id];
      if (!documentState?.lock) {
        if (documentState?.releasedSessions?.includes(sessionID)) return { released: true };
        fail('The document session is not active.', 'SESSION_NOT_ACTIVE', 409);
      }
      if (documentState.lock.deviceID !== 'desktop' || documentState.lock.sessionID !== sessionID)
        fail('The document session belongs to another device.', 'SESSION_NOT_OWNER', 409);
      const entry = await resolve(id);
      await recoverPending(id, entry, documentState);
      const source = await readSource(entry, limit);
      const previous = clone(documentState);
      // Desktop annotations and page edits are written by the existing native
      // services. Record their final source revision before releasing the lock.
      documentState.revision = source.sha256;
      const readingState = desktopReadingState(entry.view);
      if (readingState) documentState.readingState = readingState;
      documentState.lock = undefined;
      rememberReleased(documentState, sessionID);
      try {
        await persist();
      } catch (error) {
        restoreDocumentState(documentState, previous);
        throw error;
      }
      return { released: true, revision: source.sha256 };
    });
  }

  return {
    list,
    acquire,
    claimDesktop,
    heartbeat,
    update,
    release,
    releaseDesktop,
    flush: () => writes,
    cancelAll: () => {},
  };
}
