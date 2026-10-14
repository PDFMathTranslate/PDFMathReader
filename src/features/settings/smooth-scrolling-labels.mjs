import { uiLanguage } from '../../i18n/index.mjs';

// English is the fallback for every other language.
const labels = {
  en: {
    setting: 'Force smooth scrolling',
    hint: 'Pages glide to every wheel movement instead of jumping, even with a notched mouse wheel or uneven trackpad input. Movement eases in over a fraction of a second; turned off while Reduce Motion is on.',
  },
  'zh-CN': {
    setting: '强制平滑滚动',
    hint: '即使使用有段落感的鼠标滚轮或输入不均匀的触控板，页面也会随每次滚动平滑滑动，而不是跳动。移动会有不到一秒的缓动；开启“减少动态效果”时不生效。',
  },
  'zh-TW': {
    setting: '強制平滑捲動',
    hint: '即使使用有段落感的滑鼠滾輪或輸入不均勻的觸控板，頁面也會隨每次捲動平滑滑動，而不是跳動。移動會有不到一秒的緩動；開啟「減少動態效果」時不生效。',
  },
};

export function smoothScrollingLabel(key, language = uiLanguage.value) {
  return labels[language]?.[key] ?? labels.en[key] ?? key;
}
