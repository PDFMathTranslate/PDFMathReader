import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {t,setUILanguage,uiLanguage,SUPPORTED_UI_LANGUAGES,UI_MESSAGES} from '../src/i18n.mjs';
import {menuLabel} from '../electron/menu-i18n.mjs';
test('interface language defaults to English, falls back safely and interpolates page values',()=>{
 assert.equal(uiLanguage.value,'en');
 for(const locale of SUPPORTED_UI_LANGUAGES){setUILanguage(locale);assert.ok(t('toolbar.pageOf',{current:3,total:19}).includes('3'));assert.ok(t('toolbar.pageOf',{current:3,total:19}).includes('19'));assert.equal(menuLabel('PDFMathReader',locale),'PDFMathReader');assert.ok(menuLabel('Go to 30%',locale).includes('30%'));}
 assert.equal(setUILanguage('unsupported'),'en');
});
test('visible interface translation keys resolve in every supported language',async()=>{
 const sources=await Promise.all(['App.vue','AppearanceSettings.vue','AdvancedSettings.vue','TranslationServiceOptions.vue'].map(name=>readFile(new URL('../src/'+name,import.meta.url),'utf8')));
 const keys=new Set(sources.flatMap(source=>[...source.matchAll(/\bt\(['"]([^'"]+)['"]/g)].map(match=>match[1]).filter(key=>!key.endsWith('.'))));
 for(const locale of SUPPORTED_UI_LANGUAGES){setUILanguage(locale);for(const key of keys)assert.notEqual(t(key),key,`${locale}: ${key}`);}
 setUILanguage('en');
});

test('all seven locales have complete dictionaries and retain interpolation parameters',()=>{
 const flatten=(object,prefix='')=>Object.entries(object).flatMap(([key,value])=>typeof value==='string'?[[prefix+key,value]]:flatten(value,prefix+key+'.'));
 const english=flatten(UI_MESSAGES.en);
 assert.deepEqual(SUPPORTED_UI_LANGUAGES,['en','zh-CN','zh-TW','fr','es','ja','ko']);
 for(const locale of SUPPORTED_UI_LANGUAGES){
  const localized=new Map(flatten(UI_MESSAGES[locale]));
  for(const [key,value] of english){
   assert.ok(localized.has(key),`${locale} missing ${key}`);
   const placeholders=text=>[...text.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(match=>match[1]).sort();
   assert.deepEqual(placeholders(localized.get(key)),placeholders(value),`${locale}: ${key}`);
  }
  setUILanguage(locale);
  for(const key of ['settings.sourceLanguage','settings.translationLanguage','settings.promptFile','settings.systemPrompt','appearance.interfaceLanguage'])assert.notEqual(t(key),key);
  if(locale!=='en')assert.notEqual(menuLabel('File',locale),'File');
 }
 setUILanguage('en');
});
