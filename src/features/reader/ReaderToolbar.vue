<script setup>
import { uiLanguage, t } from '../../i18n/index.mjs';
import { menuLabel } from '../../../shared/i18n/menu.mjs';
import { AppButton, AppPopUpButton, AppPopUpButtonItem } from '../../ui/controls.mjs';
import KernelErrorPopover from '../settings/KernelErrorPopover.vue';
import { defineAsyncComponent } from 'vue';
const WindowsMenu = defineAsyncComponent(() => import('../../platform/windows/WindowsMenu.vue'));
defineProps([
  'pages',
  'immersiveHeaderHidden',
  'revealHeader',
  'headerDoubleClick',
  'platform',
  'desktopCredentials',
  'desktopWindow',
  'maximized',
  'bindWindowsMenu',
  'dismissPopovers',
  'toolbarHint',
  'sidebar',
  'toggleSidebar',
  'title',
  'active',
  'annotations',
  'showKernelToolbarShortcut',
  'kernelErrorVisible',
  'engine',
  'engineBusy',
  'chooseKernel',
  'kernelOptions',
  'kernelFailure',
  'offerDocumentIgnore',
  'ignoreKernelFailure',
  'recoverKernel',
  'translationTaskProgress',
  'searchOpen',
  'closeSearch',
  'openSearch',
  'openSettings',
]);
const windowsMenuOpen = defineModel('windowsMenuOpen');
const showAnnotations = defineModel('showAnnotations');
const showTranslations = defineModel('showTranslations');
const settings = defineModel('settings');
</script>

<template>
  <nav
    class="toolbar"
    :class="{ 'has-document': pages.length }"
    :aria-label="t('app.readerNavigation')"
    :inert="immersiveHeaderHidden"
    @focusin="revealHeader"
    @dblclick="headerDoubleClick"
  >
    <div v-if="platform === 'darwin'" class="toolbar-progressive-blur" aria-hidden="true">
      <span v-for="level in 7" :key="level" :data-blur-level="level"></span>
    </div>
    <div v-if="platform === 'darwin'" class="traffic-lights" aria-hidden="true">
      <i></i><i></i><i></i>
    </div>
    <div v-if="platform === 'linux' && desktopCredentials" class="linux-traffic-lights">
      <button
        class="close"
        :aria-label="menuLabel('Close Window', uiLanguage)"
        :title="menuLabel('Close Window', uiLanguage)"
        @click="desktopWindow.close()"
      >
        <span aria-hidden="true">×</span>
      </button>
      <button
        class="minimize"
        :aria-label="menuLabel('Minimize', uiLanguage)"
        :title="menuLabel('Minimize', uiLanguage)"
        @click="desktopWindow.minimize()"
      >
        <span aria-hidden="true">−</span>
      </button>
      <button
        class="maximize"
        :aria-label="menuLabel('Maximize / Restore', uiLanguage)"
        :title="menuLabel('Maximize / Restore', uiLanguage)"
        :aria-pressed="maximized"
        @click="desktopWindow.maximize()"
      >
        <span aria-hidden="true">{{ maximized ? '−' : '+' }}</span>
      </button>
    </div>
    <WindowsMenu
      v-if="['win32', 'linux'].includes(platform) && desktopCredentials"
      :ref="bindWindowsMenu"
      @open="
        dismissPopovers();
        revealHeader();
        windowsMenuOpen = true;
      "
      @close="windowsMenuOpen = false"
    />
    <AppButton
      v-if="pages.length"
      class="icon-button"
      :title="
        toolbarHint(
          sidebar ? t('toolbar.hidePageThumbnails') : t('toolbar.showPageThumbnails'),
          'B',
        )
      "
      :aria-label="t('toolbar.toggleThumbnails')"
      :aria-expanded="sidebar"
      @click="toggleSidebar"
      ><span
        class="system-icon"
        aria-hidden="true"
        data-symbol="sidebar.left"
        style="--symbol: url('/symbols/sidebar.left.png')"
      ></span
    ></AppButton>
    <div class="title">
      <strong :title="title">{{ title }}</strong
      ><span v-if="pages.length">{{
        t('toolbar.pageOf', { current: active, total: pages.length })
      }}</span>
    </div>
    <div class="toolbar-actions">
      <template v-if="pages.length">
        <AppButton
          v-if="annotations.length"
          class="icon-button annotation-visibility-toggle"
          :title="t(showAnnotations ? 'toolbar.hideAnnotations' : 'toolbar.showAnnotations')"
          :aria-label="t(showAnnotations ? 'toolbar.hideAnnotations' : 'toolbar.showAnnotations')"
          :aria-pressed="showAnnotations"
          @click="showAnnotations = !showAnnotations"
          ><svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            <path v-if="!showAnnotations" d="m3 3 18 18" /></svg
        ></AppButton>
      </template>
      <div
        v-if="showKernelToolbarShortcut || kernelErrorVisible"
        class="toolbar-kernel"
        data-popover-trigger
      >
        <AppPopUpButton
          v-if="showKernelToolbarShortcut"
          size="small"
          :model-value="engine"
          :disabled="engineBusy"
          :aria-label="t('settings.mode')"
          teleport-to="body"
          @update:model-value="chooseKernel"
        >
          <AppPopUpButtonItem v-for="option in kernelOptions" :key="option.id" :value="option.id">{{
            t(option.labelKey)
          }}</AppPopUpButtonItem>
        </AppPopUpButton>
        <Transition name="settings-motion"
          ><KernelErrorPopover
            v-if="kernelErrorVisible"
            :message="kernelFailure.message"
            :kernel-label="t(kernelOptions.find((option) => option.id === engine)?.labelKey)"
            :busy="engineBusy"
            @ignore="ignoreKernelFailure"
            @retry="recoverKernel()"
        /></Transition>
      </div>
      <AppButton
        v-if="pages.length"
        class="icon-button translation-toggle"
        :aria-label="t('toolbar.translation')"
        :aria-busy="translationTaskProgress.busy"
        :title="
          translationTaskProgress.busy
            ? t('toolbar.translating', { percent: translationTaskProgress.percent })
            : toolbarHint(
                showTranslations ? t('toolbar.showOriginalText') : t('toolbar.showTranslatedText'),
                'R',
              )
        "
        :aria-pressed="showTranslations"
        @click="showTranslations = !showTranslations"
        ><svg
          v-if="translationTaskProgress.busy"
          class="translation-progress"
          :class="{ 'cache-reading': translationTaskProgress.cacheOnly }"
          viewBox="0 0 24 24"
          role="progressbar"
          :aria-label="t('toolbar.translationProgress')"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="translationTaskProgress.percent"
        >
          <circle class="translation-progress-track" cx="12" cy="12" r="9" />
          <circle
            class="translation-progress-fill"
            cx="12"
            cy="12"
            r="9"
            pathLength="100"
            :stroke-dasharray="`${translationTaskProgress.percent} 100`"
          /></svg
        ><span
          v-else
          class="system-icon"
          aria-hidden="true"
          data-symbol="character.book.closed"
          style="--symbol: url('/symbols/character.book.closed.png')"
        ></span
      ></AppButton>
      <AppButton
        v-if="pages.length"
        class="icon-button"
        data-popover-trigger
        :aria-label="t('toolbar.searchDocument')"
        :title="toolbarHint(t('toolbar.searchOriginalOrTranslatedText'), 'F')"
        :aria-expanded="searchOpen"
        @click="searchOpen ? closeSearch() : openSearch()"
        ><span
          class="system-icon"
          aria-hidden="true"
          data-symbol="magnifyingglass"
          style="--symbol: url('/symbols/magnifyingglass.png')"
        ></span></AppButton
      ><AppButton
        class="icon-button"
        data-popover-trigger
        :aria-label="t('toolbar.translationSettings')"
        :title="toolbarHint(t('toolbar.openTranslationSettings'), ',')"
        @click="settings ? (settings = false) : openSettings()"
        ><span
          class="system-icon"
          aria-hidden="true"
          data-symbol="gearshape"
          style="--symbol: url('/symbols/gearshape.png')"
        ></span
      ></AppButton>
    </div>
    <div v-if="platform === 'win32' && desktopCredentials" class="windows-window-controls">
      <button
        class="windows-minimize"
        :aria-label="menuLabel('Minimize', uiLanguage)"
        :title="menuLabel('Minimize', uiLanguage)"
        @click="desktopWindow.minimize()"
      >
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h10" /></svg>
      </button>
      <button
        class="windows-maximize"
        :aria-label="menuLabel('Maximize / Restore', uiLanguage)"
        :title="menuLabel('Maximize / Restore', uiLanguage)"
        :aria-pressed="maximized"
        @click="desktopWindow.maximize()"
      >
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path v-if="maximized" d="M3 3V1h8v8H9M1 3h8v8H1Z" />
          <path v-else d="M1 1h10v10H1Z" />
        </svg>
      </button>
      <button
        class="windows-close"
        :aria-label="menuLabel('Close Window', uiLanguage)"
        :title="menuLabel('Close Window', uiLanguage)"
        @click="desktopWindow.close()"
      >
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m1 1 10 10M11 1 1 11" /></svg>
      </button>
    </div>
  </nav>
</template>
