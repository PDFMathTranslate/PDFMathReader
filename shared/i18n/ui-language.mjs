// Countries provide a stable English sort order, independent of the active locale.
export const UI_LANGUAGE_OPTIONS = Object.freeze(
  [
    { value: 'bn', label: 'বাংলা', country: 'Bangladesh' },
    { value: 'zh-CN', label: '简体中文', country: 'China' },
    { value: 'arz', label: 'العربية المصرية', country: 'Egypt' },
    { value: 'fr', label: 'Français', country: 'France' },
    { value: 'de', label: 'Deutsch', country: 'Germany' },
    { value: 'hi', label: 'हिन्दी', country: 'India' },
    { value: 'ja', label: '日本語', country: 'Japan' },
    { value: 'pcm', label: 'Naijá', country: 'Nigeria' },
    { value: 'ur', label: 'اردو', country: 'Pakistan' },
    { value: 'pt', label: 'Português', country: 'Portugal' },
    { value: 'ru', label: 'Русский', country: 'Russia' },
    { value: 'ar', label: 'العربية', country: 'Saudi Arabia' },
    { value: 'ko', label: '한국어', country: 'South Korea' },
    { value: 'es', label: 'Español', country: 'Spain' },
    { value: 'zh-TW', label: '繁體中文', country: 'Taiwan' },
    { value: 'en', label: 'English', country: 'United States' },
  ]
    .sort((a, b) => a.country.localeCompare(b.country, 'en'))
    .map(Object.freeze),
);
export const SUPPORTED_UI_LANGUAGES = Object.freeze(UI_LANGUAGE_OPTIONS.map(({ value }) => value));
export function resolveUILanguage(choice = 'en', systemLocale = 'en') {
  if (choice !== 'system') return SUPPORTED_UI_LANGUAGES.includes(choice) ? choice : 'en';
  const locale = String(systemLocale).replaceAll('_', '-').toLowerCase();
  const base = locale.split('-')[0];
  if (base === 'zh') return /(?:^|-)(hant|tw|hk|mo)(?:-|$)/.test(locale) ? 'zh-TW' : 'zh-CN';
  if (locale === 'ar-eg' || locale.startsWith('ar-eg-')) return 'arz';
  return SUPPORTED_UI_LANGUAGES.includes(base) ? base : 'en';
}
export function uiLanguageDirection(code) {
  return ['ar', 'arz', 'ur'].includes(code) ? 'rtl' : 'ltr';
}
