import { randomBytes } from 'node:crypto';
import { documentSource } from '../services/documents.mjs';

export function registerDocumentIPC({
  handle,
  trustedWindow,
  registry,
  annotations,
  documentSession,
  readSystemPDF,
  validateSystemPDF,
  documentIdentity,
  focusDocumentWindow,
  claimCompanionPath,
  releaseCompanionDocument,
  companionOwnership,
  flushCompanionPersistence,
}) {
  handle('documents:next', async (event) => {
    const target = trustedWindow(event);
    const state = registry.stateFor(target);
    const document = state.documents.shift();
    if (!document) return null;
    if (typeof document !== 'string') {
      const path = document.ticket && state.tickets.get(document.ticket);
      state.unkeyedAnnotationSource = path
        ? { ...documentSource(path), bytes: Buffer.from(document.bytes) }
        : registry.annotationSourceForDocument(document);
      return document;
    }
    try {
      await claimCompanionPath?.(document, target);
      const loaded = await readSystemPDF(document);
      const source = { ...documentSource(document), bytes: Buffer.from(loaded.bytes) };
      state.unkeyedAnnotationSource = source;
      state.annotationSources.set(document, source);
      const ticket = randomBytes(16).toString('hex');
      state.tickets.set(ticket, document);
      return { ...loaded, ticket };
    } catch {
      await releaseCompanionDocument?.(target, companionOwnership?.(target)).catch(() => {});
      state.documentIdentity = null;
      state.performance.hasDocument = false;
      return {
        error: /\.epub$/i.test(document)
          ? 'Could not open this EPUB. It may be damaged, DRM-protected or larger than 200 MB.'
          : 'Could not open this PDF. Check file access and the 200 MB limit.',
      };
    }
  });
  handle('documents:editPages', async (event, value) => {
    const target = trustedWindow(event);
    const state = registry.stateFor(target);
    const source = registry.annotationSourceForWindow(state, value?.key);
    const result = await annotations.editPages(value, source);
    if (source) source.bytes = Buffer.from(result.bytes);
    let ticket;
    if (source?.path && source.reliable) {
      ticket = randomBytes(16).toString('hex');
      state.tickets.set(ticket, source.path);
    }
    return { ...result, ticket };
  });
  handle('documents:closed', async (event) => {
    const target = trustedWindow(event);
    const state = registry.stateFor(target);
    const ownership = companionOwnership?.(target);
    const hadDocument = !!(
      state.documentIdentity ||
      state.performance.hasDocument ||
      state.documents.length
    );
    state.documentIdentity = null;
    // The start page is reusable as soon as the document closes. Diagnostic
    // snapshots may still finish asynchronously and do not own this state.
    state.performance.hasDocument = false;
    const closeWindow =
      hadDocument &&
      [...registry.windows].some(
        ([other, candidate]) =>
          other !== target &&
          !other.isDestroyed() &&
          !candidate.settingsOwner &&
          !candidate.closing &&
          (candidate.documentIdentity ||
            candidate.performance.hasDocument ||
            candidate.documents.length),
      );
    await documentSession.close(target.id);
    await flushCompanionPersistence?.();
    await releaseCompanionDocument?.(target, ownership);
    // Let the renderer finish releasing its document before closing its window.
    return { closeWindow };
  });
  handle('documents:claim', async (event, path) => {
    const target = trustedWindow(event);
    if (!path) return true;
    await validateSystemPDF(path);
    const identity = await documentIdentity(path);
    const existing =
      registry.findDocumentWindow(identity) ||
      (registry.openingDocuments.has(identity)
        ? await registry.openingDocuments.get(identity)
        : null);
    if (existing) {
      focusDocumentWindow(existing);
      return false;
    }
    await claimCompanionPath?.(path, target);
    registry.stateFor(target).documentIdentity = identity;
    return true;
  });
  handle('documents:view', async (event, view) => {
    const target = trustedWindow(event);
    await documentSession.update(target.id, view);
    return true;
  });
}
