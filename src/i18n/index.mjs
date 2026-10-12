import { ref } from 'vue';
import english from './locales/en.mjs';
import {
  SUPPORTED_UI_LANGUAGES,
  resolveUILanguage,
  uiLanguageDirection,
} from '../../shared/i18n/ui-language.mjs';
export { SUPPORTED_UI_LANGUAGES };
const rendererSystemLocale = () =>
  globalThis.previewSystemLocale || globalThis.navigator?.language || 'en';
export const uiLanguageChoice = ref('en');
export const uiLanguage = ref(resolveUILanguage('en', rendererSystemLocale()));

// English is bundled as the fallback; every other language is its own chunk,
// fetched when it is first selected.
const localeLoaders = {
  ar: () => import('./locales/ar.mjs'),
  arz: () => import('./locales/arz.mjs'),
  bn: () => import('./locales/bn.mjs'),
  de: () => import('./locales/de.mjs'),
  es: () => import('./locales/es.mjs'),
  fr: () => import('./locales/fr.mjs'),
  hi: () => import('./locales/hi.mjs'),
  ja: () => import('./locales/ja.mjs'),
  ko: () => import('./locales/ko.mjs'),
  pcm: () => import('./locales/pcm.mjs'),
  pt: () => import('./locales/pt.mjs'),
  ru: () => import('./locales/ru.mjs'),
  ur: () => import('./locales/ur.mjs'),
  'zh-CN': () => import('./locales/zh-CN.mjs'),
  'zh-TW': () => import('./locales/zh-TW.mjs'),
};
const messages = { en: english };
const loading = new Map();
export const UI_MESSAGES = messages;

/** Resolve once the language's strings are available; unsupported codes resolve to English. */
export function loadUILanguage(code) {
  const language = supportedLanguage(code);
  if (messages[language]) return Promise.resolve(language);
  let request = loading.get(language);
  if (!request) {
    request = localeLoaders[language]().then(
      (module) => {
        messages[language] = module.default;
        loading.delete(language);
        return language;
      },
      (error) => {
        loading.delete(language);
        throw error;
      },
    );
    loading.set(language, request);
  }
  return request;
}

let languageRequest = 0;
function presentLanguage(language) {
  uiLanguage.value = language;
  const documentElement = globalThis.document?.documentElement;
  if (documentElement) {
    documentElement.lang = language;
    documentElement.dir = uiLanguageDirection(language);
  }
}

/**
 * Record the choice immediately. The displayed language, document lang and dir
 * change once its strings are loaded, so text never flashes as raw keys; a
 * newer choice supersedes a pending one, and a failed load keeps the current language.
 */
export function setUILanguage(code) {
  uiLanguageChoice.value = code === 'system' || SUPPORTED_UI_LANGUAGES.includes(code) ? code : 'en';
  const language = resolveUILanguage(uiLanguageChoice.value, rendererSystemLocale());
  const request = ++languageRequest;
  if (messages[language]) presentLanguage(language);
  else
    loadUILanguage(language).then(
      () => request === languageRequest && presentLanguage(language),
      (error) => console.warn(`Could not load the ${language} interface language`, error),
    );
  return uiLanguageChoice.value;
}

function lookup(locale, key) {
  let value = messages[locale];
  for (const part of String(key).split('.')) {
    if (!value || typeof value !== 'object' || !(part in value)) return undefined;
    value = value[part];
  }
  return value;
}

function supportedLanguage(code) {
  return SUPPORTED_UI_LANGUAGES.includes(code) ? code : 'en';
}

export function t(key, params = {}) {
  const localized = lookup(uiLanguage.value, key);
  const fallback = lookup('en', key);
  const value =
    typeof localized === 'string'
      ? localized
      : typeof fallback === 'string'
        ? fallback
        : String(key);
  const values = params && typeof params === 'object' ? params : {};
  return value.replace(/\{([A-Za-z0-9_]+)\}/g, (placeholder, name) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder,
  );
}

// Keep upstream text for options added after this localization snapshot.
export function advancedOptionText(option, field) {
  if (option.id === 'prefer_gpu' && ['zh-CN', 'zh-TW'].includes(uiLanguage.value))
    return field === 'label'
      ? '优先 GPU 推理'
      : '自动准备 GPU 依赖：Windows 使用 DirectML，macOS 使用 CoreML；不可用时回退到 CPU。';
  const key = `advanced.options.${option.id}.${field}`;
  return typeof lookup('en', key) === 'string' ? t(key) : option[field];
}

export function advancedChoiceText(option, choice) {
  if (!['primary_font_family', 'backend'].includes(option.id)) return String(choice);
  const key = `advanced.choices.${choice}`;
  return typeof lookup('en', key) === 'string' ? t(key) : String(choice);
}
