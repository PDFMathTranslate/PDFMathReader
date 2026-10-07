<script setup>
import { computed, ref, watch } from 'vue';
import { AppPopUpButton, AppPopUpButtonItem, AppTextField } from '../../ui/controls.mjs';
import {
  isCustomLanguageCode,
  translationLanguageCode,
} from '../../../shared/translation/languages.mjs';
import { t } from '../../i18n/index.mjs';
const props = defineProps({
  modelValue: String,
  options: Array,
  label: String,
  labelFor: Function,
  open: { type: Boolean, default: undefined },
});
const emit = defineEmits(['update:modelValue', 'update:open']);
const popup = ref(),
  localOpen = ref(false);
const menuOpen = computed({
  get: () => props.open ?? localOpen.value,
  set: (value) => {
    localOpen.value = value;
    emit('update:open', value);
  },
});
defineExpose({ focus: () => popup.value?.focus?.() });
const custom = ref(isCustomLanguageCode(props.modelValue)),
  draft = ref(custom.value ? props.modelValue : '');
const selection = computed(() => (custom.value ? 'custom' : props.modelValue));
watch(
  () => props.modelValue,
  (value) => {
    custom.value = isCustomLanguageCode(value);
    if (custom.value) draft.value = value;
  },
);
function select(value) {
  if (value === 'custom') {
    draft.value = translationLanguageCode(props.modelValue) || 'en';
    custom.value = true;
    emit('update:modelValue', draft.value);
  } else {
    custom.value = false;
    emit('update:modelValue', value);
  }
}
function update(value) {
  draft.value = value;
  const code = value.trim();
  if (isCustomLanguageCode(code)) emit('update:modelValue', code);
}
const invalid = computed(() => custom.value && !isCustomLanguageCode(draft.value.trim()));
</script>
<template>
  <div class="language-code-control">
    <AppPopUpButton
      ref="popup"
      v-model:open="menuOpen"
      :model-value="selection"
      teleport-to="body"
      :aria-label="label"
      @update:model-value="select"
    >
      <AppPopUpButtonItem v-for="name in options" :key="name" :value="name">{{
        labelFor(name)
      }}</AppPopUpButtonItem>
      <AppPopUpButtonItem value="custom">{{ t('settings.customLanguageCode') }}</AppPopUpButtonItem>
    </AppPopUpButton>
    <template v-if="custom">
      <AppTextField
        :model-value="draft"
        :aria-label="label + ' — ' + t('settings.customLanguageCode')"
        :aria-invalid="invalid"
        autocomplete="off"
        autocapitalize="off"
        :spellcheck="false"
        placeholder="en, zh-TW, pt-BR"
        @update:model-value="update"
      />
      <p class="muted" role="status">{{ t('settings.customLanguageCodeReminder') }}</p>
      <p v-if="invalid" class="muted" role="alert">{{ t('settings.customLanguageCodeInvalid') }}</p>
    </template>
  </div>
</template>
<style scoped>
.language-code-control {
  display: grid;
  gap: 8px;
  min-width: 0;
  max-width: 65%;
  margin-inline-start: auto;
}
.language-code-control p {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}
</style>
