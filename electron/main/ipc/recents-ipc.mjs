import { popupGlassMenu } from '../services/glass-menu.mjs';
import { app, clipboard, dialog, Menu, shell } from 'electron';
import { randomBytes } from 'node:crypto';
import { documentSource } from '../services/documents.mjs';

const recentContextMenuLabels = {
  en: {
    open: 'Open',
    openWindow: 'Open in New Window',
    hide: 'Remove from Recents',
    copy: 'Copy File Location',
    reveal: 'Reveal in Finder',
    status: 'View Translation Status',
  },
  'zh-CN': {
    open: '打开',
    openWindow: '在新窗口打开',
    hide: '从最近记录中删除',
    copy: '复制文件位置',
    reveal: '在访达中显示',
    status: '查看翻译状态',
  },
  'zh-TW': {
    open: '開啟',
    openWindow: '在新視窗開啟',
    hide: '從最近記錄中移除',
    copy: '複製檔案位置',
    reveal: '在 Finder 中顯示',
    status: '檢視翻譯狀態',
  },
  fr: {
    open: 'Ouvrir',
    openWindow: 'Ouvrir dans une nouvelle fenêtre',
    hide: 'Retirer des documents récents',
    copy: 'Copier l’emplacement du fichier',
    reveal: 'Révéler dans le Finder',
    status: 'Afficher l’état de la traduction',
  },
  es: {
    open: 'Abrir',
    openWindow: 'Abrir en una ventana nueva',
    hide: 'Eliminar de recientes',
    copy: 'Copiar ubicación del archivo',
    reveal: 'Mostrar en Finder',
    status: 'Ver estado de la traducción',
  },
  ja: {
    open: '開く',
    openWindow: '新しいウインドウで開く',
    hide: '最近の項目から削除',
    copy: 'ファイルの場所をコピー',
    reveal: 'Finder で表示',
    status: '翻訳状況を表示',
  },
  ko: {
    open: '열기',
    openWindow: '새 창에서 열기',
    hide: '최근 항목에서 제거',
    copy: '파일 위치 복사',
    reveal: 'Finder에서 보기',
    status: '번역 상태 보기',
  },
  de: {
    open: 'Öffnen',
    openWindow: 'In neuem Fenster öffnen',
    hide: 'Aus den zuletzt verwendeten Dokumenten entfernen',
    copy: 'Dateipfad kopieren',
    reveal: 'Im Finder anzeigen',
    status: 'Übersetzungsstatus anzeigen',
  },
  pt: {
    open: 'Abrir',
    openWindow: 'Abrir numa nova janela',
    hide: 'Remover dos recentes',
    copy: 'Copiar localização do ficheiro',
    reveal: 'Mostrar no Finder',
    status: 'Ver estado da tradução',
  },
  ru: {
    open: 'Открыть',
    openWindow: 'Открыть в новом окне',
    hide: 'Удалить из недавних',
    copy: 'Скопировать расположение файла',
    reveal: 'Показать в Finder',
    status: 'Посмотреть статус перевода',
  },
  ar: {
    open: 'فتح',
    openWindow: 'فتح في نافذة جديدة',
    hide: 'إزالة من المستندات الأخيرة',
    copy: 'نسخ موقع الملف',
    reveal: 'إظهار في Finder',
    status: 'عرض حالة الترجمة',
  },
  arz: {
    open: 'افتح',
    openWindow: 'افتح في شباك جديد',
    hide: 'شيل من الملفات الأخيرة',
    copy: 'انسخ مكان الملف',
    reveal: 'اعرض في Finder',
    status: 'اعرض حالة الترجمة',
  },
  hi: {
    open: 'खोलें',
    openWindow: 'नई विंडो में खोलें',
    hide: 'हाल के दस्तावेज़ों से हटाएँ',
    copy: 'फ़ाइल का स्थान कॉपी करें',
    reveal: 'Finder में दिखाएँ',
    status: 'अनुवाद की स्थिति देखें',
  },
  bn: {
    open: 'খুলুন',
    openWindow: 'নতুন উইন্ডোতে খুলুন',
    hide: 'সাম্প্রতিক থেকে সরান',
    copy: 'ফাইলের অবস্থান কপি করুন',
    reveal: 'Finder-এ দেখান',
    status: 'অনুবাদের অবস্থা দেখুন',
  },
  ur: {
    open: 'کھولیں',
    openWindow: 'نئی ونڈو میں کھولیں',
    hide: 'حالیہ سے ہٹائیں',
    copy: 'فائل کا مقام کاپی کریں',
    reveal: 'Finder میں دکھائیں',
    status: 'ترجمے کی حالت دیکھیں',
  },
  pcm: {
    open: 'Open',
    openWindow: 'Open for new window',
    hide: 'Remove am from Recents',
    copy: 'Copy file location',
    reveal: 'Show am for Finder',
    status: 'See translation status',
  },
};
const recentExtraLabels = {
  en: { pin: 'Pin', unpin: 'Unpin', clearCache: 'Clear Translation Cache' },
  'zh-CN': { pin: '置顶', unpin: '取消置顶', clearCache: '清除翻译缓存' },
  'zh-TW': { pin: '置頂', unpin: '取消置頂', clearCache: '清除翻譯快取' },
  ja: { pin: 'ピン留め', unpin: 'ピン留め解除', clearCache: '翻訳キャッシュを削除' },
  ko: { pin: '고정', unpin: '고정 해제', clearCache: '번역 캐시 지우기' },
  fr: { pin: 'Épingler', unpin: 'Retirer l’épingle', clearCache: 'Effacer le cache de traduction' },
  es: { pin: 'Fijar', unpin: 'Quitar la fijación', clearCache: 'Borrar caché de traducción' },
  de: { pin: 'Oben halten', unpin: 'Lösen', clearCache: 'Übersetzungscache löschen' },
  pt: { pin: 'Fixar', unpin: 'Remover fixação', clearCache: 'Limpar cache de tradução' },
  ru: { pin: 'Закрепить', unpin: 'Открепить', clearCache: 'Очистить кэш перевода' },
  ar: { pin: 'تثبيت', unpin: 'إلغاء التثبيت', clearCache: 'مسح ذاكرة التخزين المؤقت للترجمة' },
  arz: { pin: 'ثبّت', unpin: 'شيل التثبيت', clearCache: 'امسح كاش الترجمة' },
  hi: { pin: 'पिन करें', unpin: 'पिन हटाएँ', clearCache: 'अनुवाद कैश साफ़ करें' },
  bn: { pin: 'পিন করুন', unpin: 'পিন সরান', clearCache: 'অনুবাদের ক্যাশে পরিষ্কার করুন' },
  ur: { pin: 'پن کریں', unpin: 'پن ہٹائیں', clearCache: 'ترجمہ کیش صاف کریں' },
  pcm: { pin: 'Pin', unpin: 'Unpin', clearCache: 'Clear translation cache' },
};
const fileManagerRevealLabels = {
  en: 'Show in File Manager',
  'zh-CN': '在文件管理器中显示',
  'zh-TW': '在檔案管理員中顯示',
  fr: 'Afficher dans le gestionnaire de fichiers',
  es: 'Mostrar en el administrador de archivos',
  ja: 'ファイルマネージャーで表示',
  ko: '파일 관리자에서 표시',
  de: 'Im Dateimanager anzeigen',
  pt: 'Mostrar no gestor de ficheiros',
  ru: 'Показать в файловом менеджере',
  ar: 'إظهار في مدير الملفات',
  arz: 'اعرض في مدير الملفات',
  hi: 'फ़ाइल प्रबंधक में दिखाएँ',
  bn: 'ফাইল ম্যানেজারে দেখান',
  ur: 'فائل مینیجر میں دکھائیں',
  pcm: 'Show am for File Manager',
};
const recentContextMenuLabelsFor = (locale) => {
  const labels = recentContextMenuLabels[locale] || recentContextMenuLabels.en;
  return process.platform === 'darwin'
    ? labels
    : { ...labels, reveal: fileManagerRevealLabels[locale] || fileManagerRevealLabels.en };
};

export function registerRecentsIPC({
  handle,
  trustedWindow,
  registry,
  recents,
  preferences,
  readSystemPDF,
  validateSystemPDF,
  documentSession,
  documentIdentity,
  focusDocumentWindow,
  openDocumentWindow,
  resolveUILanguage,
  token,
  smoke,
  rebuildMenu,
  claimCompanionDocument,
  releaseCompanionDocument,
  companionOwnership,
  flushCompanionPersistence,
}) {
  for (const action of ['remember', 'setPinned', 'remove', 'clear']) {
    const mutate = recents[action].bind(recents);
    recents[action] = async (...args) => {
      const result = await mutate(...args);
      rebuildMenu();
      return result;
    };
  }
  for (const action of [
    'list',
    'open',
    'openWindow',
    'remember',
    'clear',
    'preview',
    'contextMenu',
    'setThumbnail',
    'setView',
    'setTranslationStatus',
    'setTranslation',
  ])
    handle('recents:' + action, async (event, value) => {
      const target = trustedWindow(event);
      if (action === 'list') return recents.list();
      if (action === 'clear') {
        app.clearRecentDocuments();
        return recents.clear();
      }
      if (action === 'contextMenu') {
        const id = value;
        const path = typeof id === 'string' ? recents.path(id) : undefined;
        if (typeof id !== 'string' || !id || typeof path !== 'string' || !path)
          throw Error('Document no longer in history.');
        const locale = resolveUILanguage(
          preferences?.load?.().uiLanguage || 'en',
          app.getPreferredSystemLanguages()[0] || app.getLocale(),
        );
        const labels = {
          ...recentContextMenuLabelsFor(locale),
          ...(recentExtraLabels[locale] || recentExtraLabels.en),
        };
        const entry = recents.list().find((item) => item.id === id);
        return new Promise((resolve, reject) => {
          let selected = null;
          let pending = Promise.resolve();
          const template = [
            { label: labels.open, click: () => (selected = 'open') },
            { label: labels.openWindow, click: () => (selected = 'openWindow') },
            {
              label: entry?.pinned ? labels.unpin : labels.pin,
              click: () => {
                pending = recents.setPinned(id, !entry?.pinned).then(() => {
                  selected = 'pin';
                });
              },
            },
            {
              label: labels.hide,
              click: () => {
                pending = recents.remove(id).then(() => {
                  selected = 'hide';
                });
              },
            },
            { type: 'separator' },
            {
              label: labels.copy,
              click: () => (pending = Promise.resolve().then(() => clipboard.writeText(path))),
            },
            {
              label: labels.reveal,
              click: () => (pending = Promise.resolve().then(() => shell.showItemInFolder(path))),
            },
            { type: 'separator' },
            { label: labels.status, click: () => (selected = 'status') },
            { type: 'separator' },
            {
              label: labels.clearCache,
              click: () => {
                pending = (async () => {
                  const document = await readSystemPDF(path);
                  const response = await fetch(
                    registry.stateFor(target).backend.origin + '/api/translation-cache/clear',
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/pdf', 'X-Preview-Token': token },
                      body: document.bytes,
                    },
                  );
                  if (!response.ok) throw Error('Could not clear translation cache.');
                  await recents.clearTranslationStatus(id);
                  selected = 'clearCache';
                })();
              },
            },
          ];
          try {
            const callback = () => pending.then(() => resolve(selected), reject);
            if (
              !popupGlassMenu({
                target,
                template,
                Menu,
                callback,
                enabled: preferences?.load?.().interfaceStyle === 'liquid-glass',
              })
            )
              Menu.buildFromTemplate(template).popup({ window: target, callback });
          } catch (error) {
            reject(error);
          }
        });
      }
      if (action === 'openWindow') {
        const path = recents.path(value);
        if (!path) throw Error('Document no longer in history.');
        await validateSystemPDF(path);
        await openDocumentWindow(path, target);
        return true;
      }
      if (action === 'open') {
        const path = recents.path(value);
        if (!path) throw Error('Document no longer in history.');
        const identity = await documentIdentity(path);
        const existing =
          registry.findDocumentWindow(identity) ||
          (registry.openingDocuments.has(identity)
            ? await registry.openingDocuments.get(identity)
            : null);
        if (existing) {
          focusDocumentWindow(existing);
          return null;
        }
        await claimCompanionDocument?.(value, target);
        registry.stateFor(target).documentIdentity = identity;
        let document;
        try {
          document = await readSystemPDF(path);
        } catch (error) {
          await releaseCompanionDocument?.(target, companionOwnership?.(target)).catch(() => {});
          registry.stateFor(target).documentIdentity = null;
          throw error;
        }
        const state = registry.stateFor(target);
        const source = { ...documentSource(path), bytes: Buffer.from(document.bytes) };
        state.annotationSources.set(value, source);
        state.unkeyedAnnotationSource = source;
        const ticket = randomBytes(16).toString('hex');
        state.tickets.set(ticket, path);
        const recent = recents.list().find((entry) => entry.id === value);
        return { ...document, ticket, recentId: value, view: recent?.view };
      }
      if (action === 'preview') {
        const path = recents.path(value);
        if (!path) throw Error('Document no longer in history.');
        const document = await readSystemPDF(path);
        return { bytes: document.bytes };
      }
      if (action === 'setThumbnail') return recents.setThumbnail(value?.id, value?.thumbnail);
      if (action === 'setView') return recents.setView(value?.id, value?.view);
      if (action === 'setTranslationStatus')
        return recents.setTranslationStatus(value?.id, value?.status);
      if (action === 'setTranslation') return recents.setTranslation(value?.id, value?.choice);
      const state = registry.stateFor(target);
      const ownership = companionOwnership?.(target);
      const path = value?.ticket ? state.tickets.get(value.ticket) : value?.path;
      if (!path) {
        state.documentIdentity = null;
        await documentSession.close(target.id);
        await flushCompanionPersistence?.();
        await releaseCompanionDocument?.(target, ownership);
        if (!state.unkeyedAnnotationSource?.preserveWithoutPath) {
          state.unkeyedAnnotationSource = null;
          state.annotationSources.clear();
        }
        return { entries: recents.list(), recentId: null };
      }
      if (
        smoke &&
        !['A quieter way to read.pdf', 'Portrait and landscape.pdf'].includes(
          path.split(/[\\/]/).pop(),
        )
      )
        throw Error('Test document rejected.');
      await validateSystemPDF(path);
      if (value?.ticket) state.tickets.delete(value.ticket);
      if (!smoke) app.addRecentDocument(path);
      const prepared = recents.prepare?.(path);
      const companionID =
        prepared?.id || recents.list().find((entry) => recents.path(entry.id) === path)?.id;
      let claimed;
      try {
        if (prepared?.created) await recents.persistPrepared?.(companionID);
        claimed = await claimCompanionDocument?.(companionID, target);
        if (claimed?.available === false && prepared?.created)
          await recents.discardPreparedAndPersist?.(companionID);
      } catch (error) {
        if (prepared?.created)
          await recents.discardPreparedAndPersist?.(companionID).catch(() => {});
        throw error;
      }
      let entries;
      try {
        entries = await recents.remember(path, value?.thumbnail);
      } catch (error) {
        await releaseCompanionDocument?.(target, companionOwnership?.(target)).catch(() => {});
        if (prepared?.created)
          await recents.discardPreparedAndPersist?.(companionID).catch(() => {});
        throw error;
      }
      const first = entries.find((item) => recents.path(item.id) === path);
      const previous = state.unkeyedAnnotationSource;
      // An EPUB's converted PDF exists only in memory and the app cache; keep it.
      const source = documentSource(path);
      if (!source.reliable && previous?.path === path && previous.bytes)
        source.bytes = previous.bytes;
      state.annotationSources.set(first.id, source);
      state.unkeyedAnnotationSource = source;
      state.closedTabRemembered = false;
      const restored = state.restoreView;
      state.restoreView = null;
      try {
        await documentSession.open(target.id, { path, view: restored || first?.view });
      } catch (error) {
        await releaseCompanionDocument?.(target, companionOwnership?.(target)).catch(() => {});
        throw error;
      }
      return {
        entries,
        recentId: first?.id ?? null,
        view: restored || first?.view,
        translation: first?.translation,
      };
    });
  handle('recents:statusDialog', async (event, value) => {
    const target = trustedWindow(event);
    if (
      !value ||
      typeof value.title !== 'string' ||
      value.title.length > 200 ||
      typeof value.detail !== 'string' ||
      value.detail.length > 12000 ||
      typeof value.close !== 'string' ||
      value.close.length > 100
    )
      throw Error('Invalid status dialog.');
    await dialog.showMessageBox(target, {
      type: 'info',
      message: value.title,
      detail: value.detail,
      buttons: [value.close],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
  });
}
