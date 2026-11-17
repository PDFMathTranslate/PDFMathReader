import { ANNOTATION_MENU_LABELS } from '../../../shared/i18n/annotation-menu-labels.mjs';
import { popupGlassMenu } from '../services/glass-menu.mjs';
import { createAIDiscussionService } from '../services/ai-discussion.mjs';
import { clipboard, dialog, Menu, ShareMenu, shell } from 'electron';
import { writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export function registerAnnotationIPC({
  handle,
  trustedWindow,
  registry,
  annotations,
  importPDFAnnotations,
  stripManagedAnnotations,
  menuLabel,
  resolveUILanguage,
  app,
  runFile,
}) {
  const aiDiscussion = createAIDiscussionService({ runFile, clipboard });
  const localeFor = (target) =>
    resolveUILanguage(
      registry.stateFor(target)?.preferences?.uiLanguage || 'en',
      app.getPreferredSystemLanguages()[0] || app.getLocale(),
    );
  handle('previewAnnotations:prepare', async (event, value) => {
    const target = trustedWindow(event);
    if (!(value instanceof Uint8Array) || value.byteLength > 200 * 1024 * 1024)
      throw Error('Invalid annotation PDF bytes.');
    const imported = await importPDFAnnotations(value, { prepare: true });
    registry.stateFor(target).unkeyedAnnotationSource = {
      bytes: Buffer.from(value),
      reliable: false,
      preserveWithoutPath: true,
    };
    return imported;
  });
  handle('previewAnnotations:confirmDelete', async (event, kind) => {
    const target = trustedWindow(event);
    if (!['highlight', 'comment'].includes(kind)) throw Error('Invalid annotation kind.');
    const locale = localeFor(target);
    const { response } = await dialog.showMessageBox(target, {
      type: 'warning',
      message: menuLabel(
        kind === 'highlight' ? 'Delete this highlight?' : 'Delete this comment?',
        locale,
      ),
      buttons: [menuLabel('Cancel', locale), menuLabel('Delete', locale)],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    return response === 1;
  });
  handle('previewAnnotations:palette', async (event) => {
    trustedWindow(event);
    return annotations.palette();
  });
  handle('previewAnnotations:search', (event, { provider, text } = {}) => {
    trustedWindow(event);
    if (!['google', 'scholar'].includes(provider) || typeof text !== 'string' || !text.trim())
      throw Error('Invalid search.');
    const base =
      provider === 'scholar'
        ? 'https://scholar.google.com/scholar'
        : 'https://www.google.com/search';
    return shell.openExternal(`${base}?q=${encodeURIComponent(text.trim())}`);
  });
  handle('previewAnnotations:contextMenu', (event, kind, scope) => {
    const target = trustedWindow(event);
    if (process.platform !== 'darwin' && scope !== 'sidebar') return null;
    if (!['highlight', 'comment'].includes(kind)) throw Error('Invalid annotation kind.');
    return new Promise((resolve) => {
      let selected = null;
      const locale = localeFor(target);
      const item = (
        label,
        displayLabel = menuLabel(ANNOTATION_MENU_LABELS[label] || label, locale),
      ) => ({
        label: displayLabel,
        click: () => {
          selected = label;
        },
      });
      const template =
        scope === 'sidebar'
          ? [item('复制'), item('删除')]
          : [
              item('复制'),
              item('分享'),
              ...(kind === 'highlight'
                ? [
                    item('在文档内搜索'),
                    item('glossary-selection'),
                    item('谷歌搜索'),
                    item('谷歌学术搜索'),
                  ]
                : []),
              item('和人工智能讨论'),
              item('Paraphrase via AI chats...'),
              { type: 'separator' },
              ...(kind === 'comment' ? [item('修改')] : []),
              item('删除'),
            ];
      const callback = () => resolve(selected);
      if (
        !popupGlassMenu({
          target,
          template,
          Menu,
          callback,
          enabled: registry.stateFor(target)?.preferences?.interfaceStyle === 'liquid-glass',
        })
      )
        Menu.buildFromTemplate(template).popup({ window: target, callback });
    });
  });
  handle('previewAnnotations:markDeleteHint', async (event) => {
    trustedWindow(event);
    return annotations.markDeleteHint();
  });
  handle('previewAnnotations:loadState', async (event, key) => {
    trustedWindow(event);
    return annotations.loadState(key);
  });
  handle('previewAnnotations:load', async (event, key) => {
    trustedWindow(event);
    return annotations.load(key);
  });
  handle('previewAnnotations:save', async (event, value) => {
    const target = trustedWindow(event);
    return annotations.save(
      value,
      registry.annotationSourceForWindow(registry.stateFor(target), value?.key),
    );
  });
  handle('previewAnnotations:clean', async (event, value) => {
    trustedWindow(event);
    if (!(value instanceof Uint8Array) || value.byteLength > 200 * 1024 * 1024)
      throw Error('Invalid annotation PDF bytes.');
    return new Uint8Array(await stripManagedAnnotations(value));
  });
  handle('previewAnnotations:share', async (event, text) => {
    const target = trustedWindow(event);
    if (process.platform !== 'darwin') return false;
    if (typeof text !== 'string' || !text.trim() || text.length > 1000000)
      throw Error('Invalid share text.');
    new ShareMenu({ texts: [text] }).popup({ window: target });
    return true;
  });
  handle('previewAnnotations:export', async (event, { text, name, format } = {}) => {
    const target = trustedWindow(event);
    if (typeof text !== 'string' || text.length > 20 * 1024 * 1024)
      throw Error('Invalid annotation export.');
    if (typeof name !== 'string' || !name.trim() || name.length > 255)
      throw Error('Invalid annotation export name.');
    const markdown = format === 'markdown' || format === 'markdown-outline';
    if (!markdown && format !== 'text') throw Error('Invalid annotation export format.');
    // Default to the folder that holds the open document when it has a real path.
    const source = registry.stateFor(target)?.unkeyedAnnotationSource;
    const file = basename(name);
    const defaultPath =
      source?.reliable && typeof source.path === 'string'
        ? join(dirname(source.path), file)
        : join(app.getPath('documents'), file);
    const { canceled, filePath } = await dialog.showSaveDialog(target, {
      defaultPath,
      filters: markdown
        ? [{ name: 'Markdown', extensions: ['md'] }]
        : [{ name: 'Plain Text', extensions: ['txt'] }],
    });
    if (canceled || !filePath) return false;
    await writeFile(filePath, text, 'utf8');
    return true;
  });
  handle('previewAnnotations:handover', async (event, text) => {
    const target = trustedWindow(event);
    if (typeof text !== 'string' || !text.trim() || text.length > 1000000)
      throw Error('Invalid handover text.');
    const locale = localeFor(target);
    const label = (text) => menuLabel(text, locale);
    if (process.platform !== 'darwin')
      throw Error(label('Local AI chat is only available on macOS.'));
    const clients = await aiDiscussion.list();
    if (!clients.length)
      throw Error(label('No local AI app found. Install ChatGPT, Claude, or Gemini.'));
    const client = await new Promise((resolve) => {
      let selected = null;
      const menu = Menu.buildFromTemplate(
        clients.map((label) => ({
          label,
          click: () => {
            selected = label;
          },
        })),
      );
      menu.popup({ window: target, callback: () => resolve(selected) });
    });
    if (!client) return { cancelled: true };
    return aiDiscussion.open(client, text, label);
  });
  handle('clipboard:write-text', async (event, text) => {
    trustedWindow(event);
    if (typeof text !== 'string' || text.length > 1000000) throw Error('Invalid clipboard text');
    await clipboard.writeText(text);
    return true;
  });
}
