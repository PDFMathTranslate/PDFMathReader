<script setup>
import { computed, watch } from 'vue';
import { MacSwitch, MacPopUpButton, MacPopUpButtonItem } from './platform-controls.mjs';
import { t, setUILanguage, uiLanguage as currentUILanguage } from './i18n.mjs';
const props = defineProps({
  showKernelToolbarShortcut: Boolean,
  effectsOnly: Boolean,
  showEffects: { type: Boolean, default: true },
  appearance: String,
  accentColor: String,
  reduceMotion: Boolean,
  reduceTransparency: Boolean,
  reducePadding: Boolean,
  uiLanguage: { type: String, default: 'system' },
});
const emit = defineEmits([
  'update:showKernelToolbarShortcut',
  'update:appearance',
  'update:accentColor',
  'update:reduceMotion',
  'update:reduceTransparency',
  'update:reducePadding',
  'update:uiLanguage',
]);
const kernelShortcutLabel = computed(
  () =>
    ({
      en: 'Show kernel switching shortcut in toolbar',
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
const uiLanguages = [
  ['system', 'appearance.systemLanguage'],
  ['en', 'appearance.english'],
  ['zh-CN', 'appearance.simplifiedChinese'],
  ['zh-TW', 'appearance.traditionalChinese'],
  ['fr', 'appearance.french'],
  ['es', 'appearance.spanish'],
  ['ja', 'appearance.japanese'],
  ['ko', 'appearance.korean'],
];
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
        ><MacPopUpButton
          teleport-to="body"
          :model-value="uiLanguage"
          :aria-label="t('appearance.language')"
          @update:model-value="changeUILanguage"
          ><MacPopUpButtonItem v-for="[value, label] in uiLanguages" :key="value" :value="value">{{
            t(label)
          }}</MacPopUpButtonItem></MacPopUpButton
        >
      </div>
      <div class="appearance-row" data-setting="kernel-toolbar-shortcut">
        <span id="kernel-toolbar-shortcut-label">{{ kernelShortcutLabel }}</span>
        <MacSwitch
          :model-value="showKernelToolbarShortcut"
          aria-labelledby="kernel-toolbar-shortcut-label"
          @update:model-value="emit('update:showKernelToolbarShortcut', $event)"
        />
      </div>
    </div>
  </section>
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
            ><MacSwitch
              :model-value="reduceMotion"
              aria-labelledby="reduce-motion-label"
              @update:model-value="emit('update:reduceMotion', $event)"
            />
          </div>
          <div class="setting-row">
            <span id="reduce-transparency-label">{{ t('appearance.reduceTransparency') }}</span
            ><MacSwitch
              :model-value="reduceTransparency"
              aria-labelledby="reduce-transparency-label"
              @update:model-value="emit('update:reduceTransparency', $event)"
            />
          </div>
          <div class="setting-row">
            <span id="reduce-padding-label">{{ t('appearance.reducePadding') }}</span
            ><MacSwitch
              :model-value="reducePadding"
              aria-labelledby="reduce-padding-label"
              @update:model-value="emit('update:reducePadding', $event)"
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
</style>
