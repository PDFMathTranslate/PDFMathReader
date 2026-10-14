import { uiLanguage } from '../../i18n/index.mjs';

// Experimental feature: English is the fallback for every other language.
const labels = {
  en: {
    setting: 'Local fonts for original PDFs',
    hint: 'Draws the text of original pages with installed fonts, one for serif text and one for sans-serif text. Each letter stays where the document placed it and is narrowed when the local font is wider. Formulas, symbols, monospaced text and thumbnails keep the document’s own fonts. Leave a field empty to keep the document’s font for that style.',
    serif: 'Serif text',
    sans: 'Sans-serif text',
    serifPlaceholder: 'e.g. Iowan Old Style',
    sansPlaceholder: 'e.g. Avenir Next',
  },
  'zh-CN': {
    setting: '原文 PDF 使用本地字体',
    hint: '用已安装的字体绘制原文页面中的文字：一种用于衬线文字，一种用于无衬线文字。每个字母仍在文档原本的位置，本地字体较宽时会收窄。公式、符号、等宽文字和缩略图保留文档自带字体。留空则该类文字保留文档字体。',
    serif: '衬线文字',
    sans: '无衬线文字',
    serifPlaceholder: '例如 Iowan Old Style',
    sansPlaceholder: '例如 Avenir Next',
  },
  'zh-TW': {
    setting: '原文 PDF 使用本機字型',
    hint: '以已安裝的字型繪製原文頁面中的文字：一種用於襯線文字，一種用於無襯線文字。每個字母仍在文件原本的位置，本機字型較寬時會收窄。公式、符號、等寬文字與縮圖保留文件內嵌字型。留空則該類文字保留文件字型。',
    serif: '襯線文字',
    sans: '無襯線文字',
    serifPlaceholder: '例如 Iowan Old Style',
    sansPlaceholder: '例如 Avenir Next',
  },
};

export function pdfFontLabel(key, language = uiLanguage.value) {
  return labels[language]?.[key] ?? labels.en[key] ?? key;
}
