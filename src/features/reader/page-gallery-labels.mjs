import { uiLanguage } from '../../i18n/index.mjs';

// English remains the fallback for unsupported language codes.
const labels = {
  en: { gallery: 'Page Gallery', page: 'Page {page}' },
  'zh-CN': { gallery: '页面画廊', page: '第 {page} 页' },
  'zh-TW': { gallery: '頁面圖庫', page: '第 {page} 頁' },
  ja: { gallery: 'ページギャラリー', page: '{page} ページ' },
  ko: { gallery: '페이지 갤러리', page: '{page}페이지' },
  fr: { gallery: 'Galerie de pages', page: 'Page {page}' },
  es: { gallery: 'Galería de páginas', page: 'Página {page}' },
  de: { gallery: 'Seitengalerie', page: 'Seite {page}' },
  pt: { gallery: 'Galeria de páginas', page: 'Página {page}' },
  ru: { gallery: 'Галерея страниц', page: 'Страница {page}' },
  ar: { gallery: 'معرض الصفحات', page: 'الصفحة {page}' },
  arz: { gallery: 'معرض الصفحات', page: 'الصفحة {page}' },
  hi: { gallery: 'पेज गैलरी', page: 'पेज {page}' },
  bn: { gallery: 'পেজ গ্যালারি', page: 'পেজ {page}' },
  ur: { gallery: 'صفحوں کی گیلری', page: 'صفحہ {page}' },
  pcm: { gallery: 'Page gallery', page: 'Page {page}' },
};

export function pageGalleryLabel(key, values = {}) {
  const text = labels[uiLanguage.value]?.[key] ?? labels.en[key];
  return text.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}
