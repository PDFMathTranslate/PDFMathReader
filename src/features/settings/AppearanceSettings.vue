<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import InterfaceStyleSettings from './InterfaceStyleSettings.vue';
import DocumentFontSettings from './DocumentFontSettings.vue';
const interfaceStyle = defineModel('interfaceStyle', { default: 'default' });
import { UI_LANGUAGE_OPTIONS } from '../../../shared/i18n/ui-language.mjs';
import { AppSwitch, AppPopUpButton, AppPopUpButtonItem } from '../../ui/controls.mjs';
import { t, setUILanguage, uiLanguage as currentUILanguage } from '../../i18n/index.mjs';
const props = defineProps({
  showKernelToolbarShortcut: Boolean,
  effectsOnly: Boolean,
  showEffects: { type: Boolean, default: true },
  appearance: String,
  accentColor: String,
  reduceMotion: Boolean,
  reduceTransparency: Boolean,
  uiLanguage: { type: String, default: 'en' },
});
const emit = defineEmits([
  'update:showKernelToolbarShortcut',
  'update:appearance',
  'update:accentColor',
  'update:reduceMotion',
  'update:reduceTransparency',
  'update:uiLanguage',
]);
const kernelShortcutLabel = computed(
  () =>
    ({
      en: 'Show kernel switching shortcut in toolbar',
      ar: 'إظهار اختصار تبديل المحرك في شريط الأدوات',
      arz: 'اعرض اختصار تغيير المحرك في شريط الأدوات',
      hi: 'टूलबार में इंजन बदलने का शॉर्टकट दिखाएँ',
      bn: 'টুলবারে ইঞ্জিন বদলানোর শর্টকাট দেখান',
      ru: 'Показывать переключение движка на панели инструментов',
      pt: 'Mostrar atalho para mudar de motor na barra de ferramentas',
      ur: 'ٹول بار میں انجن بدلنے کا شارٹ کٹ دکھائیں',
      de: 'Kurzbefehl zum Wechseln der Engine in der Symbolleiste anzeigen',
      pcm: 'Show shortcut to change engine for toolbar',

      'zh-CN': '在工具栏显示内核切换快捷方式',
      'zh-TW': '在工具列顯示核心切換快捷方式',
      ja: 'ツールバーにカーネル切り替えショートカットを表示',
      ko: '도구 모음에 커널 전환 바로 가기 표시',
      fr: 'Afficher le raccourci de changement de moteur dans la barre d’outils',
      es: 'Mostrar el acceso para cambiar de motor en la barra de herramientas',
    })[currentUILanguage.value] || 'Show kernel switching shortcut in toolbar',
);
const themes = [
  ['light', 'appearance.light'],
  ['dark', 'appearance.dark'],
  ['system', 'appearance.auto'],
];
const colors = [
  ['system', 'appearance.system'],
  ['#007aff', 'appearance.blue'],
  ['#af52de', 'appearance.purple'],
  ['#ff2d55', 'appearance.pink'],
  ['#ff3b30', 'appearance.red'],
  ['#ff9500', 'appearance.orange'],
  ['#ffcc00', 'appearance.yellow'],
  ['#34c759', 'appearance.green'],
  ['#8e8e93', 'appearance.gray'],
  ['#3d647a', 'appearance.slateBlue'],
];
const uiLanguages = computed(() => [
  { value: 'system', label: t('appearance.systemLanguage') },
  ...UI_LANGUAGE_OPTIONS,
]);
// The app icon is a desktop-wide choice owned by the main process, not a window preference.
const appIconLabels = {
  base: 'appearance.iconDefault',
  warm: 'appearance.iconWarm',
  spring: 'appearance.iconSpring',
  hist: 'appearance.iconClassic',
  tech: 'appearance.iconBlueprint',
  moon: 'appearance.iconMoon',
  modern: 'appearance.iconModern',
  art: 'appearance.iconArt',
  zotero: 'appearance.iconZotero',
};
const appIcons = ref([]);
const appIcon = ref('');
onMounted(async () => {
  const state = await globalThis.previewAppIcon?.load().catch(() => null);
  if (!state) return;
  appIcons.value = state.options;
  appIcon.value = state.selected;
});
async function changeAppIcon(id) {
  const previous = appIcon.value;
  appIcon.value = id;
  try {
    appIcon.value = (await globalThis.previewAppIcon.select(id)).selected;
  } catch {
    appIcon.value = previous;
  }
}
watch(
  () => props.uiLanguage,
  (code) => setUILanguage(code),
  { immediate: true },
);
function changeUILanguage(code) {
  emit('update:uiLanguage', setUILanguage(code));
}
</script>
<template>
  <section
    v-if="!effectsOnly"
    class="settings-section appearance-section"
    aria-labelledby="settings-appearance"
  >
    <h3 id="settings-appearance">{{ t('appearance.style') }}</h3>
    <div class="settings-section-body">
      <div class="appearance-row">
        <span>{{ t('appearance.appearance') }}</span>
        <div class="appearance-options" role="group" :aria-label="t('appearance.appearance')">
          <button
            v-for="[value, label] in themes"
            :key="value"
            class="appearance-choice"
            :aria-pressed="appearance === value"
            @click="emit('update:appearance', value)"
          >
            <span class="appearance-preview" :data-preview="value" aria-hidden="true"
              ><i class="preview-window"><i></i><b></b><b></b></i
              ><i class="preview-panel"><b></b><b></b><b></b></i></span
            ><span>{{ t(label) }}</span>
          </button>
        </div>
      </div>
      <div v-if="appIcons.length" class="appearance-row app-icon-row">
        <span>{{ t('appearance.appIcon') }}</span>
        <div class="appearance-options" role="group" :aria-label="t('appearance.appIcon')">
          <button
            v-for="{ id, preview } in appIcons"
            :key="id"
            class="appearance-choice"
            :aria-pressed="appIcon === id"
            @click="changeAppIcon(id)"
          >
            <img class="app-icon-preview" :src="preview" alt="" draggable="false" /><span>{{
              t(appIconLabels[id])
            }}</span>
          </button>
        </div>
      </div>
      <div class="appearance-row color-row">
        <span>{{ t('appearance.color') }}</span>
        <div class="color-options" role="group" :aria-label="t('appearance.accentColor')">
          <button
            v-for="[value, label] in colors"
            :key="value"
            class="color-choice"
            :aria-label="t('appearance.accentColorOption', { name: t(label) })"
            :aria-pressed="accentColor === value"
            @click="emit('update:accentColor', value)"
          >
            <span
              class="color-swatch"
              :class="{ spectrum: value === 'system' }"
              :style="value !== 'system' ? { background: value } : {}"
            ></span
            ><span>{{ t(label) }}</span></button
          ><label
            v-if="false"
            class="color-choice custom-color"
            :class="{
              selected: accentColor !== 'system' && !colors.some((c) => c[0] === accentColor),
            }"
            ><span
              class="color-swatch spectrum"
              :style="accentColor !== 'system' ? { background: accentColor } : {}"
              ><input
                type="color"
                :aria-label="t('appearance.customAccentColor')"
                :value="accentColor === 'system' ? '#3d647a' : accentColor"
                @input="emit('update:accentColor', $event.target.value)" /></span
            ><span>{{ t('appearance.custom') }}</span></label
          >
        </div>
      </div>
    </div>
  </section>
  <section
    v-if="!effectsOnly"
    class="settings-section interface-section"
    aria-labelledby="settings-interface"
  >
    <h3 id="settings-interface">{{ t('appearance.interface') }}</h3>
    <div class="settings-section-body">
      <div class="appearance-row">
        <span>{{ t('appearance.language') }}</span
        ><AppPopUpButton
          teleport-to="body"
          :model-value="uiLanguage"
          :aria-label="t('appearance.language')"
          @update:model-value="changeUILanguage"
          ><AppPopUpButtonItem
            v-for="{ value, label } in uiLanguages"
            :key="value"
            :value="value"
            >{{ label }}</AppPopUpButtonItem
          ></AppPopUpButton
        >
      </div>
      <InterfaceStyleSettings v-model="interfaceStyle" />
      <div class="appearance-row" data-setting="kernel-toolbar-shortcut">
        <span id="kernel-toolbar-shortcut-label">{{ kernelShortcutLabel }}</span>
        <AppSwitch
          :model-value="showKernelToolbarShortcut"
          aria-labelledby="kernel-toolbar-shortcut-label"
          @update:model-value="emit('update:showKernelToolbarShortcut', $event)"
        />
      </div>
    </div>
  </section>
  <DocumentFontSettings v-if="!effectsOnly" />
  <DocumentFontSettings v-if="!effectsOnly" cjk />
  <section
    v-if="showEffects"
    class="settings-section effects-section"
    aria-labelledby="settings-effects"
  >
    <h3 id="settings-effects">{{ t('appearance.effects') }}</h3>
    <div class="settings-section-body">
      <div class="performance-effects">
        <div>
          <div class="setting-row">
            <span id="reduce-motion-label">{{ t('appearance.reduceMotion') }}</span
            ><AppSwitch
              :model-value="reduceMotion"
              aria-labelledby="reduce-motion-label"
              @update:model-value="emit('update:reduceMotion', $event)"
            />
          </div>
          <div class="setting-row">
            <span id="reduce-transparency-label">{{ t('appearance.reduceTransparency') }}</span
            ><AppSwitch
              :model-value="reduceTransparency"
              aria-labelledby="reduce-transparency-label"
              @update:model-value="emit('update:reduceTransparency', $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-section-body {
  display: grid;
  gap: 10px;
}
.app-icon-row .appearance-options {
  flex-wrap: wrap;
  row-gap: 10px;
}
.app-icon-preview {
  display: block;
  /* Previews are cropped to the icon body; round to the macOS icon corner (22.5%). */
  width: 44px;
  height: 44px;
  border-radius: 10px;
  margin: 5px;
}
.appearance-choice[aria-pressed='true'] .app-icon-preview {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
/* Like System Settings, focus rings hug the icon rather than the whole tile. */
.app-icon-row .appearance-choice:focus-visible {
  outline: none;
}
.app-icon-row .appearance-choice:focus-visible .app-icon-preview {
  outline: 3px solid color-mix(in srgb, var(--accent) 40%, transparent);
  outline-offset: 2px;
}
.app-icon-row .appearance-choice[aria-pressed='true']:focus-visible .app-icon-preview {
  outline-color: var(--accent);
}
</style>
