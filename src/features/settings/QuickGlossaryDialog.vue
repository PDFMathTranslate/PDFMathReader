<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  AppButton,
  AppTextField,
  AppPopUpButton,
  AppPopUpButtonItem,
  platform,
} from '../../ui/controls.mjs';
import { menuLabel } from '../../../shared/i18n/menu.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import {
  addQuickGlossaryTerm,
  GLOSSARY_REQUEST,
  normalizeGlossaryTerm,
} from './quick-glossary.mjs';
const libraries = defineModel({ type: Array, required: true });
const preferences = inject('documentLanguagePreferences', null);
const dialog = ref(null);
const targetInput = ref(null);
const source = ref('');
const target = ref('');
const newLibraryId = '__new_glossary__';
const libraryId = ref(newLibraryId);
const error = ref('');
const title = computed(() =>
  menuLabel('Add to translation glossary...', uiLanguage.value).replace(/(?:\.\.\.|…)$/, ''),
);
const duplicate = computed(() =>
  libraries.value
    .find((library) => library.id === libraryId.value)
    ?.entries.find(
      (entry) => normalizeGlossaryTerm(entry.source) === normalizeGlossaryTerm(source.value),
    ),
);
async function open(event) {
  if (typeof event.detail !== 'string' || !event.detail.trim()) return;
  source.value = normalizeGlossaryTerm(event.detail);
  libraryId.value = libraries.value.find((library) => library.enabled)?.id || newLibraryId;
  target.value = duplicate.value?.target || '';
  error.value = '';
  await nextTick();
  if (!dialog.value.open) dialog.value.showModal();
  targetInput.value?.focus();
}
function save() {
  try {
    libraries.value = addQuickGlossaryTerm(libraries.value, {
      libraryId: libraryId.value === newLibraryId ? '' : libraryId.value,
      source: source.value,
      target: target.value,
      newLibraryName: `${preferences?.sourceLanguage?.value || 'Source'} → ${preferences?.language?.value || 'Translation'}`,
    });
    dialog.value.close();
  } catch (cause) {
    error.value = cause.message;
  }
}
onMounted(() => window.addEventListener(GLOSSARY_REQUEST, open));
onBeforeUnmount(() => window.removeEventListener(GLOSSARY_REQUEST, open));
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="quick-glossary-dialog"
      :data-platform="platform"
      :aria-label="title"
    >
      <form @submit.prevent="save">
        <header>
          <h2>{{ title }}</h2>
          <p>Choose how this term should appear in new translations.</p>
        </header>
        <div class="glossary-fields">
          <label class="glossary-field">
            <span>Source term</span>
            <AppTextField v-model="source" required maxlength="500" aria-label="Source term" />
          </label>
          <label class="glossary-field">
            <span>Target term</span>
            <AppTextField
              ref="targetInput"
              v-model="target"
              required
              maxlength="500"
              aria-label="Target term"
            />
          </label>
          <div class="glossary-field">
            <span id="quick-glossary-library-label">Glossary</span>
            <AppPopUpButton
              v-model="libraryId"
              :teleport-to="false"
              aria-labelledby="quick-glossary-library-label"
            >
              <AppPopUpButtonItem
                v-for="library in libraries"
                :key="library.id"
                :value="library.id"
              >
                {{ library.name || 'Unnamed glossary'
                }}{{ library.enabled ? '' : ' (will be enabled)' }}
              </AppPopUpButtonItem>
              <AppPopUpButtonItem :value="newLibraryId">New glossary</AppPopUpButtonItem>
            </AppPopUpButton>
          </div>
        </div>
        <p v-if="duplicate" class="glossary-message">
          Saving will replace the existing target term.
        </p>
        <p v-if="error" class="glossary-error" role="alert">{{ error }}</p>
        <footer>
          <AppButton type="button" @click="dialog.close()">Cancel</AppButton>
          <AppButton type="submit" variant="prominent" :disabled="!source.trim() || !target.trim()"
            >Save</AppButton
          >
        </footer>
      </form>
    </dialog>
  </Teleport>
</template>

<style scoped>
.quick-glossary-dialog {
  --glossary-surface: #f5f5f7;
  --glossary-group: #ffffffb3;
  --glossary-edge: #00000014;
  --glossary-text: #1d1d1f;
  --glossary-secondary: #6e6e73;
  box-sizing: border-box;
  width: min(420px, calc(100vw - 40px));
  max-height: calc(100vh - 40px);
  overflow: auto;
  padding: 24px;
  border: 1px solid var(--glossary-edge);
  border-radius: 24px;
  corner-shape: squircle;
  background: var(--glossary-surface);
  color: var(--glossary-text);
  font:
    13px/1.4 -apple-system,
    BlinkMacSystemFont,
    system-ui,
    sans-serif;
  box-shadow:
    inset 0 1px 0 #ffffff80,
    0 24px 72px #0004,
    0 4px 16px #0002;
}
:global([data-appearance='dark'] .quick-glossary-dialog) {
  --glossary-surface: #2c2c2e;
  --glossary-group: #ffffff08;
  --glossary-edge: #ffffff14;
  --glossary-text: #f5f5f7;
  --glossary-secondary: #aeaeb2;
  color-scheme: dark;
}
.quick-glossary-dialog::backdrop {
  background: #00000026;
}
form {
  display: grid;
  gap: 20px;
}
h2 {
  margin: 0;
  font-size: 15px;
  line-height: 20px;
  font-weight: 600;
}
header p {
  margin: 6px 0 0;
  color: var(--glossary-secondary);
  font-size: 12px;
  line-height: 17px;
}
.glossary-fields {
  display: grid;
  gap: 16px;
  padding: 16px;
  background: var(--glossary-group);
  border: 1px solid var(--glossary-edge);
  border-radius: 16px;
  corner-shape: squircle;
}
.glossary-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.glossary-field > span {
  font-size: 12px;
  font-weight: 500;
}
.glossary-field :deep(.macvue-field) {
  --_macvue-field-radius: 10px;
  width: 100%;
}
.glossary-field :deep(.macvue-field-input) {
  min-height: 32px;
  border-radius: 10px;
  font-size: 13px;
}
.glossary-field :deep(.macvue-pop-up-button) {
  width: 100%;
  min-height: 32px;
  border-radius: 10px;
  font-size: 13px;
}
footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
footer :deep(button) {
  min-width: 72px;
  min-height: 30px;
  border-radius: 10px;
  font-size: 13px;
}
.glossary-message,
.glossary-error {
  margin: 0;
  font-size: 12px;
  color: var(--glossary-secondary);
}
.glossary-error {
  color: light-dark(#b42318, #ff9b93);
}
</style>
