<script setup>
import { computed, ref } from 'vue';
import { AppButton } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
defineProps({ modelValue: { type: String, default: '' } });
const emit = defineEmits(['update:modelValue']);
const nativeAvailable = !!globalThis.window?.previewPromptFile;
const busy = ref(false),
  error = ref('');
const labels = computed(
  () =>
    ({
      'zh-CN': ['选择文件…', '清除', '未选择文件'],
      'zh-TW': ['選擇檔案…', '清除', '尚未選擇檔案'],
      ja: ['ファイルを選択…', 'クリア', 'ファイル未選択'],
      ko: ['파일 선택…', '지우기', '선택한 파일 없음'],
      fr: ['Choisir un fichier…', 'Effacer', 'Aucun fichier sélectionné'],
      es: ['Elegir archivo…', 'Borrar', 'Ningún archivo seleccionado'],
    })[uiLanguage.value] || ['Choose file…', 'Clear', 'No file selected'],
);
async function choose() {
  busy.value = true;
  error.value = '';
  try {
    const path = await window.previewPromptFile.choose();
    if (path) emit('update:modelValue', path);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="prompt-file-picker">
    <AppButton :disabled="busy || !nativeAvailable" @click="choose">{{ labels[0] }}</AppButton>
    <span class="prompt-file-name" :title="modelValue">{{
      modelValue ? modelValue.split(/[\\/]/).pop() : labels[2]
    }}</span>
    <AppButton v-if="modelValue" :disabled="busy" @click="emit('update:modelValue', '')">{{
      labels[1]
    }}</AppButton>
    <p v-if="error" class="muted" role="status">{{ error }}</p>
  </div>
</template>
<style scoped>
.prompt-file-picker {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.prompt-file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prompt-file-picker > p {
  flex-basis: 100%;
}
</style>
