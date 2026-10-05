<script setup>
import { computed, ref, shallowRef, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { t, uiLanguage } from './i18n.mjs';
import { MacButton, MacSearchField, platform } from './platform-controls.mjs';
const CategoryButton = platform === 'win32' ? MacButton : 'button';
const props = defineProps({
  section: { type: String, default: 'general' },
  nativeWindow: { type: Boolean, default: false },
  effectiveTranslation: { type: String, default: '' },
});
const emit = defineEmits(['update:section', 'close', 'legacy']);
const navigation = ref(),
  content = ref(),
  search = ref(''),
  submenus = shallowRef([]);
const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase().trim();
const words = {
  en: ['General', 'Providers', 'Search', 'Previous settings'],
  'zh-CN': ['通用', '翻译服务', '搜索设置', '旧版设置'],
  'zh-TW': ['一般', '翻譯服務', '搜尋設定', '舊版設定'],
  ja: ['一般', '翻訳サービス', '設定を検索', '以前の設定'],
  ko: ['일반', '번역 서비스', '설정 검색', '이전 설정'],
  fr: ['Général', 'Services de traduction', 'Rechercher les réglages', 'Anciens réglages'],
  es: ['General', 'Servicios de traducción', 'Buscar ajustes', 'Ajustes anteriores'],
};
const labels = computed(() => words[uiLanguage.value] || words.en);
const sections = computed(() => [
  { id: 'general', label: labels.value[0], symbol: 'gearshape.fill' },
  { id: 'appearance', label: t('appearance.section'), symbol: 'circle.lefthalf.filled' },
  { id: 'translation', label: t('settings.translation'), symbol: 'character.book.closed.fill' },
  { id: 'providers', label: labels.value[1], symbol: 'network' },
  { id: 'kernel', label: t('settings.kernel'), symbol: 'cpu.fill' },
  {
    id: 'performance',
    label:
      {
        en: 'Performance',
        'zh-CN': '性能',
        'zh-TW': '效能',
        ja: 'パフォーマンス',
        ko: '성능',
        fr: 'Performances',
        es: 'Rendimiento',
      }[uiLanguage.value] || 'Performance',
    symbol: 'gauge.with.dots.needle.67percent',
  },
  { id: 'about', label: t('settings.about'), symbol: 'info.circle.fill' },
]);
const visibleSections = computed(() => {
  const query = normalize(search.value);
  if (!query) return sections.value;
  return sections.value.flatMap((section) => [
    ...(normalize(section.label).includes(query) ? [section] : []),
    ...submenus.value
      .filter((item) => item.section === section.id && normalize(item.label).includes(query))
      .map((item) => ({ ...item, symbol: section.symbol, parentLabel: section.label })),
  ]);
});
// Index rendered captions only, never input values or saved credentials. Hidden
// category pages stay mounted, so their localized submenus are searchable too.
function indexSubmenus() {
  const entries = [];
  for (const page of content.value?.querySelectorAll('.workspace-page') || []) {
    const section = page.dataset.settingsPage;
    const seen = new Set();
    for (const target of page.querySelectorAll(
      'h3,summary,.setting-row,.appearance-row,.provider-list-item',
    )) {
      const caption = target.matches('.provider-list-item')
        ? target.querySelector('.provider-list-name')
        : target.matches('.setting-row,.appearance-row')
          ? target.querySelector(':scope > span,:scope > label')
          : target;
      const label = caption?.textContent?.replace(/\s+/g, ' ').trim();
      if (!label || seen.has(label)) continue;
      seen.add(label);
      entries.push({ id: `${section}:${entries.length}`, section, label, target });
    }
  }
  submenus.value = entries;
}
async function chooseResult(item) {
  if (!item.target) {
    choose(item.id);
    return;
  }
  choose(item.section);
  await nextTick();
  const target = item.target;
  if (!target.isConnected) return;
  for (
    let ancestor = target;
    ancestor && ancestor !== content.value;
    ancestor = ancestor.parentElement
  )
    if (ancestor.tagName === 'DETAILS') ancestor.open = true;
  if (target.matches('.provider-list-item')) target.click();
  await nextTick();
  target.scrollIntoView({ block: 'center', behavior: 'instant' });
  // Focus the destination without activating a switch or changing a preference.
  const focusTarget = target.matches('button,summary')
    ? target
    : target.querySelector('button,input,select,textarea,[tabindex]') || target;
  if (
    !focusTarget.hasAttribute('tabindex') &&
    !focusTarget.matches('button,input,select,textarea,summary')
  )
    focusTarget.setAttribute('tabindex', '-1');
  focusTarget.focus({ preventScroll: true });
}
let contentObserver;
const title = computed(() => sections.value.find((item) => item.id === props.section)?.label);
function choose(id) {
  emit('update:section', id);
}
function navKey(event, index) {
  const items = visibleSections.value;
  if (!items.length) return;
  let target = index;
  if (event.key === 'ArrowDown') target = (index + 1) % items.length;
  else if (event.key === 'ArrowUp') target = (index + items.length - 1) % items.length;
  else if (event.key === 'Home') target = 0;
  else if (event.key === 'End') target = items.length - 1;
  else return;
  event.preventDefault();
  chooseResult(items[target]);
  nextTick(() => navigation.value?.querySelectorAll('.category-button')[target]?.focus());
}
let previousFocus;
function keys(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
  }
}
onMounted(() => {
  indexSubmenus();
  contentObserver = new MutationObserver(indexSubmenus);
  contentObserver.observe(content.value, { childList: true, subtree: true, characterData: true });
  previousFocus = document.activeElement;
  navigation.value?.querySelector('[aria-current="page"]')?.focus();
  document.addEventListener('keydown', keys);
});
onBeforeUnmount(() => {
  contentObserver?.disconnect();
  document.removeEventListener('keydown', keys);
  if (previousFocus?.isConnected) previousFocus.focus();
});
</script>
<template>
  <section
    class="settings settings-workspace"
    :class="{ 'native-settings-window': nativeWindow }"
    role="dialog"
    :aria-label="t('settings.title')"
    :data-section="section"
  >
    <aside class="settings-categories">
      <label v-if="nativeWindow" class="sidebar-search"
        ><span
          class="system-icon"
          aria-hidden="true"
          style="--symbol: url('/symbols/magnifyingglass.png')"
        ></span
        ><MacSearchField
          v-if="platform === 'win32'"
          v-model="search"
          :placeholder="labels[2]"
          :aria-label="labels[2]" />
        <input
          v-else
          v-model="search"
          type="search"
          :placeholder="labels[2]"
          :aria-label="labels[2]"
      /></label>
      <nav ref="navigation" :aria-label="t('settings.title')">
        <CategoryButton
          v-for="(item, index) in visibleSections"
          :key="item.id"
          class="category-button"
          :data-settings-category="item.target ? undefined : item.id"
          :data-settings-result="item.target ? item.section : undefined"
          :title="item.parentLabel ? `${item.parentLabel} › ${item.label}` : item.label"
          :aria-current="section === item.id ? 'page' : undefined"
          @click="chooseResult(item)"
          @keydown="navKey($event, index)"
        >
          <span class="category-icon" :data-category="item.id" aria-hidden="true"
            ><span
              class="system-icon"
              :style="{ '--symbol': `url('/symbols/${item.symbol}.png')` }"
            ></span></span
          ><span class="category-label"
            >{{ item.label
            }}<small v-if="item.parentLabel" class="result-parent">{{
              item.parentLabel
            }}</small></span
          >
        </CategoryButton>
      </nav>
      <p class="effective-translation-summary" :title="effectiveTranslation" role="status">
        {{ effectiveTranslation }}
      </p>
    </aside>
    <main ref="content" class="settings-main">
      <header
        v-if="!nativeWindow || section !== 'providers'"
        class="settings-heading workspace-heading"
      >
        <h2 v-if="section !== 'providers'">{{ title }}</h2>
        <div class="workspace-actions">
          <MacSearchField
            v-if="!nativeWindow && platform === 'win32'"
            v-model="search"
            :placeholder="labels[2]"
            :aria-label="labels[2]"
          />
          <input
            v-else-if="!nativeWindow"
            v-model="search"
            type="search"
            :placeholder="labels[2]"
            :aria-label="labels[2]"
          /><MacButton v-if="!nativeWindow" :aria-label="t('settings.close')" @click="emit('close')"
            ><span
              class="system-icon"
              aria-hidden="true"
              style="--symbol: url('/symbols/xmark.png')"
            ></span
          ></MacButton>
        </div>
      </header>
      <div
        v-for="item in sections"
        v-show="section === item.id"
        :key="item.id"
        :data-settings-page="item.id"
        class="workspace-page"
        :class="{ 'provider-page': item.id === 'providers' }"
      >
        <slot :name="item.id" />
      </div>
    </main>
  </section>
</template>
<style scoped>
fluent-button.category-button {
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  padding: 0;
  display: block;
  width: 100%;
}
fluent-button.category-button::part(content) {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  justify-content: flex-start;
  gap: 9px;
  padding: 9px 10px;
}
fluent-button.category-button[aria-current='page'] {
  background: var(--accent-soft);
  color: var(--text);
}
fluent-button.category-button[aria-current='page']::part(content) {
  background: transparent;
  color: inherit;
}
.workspace-actions :deep(fluent-text-input) {
  width: 180px;
}
.workspace-actions :deep(fluent-button) {
  width: 30px;
  min-width: 30px;
  height: 32px;
  padding: 0;
  flex: none;
}
.sidebar-search :deep(fluent-text-input) {
  width: 100%;
  min-width: 0;
}
.result-parent {
  display: block;
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 400;
}
.category-button:has(.result-parent) .category-label {
  white-space: normal;
}

section.settings.settings-workspace[data-section] {
  box-sizing: border-box;
  inset: calc(var(--toolbar-height) + 12px) 0 auto;
  margin: 0 auto;
  width: min(1080px, calc(100vw - 36px));
  height: min(740px, calc(100dvh - var(--toolbar-height) - var(--statusbar-height) - 34px));
  max-height: none;
  padding: 0;
  display: grid;
  grid-template-columns: 114px minmax(0, 1fr);
  gap: 0;
  overflow: hidden;
  border: 0;
  border-radius: 26px;
  background: var(--chrome);
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  animation: none;
  box-shadow:
    0 18px 70px #0003,
    0 2px 9px #0002;
}
section.settings.settings-workspace.native-settings-window[data-section] {
  inset: 0;
  margin: 0;
  width: 100%;
  height: 100%;
  max-height: none;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
  grid-template-columns: clamp(132px, 18.78%, 180px) minmax(0, 1fr);
  transform: none;
  transition: none;
}
.settings-categories {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 22px 10px 12px;
  background: color-mix(in srgb, var(--chrome) 90%, var(--text) 5%);
  border-right: 1px solid var(--chrome-divider);
}
.native-settings-window .settings-categories {
  padding: 60px 12px 14px;
  background: color-mix(in srgb, var(--chrome) 70%, transparent);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-app-region: drag;
}
.workspace-title {
  padding: 0 12px 24px;
  font-size: 13px;
  font-weight: 650;
}
.native-settings-window .workspace-title {
  padding-inline: 6px;
}
.workspace-title span {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-secondary);
}
.settings-categories nav {
  display: grid;
  gap: 3px;
  overflow: auto;
  overflow-x: hidden;
}
.category-button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 32px;
  padding: 5px 9px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  text-align: left;
  font-size: 13px;
}
.category-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.category-button:hover {
  background: var(--chrome-hover);
}
.category-button[aria-current='page'] {
  background: var(--accent);
  color: var(--text-on-accent);
  font-weight: 600;
}
.category-button:focus-visible,
.effective-translation-summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
} /* Palette follows the reference System Settings tiles: General gray,
   Appearance black, network blue, and Focus purple. */
.category-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  corner-shape: round;
  color: white;
  --icon-top: #a4a4a8;
  --icon-bottom: #858589;
  background: linear-gradient(180deg, var(--icon-top), var(--icon-bottom));
  box-shadow:
    inset 0 1px 0 #ffffff30,
    inset 0 -1px 0 #00000012,
    0 1px 2px #00000030;
}
.category-icon[data-category='appearance'] {
  --icon-top: #303033;
  --icon-bottom: #111113;
}
.category-icon[data-category='translation'],
.category-icon[data-category='providers'] {
  --icon-top: #00aaff;
  --icon-bottom: #007aff;
}
.category-icon[data-category='about'] {
  --icon-top: #8065ff;
  --icon-bottom: #6549f5;
}
.category-icon .system-icon {
  display: block;
  width: 15px;
  height: 15px;
  color: #fff;
}
.effective-translation-summary {
  margin: auto 0 0;
  padding: 12px 10px 2px;
  color: var(--text-secondary);
  text-align: left;
  font-size: 11px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.settings-main {
  background: var(--chrome-solid);
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  -webkit-app-region: no-drag;
}
.workspace-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  height: 64px;
  padding: 0 22px;
  border-bottom: 1px solid var(--chrome-divider);
}
.native-settings-window .workspace-heading {
  height: 64px;
  padding-inline: 28px;
  background: var(--chrome-solid);
  -webkit-app-region: drag;
}
.workspace-heading h2 {
  font-size: 18px;
}
.workspace-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.settings .workspace-actions input {
  width: 180px;
  min-height: 28px;
  margin: 0;
  font-size: 12px;
}
.workspace-actions button {
  padding: 5px;
  width: 26px;
  height: 26px;
}
.workspace-actions .system-icon {
  width: 13px;
  height: 13px;
}
.native-settings-window
  :is(
    nav,
    button,
    input,
    select,
    textarea,
    a,
    summary,
    [role='button'],
    [role='option'],
    [role='tab'],
    [role='switch'],
    [role='slider'],
    [role='combobox'],
    .macvue-button,
    .macvue-switch,
    .macvue-segmented,
    .macvue-field,
    .macvue-pop-up-button,
    fluent-button,
    fluent-select
  ) {
  -webkit-app-region: no-drag;
}
.workspace-page {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 28px 32px;
  overscroll-behavior: contain;
}
.native-settings-window .workspace-page {
  padding: 16px 24px 28px;
}
.workspace-page.provider-page {
  padding: 0;
  overflow: hidden;
  display: flex;
}
section.settings.settings-workspace .workspace-page :deep(.settings-section) {
  gap: 12px;
  padding: 14px 16px;
  margin: 0;
  border: 1px solid color-mix(in srgb, var(--chrome-border) 70%, transparent);
  border-radius: 18px;
  background: color-mix(in srgb, var(--chrome-solid) 94%, var(--text) 3%);
  box-shadow: 0 1px 2px #0000000a;
}
section.settings.settings-workspace .workspace-page :deep(.settings-section + .settings-section) {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 0;
}
section.settings.settings-workspace
  .workspace-page
  :deep(.settings-section .advanced-settings.settings-section) {
  margin-top: 4px;
  padding: 16px 0 0;
  border: 0;
  border-top: 1px solid var(--chrome-divider);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.workspace-page :deep(.setting-row) {
  min-height: 32px;
  gap: 16px;
}
.workspace-page :deep(.setting-row + .setting-row) {
  padding-top: 10px;
}
.workspace-page :deep(.muted) {
  line-height: 1.55;
}
.workspace-page :deep(.advanced-options) {
  margin-top: 18px;
  display: grid;
  gap: 18px;
}
.workspace-page :deep(.appearance-row) {
  gap: 28px;
}
.workspace-page :deep(.appearance-section) {
  max-width: none;
  width: 100%;
  min-width: 0;
}
.workspace-page :deep(.kernel-setting) {
  max-width: none;
  width: 100%;
  min-width: 0;
}
.workspace-page :deep(.kernel-mode-row) {
  max-width: none;
  width: 100%;
}
.workspace-page :deep(.parallel-settings) {
  max-width: none;
  width: 100%;
  min-width: 0;
}

section.settings-workspace :deep(.macvue-segmented-pill) {
  display: none;
}
section.settings-workspace :deep(.macvue-segment) {
  flex: 1 1 0;
  min-width: 0;
}
section.settings-workspace :deep(.macvue-segment[data-state='on']) {
  background: var(--accent);
  color: var(--text-on-accent);
}

section.settings.settings-workspace label.sidebar-search {
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 7px;
  flex: none;
  margin: 0 0 18px;
  padding: 0 10px;
  height: 30px;
  border: 1px solid var(--chrome-border);
  border-radius: 999px !important;
  corner-shape: round;
  background: var(--chrome-raised);
  box-shadow: inset 0 1px 2px #00000005;
}
section.settings.settings-workspace .sidebar-search .system-icon {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  color: var(--text-secondary);
}
section.settings-workspace .sidebar-search input {
  width: 100%;
  min-width: 0;
  height: 28px;
  min-height: 0;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  font: inherit;
  font-size: 13px;
  outline: none;
}
.sidebar-search:focus-within {
  outline: 3px solid var(--accent-soft);
  border-color: var(--accent);
}
section.settings-workspace .sidebar-search {
  -webkit-app-region: no-drag;
}
section.settings.settings-workspace .workspace-page :deep(.settings-section h3) {
  font-size: 13px;
}
/* Match the regular macOS NSSwitch metrics supplied by MacVue. */
section.settings.settings-workspace :deep(.macvue-switch) {
  flex-shrink: 0;
  --_macvue-switch-track-width: 54px;
  --_macvue-switch-track-height: 24px;
  --_macvue-switch-thumb-width: 32px;
  --_macvue-switch-thumb-height: 20px;
  --_macvue-switch-thumb-inset: 2px;
  --_macvue-switch-glass-lens-width: 36px;
  --_macvue-switch-glass-lens-height: 24px;
}
section.settings.settings-workspace :deep(.macvue-field) {
  height: 28px;
  min-height: 28px;
  --_macvue-field-radius: 8px;
  border-radius: 8px;
}
section.settings.settings-workspace :deep(.macvue-field-input) {
  font-size: 13px;
  border-radius: 8px;
  min-height: 0;
}
section.settings.settings-workspace :deep(.macvue-pop-up-button) {
  min-height: 26px;
  font-size: 13px;
  border-radius: 8px;
}
section.settings.settings-workspace :deep(.macvue-segmented) {
  height: 30px;
  min-height: 30px;
  max-height: 30px;
  border-radius: 10px;
}
section.settings.settings-workspace :deep(.macvue-segmented > .macvue-segment) {
  height: 26px;
  min-height: 26px;
  max-height: 26px;
  border-radius: 8px;
  font-size: 13px;
}
section.settings.settings-workspace :deep(.appearance-row),
section.settings.settings-workspace :deep(.appearance-effects) {
  grid-template-columns: minmax(100px, 1fr) minmax(0, 2.4fr);
  gap: 18px;
  align-items: start;
}
section.settings.settings-workspace :deep(.appearance-options) {
  justify-content: flex-end;
  gap: 12px;
}
section.settings.settings-workspace :deep(.appearance-preview) {
  width: 74px;
  height: 50px;
  border-radius: 8px;
}
section.settings.settings-workspace :deep(.appearance-choice) {
  font-size: 12px;
  gap: 7px;
}
section.settings.settings-workspace :deep(.color-options) {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 11px;
  padding: 6px 3px;
}
section.settings.settings-workspace :deep(.color-choice) {
  width: 22px;
  gap: 0;
}
section.settings.settings-workspace :deep(.color-swatch) {
  width: 22px;
  height: 22px;
}
section.settings.settings-workspace :deep(.color-choice > span:last-child) {
  display: none;
}
section.settings.settings-workspace :deep(.provider-list-item) {
  grid-template-columns: 22px minmax(0, 1fr) 8px;
  min-height: 34px;
  padding: 6px 7px;
  gap: 8px;
}
section.settings.settings-workspace :deep(.provider-list-item .provider-icon) {
  width: 22px;
  height: 22px;
  --provider-icon-size: 22px;
}
section.settings.settings-workspace :deep(.provider-detail) {
  padding: 18px 20px;
}
section.settings.settings-workspace :deep(.setting-row > .macvue-pop-up-button-anchor) {
  margin-inline-start: auto;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 65%;
}
section.settings.settings-workspace :deep(.appearance-row > .macvue-pop-up-button-anchor) {
  justify-self: end;
  min-width: 0;
  max-width: 100%;
}
section.settings.settings-workspace :deep(.provider-field:has(> .macvue-pop-up-button-anchor)) {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}
section.settings.settings-workspace :deep(.macvue-pop-up-button-anchor) {
  display: flex;
  justify-content: flex-end;
}
section.settings.settings-workspace :deep(.translation-mode-select) {
  width: max-content;
  margin-inline-start: auto;
}
section.settings.settings-workspace :deep(.parallel-settings) {
  border-top: 0;
  padding-top: 0;
}
section.settings.settings-workspace :deep(.provider-use-button) {
  box-sizing: border-box;
  height: 28px;
  min-height: 28px;
  padding: 0 16px;
  border-radius: 999px;
  corner-shape: round;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  box-shadow:
    inset 0 1px 0 #ffffff24,
    0 1px 2px #00000012;
}
/* Section headings sit above their grouped controls, as in System Settings. */
section.settings.settings-workspace .workspace-page :deep(.settings-section:has(> h3)),
section.settings.settings-workspace .workspace-page :deep(.settings-section:has(> summary)) {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  gap: 10px;
}
section.settings.settings-workspace .workspace-page :deep(.settings-section > h3),
section.settings.settings-workspace .workspace-page :deep(.settings-section > summary) {
  margin: 0;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 600;
}
section.settings.settings-workspace .workspace-page :deep(.settings-section-body),
section.settings.settings-workspace .workspace-page :deep(.settings-section > .advanced-options) {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--chrome-border) 70%, transparent);
  border-radius: 18px;
  background: color-mix(in srgb, var(--chrome-solid) 94%, var(--text) 3%);
  box-shadow: 0 1px 2px #0000000a;
}
section.settings.settings-workspace .workspace-page :deep(.settings-section > .advanced-options) {
  margin-top: 10px;
}
section.settings.settings-workspace
  .workspace-page
  :deep(.settings-section + .settings-section:has(> h3)),
section.settings.settings-workspace
  .workspace-page
  :deep(.settings-section + .settings-section:has(> summary)) {
  margin-top: 22px;
  padding-top: 0;
}
section.settings.settings-workspace
  .workspace-page
  :deep(.settings-section-body:has(> .setting-row):not(:has(> :not(.setting-row)))) {
  gap: 0;
  padding-block: 4px;
}
section.settings.settings-workspace
  .workspace-page
  :deep(.settings-section-body:has(> .setting-row):not(:has(> :not(.setting-row))) > .setting-row) {
  min-height: 44px;
}
/* Keep the developer switch, its caption and maintenance controls compact. */
section.settings.settings-workspace
  .workspace-page
  :deep(.developer-options > .settings-section-body) {
  gap: 4px;
  padding-block: 8px;
}
section.settings.settings-workspace
  .workspace-page
  :deep(.developer-options > .settings-section-body > .muted) {
  margin: 0;
  padding-bottom: 4px;
}
section.settings.settings-workspace .workspace-page :deep(.developer-kernel-actions) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--chrome-divider);
}
section.settings.settings-workspace
  .workspace-page
  :deep(.developer-kernel-actions .advanced-kernel-update) {
  margin: 0;
  padding: 0;
  border: 0;
}
section.settings.settings-workspace
  .workspace-page
  :deep(.advanced-option:not(:has(~ .advanced-option))) {
  border-bottom: 0;
}
section.settings.settings-workspace
  .workspace-page
  :deep(.developer-kernel-actions .advanced-kernel-update:not(.bundled)) {
  display: contents;
}
section.settings.settings-workspace
  .workspace-page
  :deep(.developer-kernel-actions .macvue-button) {
  width: auto;
  max-width: 100%;
  min-height: 28px;
  height: auto;
  margin: 0;
  padding: 6px 16px;
  border-radius: 999px;
  corner-shape: round;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.25;
  white-space: normal;
}
section.settings.settings-workspace
  .workspace-page
  :deep(.performance-resources .settings-section-body) {
  gap: 0;
  padding-block: 4px;
}
section.settings.settings-workspace
  .workspace-page
  :deep(.performance-resources .settings-section-body > .muted) {
  margin: 0;
  padding: 0 0 8px;
  line-height: 1.55;
}
/* Keep separators centered between controls rather than adding space only above them. */
section.settings.settings-workspace .workspace-page :deep(.settings-section-body .setting-row) {
  box-sizing: border-box;
  min-height: 40px;
  padding: 8px 0;
  margin: 0;
  gap: 16px;
}
section.settings.settings-workspace
  .workspace-page
  :deep(.settings-section-body .setting-row + .setting-row) {
  padding: 8px 0;
}
section.settings.settings-workspace
  .workspace-page
  :deep(.interface-section > .settings-section-body),
section.settings.settings-workspace
  .workspace-page
  :deep(.effects-section > .settings-section-body) {
  gap: 0;
  padding-block: 4px;
}
section.settings.settings-workspace .workspace-page :deep(.interface-section .appearance-row) {
  min-height: 40px;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
}
section.settings.settings-workspace
  .workspace-page
  :deep(.interface-section .appearance-row > span) {
  padding: 0;
}
@media (max-width: 800px) {
  section.settings.settings-workspace :deep(.appearance-row),
  section.settings.settings-workspace :deep(.appearance-effects) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  section.settings.settings-workspace :deep(.appearance-options),
  section.settings.settings-workspace :deep(.color-options) {
    justify-content: flex-start;
  }
  .native-settings-window .workspace-page {
    padding-inline: 16px;
  }
}
@media (prefers-reduced-transparency: reduce) {
  .native-settings-window .settings-categories {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    background: var(--chrome-solid);
  }
}
:global(:root[data-reduce-transparency='true'] .native-settings-window .settings-categories) {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  background: var(--chrome-solid);
}

@media (max-width: 760px) {
  section.settings.settings-workspace:not(.native-settings-window)[data-section] {
    grid-template-columns: 93.6px minmax(0, 1fr);
    width: calc(100vw - 20px);
  }
  .settings-categories {
    padding-inline: 7px;
  }
  .workspace-title {
    padding-inline: 7px;
  }
  .category-button {
    padding-inline: 7px;
    gap: 7px;
  }
  .workspace-page {
    padding: 20px;
  }
  .workspace-heading {
    padding-inline: 16px;
  }
  .settings .workspace-actions input {
    width: 130px;
  }
}
@media (max-width: 520px) {
  section.settings.settings-workspace:not(.native-settings-window)[data-section] {
    grid-template-columns: 67.2px minmax(0, 1fr);
  }
  .category-button {
    font-size: 11px;
    gap: 5px;
  }
  .category-icon {
    width: 24px;
    height: 24px;
    border-radius: 5.5px;
  }
  .category-icon .system-icon {
    width: 15px;
    height: 15px;
  }
  .workspace-title {
    font-size: 11px;
    padding-bottom: 16px;
  }
  .workspace-page {
    padding: 16px 12px;
  }
  .workspace-heading h2 {
    font-size: 15px;
  }
  .settings .workspace-actions input {
    width: 90px;
  }
  .workspace-actions {
    gap: 5px;
  }
  .workspace-heading {
    padding-inline: 12px;
  }
  .workspace-page :deep(.setting-row) {
    flex-wrap: wrap;
    gap: 8px;
  }
  .workspace-page :deep(.appearance-row) {
    flex-wrap: wrap;
  }
}
.workspace-page :deep(.dependency-project) {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 8px 0;
  color: var(--accent);
  text-decoration: none;
}
.workspace-page :deep(.dependency-project:hover) {
  text-decoration: underline;
}
.workspace-page :deep(.dependency-project + .dependency-project) {
  border-top: 1px solid var(--chrome-divider);
}
.workspace-page :deep(.dependency-url) {
  overflow-wrap: anywhere;
  font-size: 11px;
}
</style>
