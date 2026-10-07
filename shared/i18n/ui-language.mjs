export const SUPPORTED_UI_LANGUAGES = Object.freeze([
  'en',
  'zh-CN',
  'zh-TW',
  'fr',
  'es',
  'ja',
  'ko',
]);
export function resolveUILanguage(choice, systemLocale = 'en') {
  if (choice !== 'system') return SUPPORTED_UI_LANGUAGES.includes(choice) ? choice : 'en';
  const locale = String(systemLocale).replaceAll('_', '-').toLowerCase();
  const base = locale.split('-')[0];
  if (base === 'zh') return /(?:^|-)(hant|tw|hk|mo)(?:-|$)/.test(locale) ? 'zh-TW' : 'zh-CN';
  return SUPPORTED_UI_LANGUAGES.includes(base) ? base : 'en';
}
