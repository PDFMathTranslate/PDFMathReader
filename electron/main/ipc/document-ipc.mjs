import { randomBytes } from 'node:crypto';

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
}) {
  handle('documents:next', async (event) => {
    const target = trustedWindow(event);
    const state = registry.stateFor(target);
    const document = state.documents.shift();
    if (!document) return null;
    if (typeof document !== 'string') {
      state.unkeyedAnnotationSource = registry.annotationSourceForDocument(document);
      return document;
    }
    try {
      const loaded = await readSystemPDF(document);
      const source = {
        path: document,
        reliable: true,
        preserveWithoutPath: false,
        bytes: Buffer.from(loaded.bytes),
      };
      state.unkeyedAnnotationSource = source;
      state.annotationSources.set(document, source);
      const ticket = randomBytes(16).toString('hex');
      state.tickets.set(ticket, document);
      return { ...loaded, ticket };
    } catch {
      state.documentIdentity = null;
      state.performance.hasDocument = false;
      return { error: 'Could not open this PDF. Check file access and the 50 MB limit.' };
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
  handle('documents:closed', (event) => {
    const target = trustedWindow(event);
    registry.stateFor(target).documentIdentity = null;
    return documentSession.close(target.id);
  });
  handle('documents:claim', async (event, path) => {
    const target = trustedWindow(event);
    if (!path) return true;
    await validateSystemPDF(path);
    const identity = documentIdentity(path);
    const existing =
      registry.findDocumentWindow(identity) ||
      (registry.openingDocuments.has(identity)
        ? await registry.openingDocuments.get(identity)
        : null);
    if (existing) {
      focusDocumentWindow(existing);
      return false;
    }
    registry.stateFor(target).documentIdentity = identity;
    return true;
  });
  handle('documents:view', async (event, view) => {
    const target = trustedWindow(event);
    await documentSession.update(target.id, view);
    return true;
  });
}
