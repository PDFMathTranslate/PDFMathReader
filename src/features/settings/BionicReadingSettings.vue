<script setup>
import { AppPopUpButton, AppPopUpButtonItem, AppSlider } from '../../ui/controls.mjs';
import { t } from '../../i18n/index.mjs';
import { BIONIC_FIXED_LENGTH } from '../translation/bionic-reading.mjs';
const mode = defineModel('mode', { type: String, default: 'off' });
const fixedLength = defineModel('fixedLength', { type: Number, default: 3 });
</script>

<template>
  <div class="bionic-reading-settings">
    <div class="setting-row" data-setting="bionic-reading">
      <span id="bionic-reading-label">{{ t('settings.bionicReading') }}</span>
      <AppPopUpButton
        v-model="mode"
        teleport-to="body"
        aria-labelledby="bionic-reading-label"
        aria-describedby="bionic-reading-hint"
      >
        <AppPopUpButtonItem value="off">{{ t('settings.bionicReadingOff') }}</AppPopUpButtonItem>
        <AppPopUpButtonItem value="fixed">{{
          t('settings.bionicReadingFixed')
        }}</AppPopUpButtonItem>
        <AppPopUpButtonItem value="root">{{ t('settings.bionicReadingRoot') }}</AppPopUpButtonItem>
      </AppPopUpButton>
    </div>
    <p id="bionic-reading-hint" class="muted bionic-reading-hint">
      {{ t('settings.bionicReadingHint') }}
    </p>
    <div class="bionic-length" data-setting="bionic-fixed-length">
      <div class="bionic-length-label">
        <span id="bionic-fixed-length-label">{{ t('settings.bionicFixedLength') }}</span
        ><output>{{ fixedLength }}</output>
      </div>
      <AppSlider
        v-model="fixedLength"
        :min="BIONIC_FIXED_LENGTH.min"
        :max="BIONIC_FIXED_LENGTH.max"
        :step="1"
        :disabled="mode !== 'fixed'"
        aria-labelledby="bionic-fixed-length-label"
      />
    </div>
  </div>
</template>

<style scoped>
.bionic-reading-settings {
  border-top: 1px solid var(--separator, #8883);
}
.bionic-reading-hint {
  margin: 0;
  padding: 0 0 12px;
  font-size: 12px;
  line-height: 1.5;
}
.bionic-length {
  display: grid;
  gap: 8px;
  padding: 2px 0 10px;
}
.bionic-length-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 13px;
}
.bionic-length-label output {
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
