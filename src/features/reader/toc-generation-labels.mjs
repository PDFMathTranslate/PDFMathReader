import { uiLanguage } from '../../i18n/index.mjs';

// Experimental feature: English is the fallback for every other language.
const labels = {
  en: {
    setting: 'Generate table of contents (experimental)',
    hint: 'Adds Edit → Generate Table of Contents. Documents without bookmarks get a contents list built locally from a printed contents page or from heading fonts and numbering. Nothing is sent anywhere, and scanned pages without text are not supported.',
    reading: 'Reading page {done} of {total}',
    cancel: 'Cancel',
    dismiss: 'Dismiss',
    empty: 'No table of contents could be detected in this document.',
    failed: 'Contents generation failed.',
    exists: 'This document already has a table of contents.',
    doneToc: 'Generated {count} entries from the printed contents page.',
    doneHeadings: 'Generated {count} entries from headings.',
  },
  'zh-CN': {
    setting: '生成目录（实验性）',
    hint: '在“编辑”菜单中加入“生成目录”。对没有书签的文档，在本机根据印刷目录页，或根据标题字号与编号生成目录。不会向外发送任何内容，也不支持没有文字层的扫描页。',
    reading: '正在读取第 {done} / {total} 页',
    cancel: '取消',
    dismiss: '关闭',
    empty: '未能在此文档中识别出目录。',
    failed: '目录生成失败。',
    exists: '此文档已有目录。',
    doneToc: '已根据印刷目录页生成 {count} 个条目。',
    doneHeadings: '已根据标题生成 {count} 个条目。',
  },
  'zh-TW': {
    setting: '生成目錄（實驗性）',
    hint: '在「編輯」選單中加入「生成目錄」。對沒有書籤的文件，在本機根據印刷目錄頁，或根據標題字級與編號生成目錄。不會向外傳送任何內容，也不支援沒有文字層的掃描頁。',
    reading: '正在讀取第 {done} / {total} 頁',
    cancel: '取消',
    dismiss: '關閉',
    empty: '未能在此文件中辨識出目錄。',
    failed: '目錄生成失敗。',
    exists: '此文件已有目錄。',
    doneToc: '已根據印刷目錄頁生成 {count} 個項目。',
    doneHeadings: '已根據標題生成 {count} 個項目。',
  },
};

export function tocGenerationLabel(key, params = {}, language = uiLanguage.value) {
  const text = labels[language]?.[key] ?? labels.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => String(params[name] ?? match));
}
