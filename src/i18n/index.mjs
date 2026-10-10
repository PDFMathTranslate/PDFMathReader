import { ref } from 'vue';
import { extraMessages } from './locales-extra.mjs';
import { advancedMessages } from './advanced-locales.mjs';
import { expandedMessages as europeanMessages } from './locales-europe.mjs';
import { expandedMessages as arabicMessages } from './locales-arabic.mjs';
import { expandedMessages as southAsiaPidginMessages } from './locales-south-asia-pidgin.mjs';

import {
  SUPPORTED_UI_LANGUAGES,
  resolveUILanguage,
  uiLanguageDirection,
} from '../../shared/i18n/ui-language.mjs';
export { SUPPORTED_UI_LANGUAGES };
const rendererSystemLocale = () =>
  globalThis.previewSystemLocale || globalThis.navigator?.language || 'en';
export const uiLanguageChoice = ref('en');
export const uiLanguage = ref(resolveUILanguage('en', rendererSystemLocale()));

const messages = {
  en: {
    app: {
      readerNavigation: 'Reader navigation',
    },
    toolbar: {
      hideAnnotations: 'Hide highlights and comments',
      showAnnotations: 'Show highlights and comments',
      hidePageThumbnails: 'Hide page thumbnails',
      showPageThumbnails: 'Show page thumbnails',
      toggleThumbnails: 'Toggle thumbnails',
      pageOf: 'Page {current} of {total}',
      zoomOut: 'Zoom out',
      zoom: 'Zoom',
      chooseZoomPercentage: 'Choose zoom percentage',
      zoomIn: 'Zoom in',
      translation: 'Translation',
      translating: 'Translating… {percent}%',
      translationProgress: 'Translation progress',
      showOriginalText: 'Show original text',
      showTranslatedText: 'Show translated text',
      searchDocument: 'Search document',
      searchOriginalOrTranslatedText: 'Search original or translated text',
      translationSettings: 'Translation settings',
      openTranslationSettings: 'Open translation settings',
    },
    search: {
      foundPages: 'Found on {count} pages',
      done: 'Done',
      searchTranslation: 'Search translation',
      searchOriginal: 'Search original',
      documentText: 'Search document text',
      searching: 'Searching…',
      noMatches: 'No matches',
      previousMatch: 'Previous match',
      nextMatch: 'Next match',
      close: 'Close search',
    },
    sidebar: {
      thumbnails: 'Thumbnails',
      goToPage: 'Go to page {page}',
      translated: 'Translated',
    },
    startup: {
      openPDF: 'Open PDF…',
      description: 'Open or drop a PDF and read in your language',
      sample: 'Try a sample document',
      recentDocuments: 'Recent documents',
      viewMode: 'View mode',
      galleryView: 'Gallery view',
      listView: 'List view',
      clear: 'Clear',
      openDocument: 'Open {name}',
      previewUnavailable: 'Preview unavailable',
    },
    navigator: {
      followReference: 'Follow PDF reference',
      returnToPosition: 'Return to previous position',
      returnToPage: 'Return to page {page}',

      pageNavigator: 'Page navigator',
      previousPage: 'Previous page',
      pageNumber: 'Page number',
      nextPage: 'Next page',
    },
    status: {
      openingPDF: 'Opening PDF…',
      paragraphsTranslated: '{done} / {total} paragraphs translated · {cached} cached',
      translationReady: 'Translation ready',
      openAIKeyNotConfigured: 'OpenAI key not configured',
      pageOf: 'Page {current} of {total}',
    },
    reading: {
      ready: 'Ready to read',
      paused: 'Paused',
      scrolling: 'Scrolling',
      readingPage: 'Reading page {page}',
    },
    pageStatus: {
      openPDFToTranslate: 'Open a PDF to translate.',
      queued: 'Page queued…',
      detectingLayout: 'Detecting layout…',
      translatingPage: 'Translating page…',
      loadingTranslationPage: 'Loading translated page…',
      translationFailed: 'Translation failed.',
      translatedPageReady: 'Translated page ready.',
      readyToTranslate: 'Ready to translate this page.',
      noReadableText: 'No readable text detected. This page may require OCR.',
      checkKernelAvailability: 'Check kernel availability first.',
    },
    error: {
      dismiss: 'Dismiss error',
      thisPDFUnavailable: 'This PDF is unavailable. It may have been moved or deleted.',
      clearDocumentHistory: 'Could not clear document history.',
      saveReadingPosition: 'Could not save the reading position.',
      receivePDFFromDesktop: 'Could not receive the PDF from the desktop.',
      saveRecentHistory: 'Opened PDF, but could not save recent history.',
      saveDocumentPreview: 'Could not save the document preview.',
      searchDocument: 'Search could not read this document.',
      testDocumentsDisabled: 'TEST APP: personal documents are disabled.',
      PDFTooLarge: 'Choose a PDF smaller than 200 MB.',
      requestFailed: 'Request failed',
    },
    copy: {
      paragraphCopied: 'Paragraph copied',
      failed: 'Copy failed. Try again.',
    },
    paragraph: {
      comparison: 'Paragraph comparison',
      title: 'Paragraph',
      closeComparison: 'Close paragraph comparison',
      original: 'Original',
      translation: 'Translation',
      page: 'Page {page} · {layout}',
    },
    settings: {
      customLanguageCode: 'Custom code…',
      customLanguageCodeReminder:
        'Check custom source and target codes carefully. Confirm that your selected kernel and translation service support them; incorrect or unsupported codes may cause translation failures or incorrect results.',
      customLanguageCodeInvalid: 'Enter a valid language code, such as en, zh-TW, or pt-BR.',

      title: 'Settings',
      close: 'Close settings',
      apiKey: 'API key',
      openAIAPIKey: 'OpenAI API key',
      clearAPIKey: 'Clear API key',
      mode: 'Mode',
      installKernelWithUV: 'Install kernel with uv',
      translation: 'Translation',
      sourceLanguage: 'Source language',
      promptFile: 'Prompt file',
      systemPrompt: 'System prompt',
      automaticDetection: 'Automatic detection',
      translateInto: 'Translate into',
      translationLanguage: 'Translation language',
      reuseTranslations: 'Reuse existing translations',
      reuseTranslationsDescription:
        'Reuse compatible translations for the same document, language, kernel, and options across services and models.',
      translationMode: 'Translation mode',
      parallelPages: 'Parallel pages',
      parallelTranslations: 'Parallel translations',
      reading: 'Reading',
      translateWhenScrollingStops: 'Translate when scrolling stops',
      showParagraphBoundaries: 'Show paragraph boundaries',
      restoreDocuments: 'Restore documents on startup',
      autoHideHeader: 'Auto-hide header',
      interaction: 'Interaction',
      documentOpenMode: 'New document opens in',
      openTranslation: 'Translation mode',
      openOriginal: 'Original mode',
      openManual: 'Open translation manually',
      interactionMode: 'Interaction mode',
      readingMode: 'Reading mode',
      comparisonMode: 'Comparison mode',
      about: 'About',
      github: 'GitHub',
      githubLabel: 'PDFMathReader on GitHub',
    },
    advanced: {
      reinstallKernelGit: 'Reinstall current kernel via Git (latest source)',
      reinstallKernel: 'Reinstall current kernel with uv (update)',
      updatingKernel: 'Updating kernel…',
      bundledKernel: 'This kernel is bundled with the app; update the app to update it.',

      section: 'Advanced',
      loading: 'Loading options…',
      restoreDefaults: 'Restore defaults',
    },
    engine: {
      ultraFast: 'Ultra fast',
      fast: 'Fast',
      precise: 'Precise',
      pdfInspector: 'Ultra fast',
      pdfMathFast: 'Fast',
      pdfMathPrecise: 'Precise',
      busy: 'Busy',
      ready: 'Available',
      error: 'Installed with an error',
      missing: 'Not installed',
      uvUnavailable: 'uv unavailable',
    },
    translation: {
      full: 'Translate entire document',
      fullDescription: 'Translate the entire document when it opens',
      reading: 'Reduce translation requests',
      readingDescription:
        'Automatically translate visible pages and prepare the next screen in your reading direction',
      readingAhead: 'Reduce translation requests, translate further ahead while browsing',
      readingAheadDescription:
        'Prioritizes visible pages, pretranslates up to six pages in your reading direction and two pages behind, while keeping the translation scope limited.',
      language: 'Translation language',
      siliconflowFreeFallback:
        'No OpenAI API key configured. Using SiliconFlow free translation service.',
    },
    parallel: {
      off: 'Off',
      medium: 'Medium',
      more: 'More',
    },
    key: {
      invalidPlaceholder: 'Please set a new key. The saved key is invalid',
      environmentPlaceholder: 'Using environment variable',
      savedPlaceholder: 'Using saved key',
      missingPlaceholder: 'Please provide your key',
      saveFailed: 'Could not save the key. Please set it again',
    },
    appearance: {
      section: 'Appearance',
      appearance: 'Appearance',
      light: 'Light',
      dark: 'Dark',
      auto: 'Auto',
      color: 'Color',
      accentColor: 'Accent color',
      accentColorOption: '{name} accent color',
      customAccentColor: 'Custom accent color',
      system: 'System',
      blue: 'Blue',
      purple: 'Purple',
      pink: 'Pink',
      red: 'Red',
      orange: 'Orange',
      yellow: 'Yellow',
      green: 'Green',
      gray: 'Gray',
      slateBlue: 'Slate Blue',
      custom: 'Custom',
      effects: 'Effects',
      reduceMotion: 'Reduce motion',
      reduceTransparency: 'Reduce transparency',
      reducePadding: 'Reduce padding',
      interfaceLanguage: 'Interface language',
      english: 'English',
      simplifiedChinese: '简体中文',
      japanese: '日本語',
      traditionalChinese: '繁體中文',
      french: 'Français',
      spanish: 'Español',
      korean: '한국어',
    },
  },
  'zh-CN': {
    app: {
      readerNavigation: '阅读器导航',
    },
    toolbar: {
      hideAnnotations: '隐藏高亮和批注',
      showAnnotations: '显示高亮和批注',
      hidePageThumbnails: '隐藏页面缩略图',
      showPageThumbnails: '显示页面缩略图',
      toggleThumbnails: '切换缩略图',
      pageOf: '第 {current} 页，共 {total} 页',
      zoomOut: '缩小',
      zoom: '缩放',
      chooseZoomPercentage: '选择缩放比例',
      zoomIn: '放大',
      translation: '翻译',
      translating: '正在翻译… {percent}%',
      translationProgress: '翻译进度',
      showOriginalText: '显示原文',
      showTranslatedText: '显示译文',
      searchDocument: '搜索文档',
      searchOriginalOrTranslatedText: '搜索原文或译文',
      translationSettings: '翻译设置',
      openTranslationSettings: '打开翻译设置',
    },
    search: {
      foundPages: '在 {count} 页找到结果',
      done: '完成',
      searchTranslation: '搜索译文',
      searchOriginal: '搜索原文',
      documentText: '搜索文档文本',
      searching: '正在搜索…',
      noMatches: '没有匹配项',
      previousMatch: '上一个匹配项',
      nextMatch: '下一个匹配项',
      close: '关闭搜索',
    },
    sidebar: {
      thumbnails: '缩略图',
      goToPage: '转到第 {page} 页',
      translated: '已翻译',
    },
    startup: {
      openPDF: '打开 PDF…',
      description: '打开或拖入 PDF，用您的语言阅读',
      sample: '试读示例文档',
      recentDocuments: '最近文档',
      viewMode: '视图模式',
      galleryView: '画廊视图',
      listView: '列表视图',
      clear: '清除',
      openDocument: '打开 {name}',
      previewUnavailable: '预览不可用',
    },
    navigator: {
      followReference: '跳转到 PDF 引用',
      returnToPosition: '返回之前的位置',
      returnToPage: '返回第 {page} 页',

      pageNavigator: '页面导航',
      previousPage: '上一页',
      pageNumber: '页码',
      nextPage: '下一页',
    },
    status: {
      openingPDF: '正在打开 PDF…',
      paragraphsTranslated: '已翻译 {done} / {total} 个段落 · 已缓存 {cached} 个',
      translationReady: '翻译已就绪',
      openAIKeyNotConfigured: '尚未配置 OpenAI 密钥',
      pageOf: '第 {current} 页，共 {total} 页',
    },
    reading: {
      ready: '准备阅读',
      paused: '已暂停',
      scrolling: '滚动中',
      readingPage: '正在阅读第 {page} 页',
    },
    pageStatus: {
      openPDFToTranslate: '打开 PDF 以开始翻译。',
      queued: '页面已排队…',
      detectingLayout: '正在检测版面…',
      translatingPage: '正在翻译页面…',
      loadingTranslationPage: '正在加载翻译页面…',
      translationFailed: '翻译失败。',
      translatedPageReady: '译文页面已就绪。',
      readyToTranslate: '页面已准备好翻译。',
      noReadableText: '未检测到可读文本。此页面可能需要 OCR。',
      checkKernelAvailability: '请先检查翻译内核是否可用。',
    },
    error: {
      dismiss: '关闭错误',
      thisPDFUnavailable: '此 PDF 不可用，可能已被移动或删除。',
      clearDocumentHistory: '无法清除文档历史记录。',
      saveReadingPosition: '无法保存阅读位置。',
      receivePDFFromDesktop: '无法从桌面接收 PDF。',
      saveRecentHistory: 'PDF 已打开，但无法保存最近记录。',
      saveDocumentPreview: '无法保存文档预览。',
      searchDocument: '无法读取此文档进行搜索。',
      testDocumentsDisabled: '测试应用：个人文档已禁用。',
      PDFTooLarge: '请选择小于 200 MB 的 PDF。',
      requestFailed: '请求失败',
    },
    copy: {
      paragraphCopied: '段落已复制',
      failed: '复制失败，请重试。',
    },
    paragraph: {
      comparison: '段落对比',
      title: '段落',
      closeComparison: '关闭段落对比',
      original: '原文',
      translation: '译文',
      page: '第 {page} 页 · {layout}',
    },
    settings: {
      customLanguageCode: '自定义代码…',
      customLanguageCodeReminder:
        '请仔细核对自定义源语言和目标语言代码，并确认所选内核及翻译服务支持这些代码；错误或不支持的代码可能导致翻译失败或结果不正确。',
      customLanguageCodeInvalid: '请输入有效的语言代码，例如 en、zh-TW 或 pt-BR。',

      title: '设置',
      close: '关闭设置',
      apiKey: 'API 密钥',
      openAIAPIKey: 'OpenAI API 密钥',
      clearAPIKey: '清除 API 密钥',
      mode: '模式',
      installKernelWithUV: '使用 uv 安装翻译内核',
      translation: '翻译',
      sourceLanguage: '源语言',
      promptFile: '提示词文件',
      systemPrompt: '系统提示词',
      automaticDetection: '自动检测',
      translateInto: '翻译为',
      translationLanguage: '翻译语言',
      reuseTranslations: '沿用已有译文',
      reuseTranslationsDescription:
        '文档、语言、内核和选项兼容时，切换服务或模型后沿用已有译文。关闭后仅使用当前模型的缓存。',
      translationMode: '翻译模式',
      parallelPages: '并行页面',
      parallelTranslations: '并行翻译',
      reading: '阅读',
      translateWhenScrollingStops: '滚动停止后翻译',
      showParagraphBoundaries: '显示段落边界',
      restoreDocuments: '启动时恢复文档',
      autoHideHeader: '自动隐藏标题栏',
      interaction: '交互',
      documentOpenMode: '新文档打开方式',
      openTranslation: '始终自动翻译',
      openOriginal: '默认阅读原文后台自动翻译',
      openManual: '不自动翻译直至手动开启译文',
      interactionMode: '交互模式',
      readingMode: '阅读模式',
      comparisonMode: '对比模式',
      about: '关于',
      github: 'GitHub',
      githubLabel: '在 GitHub 上查看 PDFMathReader',
    },
    advanced: {
      reinstallKernelGit: '通过 Git 重新安装当前内核（最新源码）',
      reinstallKernel: '使用 uv 重新安装当前内核（更新）',
      updatingKernel: '正在更新内核…',
      bundledKernel: '此内核随应用提供，请更新应用以更新内核。',

      section: '高级',
      loading: '正在加载选项…',
      restoreDefaults: '恢复默认设置',
    },
    engine: {
      ultraFast: '超快',
      fast: '快速',
      precise: '精确',
      pdfInspector: '超快',
      pdfMathFast: '快速',
      pdfMathPrecise: '精确',
      busy: '忙碌',
      ready: '可用',
      error: '已安装但存在错误',
      missing: '未安装',
      uvUnavailable: 'uv 不可用',
    },
    translation: {
      full: '完整翻译',
      fullDescription: '打开文档时翻译整份文档',
      reading: '降低翻译请求',
      readingDescription: '自动翻译当前可见页面，并沿阅读方向提前准备下一屏',
      readingAhead: '降低翻译请求，但在浏览时提前翻译更多',
      readingAheadDescription:
        '优先翻译可见页面，沿阅读方向提前翻译最多六页，并在后方保留两页，同时保持有限的翻译范围。',
      language: '翻译语言',
      siliconflowFreeFallback: '未配置 OpenAI 密钥。正在使用 SiliconFlow 免费翻译服务。',
    },
    parallel: {
      off: '关闭',
      medium: '中等',
      more: '更多',
    },
    key: {
      invalidPlaceholder: '请重新设定，当前保存的密钥无效',
      environmentPlaceholder: '使用环境变量',
      savedPlaceholder: '使用已保存的密钥',
      missingPlaceholder: '请提供您的密钥',
      saveFailed: '无法保存，请重新设定密钥',
    },
    appearance: {
      section: '外观',
      appearance: '外观',
      light: '浅色',
      dark: '深色',
      auto: '自动',
      color: '颜色',
      accentColor: '强调色',
      accentColorOption: '{name}强调色',
      customAccentColor: '自定义强调色',
      system: '系统',
      blue: '蓝色',
      purple: '紫色',
      pink: '粉色',
      red: '红色',
      orange: '橙色',
      yellow: '黄色',
      green: '绿色',
      gray: '灰色',
      slateBlue: '石板蓝',
      custom: '自定义',
      effects: '效果',
      reduceMotion: '减少动态效果',
      reduceTransparency: '减少透明度',
      reducePadding: '减少内边距',
      interfaceLanguage: '界面语言',
      english: 'English',
      simplifiedChinese: '简体中文',
      japanese: '日本語',
      traditionalChinese: '繁體中文',
      french: 'Français',
      spanish: 'Español',
      korean: '한국어',
    },
  },
  ja: {
    app: {
      readerNavigation: 'リーダーナビゲーション',
    },
    toolbar: {
      hideAnnotations: 'ハイライトと注釈を非表示',
      showAnnotations: 'ハイライトと注釈を表示',
      hidePageThumbnails: 'ページのサムネイルを非表示',
      showPageThumbnails: 'ページのサムネイルを表示',
      toggleThumbnails: 'サムネイルを切り替え',
      pageOf: '{total} ページ中 {current} ページ',
      zoomOut: '縮小',
      zoom: 'ズーム',
      chooseZoomPercentage: 'ズーム率を選択',
      zoomIn: '拡大',
      translation: '翻訳',
      translating: '翻訳中… {percent}%',
      translationProgress: '翻訳の進行状況',
      showOriginalText: '原文を表示',
      showTranslatedText: '翻訳を表示',
      searchDocument: '文書を検索',
      searchOriginalOrTranslatedText: '原文または翻訳を検索',
      translationSettings: '翻訳設定',
      openTranslationSettings: '翻訳設定を開く',
    },
    search: {
      foundPages: '{count} ページで見つかりました',
      done: '完了',
      searchTranslation: '翻訳を検索',
      searchOriginal: '原文を検索',
      documentText: '文書テキストを検索',
      searching: '検索中…',
      noMatches: '一致する項目はありません',
      previousMatch: '前の一致項目',
      nextMatch: '次の一致項目',
      close: '検索を閉じる',
    },
    sidebar: {
      thumbnails: 'サムネイル',
      goToPage: '{page} ページへ移動',
      translated: '翻訳済み',
    },
    startup: {
      openPDF: 'PDF を開く…',
      description: 'PDF を開くかドロップして、自分の言語で読む',
      sample: 'サンプル文書を試す',
      recentDocuments: '最近の文書',
      viewMode: '表示モード',
      galleryView: 'ギャラリー表示',
      listView: 'リスト表示',
      clear: '消去',
      openDocument: '{name} を開く',
      previewUnavailable: 'プレビューを利用できません',
    },
    navigator: {
      followReference: 'PDF の参照先へ移動',
      returnToPosition: '前の位置に戻る',
      returnToPage: '{page} ページに戻る',

      pageNavigator: 'ページナビゲーター',
      previousPage: '前のページ',
      pageNumber: 'ページ番号',
      nextPage: '次のページ',
    },
    status: {
      openingPDF: 'PDF を開いています…',
      paragraphsTranslated: '{total} 段落中 {done} 段落を翻訳 · {cached} 件をキャッシュ済み',
      translationReady: '翻訳の準備ができました',
      openAIKeyNotConfigured: 'OpenAI キーが設定されていません',
      pageOf: '{total} ページ中 {current} ページ',
    },
    reading: {
      ready: '読書の準備ができました',
      paused: '一時停止',
      scrolling: 'スクロール中',
      readingPage: '{page} ページを読んでいます',
    },
    pageStatus: {
      openPDFToTranslate: '翻訳する PDF を開いてください。',
      queued: 'ページをキューに追加しました…',
      detectingLayout: 'レイアウトを検出中…',
      translatingPage: 'ページを翻訳中…',
      loadingTranslationPage: '翻訳ページを読み込み中…',
      translationFailed: '翻訳に失敗しました。',
      translatedPageReady: '翻訳ページの準備ができました。',
      readyToTranslate: 'このページを翻訳する準備ができました。',
      noReadableText:
        '読み取れるテキストが検出されませんでした。このページには OCR が必要な場合があります。',
      checkKernelAvailability: '最初にカーネルの利用可能状況を確認してください。',
    },
    error: {
      dismiss: 'エラーを閉じる',
      thisPDFUnavailable: 'この PDF は利用できません。移動または削除された可能性があります。',
      clearDocumentHistory: '文書の履歴を消去できませんでした。',
      saveReadingPosition: '読書位置を保存できませんでした。',
      receivePDFFromDesktop: 'デスクトップから PDF を受信できませんでした。',
      saveRecentHistory: 'PDF は開きましたが、最近の履歴を保存できませんでした。',
      saveDocumentPreview: '文書のプレビューを保存できませんでした。',
      searchDocument: 'この文書を検索できませんでした。',
      testDocumentsDisabled: 'テストアプリ：個人文書は無効です。',
      PDFTooLarge: '200 MB 未満の PDF を選択してください。',
      requestFailed: 'リクエストに失敗しました',
    },
    copy: {
      paragraphCopied: '段落をコピーしました',
      failed: 'コピーに失敗しました。もう一度お試しください。',
    },
    paragraph: {
      comparison: '段落の比較',
      title: '段落',
      closeComparison: '段落の比較を閉じる',
      original: '原文',
      translation: '翻訳',
      page: '{page} ページ · {layout}',
    },
    settings: {
      customLanguageCode: 'カスタムコード…',
      customLanguageCodeReminder:
        '原言語と翻訳先のカスタムコードを慎重に確認し、選択したカーネルと翻訳サービスが対応していることを確認してください。誤ったコードや未対応のコードは翻訳の失敗や誤った結果につながる場合があります。',
      customLanguageCodeInvalid: 'en、zh-TW、pt-BR などの有効な言語コードを入力してください。',

      title: '設定',
      close: '設定を閉じる',
      apiKey: 'API キー',
      openAIAPIKey: 'OpenAI API キー',
      clearAPIKey: 'API キーを消去',
      mode: 'モード',
      installKernelWithUV: 'uv でカーネルをインストール',
      translation: '翻訳',
      sourceLanguage: '原言語',
      promptFile: 'プロンプトファイル',
      systemPrompt: 'システムプロンプト',
      automaticDetection: '自動検出',
      translateInto: '翻訳先',
      translationLanguage: '翻訳言語',
      reuseTranslations: '既存の翻訳を再利用',
      reuseTranslationsDescription:
        '同じ文書、言語、カーネル、オプションに互換性がある場合、サービスやモデルをまたいで翻訳を再利用します。',
      translationMode: '翻訳モード',
      parallelPages: '並列ページ数',
      parallelTranslations: '並列翻訳数',
      reading: '読書',
      translateWhenScrollingStops: 'スクロール停止時に翻訳',
      showParagraphBoundaries: '段落の境界を表示',
      restoreDocuments: '起動時にドキュメントを復元',
      autoHideHeader: 'タイトルバーを自動的に隠す',
      interaction: '操作',
      documentOpenMode: '新しい文書の表示',
      openTranslation: '翻訳モード',
      openOriginal: '原文モード',
      openManual: '翻訳を手動で開く',
      interactionMode: '操作モード',
      readingMode: '読書モード',
      comparisonMode: '比較モード',
      about: 'このアプリについて',
      github: 'GitHub',
      githubLabel: 'GitHub の PDFMathReader',
    },
    advanced: {
      reinstallKernelGit: 'Git で現在のカーネルを再インストール（最新ソース）',
      reinstallKernel: 'uv で現在のカーネルを再インストール（更新）',
      updatingKernel: 'カーネルを更新中…',
      bundledKernel: 'このカーネルはアプリに同梱されています。アプリを更新してください。',

      section: '詳細設定',
      loading: 'オプションを読み込み中…',
      restoreDefaults: 'デフォルトに戻す',
    },
    engine: {
      ultraFast: '超高速',
      fast: '高速',
      precise: '高精度',
      pdfInspector: '超高速',
      pdfMathFast: '高速',
      pdfMathPrecise: '高精度',
      busy: '処理中',
      ready: '利用可能',
      error: 'インストール済みですがエラーがあります',
      missing: '未インストール',
      uvUnavailable: 'uv を利用できません',
    },
    translation: {
      full: '文書全体を翻訳',
      fullDescription: '文書を開いたときに文書全体を翻訳',
      reading: '翻訳リクエストを減らす',
      readingDescription: '表示中のページを自動翻訳し、読む方向の次の画面を先に準備',
      readingAhead: '翻訳リクエストを減らし、閲覧中にさらに先まで翻訳',
      readingAheadDescription:
        '表示中のページを優先し、読む方向に最大6ページ、後方に2ページを先行翻訳しながら、翻訳範囲を限定します。',
      language: '翻訳言語',
      siliconflowFreeFallback:
        'OpenAI API キーが設定されていません。SiliconFlow の無料翻訳サービスを使用しています。',
    },
    parallel: {
      off: 'オフ',
      medium: '中',
      more: '多い',
    },
    key: {
      invalidPlaceholder: '新しいキーを設定してください。保存されたキーは無効です',
      environmentPlaceholder: '環境変数を使用',
      savedPlaceholder: '保存されたキーを使用',
      missingPlaceholder: 'キーを入力してください',
      saveFailed: '保存できませんでした。キーをもう一度設定してください',
    },
    appearance: {
      section: '外観',
      appearance: '外観',
      light: 'ライト',
      dark: 'ダーク',
      auto: '自動',
      color: 'カラー',
      accentColor: 'アクセントカラー',
      accentColorOption: '{name}のアクセントカラー',
      customAccentColor: 'カスタムアクセントカラー',
      system: 'システム',
      blue: 'ブルー',
      purple: 'パープル',
      pink: 'ピンク',
      red: 'レッド',
      orange: 'オレンジ',
      yellow: 'イエロー',
      green: 'グリーン',
      gray: 'グレイ',
      slateBlue: 'スレートブルー',
      custom: 'カスタム',
      effects: 'エフェクト',
      reduceMotion: '視差効果を減らす',
      reduceTransparency: '透明度を下げる',
      reducePadding: '余白を減らす',
      interfaceLanguage: 'インターフェイス言語',
      english: 'English',
      simplifiedChinese: '简体中文',
      japanese: '日本語',
      traditionalChinese: '繁體中文',
      french: 'Français',
      spanish: 'Español',
      korean: '한국어',
    },
  },
};

Object.assign(messages, extraMessages);
for (const [locale, labels] of Object.entries(advancedMessages))
  Object.assign(messages[locale].advanced, labels);
const translationLanguages = {
  en: {
    simplifiedChinese: 'Simplified Chinese',
    traditionalChinese: 'Traditional Chinese',
    english: 'English',
    japanese: 'Japanese',
    korean: 'Korean',
    french: 'French',
    german: 'German',
    spanish: 'Spanish',
  },
  'zh-CN': {
    simplifiedChinese: '简体中文',
    traditionalChinese: '繁体中文',
    english: '英语',
    japanese: '日语',
    korean: '韩语',
    french: '法语',
    german: '德语',
    spanish: '西班牙语',
  },
  ja: {
    simplifiedChinese: '簡体字中国語',
    traditionalChinese: '繁体字中国語',
    english: '英語',
    japanese: '日本語',
    korean: '韓国語',
    french: 'フランス語',
    german: 'ドイツ語',
    spanish: 'スペイン語',
  },
};
for (const [locale, languages] of Object.entries(translationLanguages))
  messages[locale].languages = languages;
for (const [locale, labels] of Object.entries({
  en: {
    outline: 'Contents',
    annotations: 'Annotations',
    source: 'Original',
    translation: 'Translation',
    page: 'Page {page}',
    comment: 'Comment',
    highlight: 'Highlight',
    view: 'Sidebar view',
    resize: 'Resize sidebar',
    expand: 'Expand {title}',
    collapse: 'Collapse {title}',
  },
  'zh-CN': {
    outline: '目录',
    annotations: '批注',
    source: '原文',
    translation: '译文',
    page: '第 {page} 页',
    comment: '评论',
    highlight: '高亮',
    view: '侧边栏视图',
    resize: '调整侧边栏宽度',
    expand: '展开 {title}',
    collapse: '折叠 {title}',
  },
  'zh-TW': {
    outline: '目錄',
    annotations: '批註',
    source: '原文',
    translation: '譯文',
    page: '第 {page} 頁',
    comment: '評論',
    highlight: '螢光標示',
    view: '側邊欄檢視',
    resize: '調整側邊欄寬度',
    expand: '展開 {title}',
    collapse: '摺疊 {title}',
  },
}))
  Object.assign(messages[locale].sidebar, labels);
for (const [locale, labels] of Object.entries({
  en: { retry: 'Retry', checkPage: 'Check this page' },
  'zh-CN': { retry: '重试', checkPage: '请检查此页' },
  'zh-TW': { retry: '重試', checkPage: '請檢查此頁' },
  ja: { retry: '再試行', checkPage: 'このページを確認' },
  fr: { retry: 'Réessayer', checkPage: 'Vérifiez cette page' },
  es: { retry: 'Reintentar', checkPage: 'Revisa esta página' },
  ko: { retry: '다시 시도', checkPage: '이 페이지를 확인하세요' },
}))
  Object.assign(messages[locale].pageStatus, labels);
const recentStatusMessages = {
  en: {
    title: 'Translation status',
    snapshot: 'Progress recorded at the last reading session.',
    total: 'Total pages',
    completed: 'Completed',
    partial: 'Partially translated',
    pending: 'Not completed',
    failed: 'Failed',
    engine: 'Engine',
    language: 'Target language',
    updated: 'Updated',
    unknown: 'No translation status recorded yet. Open this document to record its progress.',
    close: 'Close',
  },
  'zh-CN': {
    title: '翻译状态',
    snapshot: '上次阅读时记录的翻译进度。',
    total: '总页数',
    completed: '已完成',
    partial: '部分翻译',
    pending: '未完成',
    failed: '失败',
    engine: '翻译引擎',
    language: '目标语言',
    updated: '更新时间',
    unknown: '尚未记录翻译状态。打开文档后可记录进度。',
    close: '关闭',
  },
  'zh-TW': {
    title: '翻譯狀態',
    snapshot: '上次閱讀時記錄的翻譯進度。',
    total: '總頁數',
    completed: '已完成',
    partial: '部分翻譯',
    pending: '未完成',
    failed: '失敗',
    engine: '翻譯引擎',
    language: '目標語言',
    updated: '更新時間',
    unknown: '尚未記錄翻譯狀態。開啟文件後可記錄進度。',
    close: '關閉',
  },
  ja: {
    title: '翻訳状況',
    snapshot: '前回の閲覧時に記録された進捗。',
    total: '総ページ数',
    completed: '完了',
    partial: '一部翻訳済み',
    pending: '未完了',
    failed: '失敗',
    engine: 'エンジン',
    language: '翻訳先の言語',
    updated: '更新日時',
    unknown: '翻訳状況はまだ記録されていません。文書を開くと進捗を記録できます。',
    close: '閉じる',
  },
  ko: {
    title: '번역 상태',
    snapshot: '마지막으로 읽을 때 기록된 진행 상황입니다.',
    total: '전체 페이지',
    completed: '완료',
    partial: '부분 번역',
    pending: '미완료',
    failed: '실패',
    engine: '엔진',
    language: '대상 언어',
    updated: '업데이트',
    unknown: '아직 번역 상태가 기록되지 않았습니다. 문서를 열어 진행 상황을 기록하세요.',
    close: '닫기',
  },
  fr: {
    title: 'État de la traduction',
    snapshot: 'Progression enregistrée lors de la dernière lecture.',
    total: 'Pages au total',
    completed: 'Terminées',
    partial: 'Partiellement traduites',
    pending: 'Non terminées',
    failed: 'Échecs',
    engine: 'Moteur',
    language: 'Langue cible',
    updated: 'Mise à jour',
    unknown: 'Aucun état enregistré. Ouvrez le document pour enregistrer sa progression.',
    close: 'Fermer',
  },
  es: {
    title: 'Estado de traducción',
    snapshot: 'Progreso registrado durante la última lectura.',
    total: 'Páginas totales',
    completed: 'Completadas',
    partial: 'Traducción parcial',
    pending: 'Sin completar',
    failed: 'Fallidas',
    engine: 'Motor',
    language: 'Idioma de destino',
    updated: 'Actualizado',
    unknown: 'Aún no hay un estado registrado. Abre el documento para registrar el progreso.',
    close: 'Cerrar',
  },
};
for (const [locale, labels] of Object.entries(recentStatusMessages))
  messages[locale].recentStatus = labels;
const annotationBrowserMessages = {
  en: {
    search: 'Search annotations',
    filter: 'Filter',
    group: 'Group',
    none: 'None',
    kind: { highlight: 'Highlight', comment: 'Comment' },
    date: {
      today: 'Today',
      week: 'Within a week',
      month: 'Within 30 days',
      older: 'Over 30 days ago',
      unknown: 'Unknown date',
    },
    color: 'Color',
    chapter: { unknown: 'No chapter' },
    all: 'All',
    from: 'From',
    to: 'To',
    reset: 'Reset filters',
    empty: 'No matching annotations',
    yellow: 'Yellow',
    green: 'Green',
    cyan: 'Cyan',
    red: 'Red',
    kindLabel: 'Type',
    dateLabel: 'Date',
    chapterLabel: 'Chapter',
  },
  'zh-CN': {
    search: '搜索批注',
    filter: '筛选',
    group: '分组',
    none: '不分组',
    kind: { highlight: '高亮', comment: '评论' },
    date: {
      today: '今天',
      week: '一周内',
      month: '30 天内',
      older: '30 天以前',
      unknown: '日期未知',
    },
    color: '颜色',
    chapter: { unknown: '无章节' },
    all: '全部',
    from: '开始日期',
    to: '结束日期',
    reset: '重置筛选',
    empty: '没有匹配的批注',
    yellow: '黄色',
    green: '绿色',
    cyan: '青色',
    red: '红色',
    kindLabel: '类别',
    dateLabel: '日期',
    chapterLabel: '章节',
  },
  'zh-TW': {
    search: '搜尋批註',
    filter: '篩選',
    group: '分組',
    none: '不分組',
    kind: { highlight: '螢光標示', comment: '評論' },
    date: {
      today: '今天',
      week: '一週內',
      month: '30 天內',
      older: '30 天以前',
      unknown: '日期未知',
    },
    color: '顏色',
    chapter: { unknown: '無章節' },
    all: '全部',
    from: '開始日期',
    to: '結束日期',
    reset: '重設篩選',
    empty: '沒有符合的批註',
    yellow: '黃色',
    green: '綠色',
    cyan: '青色',
    red: '紅色',
    kindLabel: '類別',
    dateLabel: '日期',
    chapterLabel: '章節',
  },
  ja: {
    search: '注釈を検索',
    filter: '絞り込み',
    group: 'グループ',
    none: 'なし',
    kind: { highlight: 'ハイライト', comment: 'コメント' },
    date: {
      today: '今日',
      week: '1週間以内',
      month: '30日以内',
      older: '30日以前',
      unknown: '日付不明',
    },
    color: '色',
    chapter: { unknown: '章なし' },
    all: 'すべて',
    from: '開始日',
    to: '終了日',
    reset: '絞り込みをリセット',
    empty: '一致する注釈はありません',
    yellow: '黄色',
    green: '緑',
    cyan: 'シアン',
    red: '赤',
    kindLabel: '種類',
    dateLabel: '日付',
    chapterLabel: '章',
  },
  fr: {
    search: 'Rechercher les annotations',
    filter: 'Filtrer',
    group: 'Grouper',
    none: 'Aucun',
    kind: { highlight: 'Surlignage', comment: 'Commentaire' },
    date: {
      today: 'Aujourd’hui',
      week: 'Cette semaine',
      month: 'Ces 30 derniers jours',
      older: 'Il y a plus de 30 jours',
      unknown: 'Date inconnue',
    },
    color: 'Couleur',
    chapter: { unknown: 'Sans chapitre' },
    all: 'Tous',
    from: 'Du',
    to: 'Au',
    reset: 'Réinitialiser',
    empty: 'Aucune annotation correspondante',
    yellow: 'Jaune',
    green: 'Vert',
    cyan: 'Cyan',
    red: 'Rouge',
    kindLabel: 'Type',
    dateLabel: 'Date',
    chapterLabel: 'Chapitre',
  },
  es: {
    search: 'Buscar anotaciones',
    filter: 'Filtrar',
    group: 'Agrupar',
    none: 'Ninguno',
    kind: { highlight: 'Resaltado', comment: 'Comentario' },
    date: {
      today: 'Hoy',
      week: 'Esta semana',
      month: 'Últimos 30 días',
      older: 'Hace más de 30 días',
      unknown: 'Fecha desconocida',
    },
    color: 'Color',
    chapter: { unknown: 'Sin capítulo' },
    all: 'Todos',
    from: 'Desde',
    to: 'Hasta',
    reset: 'Restablecer filtros',
    empty: 'Sin anotaciones coincidentes',
    yellow: 'Amarillo',
    green: 'Verde',
    cyan: 'Cian',
    red: 'Rojo',
    kindLabel: 'Tipo',
    dateLabel: 'Fecha',
    chapterLabel: 'Capítulo',
  },
  ko: {
    search: '주석 검색',
    filter: '필터',
    group: '그룹',
    none: '없음',
    kind: { highlight: '강조', comment: '댓글' },
    date: {
      today: '오늘',
      week: '일주일 이내',
      month: '30일 이내',
      older: '30일 이전',
      unknown: '날짜 없음',
    },
    color: '색상',
    chapter: { unknown: '장 없음' },
    all: '전체',
    from: '시작일',
    to: '종료일',
    reset: '필터 초기화',
    empty: '일치하는 주석 없음',
    yellow: '노란색',
    green: '초록색',
    cyan: '청록색',
    red: '빨간색',
    kindLabel: '유형',
    dateLabel: '날짜',
    chapterLabel: '장',
  },
};
const annotationPurpleLabels = {
  en: 'Purple',
  'zh-CN': '紫色',
  'zh-TW': '紫色',
  ja: '紫',
  fr: 'Violet',
  es: 'Morado',
  ko: '보라색',
};
for (const [locale, label] of Object.entries(annotationPurpleLabels))
  annotationBrowserMessages[locale].purple = label;
const annotationUnknownColors = {
  en: 'No color',
  'zh-CN': '无颜色',
  'zh-TW': '無顏色',
  ja: '色なし',
  fr: 'Sans couleur',
  es: 'Sin color',
  ko: '색상 없음',
};
for (const [locale, label] of Object.entries(annotationUnknownColors))
  annotationBrowserMessages[locale].unknownColor = label;
for (const [locale, labels] of Object.entries(annotationBrowserMessages))
  messages[locale].annotationBrowser = labels;
const topicSentenceLabels = {
  en: 'Emphasize topic sentences',
  'zh-CN': '强调主题句',
  'zh-TW': '強調主題句',
  ja: '段落の最初の文を強調',
  fr: 'Mettre en évidence la première phrase',
  es: 'Destacar la primera oración',
  ko: '문단의 첫 문장 강조',
};
for (const [locale, label] of Object.entries(topicSentenceLabels))
  messages[locale].settings.emphasizeTopicSentences = label;
const topicSentenceHints = {
  en: 'A soft tint marks the first sentence of paragraphs over 60 words or 120 CJK characters. Single-sentence paragraphs are skipped.',
  'zh-CN': '以淡色底纹标示超过 60 个词或 120 个中日韩字符的长段落首句；只有一句的段落不强调。',
  'zh-TW': '以淡色底紋標示超過 60 個詞或 120 個中日韓字元的長段落首句；只有一句的段落不強調。',
  ja: '60語または120文字を超える段落の最初の文を淡く表示します。1文のみの段落は対象外です。',
  ko: '60단어 또는 한중일 문자 120자를 넘는 문단의 첫 문장을 옅게 표시합니다. 한 문장인 문단은 제외합니다.',
  fr: 'Une teinte légère marque la première phrase des paragraphes de plus de 60 mots ou 120 caractères CJK. Les paragraphes à une seule phrase sont exclus.',
  es: 'Un fondo suave marca la primera oración de párrafos de más de 60 palabras o 120 caracteres CJK. Se omiten los párrafos de una sola oración.',
};
for (const [locale, hint] of Object.entries(topicSentenceHints))
  messages[locale].settings.emphasizeTopicSentencesHint = hint;
const informationLabels = {
  en: [
    'Emphasize information',
    'Subtle underlines mark research results, ordering, reasoning, discovery and comparison keywords.',
  ],
  'zh-CN': ['强调信息', '用细下划线标示科研结果、序数、逻辑、发现和比较关键词。'],
  'zh-TW': ['強調資訊', '用細底線標示科研結果、序數、邏輯、發現與比較關鍵詞。'],
  ja: ['重要情報を強調', '研究結果・順序・論理・発見・比較のキーワードに細い下線を表示します。'],
  fr: [
    'Mettre en évidence les informations',
    'Souligner discrètement les mots clés des résultats, de l’ordre, du raisonnement, des découvertes et des comparaisons.',
  ],
  es: [
    'Destacar información',
    'Subrayar suavemente palabras clave de resultados, orden, lógica, descubrimientos y comparaciones.',
  ],
  ko: [
    '중요 정보 강조',
    '연구 결과, 순서, 논리, 발견 및 비교 관련 키워드에 가는 밑줄을 표시합니다.',
  ],
};
for (const [locale, [label, hint]] of Object.entries(informationLabels)) {
  messages[locale].settings.emphasizeInformation = label;
  messages[locale].settings.emphasizeInformationHint = hint;
}
const resourceUsageLabels = {
  en: [
    'Reduce resource usage',
    'Pause background rendering and release page bitmaps when minimized or inactive. Full-document translation continues.',
  ],
  'zh-CN': ['降低资源占用', '窗口最小化或应用非前台时暂停绘制并释放页面位图；全文翻译继续执行。'],
  'zh-TW': [
    '降低資源佔用',
    '視窗最小化或應用程式非前景時暫停繪製並釋放頁面點陣圖；全文翻譯繼續執行。',
  ],
  ja: [
    'リソース使用量を削減',
    '最小化・非アクティブ時に描画を停止し、ページ画像を解放します。全文翻訳は継続します。',
  ],
  ko: [
    '리소스 사용량 줄이기',
    '최소화하거나 비활성 상태일 때 렌더링을 멈추고 페이지 이미지를 해제합니다. 전체 문서 번역은 계속됩니다.',
  ],
  fr: [
    'Réduire l’utilisation des ressources',
    'Suspendre le rendu et libérer les images en arrière-plan. La traduction intégrale continue.',
  ],
  es: [
    'Reducir el uso de recursos',
    'Pausar el renderizado y liberar imágenes en segundo plano. La traducción completa continúa.',
  ],
};
for (const [locale, [label, hint]] of Object.entries(resourceUsageLabels)) {
  messages[locale].settings.reduceResourceUsage = label;
  messages[locale].settings.reduceResourceUsageHint = hint;
}
const paragraphGapOptimizationLabels = {
  en: [
    'Optimize paragraph gaps in reading mode',
    'In vertical reading mode, reduce extra gaps to use screen space more efficiently.',
  ],
  'zh-CN': [
    '阅读模式段落间隙优化',
    '在竖向阅读模式中，通过缩减额外的间隙在排版中充分利用屏幕空间。',
  ],
  'zh-TW': ['閱讀模式段落間距最佳化', '在直向閱讀模式中，縮減額外間距，讓排版更充分利用螢幕空間。'],
  ja: [
    '読書モードの段落間隔を最適化',
    '縦書きの読書モードで余分な間隔を縮め、画面をより有効に使います。',
  ],
  ko: [
    '읽기 모드 단락 간격 최적화',
    '세로 읽기 모드에서 추가 간격을 줄여 화면 공간을 더 효율적으로 사용합니다.',
  ],
  fr: [
    'Optimiser les espaces entre les paragraphes en mode lecture',
    'En mode lecture vertical, réduire les espaces superflus pour mieux utiliser l’écran.',
  ],
  es: [
    'Optimizar los espacios entre párrafos en el modo de lectura',
    'En el modo de lectura vertical, reduce los espacios adicionales para aprovechar mejor la pantalla.',
  ],
};
for (const [locale, [label, description]] of Object.entries(paragraphGapOptimizationLabels)) {
  messages[locale].settings.optimizeParagraphGaps = label;
  messages[locale].settings.optimizeParagraphGapsDescription = description;
}
const translationServiceLabels = {
  en: {
    translationService: 'Translation service',
    translationServiceAuto: 'Automatic',
    translationServiceOpenAI: 'OpenAI compatible',
    translationServiceAppleLocal: 'Apple Translation (on device)',
    translationServiceSiliconFlowFree: 'SiliconFlow free',
    translationServiceLoading: 'Loading translation services…',
    translationServiceUnavailable: 'Translation services are unavailable.',
    translationServiceRetry: 'Retry',
  },
  'zh-CN': {
    translationService: '翻译服务',
    translationServiceAuto: '自动',
    translationServiceOpenAI: '兼容 OpenAI',
    translationServiceAppleLocal: 'Apple 翻译（设备端）',
    translationServiceSiliconFlowFree: 'SiliconFlow 免费服务',
    translationServiceLoading: '正在加载翻译服务…',
    translationServiceUnavailable: '翻译服务不可用。',
    translationServiceRetry: '重试',
  },
  'zh-TW': {
    translationService: '翻譯服務',
    translationServiceAuto: '自動',
    translationServiceOpenAI: '相容 OpenAI',
    translationServiceAppleLocal: 'Apple 翻譯（裝置端）',
    translationServiceSiliconFlowFree: 'SiliconFlow 免費服務',
    translationServiceLoading: '正在載入翻譯服務…',
    translationServiceUnavailable: '翻譯服務無法使用。',
    translationServiceRetry: '重試',
  },
  ja: {
    translationService: '翻訳サービス',
    translationServiceAuto: '自動',
    translationServiceOpenAI: 'OpenAI 互換',
    translationServiceAppleLocal: 'Apple 翻訳（デバイス上）',
    translationServiceSiliconFlowFree: 'SiliconFlow 無料サービス',
    translationServiceLoading: '翻訳サービスを読み込み中…',
    translationServiceUnavailable: '翻訳サービスを利用できません。',
    translationServiceRetry: '再試行',
  },
  ko: {
    translationService: '번역 서비스',
    translationServiceAuto: '자동',
    translationServiceOpenAI: 'OpenAI 호환',
    translationServiceAppleLocal: 'Apple 번역 (기기에서)',
    translationServiceSiliconFlowFree: 'SiliconFlow 무료 서비스',
    translationServiceLoading: '번역 서비스 로드 중…',
    translationServiceUnavailable: '번역 서비스를 사용할 수 없습니다.',
    translationServiceRetry: '다시 시도',
  },
  fr: {
    translationService: 'Service de traduction',
    translationServiceAuto: 'Automatique',
    translationServiceOpenAI: 'Compatible OpenAI',
    translationServiceAppleLocal: 'Traduction Apple (sur l’appareil)',
    translationServiceSiliconFlowFree: 'SiliconFlow gratuit',
    translationServiceLoading: 'Chargement des services de traduction…',
    translationServiceUnavailable: 'Services de traduction indisponibles.',
    translationServiceRetry: 'Réessayer',
  },
  es: {
    translationService: 'Servicio de traducción',
    translationServiceAuto: 'Automático',
    translationServiceOpenAI: 'Compatible con OpenAI',
    translationServiceAppleLocal: 'Traducción de Apple (en el dispositivo)',
    translationServiceSiliconFlowFree: 'SiliconFlow gratuito',
    translationServiceLoading: 'Cargando servicios de traducción…',
    translationServiceUnavailable: 'Los servicios de traducción no están disponibles.',
    translationServiceRetry: 'Reintentar',
  },
};
for (const [locale, labels] of Object.entries(translationServiceLabels))
  Object.assign(messages[locale].settings, labels);
export const UI_MESSAGES = messages;

function lookup(locale, key) {
  let value = messages[locale];
  for (const part of String(key).split('.')) {
    if (!value || typeof value !== 'object' || !(part in value)) return undefined;
    value = value[part];
  }
  return value;
}

function supportedLanguage(code) {
  return SUPPORTED_UI_LANGUAGES.includes(code) ? code : 'en';
}

export function setUILanguage(code) {
  uiLanguageChoice.value = code === 'system' || SUPPORTED_UI_LANGUAGES.includes(code) ? code : 'en';
  uiLanguage.value = resolveUILanguage(uiLanguageChoice.value, rendererSystemLocale());
  const documentElement = globalThis.document?.documentElement;
  if (documentElement) {
    documentElement.lang = uiLanguage.value;
    documentElement.dir = uiLanguageDirection(uiLanguage.value);
  }
  return uiLanguageChoice.value;
}

export function t(key, params = {}) {
  const localized = lookup(uiLanguage.value, key);
  const fallback = lookup('en', key);
  const value =
    typeof localized === 'string'
      ? localized
      : typeof fallback === 'string'
        ? fallback
        : String(key);
  const values = params && typeof params === 'object' ? params : {};
  return value.replace(/\{([A-Za-z0-9_]+)\}/g, (placeholder, name) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder,
  );
}

// Keep upstream text for options added after this localization snapshot.
export function advancedOptionText(option, field) {
  const key = `advanced.options.${option.id}.${field}`;
  return typeof lookup('en', key) === 'string' ? t(key) : option[field];
}

export function advancedChoiceText(option, choice) {
  if (!['primary_font_family', 'backend'].includes(option.id)) return String(choice);
  const key = `advanced.choices.${choice}`;
  return typeof lookup('en', key) === 'string' ? t(key) : String(choice);
}

const appearanceSectionLabels = {
  en: ['Style', 'Interface', 'Language'],
  'zh-CN': ['样式', '界面', '语言'],
  'zh-TW': ['樣式', '介面', '語言'],
  ja: ['スタイル', 'インターフェイス', '言語'],
  ko: ['스타일', '인터페이스', '언어'],
  fr: ['Style', 'Interface', 'Langue'],
  es: ['Estilo', 'Interfaz', 'Idioma'],
};
for (const [locale, [style, interfaceLabel, language]] of Object.entries(appearanceSectionLabels)) {
  Object.assign(messages[locale].appearance, { style, interface: interfaceLabel, language });
}

const emphasisSectionLabels = {
  en: 'Emphasis',
  'zh-CN': '强调',
  'zh-TW': '強調',
  ja: '強調',
  ko: '강조',
  fr: 'Mise en évidence',
  es: 'Énfasis',
};
for (const [locale, label] of Object.entries(emphasisSectionLabels))
  messages[locale].settings.emphasis = label;

const translationSectionLabels = {
  en: ['Language', 'Behavior', 'Parallelism'],
  'zh-CN': ['语言', '行为', '并行'],
  'zh-TW': ['語言', '行為', '平行'],
  ja: ['言語', '動作', '並列処理'],
  ko: ['언어', '동작', '병렬 처리'],
  fr: ['Langue', 'Comportement', 'Parallélisme'],
  es: ['Idioma', 'Comportamiento', 'Paralelismo'],
};
for (const [locale, [languageSection, behaviorSection, parallelSection]] of Object.entries(
  translationSectionLabels,
)) {
  Object.assign(messages[locale].settings, { languageSection, behaviorSection, parallelSection });
}

const dependencySectionLabels = {
  en: 'Dependencies',
  'zh-CN': '依赖项目',
  'zh-TW': '相依專案',
  ja: '依存プロジェクト',
  ko: '의존 프로젝트',
  fr: 'Dépendances',
  es: 'Dependencias',
};
for (const [locale, label] of Object.entries(dependencySectionLabels))
  messages[locale].settings.dependencies = label;

const providerGroupLabels = {
  en: ['Configured', 'Not configured', 'Errors', 'None'],
  'zh-CN': ['已经配置', '尚未配置', '存在错误', '暂无'],
  'zh-TW': ['已經設定', '尚未設定', '存在錯誤', '暫無'],
  ja: ['設定済み', '未設定', 'エラーあり', 'なし'],
  ko: ['설정됨', '미설정', '오류 있음', '없음'],
  fr: ['Configurés', 'Non configurés', 'En erreur', 'Aucun'],
  es: ['Configurados', 'Sin configurar', 'Con errores', 'Ninguno'],
};
for (const [locale, [configured, unconfigured, error, empty]] of Object.entries(
  providerGroupLabels,
)) {
  messages[locale].settings.providerGroups = { configured, unconfigured, error, empty };
}

const kernelRecoveryLabels = {
  en: [
    'Ignore for 5 minutes',
    'Retry',
    'This kernel is bundled with the app. Reinstall or update the app to rebuild it.',
  ],
  'zh-CN': ['忽略 5 分钟', '重试', '此内核随应用内置；请重新安装或更新应用以重建。'],
  'zh-TW': ['忽略 5 分鐘', '重試', '此核心隨應用程式內建；請重新安裝或更新應用程式以重建。'],
  ja: [
    '5分間無視',
    '再試行',
    'このカーネルはアプリに同梱されています。再インストールまたは更新してください。',
  ],
  ko: [
    '5분 동안 무시',
    '재시도',
    '이 커널은 앱에 포함되어 있습니다. 앱을 재설치하거나 업데이트하세요.',
  ],
  fr: [
    'Ignorer pendant 5 minutes',
    'Réessayer',
    'Ce noyau est intégré à l’application. Réinstallez ou mettez à jour l’application.',
  ],
  es: [
    'Ignorar durante 5 minutos',
    'Reintentar',
    'Este núcleo está integrado en la aplicación. Reinstale o actualice la aplicación.',
  ],
};
for (const [locale, [ignore, retry, bundled]] of Object.entries(kernelRecoveryLabels))
  messages[locale].kernelRecovery = { ignore, retry, bundled };

const kernelDocumentIgnoreLabels = {
  en: 'Don’t prompt again for this document',
  'zh-CN': '以后不要提示本文档',
  'zh-TW': '以後不要提示此文件',
  ja: 'この文書のエラーを無視',
  ko: '이 문서의 오류 무시',
  fr: 'Ignorer les erreurs de ce document',
  es: 'Ignorar errores de este documento',
};
for (const [locale, ignoreDocument] of Object.entries(kernelDocumentIgnoreLabels))
  messages[locale].kernelRecovery.ignoreDocument = ignoreDocument;

const kernelRecoveryActions = {
  en: ['Reinstall kernel', 'Build latest source'],
  'zh-CN': ['重装内核', '根据最新源码重新构建'],
  'zh-TW': ['重新安裝核心', '以最新原始碼重新建置'],
  ja: ['カーネルを再インストール', '最新ソースから再ビルド'],
  ko: ['커널 재설치', '최신 소스로 다시 빌드'],
  fr: ['Réinstaller le noyau', 'Compiler les dernières sources'],
  es: ['Reinstalar núcleo', 'Compilar fuentes recientes'],
};
for (const [locale, [reinstall, rebuild]] of Object.entries(kernelRecoveryActions))
  Object.assign(messages[locale].kernelRecovery, { reinstall, rebuild });

const kernelNoConfigurationLabels = {
  en: 'This kernel requires no manual configuration.',
  'zh-CN': '该内核无须手动配置',
  'zh-TW': '此核心無須手動設定',
  ja: 'このカーネルは手動設定不要です。',
  ko: '이 커널은 수동 설정이 필요하지 않습니다.',
  fr: 'Ce noyau ne nécessite aucune configuration manuelle.',
  es: 'Este núcleo no requiere configuración manual.',
};
for (const [locale, kernelNoManualConfiguration] of Object.entries(kernelNoConfigurationLabels))
  Object.assign(messages[locale].settings, { kernelNoManualConfiguration });

const kernelModeLabels = {
  en: 'Kernel mode',
  'zh-CN': '内核模式',
  'zh-TW': '核心模式',
  ja: 'カーネルモード',
  ko: '커널 모드',
  fr: 'Mode du noyau',
  es: 'Modo del núcleo',
};
for (const [locale, kernelMode] of Object.entries(kernelModeLabels))
  Object.assign(messages[locale].settings, { kernelMode });

const kernelSectionLabels = {
  en: ['Mode settings', 'Developer options', 'Speed', 'Balance', 'Quality'],
  'zh-CN': ['模式设定', '开发者选项', '强调速度', '平衡', '强调质量'],
  'zh-TW': ['模式設定', '開發者選項', '強調速度', '平衡', '強調品質'],
  ja: ['モード設定', '開発者オプション', '速度重視', 'バランス', '品質重視'],
  ko: ['모드 설정', '개발자 옵션', '속도 우선', '균형', '품질 우선'],
  fr: ['Réglages du mode', 'Options développeur', 'Vitesse', 'Équilibre', 'Qualité'],
  es: ['Ajustes del modo', 'Opciones de desarrollo', 'Velocidad', 'Equilibrio', 'Calidad'],
};
for (const [locale, [modeSettings, developerOptions, speed, balance, quality]] of Object.entries(
  kernelSectionLabels,
)) {
  Object.assign(messages[locale].settings, {
    modeSettings,
    developerOptions,
    kernelModes: { speed, balance, quality },
  });
}

const aboutVersionLabels = {
  en: [
    'Versions',
    'App version',
    'Recent updates',
    'No feature updates in this build',
    'Loading…',
    'Unavailable',
  ],
  'zh-CN': ['版本', '应用版本', '最近更新', '此构建暂无功能更新', '正在读取…', '无法获取'],
  'zh-TW': ['版本', '應用程式版本', '最近更新', '此版本暫無功能更新', '正在讀取…', '無法取得'],
  ja: [
    'バージョン',
    'アプリのバージョン',
    '最近の更新',
    'このビルドに機能更新はありません',
    '読み込み中…',
    '取得できません',
  ],
  ko: [
    '버전',
    '앱 버전',
    '최근 업데이트',
    '이 빌드에는 기능 업데이트가 없습니다',
    '불러오는 중…',
    '사용 불가',
  ],
  fr: [
    'Versions',
    'Version de l’application',
    'Dernières mises à jour',
    'Aucune nouveauté dans cette version',
    'Chargement…',
    'Indisponible',
  ],
  es: [
    'Versiones',
    'Versión de la aplicación',
    'Actualizaciones recientes',
    'Sin novedades en esta compilación',
    'Cargando…',
    'No disponible',
  ],
};
for (const [locale, [title, app, recent, empty, loading, unavailable]] of Object.entries(
  aboutVersionLabels,
))
  messages[locale].aboutVersions = { title, app, recent, empty, loading, unavailable };

const advancedCategoryLabels = {
  en: 'Advanced Settings',
  'zh-CN': '高级设置',
  'zh-TW': '進階設定',
  ja: '詳細設定',
  ko: '고급 설정',
  fr: 'Réglages avancés',
  es: 'Ajustes avanzados',
};
for (const [locale, label] of Object.entries(advancedCategoryLabels))
  messages[locale].settings.advancedCategory = label;

const translationBehaviorLabels = {
  en: 'Translation Behavior',
  'zh-CN': '翻译行为',
  'zh-TW': '翻譯行為',
  ja: '翻訳の動作',
  ko: '번역 동작',
  fr: 'Comportement de traduction',
  es: 'Comportamiento de traducción',
};
for (const [locale, label] of Object.entries(translationBehaviorLabels))
  messages[locale].settings.translationBehavior = label;

const systemLanguageLabels = {
  en: 'System language',
  'zh-CN': '系统语言',
  'zh-TW': '系統語言',
  ja: 'システム言語',
  ko: '시스템 언어',
  fr: 'Langue du système',
  es: 'Idioma del sistema',
};
for (const [locale, label] of Object.entries(systemLanguageLabels))
  messages[locale].appearance.systemLanguage = label;

const documentDefaultLabels = {
  en: [
    'Document processing',
    'Default page crop',
    'Applies when opening documents without a saved crop. Crops equally from both sides, up to 50% in total per direction. Does not change the source file.',
    'Horizontal',
    'Vertical',
    'Automatically align document widths',
    'On opening, scales pages to the most common page width and saves the changes to the source file.',
  ],
  'zh-CN': [
    '文档处理',
    '默认页面裁剪',
    '打开没有已保存裁剪设置的文档时生效。横向、纵向均从两侧等量裁剪，每个方向合计不超过 50%。不影响源文件。',
    '横向',
    '纵向',
    '自动对齐文档宽度',
    '打开文档时，将各页等比例缩放至最常见的页面宽度，并保存修改。此功能会修改源文件。',
  ],
  'zh-TW': [
    '文件處理',
    '預設頁面裁剪',
    '開啟沒有已儲存裁剪設定的文件時生效。橫向、縱向均從兩側等量裁剪，每個方向合計不超過 50%。不影響原始檔案。',
    '橫向',
    '縱向',
    '自動對齊文件寬度',
    '開啟文件時，將各頁等比例縮放至最常見的頁面寬度並儲存。此功能會修改原始檔案。',
  ],
  ja: [
    'ドキュメント処理',
    '既定のページ切り抜き',
    '保存済みの切り抜き設定がない文書を開く際に適用。各方向の両端を均等に、合計50%まで切り抜きます。元のファイルは変更しません。',
    '横方向',
    '縦方向',
    '文書の幅を自動で揃える',
    '文書を開く際に各ページを最も多い幅に比例拡大・縮小して保存します。元のファイルが変更されます。',
  ],
  ko: [
    '문서 처리',
    '기본 페이지 자르기',
    '저장된 자르기 설정이 없는 문서를 열 때 적용됩니다. 각 방향의 양쪽을 균등하게 총 50%까지 자릅니다. 원본 파일은 변경하지 않습니다.',
    '가로',
    '세로',
    '문서 너비 자동 맞춤',
    '문서를 열 때 각 페이지를 가장 흔한 너비로 비례 조정하고 저장합니다. 원본 파일이 변경됩니다.',
  ],
  fr: [
    'Traitement des documents',
    'Recadrage par défaut',
    'Appliqué à l’ouverture sans recadrage enregistré. Retire une part égale des deux côtés, au maximum 50 % au total par direction. Le fichier source reste inchangé.',
    'Horizontal',
    'Vertical',
    'Aligner automatiquement les largeurs',
    'À l’ouverture, redimensionne proportionnellement les pages à la largeur la plus fréquente et enregistre les modifications dans le fichier source.',
  ],
  es: [
    'Procesamiento de documentos',
    'Recorte de página predeterminado',
    'Se aplica al abrir documentos sin recorte guardado. Recorta ambos lados por igual, hasta un 50 % en total por dirección. No modifica el archivo original.',
    'Horizontal',
    'Vertical',
    'Alinear los anchos automáticamente',
    'Al abrir, ajusta proporcionalmente las páginas al ancho más frecuente y guarda los cambios en el archivo original.',
  ],
};
for (const [
  locale,
  [
    documentDefaults,
    defaultPageCrop,
    defaultPageCropHint,
    cropHorizontal,
    cropVertical,
    autoAlignDocumentWidth,
    autoAlignDocumentWidthHint,
  ],
] of Object.entries(documentDefaultLabels))
  Object.assign(messages[locale].settings, {
    documentDefaults,
    defaultPageCrop,
    defaultPageCropHint,
    cropHorizontal,
    cropVertical,
    autoAlignDocumentWidth,
    autoAlignDocumentWidthHint,
  });

const informationCategoryLabels = {
  en: ['Research findings', 'Ordinal words', 'Key verbs', 'Logical connectives'],
  'zh-CN': ['研究发现', '序数词', '关键动词', '逻辑关联词'],
  'zh-TW': ['研究發現', '序數詞', '關鍵動詞', '邏輯關聯詞'],
  ja: ['研究結果', '序数詞', '重要な動詞', '論理接続詞'],
  ko: ['연구 결과', '서수 표현', '핵심 동사', '논리 연결어'],
  fr: ['Résultats de recherche', 'Mots ordinaux', 'Verbes clés', 'Connecteurs logiques'],
  es: ['Hallazgos de investigación', 'Palabras ordinales', 'Verbos clave', 'Conectores lógicos'],
};
for (const [locale, labels] of Object.entries(informationCategoryLabels))
  for (const [index, key] of [
    'emphasizeResearchFindings',
    'emphasizeOrdinals',
    'emphasizeKeyVerbs',
    'emphasizeLogicalConnectives',
  ].entries())
    messages[locale].settings[key] = labels[index];

const experimentalCategoryLabels = {
  en: 'Experimental Features',
  'zh-CN': '实验性功能',
  'zh-TW': '實驗性功能',
  ja: '実験的な機能',
  ko: '실험적 기능',
  fr: 'Fonctionnalités expérimentales',
  es: 'Funciones experimentales',
};
for (const [locale, label] of Object.entries(experimentalCategoryLabels))
  messages[locale].settings.experimentalCategory = label;

const translatedPdfCompletionLabels = {
  en: 'Translated PDF is ready',
  'zh-CN': '翻译版 PDF 已完成',
  'zh-TW': '翻譯版 PDF 已完成',
  ja: '翻訳版 PDF が完成しました',
  ko: '번역된 PDF가 완성되었습니다',
  fr: 'Le PDF traduit est prêt',
  es: 'El PDF traducido está listo',
};
for (const [locale, label] of Object.entries(translatedPdfCompletionLabels))
  messages[locale].translation.pdfCompleted = label;

Object.assign(messages, europeanMessages, southAsiaPidginMessages, arabicMessages);
