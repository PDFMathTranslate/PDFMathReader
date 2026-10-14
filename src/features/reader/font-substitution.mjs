import { watch } from 'vue';
import { stripTranslationFont } from '../../../shared/reader/translation-font.mjs';

// Fonts are told apart by their PostScript name, compacted to lower case without
// a subset prefix or separators. Math, symbol and dingbat faces keep their own
// glyphs: a text face has none of their shapes.
const SYMBOL =
  /^(cm(mi|sy|ex|bsy|mib)|msam|msbm|eu(fm|fb|rm|sm|ex)|rsfs|stmary|wasy|lasy|esint|bbm|dsrom|txsy|txmi|txex|pxsy|pxmi|pxex|mtsy|mtmi|mtex)|math|symbol|dingbat|wingding|webding|zapf|marvosym|fontawesome|esstix|euclid/;
const MONOSPACE = /mono|courier|consol|menlo|^cmtt|^sftt|^ectt|inconsolata|typewriter|code/;
const SANS =
  /sans|grotesk|grotesque|gothic|arial|helvetica|verdana|calibri|segoe|tahoma|trebuchet|myriad|frutiger|futura|gillsans|univers|avenir|roboto|lato|ubuntu|^cmss|^sfss|^lmss|nimbussan|yahei|simhei|heiti|pingfang|hiraginokaku|meiryo|gulim|dotum|malgun|franklin|optima|candara|corbel|lucidagrande|sfpro|sfns|aptos/;
const SERIF =
  /serif|times|roman|georgia|garamond|minion|palatino|antiqua|baskerville|caslon|cambria|charter|century|libertin|bodoni|didot|utopia|mercury|warnock|sabon|bembo|janson|cochin|hoefler|constantia|merriweather|lora|tiempos|literata|spectral|crimson|stix|nimbusrom|^cm(r|bx|ti|sl|csc|b|u|bxti|bxsl)\d|^sf(rm|bx|ti|sl|cc)\d|^ec(rm|bx|ti|sl|cc|bi)|^lmr|^txr|^pxr|mincho|song|ming|batang|myungjo|charis|gentium|joanna|perpetua|plantin|electra|newsreader|iowan|sitka/;
const BOLD = /bold|black|heavy|demi|[-,]medi(ital)?$|^cmbx|^cmb\d|^sfbx|^ecbx|^cmssbx/;
const ITALIC = /ital|obliq|[-,][a-z]*it$|^cm(ti|sl|bxti|bxsl|ssi)|^sf(ti|sl)|^ec(ti|sl|bi)/;
// Text that a local face can stand in for: letters, digits, punctuation and
// spaces. Math symbols and mathematical alphanumerics stay with the PDF font.
const TEXT = /^[\p{L}\p{M}\p{N}\p{P}\p{Zs}]+$/u;
const MATH_ALPHANUMERIC = /[\u{1D400}-\u{1D7FF}]/u;

// Repainting every page per keystroke would be wasted while a name is typed.
const SETTLE_MS = 400;

const baseName = (name) => (name || '').replace(/^[A-Z]{6}\+/, '').toLowerCase();

/** 'serif', 'sans', 'mono' or '' when a PDF font keeps its own glyphs. */
export function pdfFontRole(font) {
  if (!font || font.isType3Font || font.disableFontFace || font.vertical) return '';
  const name = baseName(font.name),
    compact = name.replace(/[\s_-]/g, '');
  if (SYMBOL.test(compact)) return '';
  if (MONOSPACE.test(compact) || font.fallbackName === 'monospace') return 'mono';
  if (SANS.test(compact)) return 'sans';
  if (SERIF.test(compact)) return 'serif';
  // pdf.js already weighed the font's flags and its standard-font tables.
  return font.fallbackName === 'serif' ? 'serif' : 'sans';
}

export const substitutableText = (text) =>
  typeof text === 'string' && TEXT.test(text) && !MATH_ALPHANUMERIC.test(text);

const GENERIC = { serif: 'serif', sans: 'sans-serif', mono: 'monospace' };
const cssFamily = (name, generic) => `"${name}", ${generic}`;

/** pdf.js render options that draw serif, sans and mono text with local fonts, or null. */
export function fontSubstitutionOptions({ serif = '', sans = '', mono = '' } = {}) {
  const families = {
    serif: stripTranslationFont(serif).trim(),
    sans: stripTranslationFont(sans).trim(),
    mono: stripTranslationFont(mono).trim(),
  };
  if (!families.serif && !families.sans && !families.mono) return null;
  return {
    key: `font:${families.serif}|${families.sans}|${families.mono}`,
    render: {
      fontSubstitution: {
        face(font) {
          const role = pdfFontRole(font),
            family = families[role];
          if (!family) return null;
          const name = baseName(font.name);
          return {
            family: cssFamily(family, GENERIC[role]),
            style: font.italic || ITALIC.test(name) ? 'italic' : 'normal',
            weight: font.black ? '900' : font.bold || BOLD.test(name) ? 'bold' : 'normal',
          };
        },
        accepts: substitutableText,
      },
    },
  };
}

const fontSet = (preferences, prefix) =>
  ['serif', 'sans', 'mono'].map((role) => {
    const key = `${prefix}${role[0].toUpperCase()}${role.slice(1)}Font`;
    return preferences[key]?.value || '';
  });

// Local fonts for the original and the translated document, each with its own
// serif, sans-serif and monospace families.
export function createFontSubstitution({ preferences, onToggle }) {
  const cache = {},
    timer = { id: 0 };
  const renderOptions = (translated = false) => {
    const prefix = translated ? 'translated' : 'original',
      [serif, sans, mono] = fontSet(preferences, prefix),
      id = `${serif}|${sans}|${mono}`;
    if (cache[prefix]?.id !== id)
      cache[prefix] = { id, value: fontSubstitutionOptions({ serif, sans, mono }) };
    return cache[prefix].value;
  };
  const key = () => `${renderOptions(false)?.key || ''}/${renderOptions(true)?.key || ''}`;
  watch(key, () => {
    clearTimeout(timer.id);
    timer.id = setTimeout(() => onToggle?.(), SETTLE_MS);
  });
  return { renderOptions };
}
