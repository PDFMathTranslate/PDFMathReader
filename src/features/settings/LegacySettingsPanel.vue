<script setup>
import { uiLanguage, uiLanguageChoice, t } from '../../i18n/index.mjs';
import {
  AppButton,
  AppSegmentedControl,
  AppSegment,
  AppSwitch,
  AppSlider,
  AppPopUpButton,
  AppPopUpButtonItem,
  AppSecureField,
} from '../../ui/controls.mjs';
import TranslationLanguageSelect from './TranslationLanguageSelect.vue';
import AboutAcknowledgements from './AboutAcknowledgements.vue';
import { defineAsyncComponent } from 'vue';
const AdvancedSettings = defineAsyncComponent(() => import('./AdvancedSettings.vue'));
const TranslationServiceOptions = defineAsyncComponent(
  () => import('./TranslationServiceOptions.vue'),
);
const AppearanceSettings = defineAsyncComponent(() => import('./AppearanceSettings.vue'));
defineProps([
  'popoverFocusOut',
  'settingsWindowMode',
  'closeSettingsWindow',
  'bindKernelInput',
  'engine',
  'engineBusy',
  'chooseKernel',
  'kernelOptions',
  'engineState',
  'uvState',
  'installEngine',
  'kernelStatusLabel',
  'kernelStatus',
  'uvVersionLabel',
  'sourceLanguageOptions',
  'languageLabel',
  'bindLanguageInput',
  'languageOptions',
  'desktopCredentials',
  'translationServiceId',
  'updateKey',
  'keyPlaceholder',
  'keyInvalid',
  'keyMessage',
  'keyBusy',
  'configured',
  'translationServiceCatalogRevision',
  'translationModes',
  'parallelLevels',
  'parallelLabels',
  'parallelPagesStep',
  'parallelTranslationsStep',
  'informationCategorySettings',
]);
const legacySettings = defineModel('legacySettings');
const settings = defineModel('settings');
const kernelAdvancedOptions = defineModel('kernelAdvancedOptions');
const sourceLanguage = defineModel('sourceLanguage');
const languageMenuOpen = defineModel('languageMenuOpen');
const language = defineModel('language');
const reuseTranslations = defineModel('reuseTranslations');
const keyEntry = defineModel('keyEntry');
const translationServices = defineModel('translationServices');
const serviceCredentialValues = defineModel('serviceCredentialValues');
const translationServiceRequest = defineModel('translationServiceRequest');
const translationMode = defineModel('translationMode');
const pageConcurrency = defineModel('pageConcurrency');
const concurrency = defineModel('concurrency');
const automatic = defineModel('automatic');
const layoutVisible = defineModel('layoutVisible');
const documentOpenMode = defineModel('documentOpenMode');
const interactionMode = defineModel('interactionMode');
const emphasizeTopicSentences = defineModel('emphasizeTopicSentences');
const emphasizeInformation = defineModel('emphasizeInformation');
const restoreDocuments = defineModel('restoreDocuments');
const autoHideHeader = defineModel('autoHideHeader');
const reduceResourceUsage = defineModel('reduceResourceUsage');
const showKernelToolbarShortcut = defineModel('showKernelToolbarShortcut');
const appearanceChoice = defineModel('appearanceChoice');
const accentColor = defineModel('accentColor');
const reduceMotion = defineModel('reduceMotion');
const reduceTransparency = defineModel('reduceTransparency');
const reducePadding = defineModel('reducePadding');
</script>

<template>
  <Transition name="settings-motion"
    ><section
      v-if="settings && legacySettings"
      class="settings"
      @focusout="popoverFocusOut"
      :aria-label="t('toolbar.translationSettings')"
    >
      <div class="settings-heading">
        <h2>{{ t('settings.title') }}</h2>
        <AppButton @click="legacySettings = false">{{
          uiLanguage === 'zh-CN' ? '新版设置' : 'New settings'
        }}</AppButton
        ><AppButton
          :aria-label="t('settings.close')"
          @click="settingsWindowMode ? closeSettingsWindow() : (settings = false)"
          ><span
            class="system-icon"
            aria-hidden="true"
            data-symbol="xmark"
            style="--symbol: url('/symbols/xmark.png')"
          ></span
        ></AppButton>
      </div>
      <section class="settings-section" aria-labelledby="settings-engine">
        <h3 id="settings-engine">{{ t('settings.kernelMode') }}</h3>
        <div class="kernel-setting">
          <AppSegmentedControl
            :ref="bindKernelInput"
            class="mac-mode-control"
            :model-value="engine"
            :disabled="engineBusy"
            aria-labelledby="settings-engine"
            @update:model-value="chooseKernel"
            ><AppSegment v-for="option in kernelOptions" :key="option.id" :value="option.id">{{
              t(option.labelKey)
            }}</AppSegment></AppSegmentedControl
          >
        </div>
        <AdvancedSettings
          :engine="engine"
          :engine-state="engineState"
          :installing="engineBusy"
          :uv-available="uvState?.available === true"
          @reinstall="installEngine(true, $event)"
          v-model="kernelAdvancedOptions"
        />
        <div
          class="kernel-status-line"
          role="status"
          :title="engineState?.reason || kernelStatusLabel"
        >
          <span
            class="kernel-traffic-light"
            :data-status="kernelStatus"
            :aria-label="kernelStatusLabel"
          ></span
          ><span class="kernel-module">{{
            t(kernelOptions.find((option) => option.id === engine)?.labelKey || engine)
          }}</span
          ><span>{{ engineState?.version || '—' }}</span
          ><span class="kernel-uv-version">{{ uvVersionLabel }}</span>
        </div>
        <AppButton
          v-if="engine !== 'pdf_inspector' && !engineState?.available"
          @click="installEngine"
          :disabled="engineBusy || !uvState?.available"
          >{{ t('settings.installKernelWithUV') }}</AppButton
        >
      </section>
      <section class="settings-section" aria-labelledby="settings-translation">
        <h3 id="settings-translation">{{ t('settings.translation') }}</h3>
        <div class="setting-row">
          <span id="source-language-label">{{ t('settings.sourceLanguage') }}</span
          ><TranslationLanguageSelect
            v-model="sourceLanguage"
            :options="sourceLanguageOptions"
            :label="t('settings.sourceLanguage')"
            :label-for="languageLabel"
          />
        </div>
        <div class="setting-row">
          <span id="language-label">{{ t('settings.translateInto') }}</span
          ><TranslationLanguageSelect
            :ref="bindLanguageInput"
            v-model:open="languageMenuOpen"
            v-model="language"
            :options="languageOptions"
            :label="t('settings.translationLanguage')"
            :label-for="languageLabel"
          />
        </div>
        <div class="setting-row" data-setting="reuse-translations">
          <span id="reuse-translations-label">{{ t('settings.reuseTranslations') }}</span
          ><AppSwitch v-model="reuseTranslations" aria-labelledby="reuse-translations-label" />
        </div>
        <p class="muted">{{ t('settings.reuseTranslationsDescription') }}</p>
        <div
          v-if="desktopCredentials && translationServiceId === 'openai'"
          class="translation-service-account"
          aria-labelledby="settings-account"
        >
          <span id="settings-account">{{ t('settings.apiKey') }}</span>
          <form
            v-if="desktopCredentials && translationServiceId === 'openai'"
            class="api-key-form"
            @submit.prevent="updateKey()"
          >
            <div class="api-key-row">
              <AppSecureField
                v-model="keyEntry"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                :placeholder="keyPlaceholder"
                :class="{ 'key-invalid': keyInvalid || keyMessage }"
                :aria-invalid="keyInvalid || !!keyMessage"
                :disabled="keyBusy"
                :aria-label="t('settings.openAIAPIKey')"
                @blur="updateKey()"
              /><AppButton
                v-if="configured || keyInvalid"
                type="button"
                class="key-clear"
                :aria-label="t('settings.clearAPIKey')"
                :title="t('settings.clearAPIKey')"
                :disabled="keyBusy"
                @pointerdown.prevent
                @click="updateKey(true)"
                ><span
                  class="system-icon"
                  aria-hidden="true"
                  data-symbol="trash"
                  style="--symbol: url('/symbols/trash.png')"
                ></span
              ></AppButton>
            </div>
            <button type="submit" hidden tabindex="-1" aria-hidden="true"></button>
          </form>
        </div>
        <TranslationServiceOptions
          :engine="engine"
          :engine-state="engineState"
          :catalog-revision="translationServiceCatalogRevision"
          v-model="translationServices"
          v-model:credentials="serviceCredentialValues"
          :advanced-options="kernelAdvancedOptions"
          @update:request="translationServiceRequest = $event"
          @update:advanced-options="kernelAdvancedOptions = $event"
        />
        <div class="kernel-setting">
          <AppSegmentedControl
            class="mac-translation-control"
            v-model="translationMode"
            :aria-label="t('settings.translationMode')"
            ><AppSegment v-for="option in translationModes" :key="option.id" :value="option.id">{{
              t(option.labelKey)
            }}</AppSegment></AppSegmentedControl
          >
          <p class="muted">
            {{
              translationMode === 'full'
                ? t('translation.fullDescription')
                : t('translation.readingDescription')
            }}
          </p>
        </div>
        <details class="advanced-settings settings-section">
          <summary>{{ t('advanced.section') }}</summary>
          <div class="parallel-settings">
            <div class="parallel-setting">
              <span id="parallel-pages-label">{{ t('settings.parallelPages') }}</span
              ><AppSlider
                v-model="pageConcurrency"
                :min="1"
                :max="12"
                :step="1"
                aria-labelledby="parallel-pages-label"
              />
              <div class="parallel-ticks" aria-hidden="true">
                <i
                  v-for="level in parallelLevels"
                  :key="level"
                  :style="{ left: ((level - 1) / 11) * 100 + '%' }"
                ></i>
              </div>
              <div class="parallel-levels">
                <span
                  v-for="(label, index) in parallelLabels"
                  :key="label"
                  :style="{ left: ((parallelLevels[index] - 1) / 11) * 100 + '%' }"
                  :class="{ selected: index === parallelPagesStep }"
                  >{{ label }}</span
                >
              </div>
            </div>
            <div class="parallel-setting">
              <span id="parallel-translations-label">{{ t('settings.parallelTranslations') }}</span
              ><AppSlider
                v-model="concurrency"
                :min="1"
                :max="12"
                :step="1"
                aria-labelledby="parallel-translations-label"
              />
              <div class="parallel-ticks" aria-hidden="true">
                <i
                  v-for="level in parallelLevels"
                  :key="level"
                  :style="{ left: ((level - 1) / 11) * 100 + '%' }"
                ></i>
              </div>
              <div class="parallel-levels">
                <span
                  v-for="(label, index) in parallelLabels"
                  :key="label"
                  :style="{ left: ((parallelLevels[index] - 1) / 11) * 100 + '%' }"
                  :class="{ selected: index === parallelTranslationsStep }"
                  >{{ label }}</span
                >
              </div>
            </div>
          </div>
        </details>
      </section>
      <section v-if="false" class="settings-section" aria-labelledby="settings-reading">
        <h3 id="settings-reading">{{ t('settings.reading') }}</h3>
        <div v-if="translationMode === 'reading'" class="setting-row">
          <span id="automatic-label">{{ t('settings.translateWhenScrollingStops') }}</span
          ><AppSwitch v-model="automatic" aria-labelledby="automatic-label" />
        </div>
        <div class="setting-row">
          <span id="boundaries-label">{{ t('settings.showParagraphBoundaries') }}</span
          ><AppSwitch v-model="layoutVisible" aria-labelledby="boundaries-label" />
        </div>
      </section>
      <section class="settings-section" aria-labelledby="settings-interaction">
        <h3 id="settings-interaction">{{ t('settings.interaction') }}</h3>
        <div class="setting-row" data-setting="document-open-mode">
          <span id="document-open-mode-label">{{ t('settings.documentOpenMode') }}</span
          ><AppPopUpButton
            v-model="documentOpenMode"
            teleport-to="body"
            aria-labelledby="document-open-mode-label"
            ><AppPopUpButtonItem value="translation">{{
              t('settings.openTranslation')
            }}</AppPopUpButtonItem
            ><AppPopUpButtonItem value="original">{{
              t('settings.openOriginal')
            }}</AppPopUpButtonItem
            ><AppPopUpButtonItem value="manual">{{
              t('settings.openManual')
            }}</AppPopUpButtonItem></AppPopUpButton
          >
        </div>
        <AppSegmentedControl v-model="interactionMode" :aria-label="t('settings.interactionMode')"
          ><AppSegment value="reading">{{ t('settings.readingMode') }}</AppSegment
          ><AppSegment value="comparison">{{
            t('settings.comparisonMode')
          }}</AppSegment></AppSegmentedControl
        >
        <div class="setting-row" data-setting="topic-sentences">
          <span id="topic-sentences-label">{{ t('settings.emphasizeTopicSentences') }}</span
          ><AppSwitch
            v-model="emphasizeTopicSentences"
            aria-labelledby="topic-sentences-label"
            :title="t('settings.emphasizeTopicSentencesHint')"
            :aria-label="t('settings.emphasizeTopicSentences')"
          />
        </div>
        <div class="setting-row" data-setting="information-emphasis">
          <span id="information-emphasis-label">{{ t('settings.emphasizeInformation') }}</span
          ><AppSwitch
            v-model="emphasizeInformation"
            aria-labelledby="information-emphasis-label"
            :aria-label="t('settings.emphasizeInformation')"
            :title="t('settings.emphasizeInformationHint')"
          />
        </div>
        <div
          class="information-subcategories"
          role="group"
          :aria-label="t('settings.emphasizeInformation')"
        >
          <div
            v-for="setting in informationCategorySettings"
            :key="setting.key"
            class="setting-row"
            :data-setting="setting.key"
          >
            <span :id="setting.key + '-label'">{{ t('settings.' + setting.key) }}</span>
            <AppSwitch
              v-model="setting.value.value"
              :disabled="!emphasizeInformation"
              :aria-labelledby="setting.key + '-label'"
            />
          </div>
        </div>
        <div class="setting-row" data-setting="restore-documents">
          <span id="restore-documents-label">{{ t('settings.restoreDocuments') }}</span
          ><AppSwitch v-model="restoreDocuments" aria-labelledby="restore-documents-label" />
        </div>
        <div class="setting-row" data-setting="auto-hide-header">
          <span id="auto-hide-header-label">{{ t('settings.autoHideHeader') }}</span
          ><AppSwitch
            v-model="autoHideHeader"
            aria-labelledby="auto-hide-header-label"
            :aria-label="t('settings.autoHideHeader')"
          />
        </div>
      </section>
      <section class="settings-section">
        <div class="setting-row" data-setting="reduce-resource-usage">
          <span id="reduce-resource-usage-label">{{ t('settings.reduceResourceUsage') }}</span
          ><AppSwitch
            v-model="reduceResourceUsage"
            aria-labelledby="reduce-resource-usage-label"
            :title="t('settings.reduceResourceUsageHint')"
          />
        </div>
        <p class="muted">{{ t('settings.reduceResourceUsageHint') }}</p>
      </section>
      <AppearanceSettings
        v-model:show-kernel-toolbar-shortcut="showKernelToolbarShortcut"
        v-model:appearance="appearanceChoice"
        v-model:accent-color="accentColor"
        v-model:reduce-motion="reduceMotion"
        v-model:reduce-transparency="reduceTransparency"
        v-model:reduce-padding="reducePadding"
        v-model:ui-language="uiLanguageChoice"
      />
      <section class="settings-section" aria-labelledby="settings-about">
        <h3 id="settings-about">{{ t('settings.about') }}</h3>
        <a
          class="github-link"
          href="https://github.com/PDFMathTranslate/PDFMathReader"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t('settings.githubLabel')"
          ><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path
              d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.63 1.22 3.27.94.1-.73.39-1.22.71-1.5-2.5-.29-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.09 1.15a10.78 10.78 0 0 1 5.62 0c2.14-1.45 3.09-1.15 3.09-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.32-2.64 5.27-5.15 5.55.4.35.76 1.03.76 2.08v3.1c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z"
            /></svg
          ><span>{{ t('settings.github') }}</span></a
        >
        <p class="muted">Rongxin (rongxin@u.nus.edu)</p>
        <AboutAcknowledgements />
      </section></section
  ></Transition>
</template>
