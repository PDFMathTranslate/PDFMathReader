import { uiLanguage } from '../../i18n/index.mjs';

// Experimental feature: English is the fallback for every other language.
const labels = {
  en: {
    setting: 'Remove watermarks (experimental)',
    hint: 'Hides text and images that are unusually large for the page and also diagonal, translucent, pale or repeated on many pages, and layers named watermark. Applied when pages are drawn; the file is never changed. Watermarks drawn as plain shapes, and full-page background images, are not detected.',
  },
  'zh-CN': {
    setting: '去除水印（实验性）',
    hint: '隐藏字号或图片尺寸相对页面异常偏大，且呈斜向、半透明、颜色很浅或在多页重复出现的文字和图片，以及名为水印的图层。仅在绘制页面时生效，不会修改文件。以普通图形绘制的水印和整页背景图不会被识别。',
  },
  'zh-TW': {
    setting: '移除浮水印（實驗性）',
    hint: '隱藏字級或圖片尺寸相對頁面異常偏大，且呈斜向、半透明、顏色很淺或在多頁重複出現的文字與圖片，以及名為浮水印的圖層。僅在繪製頁面時生效，不會修改檔案。以一般圖形繪製的浮水印和整頁背景圖不會被辨識。',
  },
};

export function watermarkRemovalLabel(key, language = uiLanguage.value) {
  return labels[language]?.[key] ?? labels.en[key] ?? key;
}
