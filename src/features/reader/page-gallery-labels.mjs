import { uiLanguage } from '../../i18n/index.mjs';

// English is the fallback for every other language.
const labels = {
  en: { gallery: 'Page Gallery', page: 'Page {page}' },
  'zh-CN': { gallery: '页面画廊', page: '第 {page} 页' },
  'zh-TW': { gallery: '頁面圖庫', page: '第 {page} 頁' },
  ja: { gallery: 'ページギャラリー', page: '{page} ページ' },
};

export function pageGalleryLabel(key, values = {}) {
  const text = labels[uiLanguage.value]?.[key] ?? labels.en[key];
  return text.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}
