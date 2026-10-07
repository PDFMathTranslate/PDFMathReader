<script setup>
import { t } from '../../i18n/index.mjs';
import { AppButton, AppSearchField } from '../../ui/controls.mjs';
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
