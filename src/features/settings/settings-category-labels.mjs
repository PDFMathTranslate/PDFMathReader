// Sidebar wording: [General, Providers, Search settings, Previous settings].
export const settingsWords = {
  ar: ['عام', 'خدمات الترجمة', 'البحث في الإعدادات', 'الإعدادات السابقة'],
  arz: ['عام', 'خدمات الترجمة', 'دوّر في الإعدادات', 'الإعدادات القديمة'],
  hi: ['सामान्य', 'अनुवाद सेवाएँ', 'सेटिंग खोजें', 'पुरानी सेटिंग'],
  bn: ['সাধারণ', 'অনুবাদ সেবা', 'সেটিংস খুঁজুন', 'আগের সেটিংস'],
  ru: ['Общие', 'Сервисы перевода', 'Поиск настроек', 'Прежние настройки'],
  pt: ['Geral', 'Serviços de tradução', 'Pesquisar definições', 'Definições anteriores'],
  ur: ['عمومی', 'ترجمے کی خدمات', 'ترتیبات تلاش کریں', 'پچھلی ترتیبات'],
  de: ['Allgemein', 'Übersetzungsdienste', 'Einstellungen suchen', 'Frühere Einstellungen'],
  pcm: ['General', 'Translation services', 'Find settings', 'Old settings'],
  en: ['General', 'Providers', 'Search', 'Previous settings'],
  'zh-CN': ['通用', '翻译服务', '搜索设置', '旧版设置'],
  'zh-TW': ['一般', '翻譯服務', '搜尋設定', '舊版設定'],
  ja: ['一般', '翻訳サービス', '設定を検索', '以前の設定'],
  ko: ['일반', '번역 서비스', '설정 검색', '이전 설정'],
  fr: ['Général', 'Services de traduction', 'Rechercher les réglages', 'Anciens réglages'],
  es: ['General', 'Servicios de traducción', 'Buscar ajustes', 'Ajustes anteriores'],
};

export const settingsCategoryLabels = (language) => settingsWords[language] || settingsWords.en;
