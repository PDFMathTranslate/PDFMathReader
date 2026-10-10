// English language names provide a stable sort order, independent of the active locale.
export const UI_LANGUAGE_OPTIONS = Object.freeze(
  [
    { value: 'bn', label: 'বাংলা', englishName: 'Bengali' },
    { value: 'zh-CN', label: '简体中文', englishName: 'Chinese (Simplified)' },
    { value: 'arz', label: 'العربية المصرية', englishName: 'Egyptian Arabic' },
    { value: 'fr', label: 'Français', englishName: 'French' },
    { value: 'de', label: 'Deutsch', englishName: 'German' },
    { value: 'hi', label: 'हिन्दी', englishName: 'Hindi' },
    { value: 'ja', label: '日本語', englishName: 'Japanese' },
    { value: 'pcm', label: 'Naijá', englishName: 'Nigerian Pidgin' },
    { value: 'ur', label: 'اردو', englishName: 'Urdu' },
    { value: 'pt', label: 'Português', englishName: 'Portuguese' },
    { value: 'ru', label: 'Русский', englishName: 'Russian' },
    { value: 'ar', label: 'العربية', englishName: 'Arabic' },
    { value: 'ko', label: '한국어', englishName: 'Korean' },
    { value: 'es', label: 'Español', englishName: 'Spanish' },
    { value: 'zh-TW', label: '繁體中文', englishName: 'Chinese (Traditional)' },
    { value: 'en', label: 'English', englishName: 'English' },
  ]
    .sort((a, b) => a.englishName.localeCompare(b.englishName, 'en'))
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
