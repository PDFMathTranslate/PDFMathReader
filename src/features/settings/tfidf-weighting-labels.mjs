import { uiLanguage } from '../../i18n/index.mjs';

// English is the fallback for every other language.
const labels = {
  en: {
    setting: 'Emphasize document-specific terms',
    hint: 'Uses TF-IDF: words that are frequent on a page but rare across your other documents are drawn bolder, in three steps. Applies to original pages only and starts once at least three other documents have been opened. Each opened document adds the words of a few random pages to a local cache on this Mac; no text leaves it.',
  },
  'zh-CN': {
    setting: '强调文档特有词汇',
    hint: '使用 TF-IDF：在本页出现频繁、但在你其他文档中少见的词会分三档加粗显示。仅作用于原文页面，至少打开过另外三份文档后开始生效。每份打开的文档会把若干随机页面中的词语记入本机的本地缓存，不会上传任何文本。',
  },
  'zh-TW': {
    setting: '強調文件特有詞彙',
    hint: '使用 TF-IDF：在本頁出現頻繁、但在你其他文件中少見的詞會分三檔加粗顯示。僅作用於原文頁面，至少開啟過另外三份文件後開始生效。每份開啟的文件會把若干隨機頁面中的詞語記入本機的本地快取，不會上傳任何文字。',
  },
};

export function tfidfWeightingLabel(key, language = uiLanguage.value) {
  return labels[language]?.[key] ?? labels.en[key] ?? key;
}
