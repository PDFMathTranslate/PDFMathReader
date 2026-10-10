import { popupGlassMenu } from '../services/glass-menu.mjs';
import { createAIDiscussionService } from '../services/ai-discussion.mjs';
import { clipboard, dialog, Menu, ShareMenu, shell } from 'electron';

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
    const { response } = await dialog.showMessageBox(target, {
      type: 'warning',
      message: `删除这条${kind === 'highlight' ? '高亮' : '批注'}？`,
      buttons: ['取消', '删除'],
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
  handle('previewAnnotations:contextMenu', (event, kind) => {
    const target = trustedWindow(event);
    if (process.platform !== 'darwin') return null;
    if (!['highlight', 'comment'].includes(kind)) throw Error('Invalid annotation kind.');
    return new Promise((resolve) => {
      let selected = null;
      const item = (label, displayLabel = label) => ({
        label: displayLabel,
        click: () => {
          selected = label;
        },
      });
      const template = [
        item('复制'),
        item('分享'),
        ...(kind === 'highlight'
          ? [
              item(
                '在文档内搜索',
                menuLabel(
                  'Search in Document',
                  resolveUILanguage(
                    registry.stateFor(target)?.preferences?.uiLanguage || 'en',
                    app.getPreferredSystemLanguages()[0] || app.getLocale(),
                  ),
                ),
              ),
              item('谷歌搜索'),
              item('谷歌学术搜索'),
            ]
          : []),
        item('和人工智能讨论'),
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
  handle('previewAnnotations:handover', async (event, text) => {
    const target = trustedWindow(event);
    if (typeof text !== 'string' || !text.trim() || text.length > 1000000)
      throw Error('Invalid handover text.');
    if (process.platform !== 'darwin') throw Error('本机 AI 对话目前仅支持 macOS。');
    const clients = await aiDiscussion.list();
    if (!clients.length)
      throw Error('未找到可用的本机 AI 应用，请安装 ChatGPT、Claude 或 Gemini。');
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
    return aiDiscussion.open(client, text);
  });
  handle('clipboard:write-text', async (event, text) => {
    trustedWindow(event);
    if (typeof text !== 'string' || text.length > 1000000) throw Error('Invalid clipboard text');
    await clipboard.writeText(text);
    return true;
  });
}
