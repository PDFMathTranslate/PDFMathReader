const SAFE_OPTION_IDS = Object.freeze({
  pdf_math_fast: Object.freeze([
    'debug',
    'vfont',
    'vchar',
    'lang_in',
    'prompt',
    'compatible',
    'onnx',
    'backend',
    'config',
    'skip_subset_fonts',
    'ignore_cache',
  ]),
  pdf_math_precise: Object.freeze([
    'min_text_length',
    'custom_system_prompt',
    'no_auto_extract_glossary',
    'primary_font_family',
    'formular_font_pattern',
    'formular_char_pattern',
    'split_short_lines',
    'short_line_split_factor',
    'skip_clean',
    'disable_rich_text_translate',
    'enhance_compatibility',
    'translate_table_text',
    'skip_scanned_detection',
    'ocr_workaround',
    'auto_enable_ocr_workaround',
    'no_merge_alternating_line_numbers',
    'no_remove_non_formula_lines',
    'non_formula_line_iou_threshold',
    'figure_table_protection_threshold',
    'skip_formula_offset_calculation',
  ]),
});

const SAFE_OPTION_SETS = Object.fromEntries(
  Object.entries(SAFE_OPTION_IDS).map(([id, options]) => [id, new Set(options)]),
);
const EFFECTIVE_DEFAULTS = Object.freeze({
  pdf_math_fast: Object.freeze({ backend: 'cpu', ignore_cache: true }),
  pdf_math_precise: Object.freeze({ no_auto_extract_glossary: true }),
});
const OPTION_RULES = Object.freeze({
  min_text_length: Object.freeze({ min: 0, integer: true }),
  short_line_split_factor: Object.freeze({ min: 0.1 }),
  non_formula_line_iou_threshold: Object.freeze({ min: 0, max: 1 }),
  figure_table_protection_threshold: Object.freeze({ min: 0, max: 1 }),
  primary_font_family: Object.freeze({ choices: Object.freeze(['serif', 'sans-serif', 'script']) }),
});

export class AdvancedOptionsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AdvancedOptionsError';
    this.code = 'INVALID_ADVANCED_OPTIONS';
    this.status = 422;
  }
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function optionFor(options, id) {
  return options.find((option) => option?.id === id);
}

function sameValue(left, right, type) {
  if (type === 'number') return Object.is(Number(left), Number(right));
  if (type === 'boolean') return left === right;
  return left === right;
}

function normalizeSchema(id, options) {
  const allowed = SAFE_OPTION_SETS[id];
  if (!allowed) return [];
  const seen = new Set();
  return (Array.isArray(options) ? options : [])
    .filter((option) => {
      if (
        !option ||
        typeof option.id !== 'string' ||
        !allowed.has(option.id) ||
        seen.has(option.id)
      )
        return false;
      seen.add(option.id);
      return true;
    })
    .map((option) => {
      const rule = OPTION_RULES[option.id] || {};
      const next = { ...option };
      if (rule.choices) next.choices = [...rule.choices];
      if (rule.min !== undefined) next.min = rule.min;
      if (rule.max !== undefined) next.max = rule.max;
      if (rule.integer) next.integer = true;
      if (EFFECTIVE_DEFAULTS[id] && Object.hasOwn(EFFECTIVE_DEFAULTS[id], option.id))
        next.default = EFFECTIVE_DEFAULTS[id][option.id];
      return next;
    });
}

export function decorateAdvancedOptions(id, options) {
  return normalizeSchema(id, options).map((option) => ({
    ...option,
    choices: option.choices ? [...option.choices] : option.choices,
  }));
}

export function effectiveOptionDefault(id, option) {
  if (id && EFFECTIVE_DEFAULTS[id] && Object.hasOwn(EFFECTIVE_DEFAULTS[id], option.id))
    return EFFECTIVE_DEFAULTS[id][option.id];
  return option.default;
}

export function effectiveAdvancedDefaults(id, options) {
  const schema = decorateAdvancedOptions(id, options),
    defaults = {};
  for (const option of schema) defaults[option.id] = effectiveOptionDefault(id, option);
  return defaults;
}

function validateValue(id, option, value) {
  if (option.type === 'boolean') {
    if (typeof value !== 'boolean')
      throw new AdvancedOptionsError(`Advanced option ${option.id} must be a boolean.`);
  } else if (option.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new AdvancedOptionsError(`Advanced option ${option.id} must be a finite number.`);
    if (option.integer && !Number.isInteger(value))
      throw new AdvancedOptionsError(`Advanced option ${option.id} must be an integer.`);
    if (option.min !== undefined && value < option.min)
      throw new AdvancedOptionsError(
        `Advanced option ${option.id} must be at least ${option.min}.`,
      );
    if (option.max !== undefined && value > option.max)
      throw new AdvancedOptionsError(`Advanced option ${option.id} must be at most ${option.max}.`);
  } else if (option.type === 'string') {
    if (typeof value !== 'string')
      throw new AdvancedOptionsError(`Advanced option ${option.id} must be a string.`);
  } else throw new AdvancedOptionsError(`Advanced option ${option.id} has an unsupported type.`);
  if (Array.isArray(option.choices) && !option.choices.some((choice) => Object.is(choice, value)))
    throw new AdvancedOptionsError(`Advanced option ${option.id} has an invalid choice.`);
  return value;
}

export function validateAdvancedOptions(id, advancedOptions, options) {
  const schema = decorateAdvancedOptions(id, options);
  if (advancedOptions === undefined) advancedOptions = {};
  if (!isRecord(advancedOptions))
    throw new AdvancedOptionsError('advancedOptions must be an object.');
  const canonical = {};
  for (const key of Object.keys(advancedOptions).sort()) {
    const option = optionFor(schema, key);
    if (!option) throw new AdvancedOptionsError(`Unknown advanced option: ${key}.`);
    const value = validateValue(id, option, advancedOptions[key]);
    if (!sameValue(value, effectiveOptionDefault(id, option), option.type)) canonical[key] = value;
  }
  return canonical;
}

export function advancedOptionsToArgs(id, advancedOptions, options) {
  const schema = decorateAdvancedOptions(id, options);
  const overrides = validateAdvancedOptions(id, advancedOptions, schema);
  const args = [];
  for (const option of schema) {
    const value = Object.hasOwn(overrides, option.id)
      ? overrides[option.id]
      : effectiveOptionDefault(id, option);
    if (sameValue(value, effectiveOptionDefault(id, option), option.type)) {
      if (option.type === 'boolean' && option.flagValue === effectiveOptionDefault(id, option))
        args.push(option.flag);
      if (id === 'pdf_math_fast' && option.id === 'backend')
        args.push(`${option.flag}=${String(value)}`);
      continue;
    }
    if (option.type === 'boolean') {
      if (value === option.flagValue) args.push(option.flag);
      continue;
    }
    args.push(`${option.flag}=${String(value)}`);
  }
  return { overrides, args };
}

export function canonicalAdvancedOptions(id, advancedOptions, options) {
  return validateAdvancedOptions(id, advancedOptions, options);
}
export function buildAdvancedArgs(id, advancedOptions, options) {
  return advancedOptionsToArgs(id, advancedOptions, options);
}

// Default translation keeps the pre-Advanced startup path. Importing the
// installed parser is only necessary when validating explicit overrides.
export async function translationAdvancedArgs(id, advancedOptions = {}, loadSchema) {
  if (!isRecord(advancedOptions))
    throw new AdvancedOptionsError('advancedOptions must be an object.');
  if (Object.keys(advancedOptions).length === 0)
    return { overrides: {}, args: id === 'pdf_math_precise' ? ['--no-auto-extract-glossary'] : [] };
  const schema = await loadSchema();
  if (schema.reason) throw Error(schema.reason);
  return advancedOptionsToArgs(id, advancedOptions, schema.options);
}

export { SAFE_OPTION_IDS, EFFECTIVE_DEFAULTS, OPTION_RULES };
