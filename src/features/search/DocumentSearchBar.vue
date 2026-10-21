<script setup>
import { t } from '../../i18n/index.mjs';
import {
  platform,
  AppButton,
  AppSearchField,
  AppSegmentedControl,
  AppSegment,
} from '../../ui/controls.mjs';
defineProps([
  'searchOpen',
  'pages',
  'nextSearch',
  'bindSearchInput',
  'showTranslations',
  'searchFailure',
  'searchBusy',
  'searchResults',
  'searchPageCount',
  'closeSearch',
]);
const searchQuery = defineModel('searchQuery');
const searchMode = defineModel('searchMode', { default: 'fuzzy' });
const modes = ['fuzzy', 'exact', 'regex'];
function moveMode(event) {
  const direction = getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1;
  const step = { ArrowRight: direction, ArrowLeft: -direction }[event.key];
  if (!step && event.key !== 'Home' && event.key !== 'End') return;
  event.preventDefault();
  const index =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? modes.length - 1
        : (modes.indexOf(searchMode.value) + step + modes.length) % modes.length;
  searchMode.value = modes[index];
  event.currentTarget.querySelectorAll('button')[index]?.focus();
}
</script>

<template>
  <Transition name="settings-motion">
    <form
      v-if="searchOpen && pages.length"
      class="document-search"
      role="search"
      @submit.prevent="nextSearch()"
    >
      <AppSearchField
        :ref="bindSearchInput"
        v-model="searchQuery"
        :placeholder="showTranslations ? t('search.searchTranslation') : t('search.searchOriginal')"
        :aria-label="t('search.documentText')"
        @keydown.enter.prevent="nextSearch($event.shiftKey ? -1 : 1)"
      />
      <div
        v-if="platform === 'darwin'"
        class="search-mode-control"
        role="group"
        :aria-label="t('search.mode')"
        @keydown="moveMode"
      >
        <button
          v-for="mode in modes"
          :key="mode"
          type="button"
          :aria-pressed="searchMode === mode"
          :tabindex="searchMode === mode ? 0 : -1"
          @click="searchMode = mode"
        >
          {{ t('search.' + mode) }}
        </button>
      </div>
      <AppSegmentedControl v-else v-model="searchMode" :aria-label="t('search.mode')">
        <AppSegment value="fuzzy">{{ t('search.fuzzy') }}</AppSegment>
        <AppSegment value="exact">{{ t('search.exact') }}</AppSegment>
        <AppSegment value="regex">{{ t('search.regex') }}</AppSegment>
      </AppSegmentedControl>
      <div class="search-results-row">
        <span class="search-count" role="status">{{
          searchFailure ||
          (searchBusy
            ? t('search.searching')
            : searchQuery.trim()
              ? searchResults.length
                ? t('search.foundPages', { count: searchPageCount })
                : t('search.noMatches')
              : '')
        }}</span>
        <div class="search-navigation" role="group" :aria-label="t('search.documentText')">
          <AppButton
            type="button"
            :aria-label="t('search.previousMatch')"
            :disabled="!searchResults.length"
            @click="nextSearch(-1)"
            ><svg viewBox="0 0 16 20" aria-hidden="true"><path d="m11 3-7 7 7 7" /></svg
          ></AppButton>
          <AppButton
            type="button"
            :aria-label="t('search.nextMatch')"
            :disabled="!searchResults.length"
            @click="nextSearch(1)"
            ><svg viewBox="0 0 16 20" aria-hidden="true"><path d="m5 3 7 7-7 7" /></svg
          ></AppButton>
        </div>
        <AppButton
          type="button"
          class="search-done"
          :aria-label="t('search.close')"
          @click="closeSearch()"
          >{{ t('search.done') }}</AppButton
        >
      </div>
    </form>
  </Transition>
</template>

<style scoped>
.document-search,
.document-search :deep(button),
.search-mode-control {
  -webkit-app-region: no-drag;
}
.search-mode-control {
  display: flex;
  gap: 2px;
  padding: 3px;
  min-height: 32px;
  box-sizing: border-box;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text, #1d1d1f) 7%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text, #1d1d1f) 5%, transparent);
  isolation: isolate;
}
.search-mode-control > button {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  min-height: 28px;
  padding: 4px 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary, #6e6e73);
  font:
    500 13px/1.25 -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  overflow-wrap: anywhere;
  cursor: default;
  pointer-events: auto;
}
.search-mode-control > button[aria-pressed='true'] {
  background: var(--chrome-solid, #fff);
  color: var(--text, #1d1d1f);
  box-shadow:
    0 1px 3px rgb(0 0 0 / 14%),
    inset 0 0 0 1px rgb(128 128 128 / 12%);
}
.search-mode-control > button:active {
  background: color-mix(in srgb, var(--text, #1d1d1f) 12%, var(--chrome-solid, #fff));
}
.search-mode-control > button:focus-visible {
  outline: 3px solid var(--macvue-focus-ring, Highlight);
  outline-offset: 2px;
}
@media (prefers-contrast: more) {
  .search-mode-control > button[aria-pressed='true'] {
    outline: 1px solid currentColor;
    outline-offset: -1px;
  }
}
</style>
