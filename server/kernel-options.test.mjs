import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advancedOptionsToArgs,decorateAdvancedOptions,validateAdvancedOptions} from './kernel-options.mjs';

const fastOptions=[
 {id:'vfont',flag:'--vfont',type:'string',default:'',help:'font',label:'Vfont'},
 {id:'vchar',flag:'--vchar',type:'string',default:'',help:'character',label:'Vchar'}
];

const preciseOptions=[
 ['min_text_length','--min-text-length','number',5,{integer:true}],
 ['custom_system_prompt','--custom-system-prompt','string',null,{}],
 ['no_auto_extract_glossary','--no-auto-extract-glossary','boolean',false,{flagValue:true}],
 ['primary_font_family','--primary-font-family','string',null,{}],
 ['formular_font_pattern','--formular-font-pattern','string',null,{}],
 ['formular_char_pattern','--formular-char-pattern','string',null,{}],
 ['split_short_lines','--split-short-lines','boolean',false,{flagValue:true}],
 ['short_line_split_factor','--short-line-split-factor','number',0.8,{}],
 ['skip_clean','--skip-clean','boolean',false,{flagValue:true}],
 ['disable_rich_text_translate','--disable-rich-text-translate','boolean',false,{flagValue:true}],
 ['enhance_compatibility','--enhance-compatibility','boolean',false,{flagValue:true}],
 ['translate_table_text','--translate-table-text','boolean',true,{flagValue:false}],
 ['skip_scanned_detection','--skip-scanned-detection','boolean',false,{flagValue:true}],
 ['ocr_workaround','--ocr-workaround','boolean',false,{flagValue:true}],
 ['auto_enable_ocr_workaround','--auto-enable-ocr-workaround','boolean',false,{flagValue:true}],
 ['no_merge_alternating_line_numbers','--no-merge-alternating-line-numbers','boolean',false,{flagValue:true}],
 ['no_remove_non_formula_lines','--no-remove-non-formula-lines','boolean',false,{flagValue:true}],
 ['non_formula_line_iou_threshold','--non-formula-line-iou-threshold','number',0.9,{}],
 ['figure_table_protection_threshold','--figure-table-protection-threshold','number',0.9,{}],
 ['skip_formula_offset_calculation','--skip-formula-offset-calculation','boolean',false,{flagValue:true}]
].map(([id,flag,type,defaultValue,extra])=>({id,flag,type,default:defaultValue,help:id,label:id,...extra}));

test('effective precise schema preserves app defaults and argparse false actions',()=>{
 const schema=decorateAdvancedOptions('pdf_math_precise',preciseOptions);
 assert.equal(schema.length,20);
 assert.deepEqual(schema.find(option=>option.id==='primary_font_family').choices,['serif','sans-serif','script']);
 assert.equal(schema.find(option=>option.id==='no_auto_extract_glossary').default,true);
 const table=schema.find(option=>option.id==='translate_table_text');
 assert.equal(table.default,true);
 assert.equal(table.flagValue,false);
 assert.equal(schema.find(option=>option.id==='min_text_length').min,0);
 assert.equal(schema.find(option=>option.id==='min_text_length').integer,true);
 assert.equal(schema.find(option=>option.id==='non_formula_line_iou_threshold').min,0);
 assert.equal(schema.find(option=>option.id==='non_formula_line_iou_threshold').max,1);
});

test('advanced args use effective boolean values and equals string arguments',()=>{
 const schema=decorateAdvancedOptions('pdf_math_precise',preciseOptions);
 const defaults=advancedOptionsToArgs('pdf_math_precise',{},schema);
 assert.deepEqual(defaults.overrides,{});
 assert.ok(defaults.args.includes('--no-auto-extract-glossary'));
 assert.ok(!defaults.args.includes('--translate-table-text'));

 const overrides=advancedOptionsToArgs('pdf_math_precise',{
  no_auto_extract_glossary:false,
  translate_table_text:false,
  custom_system_prompt:'--looks-like-an-option'
 },schema);
 assert.deepEqual(overrides.overrides,{custom_system_prompt:'--looks-like-an-option',no_auto_extract_glossary:false,translate_table_text:false});
 assert.ok(!overrides.args.includes('--no-auto-extract-glossary'));
 assert.ok(overrides.args.includes('--translate-table-text'));
 assert.ok(overrides.args.includes('--custom-system-prompt=--looks-like-an-option'));
});

test('advanced validation rejects unknown, mistyped, non-integer, and out-of-range values',()=>{
 const schema=decorateAdvancedOptions('pdf_math_precise',preciseOptions);
 assert.throws(()=>validateAdvancedOptions('pdf_math_precise',{unknown_option:true},schema),error=>error.code==='INVALID_ADVANCED_OPTIONS'&&/Unknown advanced option/.test(error.message));
 assert.throws(()=>validateAdvancedOptions('pdf_math_precise',{translate_table_text:'false'},schema),/must be a boolean/);
 assert.throws(()=>validateAdvancedOptions('pdf_math_precise',{min_text_length:1.5},schema),/must be an integer/);
 assert.throws(()=>validateAdvancedOptions('pdf_math_precise',{non_formula_line_iou_threshold:1.1},schema),/at most 1/);
 assert.throws(()=>validateAdvancedOptions('pdf_math_precise',{primary_font_family:'monospace'},schema),/invalid choice/);
});

test('fast options remain limited to the two parser options',()=>{
 const schema=decorateAdvancedOptions('pdf_math_fast',fastOptions);
 assert.deepEqual(schema.map(option=>option.id),['vfont','vchar']);
 assert.deepEqual(advancedOptionsToArgs('pdf_math_fast',{vfont:'a^'},schema).args,['--vfont=a^']);
});
