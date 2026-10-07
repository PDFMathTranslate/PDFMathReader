<script setup>
import { t } from '../../i18n/index.mjs';
import { AppButton, AppTextField } from '../../ui/controls.mjs';
defineProps([
  'navigatorVisible',
  'pages',
  'bindNavigator',
  'holdNavigator',
  'hideNavigatorLater',
  'toolbarHint',
  'changeZoom',
  'platform',
  'bindZoomInput',
  'zoom',
  'submitZoom',
  'zoomEntryInput',
  'active',
  'go',
  'submitPage',
  'bindPageInput',
]);
const zoomEntry = defineModel('zoomEntry');
const pageEntry = defineModel('pageEntry');
</script>

<template>
  <Transition name="navigator-motion"
    ><div
      v-if="navigatorVisible && pages.length"
      :ref="bindNavigator"
      class="reader-floating-tools"
      @pointerenter="holdNavigator"
      @pointerleave="hideNavigatorLater"
      @focusin="holdNavigator"
      @focusout="hideNavigatorLater"
    >
      <div class="floating-zoom" role="group" :aria-label="t('toolbar.zoom')">
        <AppButton
          class="icon-button"
          :title="toolbarHint(t('toolbar.zoomOut'), '−')"
          :aria-label="t('toolbar.zoomOut')"
          @click="changeZoom(-0.1)"
          ><span
            class="system-icon"
            aria-hidden="true"
            data-symbol="minus.magnifyingglass"
            style="--symbol: url('/symbols/minus.magnifyingglass.png')"
          ></span
        ></AppButton>
        <AppTextField
          v-if="platform === 'win32'"
          :ref="bindZoomInput"
          v-model="zoomEntry"
          class="zoom-popup scrub-input"
          data-scrub="zoom"
          size="small"
          inputmode="decimal"
          autocomplete="off"
          spellcheck="false"
          aria-label="Zoom percentage"
          :aria-valuenow="Math.round(zoom * 100)"
          aria-valuemin="10"
          aria-valuemax="400"
          :title="t('toolbar.chooseZoomPercentage')"
          @change="submitZoom"
          @focusout="submitZoom"
          @keydown.enter.prevent="submitZoom"
        />
        <input
          v-else
          :ref="bindZoomInput"
          class="zoom-popup scrub-input"
          data-scrub="zoom"
          :value="zoomEntry"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          spellcheck="false"
          aria-label="Zoom percentage"
          :aria-valuenow="Math.round(zoom * 100)"
          aria-valuemin="10"
          aria-valuemax="400"
          :title="t('toolbar.chooseZoomPercentage')"
          style="-webkit-app-region: no-drag"
          @input="zoomEntryInput"
          @change="submitZoom"
          @blur="submitZoom"
          @keydown.enter.prevent="submitZoom"
        /><AppButton
          class="icon-button"
          :title="toolbarHint(t('toolbar.zoomIn'), '=')"
          :aria-label="t('toolbar.zoomIn')"
          @click="changeZoom(0.1)"
          ><span
            class="system-icon"
            aria-hidden="true"
            data-symbol="plus.magnifyingglass"
            style="--symbol: url('/symbols/plus.magnifyingglass.png')"
          ></span
        ></AppButton>
      </div>
      <nav class="page-navigator" :aria-label="t('navigator.pageNavigator')">
        <component
          :is="platform === 'win32' ? AppButton : 'button'"
          :aria-label="t('navigator.previousPage')"
          :disabled="active <= 1"
          @click="go(active - 1, { animate: true })"
        >
          <span
            class="system-icon"
            aria-hidden="true"
            style="--symbol: url('/symbols/chevron.up.png')"
          ></span>
        </component>
        <form @submit.prevent="submitPage">
          <AppTextField
            v-if="platform === 'win32'"
            :ref="bindPageInput"
            v-model="pageEntry"
            class="scrub-input"
            data-scrub="page"
            size="small"
            inputmode="numeric"
            :aria-label="t('navigator.pageNumber')"
            @change="submitPage"
            @keydown.enter.prevent="submitPage"
          />
          <input
            v-else
            :ref="bindPageInput"
            v-model.number="pageEntry"
            class="scrub-input"
            data-scrub="page"
            :aria-label="t('navigator.pageNumber')"
            type="number"
            min="1"
            :max="pages.length"
            @change="submitPage"
          /><span>/ {{ pages.length }}</span>
        </form>
        <component
          :is="platform === 'win32' ? AppButton : 'button'"
          :aria-label="t('navigator.nextPage')"
          :disabled="active >= pages.length"
          @click="go(active + 1, { animate: true })"
        >
          <span
            class="system-icon"
            aria-hidden="true"
            style="--symbol: url('/symbols/chevron.down.png')"
          ></span>
        </component>
      </nav></div
  ></Transition>
</template>
