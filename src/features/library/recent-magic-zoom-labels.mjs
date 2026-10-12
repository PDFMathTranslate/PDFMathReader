import { uiLanguage } from '../../i18n/index.mjs';

// Experimental feature: English is the fallback for every other language.
const labels = {
  en: {
    setting: 'Magic zoom for recent documents (experimental)',
    hint: 'Covers in the Recents gallery grow as the pointer moves over them, like the macOS Dock, and their neighbours make room. Applies to the gallery view only and is skipped when Reduce Motion is on.',
  },
  'zh-CN': {
    setting: '最近文档魔法缩放（实验性）',
    hint: '指针移过“最近文档”画廊中的封面时，封面会像 macOS 程序坞一样放大，相邻封面自动让位。仅适用于画廊视图，开启“减少动态效果”时不生效。',
  },
  'zh-TW': {
    setting: '最近文件魔法縮放（實驗性）',
    hint: '指標移過「最近文件」圖庫中的封面時，封面會像 macOS 程式塢一樣放大，相鄰封面自動讓位。僅適用於圖庫檢視，開啟「減少動態效果」時不生效。',
  },
};

export function recentMagicZoomLabel(key, language = uiLanguage.value) {
  return labels[language]?.[key] ?? labels.en[key] ?? key;
}
