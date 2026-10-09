<script setup>
import { computed } from 'vue';
import { platform } from '../../platform/runtime.mjs';
import { AppSwitch } from '../../ui/controls.mjs';
import { t, uiLanguage as currentUILanguage } from '../../i18n/index.mjs';
import FormulaOcrSettings from './FormulaOcrSettings.vue';
const interfaceStyle = defineModel('interfaceStyle', { default: 'default' });
const optimizeParagraphGaps = defineModel('optimizeParagraphGaps');
const glassLabels = computed(
  () =>
    ({
      'zh-CN': ['界面样式', '默认', '可能消耗更多性能'],
      'zh-TW': ['介面樣式', '預設', '可能消耗更多效能'],
      ja: ['インターフェイス', 'デフォルト', 'パフォーマンスへの負荷が増える場合があります'],
      ko: ['인터페이스 스타일', '기본', '더 많은 성능 자원을 사용할 수 있습니다'],
      fr: ['Style de l’interface', 'Par défaut', 'Peut consommer davantage de ressources'],
      es: ['Estilo de interfaz', 'Predeterminado', 'Puede consumir más recursos'],
    })[currentUILanguage.value] || ['Interface style', 'Default', 'May use more resources'],
);
</script>
<template>
  <section class="settings-section" aria-labelledby="settings-experimental">
    <h3 id="settings-experimental">{{ t('settings.experimentalCategory') }}</h3>
    <div class="settings-section-body">
      <div v-if="platform === 'darwin'" class="setting-row" data-setting="interface-style">
        <div>
          <span id="interface-style-label">Liquid Glass</span>
          <p id="interface-style-warning" class="muted">{{ glassLabels[2] }}</p>
        </div>
        <AppSwitch
          :model-value="interfaceStyle === 'liquid-glass'"
          aria-labelledby="interface-style-label"
          aria-describedby="interface-style-warning"
          @update:model-value="interfaceStyle = $event ? 'liquid-glass' : 'default'"
        />
      </div>
      <FormulaOcrSettings />
      <div class="setting-row" data-setting="optimize-paragraph-gaps">
        <span id="optimize-paragraph-gaps-label">{{ t('settings.optimizeParagraphGaps') }}</span>
        <AppSwitch
          v-model="optimizeParagraphGaps"
          aria-labelledby="optimize-paragraph-gaps-label"
          :aria-label="t('settings.optimizeParagraphGaps')"
        />
      </div>
      <p class="muted">{{ t('settings.optimizeParagraphGapsDescription') }}</p>
    </div>
  </section>
</template>
<style scoped>
.settings-section-body {
  display: grid;
  gap: 10px;
}
</style>
